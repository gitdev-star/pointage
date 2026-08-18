# tests/integration/test_adms_push_real.py
#
# CI check: does the ZKTeco ADMS push endpoint (/iclock/cdata) actually
# work end-to-end against the real database? Runs the same code path a
# physical device push hits — uses app.database.engine directly (NOT the
# sqlite conftest fixtures), because adms_routes.py's INSERT ... ON
# CONFLICT DO NOTHING is Postgres-specific and silently fails on sqlite.

import pytest
from datetime import datetime
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from httpx import AsyncClient, ASGITransport

from main import app
from app.database import engine
from app.models.attendance import Attendance

TEST_SN = "CI_TEST_SN"
TEST_USER_ID = 900001  # reserved id, unlikely to collide with real data


def _attlog_line(user_id: int, ts: datetime) -> str:
    return f"{user_id}\t{ts.strftime('%Y-%m-%d %H:%M:%S')}\t0\t1\t0"


from main import app
from app.database import engine
from app.models.attendance import Attendance

TEST_SN = "CI_TEST_SN"
TEST_USER_ID = 900001  # reserved id, unlikely to collide with real data


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
    assert resp.text.strip() == "1"

    result = await real_session.execute(
        select(Attendance).where(Attendance.user_id == TEST_USER_ID)
    )
    rows = result.scalars().all()
    assert len(rows) == 1, "push returned success but no row was actually inserted"
    assert rows[0].timestamp == ts
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