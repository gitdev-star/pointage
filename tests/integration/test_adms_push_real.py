# tests/integration/test_adms_push_real.py
#
# CI check: does the ZKTeco ADMS push endpoint (/iclock/cdata) actually
# work end-to-end against the real database? Runs the same code path a
# physical device push hits — uses app.database.engine directly (NOT the
# sqlite conftest fixtures), because adms_routes.py's INSERT ... ON
# CONFLICT DO NOTHING is Postgres-specific and silently fails on sqlite.

import pytest
import asyncio
import zlib
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from httpx import AsyncClient, ASGITransport

from main import app
from app.database import engine
from app.models.attendance import Attendance
from app.models.device_sync import DeviceSyncState
from sync_service import is_push_active, PUSH_ACTIVE_WINDOW, sync_device_loop

TEST_SN = "CI_TEST_SN"
TEST_USER_ID = 900001  # reserved id, unlikely to collide with real data
TEST_IP = "203.0.113.99"  # TEST-NET-3, never a real device IP


def _attlog_line(user_id: int, ts: datetime) -> str:
    return f"{user_id}\t{ts.strftime('%Y-%m-%d %H:%M:%S')}\t0\t1\t0"


@pytest.fixture(autouse=True)
def _require_postgres():
    """Guards against conftest.py's DATABASE_URL sqlite fallback silently
    rebinding the real engine when DATABASE_URL isn't exported in the shell
    -- fails fast with a clear message instead of a confusing
    'no such table: attendance' error deep in fixture setup."""
    if engine.url.get_backend_name() != "postgresql":
        pytest.skip("test_adms_push_real.py requires DATABASE_URL pointed at real Postgres")


@pytest.fixture(autouse=True)
async def _dispose_engine_after_test():
    """Each pytest-asyncio test gets its own event loop by default; the
    shared app.database.engine's connection pool holds asyncpg connections
    bound to whichever loop was active when they were opened. Without this,
    the second test in this file reuses a pooled connection tied to the
    first test's already-closed loop -> RuntimeError: Event loop is closed.
    Disposing after every test forces fresh connections on the next test's
    loop."""
    yield
    await engine.dispose()


@pytest.fixture
async def real_session():
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        # clean slate before the test
        await session.execute(delete(Attendance).where(Attendance.user_id == TEST_USER_ID))
        await session.commit()
        yield session
        # clean up after
        await session.execute(delete(Attendance).where(Attendance.user_id == TEST_USER_ID))
        await session.commit()


@pytest.fixture
async def real_device_sync_state():
    """Same clean-slate pattern as real_session, but for DeviceSyncState —
    a stray row from a previous run would make the handshake/push-active
    tests pass or fail for the wrong reason."""
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        await session.execute(delete(DeviceSyncState).where(DeviceSyncState.sn == TEST_SN))
        await session.commit()
        yield session
        await session.execute(delete(DeviceSyncState).where(DeviceSyncState.sn == TEST_SN))
        await session.commit()


@pytest.fixture
async def real_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
@pytest.mark.integration
async def test_adms_push_inserts_a_real_row(real_client, real_session):
    """A device push must actually land a row in the real DB, not just
    return a 200 — the original bug (int32 overflow) returned 200 too."""
    ts = datetime.now().replace(microsecond=0)
    line = _attlog_line(TEST_USER_ID, ts)

    resp = await real_client.post(
        "/iclock/cdata",
        params={"SN": TEST_SN, "table": "ATTLOG"},
        content=line.encode("utf-8"),
    )
    assert resp.status_code == 200
    # NOT a row count — ZKTeco's ADMS protocol requires the literal string
    # "OK" for the device to consider the push acknowledged and advance its
    # queue. Replying with anything else (e.g. "1") was the second root
    # cause of the endless-retry bug; this is a regression guard for it.
    assert resp.text.strip() == "OK"

    result = await real_session.execute(
        select(Attendance).where(Attendance.user_id == TEST_USER_ID)
    )
    rows = result.scalars().all()
    assert len(rows) == 1, "push returned success but no row was actually inserted"
    # device_timestamp preserves exactly what the device sent — used for dedup only
    assert rows[0].device_timestamp == ts, "device_timestamp must preserve the raw device clock value"
    # timestamp is now server-generated (DB default now()) — must be tz-aware
    assert rows[0].timestamp.tzinfo is not None, "timestamp must be server-generated and tz-aware"
    assert 0 <= rows[0].uid <= 2_147_483_647  # regression guard for the int32 overflow bug


@pytest.mark.asyncio
@pytest.mark.integration
async def test_adms_push_dedupes_repeated_punch(real_client, real_session):
    """Devices retransmit the same punch (heartbeats/retries). A repeat
    push must not create a second row."""
    ts = datetime.now().replace(microsecond=0)
    line = _attlog_line(TEST_USER_ID, ts)

    await real_client.post("/iclock/cdata", params={"SN": TEST_SN, "table": "ATTLOG"}, content=line.encode())
    await real_client.post("/iclock/cdata", params={"SN": TEST_SN, "table": "ATTLOG"}, content=line.encode())

    result = await real_session.execute(
        select(Attendance).where(Attendance.user_id == TEST_USER_ID)
    )
    rows = result.scalars().all()
    assert len(rows) == 1, "duplicate push created a second row — dedup is broken"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_adms_push_timestamp_is_server_time_not_device_time(real_client, real_session):
    """Regression guard: timestamp must reflect when the SERVER received the
    push, not the device's own clock. device_timestamp is for dedup only.
    Simulate a drifted/wrong device clock and confirm timestamp doesn't
    follow it — this is the exact bug that produced rows where
    timestamp == device_timestamp in production before the fix."""
    drifted_device_time = datetime.now().replace(microsecond=0) - timedelta(hours=2)
    line = _attlog_line(TEST_USER_ID, drifted_device_time)

    before = datetime.now(timezone.utc)
    resp = await real_client.post(
        "/iclock/cdata",
        params={"SN": TEST_SN, "table": "ATTLOG"},
        content=line.encode("utf-8"),
    )
    after = datetime.now(timezone.utc)
    assert resp.status_code == 200

    result = await real_session.execute(
        select(Attendance).where(Attendance.user_id == TEST_USER_ID)
    )
    row = result.scalar_one()

    # device_timestamp must preserve exactly what the device sent, untouched
    assert row.device_timestamp == drifted_device_time

    # timestamp must be close to real server receive time...
    assert row.timestamp.tzinfo is not None, "timestamp must be tz-aware (server now())"
    assert before <= row.timestamp <= after, \
        "timestamp drifted from real server receive time — it may be reading the device clock again"

    # ...and clearly NOT equal to the drifted device time (the original bug)
    drift_seconds = abs((row.timestamp.replace(tzinfo=None) - row.device_timestamp).total_seconds())
    assert drift_seconds > 3600, \
        "timestamp matches device_timestamp — this is the exact production bug that was fixed"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_adms_push_dedup_still_keyed_on_device_timestamp(real_client, real_session):
    """Dedup must remain based on device_timestamp even though timestamp is
    now server-generated per request. Two pushes of the same device_timestamp
    must still collapse to one row, even though each push would generate a
    *different* server-side timestamp if it weren't deduped first."""
    device_time = datetime.now().replace(microsecond=0)
    line = _attlog_line(TEST_USER_ID, device_time)

    await real_client.post("/iclock/cdata", params={"SN": TEST_SN, "table": "ATTLOG"}, content=line.encode())
    await asyncio.sleep(1.1)  # ensure a real push would get a distinguishably different now()
    await real_client.post("/iclock/cdata", params={"SN": TEST_SN, "table": "ATTLOG"}, content=line.encode())

    result = await real_session.execute(
        select(Attendance).where(Attendance.user_id == TEST_USER_ID)
    )
    rows = result.scalars().all()
    assert len(rows) == 1, "same device_timestamp produced two rows — dedup broke once timestamp became server-generated"


# --------------------------------------------------
# DeviceSyncState / stamp persistence
# --------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.integration
async def test_handshake_echoes_none_for_unknown_device(real_client, real_device_sync_state):
    """A device with no prior push history has no confirmed stamp yet —
    handshake must report 'None' (the literal string ADMS expects), not
    crash and not fabricate a stamp."""
    resp = await real_client.get("/iclock/cdata", params={"SN": TEST_SN, "options": "all"})
    assert resp.status_code == 200
    assert "ATTLOGStamp=None" in resp.text


@pytest.mark.asyncio
@pytest.mark.integration
async def test_push_persists_stamp_and_push_time(real_client, real_session, real_device_sync_state):
    """This is the core regression test for the original bug: a push with
    a Stamp must be durably recorded so a later handshake can echo it back.
    Without this, the device concludes nothing was ever received and
    endlessly retries its oldest unconfirmed punch."""
    ts = datetime.now().replace(microsecond=0)
    line = _attlog_line(TEST_USER_ID, ts)

    resp = await real_client.post(
        "/iclock/cdata",
        params={"SN": TEST_SN, "table": "ATTLOG", "Stamp": "9999"},
        content=line.encode("utf-8"),
    )
    assert resp.status_code == 200

    result = await real_session.execute(
        select(DeviceSyncState).where(DeviceSyncState.sn == TEST_SN)
    )
    state = result.scalar_one_or_none()
    assert state is not None, "push did not create a device_sync_state row"
    assert state.last_stamp == "9999"
    assert state.last_push_at is not None
    age = datetime.now(timezone.utc) - state.last_push_at
    assert age < timedelta(seconds=30), "last_push_at wasn't set to roughly now"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_handshake_echoes_confirmed_stamp_after_push(real_client, real_device_sync_state):
    """End-to-end version of the original bug report: push a Stamp, then
    confirm the very next handshake echoes it back instead of hardcoded
    None. This is what actually stops the device's retry loop."""
    ts = datetime.now().replace(microsecond=0)
    line = _attlog_line(TEST_USER_ID, ts)

    await real_client.post(
        "/iclock/cdata",
        params={"SN": TEST_SN, "table": "ATTLOG", "Stamp": "12345"},
        content=line.encode("utf-8"),
    )

    resp = await real_client.get("/iclock/cdata", params={"SN": TEST_SN, "options": "all"})
    assert resp.status_code == 200
    assert "ATTLOGStamp=12345" in resp.text


@pytest.mark.asyncio
@pytest.mark.integration
async def test_push_without_stamp_does_not_clobber_existing_stamp(real_client, real_session, real_device_sync_state):
    """Some ADMS calls (e.g. table != ATTLOG, or malformed pushes) may not
    carry a Stamp. A push_state upsert must not blank out a previously
    confirmed stamp just because this particular request didn't include one."""
    ts = datetime.now().replace(microsecond=0)

    await real_client.post(
        "/iclock/cdata",
        params={"SN": TEST_SN, "table": "ATTLOG", "Stamp": "555"},
        content=_attlog_line(TEST_USER_ID, ts).encode("utf-8"),
    )
    await real_client.post(
        "/iclock/cdata",
        params={"SN": TEST_SN, "table": "ATTLOG"},  # no Stamp this time
        content=_attlog_line(TEST_USER_ID, ts + timedelta(minutes=1)).encode("utf-8"),
    )

    result = await real_session.execute(
        select(DeviceSyncState).where(DeviceSyncState.sn == TEST_SN)
    )
    state = result.scalar_one_or_none()
    assert state is not None
    assert state.last_stamp == "555", "a Stamp-less push wiped out the previously confirmed stamp"


# --------------------------------------------------
# Push-awareness (pull fallback gating)
# --------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.integration
async def test_is_push_active_true_immediately_after_push(real_client, real_device_sync_state):
    """sync_service.py's pull loop must stand down right after a push —
    this is what stops pull from contending with push for the device's
    connection slot."""
    ts = datetime.now().replace(microsecond=0)
    await real_client.post(
        "/iclock/cdata",
        params={"SN": TEST_SN, "table": "ATTLOG", "Stamp": "1"},
        content=_attlog_line(TEST_USER_ID, ts).encode("utf-8"),
    )

    # adms_routes stores device_ip from request.client.host, which under
    # ASGITransport is a test-client loopback address, not TEST_IP — so we
    # look it up by SN instead of asserting against a specific IP here.
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        result = await session.execute(
            select(DeviceSyncState.device_ip).where(DeviceSyncState.sn == TEST_SN)
        )
        ip = result.scalar_one()

    assert await is_push_active(ip) is True


@pytest.mark.asyncio
@pytest.mark.integration
async def test_is_push_active_false_when_stale(real_session, real_device_sync_state):
    """If the last push is older than PUSH_ACTIVE_WINDOW, pull must take
    back over — otherwise a device with a dead push connection would never
    get fallback coverage."""
    stale_time = datetime.now(timezone.utc) - timedelta(seconds=PUSH_ACTIVE_WINDOW + 60)
    await real_session.execute(
        DeviceSyncState.__table__.insert().values(
            sn=TEST_SN, device_ip=TEST_IP, last_stamp="1", last_push_at=stale_time,
        )
    )
    await real_session.commit()

    assert await is_push_active(TEST_IP) is False


@pytest.mark.asyncio
@pytest.mark.integration
async def test_is_push_active_false_for_unknown_device(real_device_sync_state):
    """A device that has never pushed (no device_sync_state row at all)
    must not be treated as push-active, or pull would never cover it."""
    assert await is_push_active("203.0.113.250") is False


# --------------------------------------------------
# Pull fallback (ZKReader mocked — see docstring)
# --------------------------------------------------

TEST_USER_ID_PULL = 900002  # separate id so this test can't collide with the push tests
TEST_IP_PULL = "203.0.113.101"  # TEST-NET-3, unused elsewhere in this file


@pytest.fixture
async def real_session_pull_cleanup():
    """Clean-slate for the rows the mocked ZKReader.process_logs() will
    insert during the pull-fallback test."""
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        await session.execute(delete(Attendance).where(Attendance.user_id == TEST_USER_ID_PULL))
        await session.commit()
        yield session
        await session.execute(delete(Attendance).where(Attendance.user_id == TEST_USER_ID_PULL))
        await session.commit()


@pytest.mark.asyncio
@pytest.mark.integration
async def test_pull_fallback_takes_over_and_inserts_via_zkreader(real_session_pull_cleanup):
    """When push has never been seen for a device, sync_device_loop must
    fall back to pull: reach the device, instantiate ZKReader with the
    right ip/port, and persist whatever process_logs() returns using the
    real DB session/commit path — not just call the SDK and drop the result.

    ZKReader itself is mocked: this is not a test of the ZK protocol, it's
    a test of our fallback control flow and DB write path. Real-device
    behavior (actual connect/process_logs correctness) needs a live device
    or a manual test against one.

    device_timestamp/date are set explicitly and the ON CONFLICT target
    matches the real unique constraint (user_id, device_timestamp, date) —
    timestamp itself is left to the column's server_default(now()), same
    as the real insert paths, rather than set manually here.
    """
    port = 4370
    inserted_row = {"called": False}

    async def fake_process_logs(db):
        device_ts = datetime.now().replace(microsecond=0)
        stmt = insert(Attendance.__table__).values(
            uid=zlib.crc32(b"pull-fallback-test") % 2147483647,
            user_id=TEST_USER_ID_PULL,
            device_timestamp=device_ts,
            date=device_ts.date(),
            device_ip=TEST_IP_PULL,
            # timestamp intentionally omitted — server_default now() fills it
        ).on_conflict_do_nothing(index_elements=["user_id", "device_timestamp", "date"])
        await db.execute(stmt)
        await db.commit()
        inserted_row["called"] = True
        return 1

    mock_zk_instance = AsyncMock()
    mock_zk_instance.process_logs.side_effect = fake_process_logs

    with patch("sync_service.is_reachable", new=AsyncMock(return_value=True)), \
         patch("sync_service.ZKReader") as mock_zk_class:
        mock_zk_class.return_value = mock_zk_instance

        task = asyncio.create_task(sync_device_loop(TEST_IP_PULL, port))
        try:
            for _ in range(20):
                if inserted_row["called"]:
                    break
                await asyncio.sleep(0.05)
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    assert inserted_row["called"], "pull fallback never ran process_logs — push-active check may be wrong"
    mock_zk_class.assert_called_with(device_ip=TEST_IP_PULL, device_port=port)
    mock_zk_instance.connect.assert_awaited()
    mock_zk_instance.force_reset.assert_awaited()

    result = await real_session_pull_cleanup.execute(
        select(Attendance).where(Attendance.user_id == TEST_USER_ID_PULL)
    )
    rows = result.scalars().all()
    assert len(rows) == 1, "pull fallback ran but didn't actually commit a row to Postgres"
    assert rows[0].timestamp.tzinfo is not None, "timestamp must be server-generated and tz-aware"