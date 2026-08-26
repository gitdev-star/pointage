# ============================================================
# app/routers/adms_routes.py
# ============================================================
# Receives ZKTeco ADMS push traffic from MB360 clockers.
# Devices speak plain HTTP with query params + raw text bodies
# (NOT JSON). This router translates that into the same
# Attendance rows the pull path (zk_reader.process_logs) writes,
# using the identical on_conflict_do_nothing dedup so push and
# pull can never create duplicate records for the same punch.
#
# Wire format reference (ZKTeco ADMS / Push SDK):
#   GET  /iclock/cdata?SN=<serial>&options=all           -> device registration handshake on boot
#   POST /iclock/cdata?SN=<serial>&table=ATTLOG           -> attendance log push (body: one punch per line)
#   GET  /iclock/getrequest?SN=<serial>                   -> device polls for queued commands
#   POST /iclock/devicecmd?SN=<serial>                    -> device reports command execution results
#
# ATTLOG line format (tab-separated):
#   PIN\tTIME\tSTATUS\tVERIFY\tWORKCODE\t...(reserved fields, may vary by firmware)
#   e.g. "16\t2026-08-18 08:03:11\t0\t1\t0"
# ============================================================

# app/routers/adms_routes.py
import logging
import zlib
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Response, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import select

from app.database import get_async_db
from app.models.attendance import Attendance
from app.models.device_sync import DeviceSyncState

router = APIRouter(prefix="/iclock", tags=["adms"])
logger = logging.getLogger("uvicorn.error")

BATCH_SIZE = 500


# --------------------------------------------------
# STAMP HELPERS
# --------------------------------------------------
async def _get_last_stamp(db: AsyncSession, sn: str) -> str:
    result = await db.execute(
        select(DeviceSyncState.last_stamp).where(DeviceSyncState.sn == sn)
    )
    val = result.scalar()
    return val if val else "None"


async def _upsert_push_state(db: AsyncSession, sn: str, device_ip: str, stamp: str | None):
    """Record that this device pushed, and (if a Stamp was sent) confirm it."""
    now = datetime.now(timezone.utc)
    values = {"sn": sn, "device_ip": device_ip, "last_push_at": now}
    if stamp:
        values["last_stamp"] = stamp

    stmt = insert(DeviceSyncState.__table__).values(**values)
    update_cols = {"device_ip": device_ip, "last_push_at": now}
    if stamp:
        update_cols["last_stamp"] = stamp
    stmt = stmt.on_conflict_do_update(index_elements=["sn"], set_=update_cols)
    await db.execute(stmt)
    await db.commit()


# --------------------------------------------------
# ATTLOG PARSING (unchanged)
# --------------------------------------------------
def _parse_attlog_line(line: str) -> dict | None:
    line = line.strip()
    if not line:
        return None

    parts = line.split("\t")
    if len(parts) < 2:
        parts = line.split()
    if len(parts) < 2:
        return None

    pin_raw, time_raw = parts[0], parts[1]

    try:
        user_id = int(pin_raw)
    except ValueError:
        return None

    device_timestamp = None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            device_timestamp = datetime.strptime(time_raw, fmt)
            break
        except ValueError:
            continue
    if device_timestamp is None:
        return None

    uid = zlib.crc32(f"{user_id}-{device_timestamp.isoformat()}".encode()) % 2147483647

    return {
        "uid": uid,
        "user_id": user_id,
        "device_timestamp": device_timestamp,           # raw device value — dedup key
        "date": device_timestamp.date(),                 # calendar day from the device's own record
    }

async def _bulk_insert(db: AsyncSession, values: list[dict]) -> int:
    """Same on_conflict_do_nothing pattern — now returns REAL rowcount, not chunk size."""
    if not values:
        return 0
    total_inserted = 0
    try:
        for i in range(0, len(values), BATCH_SIZE):
            chunk = values[i:i + BATCH_SIZE]
            stmt = insert(Attendance.__table__).values(chunk)
            stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "device_timestamp", "date"])
            result = await db.execute(stmt)
            await db.commit()
            total_inserted += result.rowcount  # <-- fixed: was len(chunk)
        return total_inserted
    except Exception as e:
        logger.error(f"[ADMS] bulk insert failed: {e!r}", exc_info=True)
        await db.rollback()
        return 0


# --------------------------------------------------
# ROUTES
# --------------------------------------------------

@router.get("/cdata")
async def adms_handshake(
    request: Request,
    SN: str = "",
    options: str = "",
    db: AsyncSession = Depends(get_async_db),
):
    """
    Device registration handshake. Must echo the REAL last-confirmed
    stamp for this SN, or the device will assume nothing was ever
    received and endlessly retry its oldest unacknowledged record —
    blocking every punch queued behind it.
    """
    device_ip = request.client.host if request.client else "unknown"
    stamp = await _get_last_stamp(db, SN)
    logger.info(f"[ADMS] Handshake SN={SN} ip={device_ip} options={options} → ATTLOGStamp={stamp}")

    body = (
        "GET OPTION FROM: SERVER\n"
        f"ATTLOGStamp={stamp}\n"
        "OPERLOGStamp=None\n"
        "ErrorDelay=30\n"
        "Delay=10\n"
        "TransTimes=00:00;14:05\n"
        "TransInterval=1\n"
        "TransFlag=1111000000\n"
        "Realtime=1\n"
        "Encrypt=None\n"
    )
    return Response(content=body, media_type="text/plain")


@router.post("/cdata")
async def adms_receive_data(
    request: Request,
    SN: str = "",
    table: str = "",
    Stamp: str = "",
    db: AsyncSession = Depends(get_async_db),
):
    device_ip = request.client.host if request.client else "unknown"
    raw_body = (await request.body()).decode("utf-8", errors="replace")

    if table.upper() != "ATTLOG":
        logger.info(f"[ADMS] Ignoring table={table} from SN={SN} ip={device_ip} (not handled)")
        return Response(content="OK", media_type="text/plain")

    lines = raw_body.splitlines()
    values = []
    skipped = 0
    for line in lines:
        parsed = _parse_attlog_line(line)
        if parsed is None:
            skipped += 1
            continue
        parsed["device_ip"] = device_ip
        values.append(parsed)

    inserted = await _bulk_insert(db, values)
    await _upsert_push_state(db, SN, device_ip, Stamp)

    # NEW: pull out user_ids for live visibility in logs
    user_ids = [v["user_id"] for v in values]

    logger.info(
        f"[ADMS] SN={SN} ip={device_ip} table=ATTLOG "
        f"received={len(lines)} parsed={len(values)} skipped={skipped} "
        f"new_rows={inserted} stamp={Stamp or 'none'} "
        f"user_ids={user_ids}"
    )

    return Response(content="OK", media_type="text/plain")


@router.get("/getrequest")
async def adms_get_request(request: Request, SN: str = ""):
    device_ip = request.client.host if request.client else "unknown"
    logger.debug(f"[ADMS] getrequest poll from SN={SN} ip={device_ip}")
    return Response(content="OK", media_type="text/plain")


@router.post("/devicecmd")
async def adms_device_cmd_result(request: Request, SN: str = ""):
    raw_body = (await request.body()).decode("utf-8", errors="replace")
    logger.info(f"[ADMS] devicecmd result from SN={SN}: {raw_body[:200]}")
    return Response(content="OK", media_type="text/plain")