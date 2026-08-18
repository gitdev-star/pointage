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

import logging
import zlib
from datetime import datetime

from fastapi import APIRouter, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from fastapi import Depends

from app.database import get_async_db
from app.models.attendance import Attendance

router = APIRouter(prefix="/iclock", tags=["adms"])

logger = logging.getLogger("uvicorn.error")  # same docker logs stream as devices.py

BATCH_SIZE = 500


# --------------------------------------------------
# HELPERS
# --------------------------------------------------
def _parse_attlog_line(line: str) -> dict | None:
    """
    Parse a single ADMS ATTLOG line into an Attendance-ready dict.
    Mirrors zk_reader.process_logs()'s field mapping:
      - user_id = device PIN (int)
      - uid     = synthesized fallback (ADMS ATTLOG never carries a
                  separate internal uid counter the way pull's SDK does,
                  so we always use the same synthesis pull falls back to)
    Returns None for malformed/unparseable lines (skipped, not fatal).
    """
    line = line.strip()
    if not line:
        return None

    parts = line.split("\t")
    if len(parts) < 2:
        # some firmwares send space-separated instead of tab-separated
        parts = line.split()
    if len(parts) < 2:
        return None

    pin_raw, time_raw = parts[0], parts[1]

    try:
        user_id = int(pin_raw)
    except ValueError:
        return None

    timestamp = None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            timestamp = datetime.strptime(time_raw, fmt)
            break
        except ValueError:
            continue
    if timestamp is None:
        return None

    # uid column is a Postgres INTEGER (32-bit signed, max ~2.1e9).
    # ADMS never provides a device-side uid, so we synthesize one that's
    # deterministic and always fits the column, instead of naive string
    # concatenation (which overflows int32 almost immediately).
    uid = zlib.crc32(f"{user_id}-{timestamp.isoformat()}".encode()) % 2147483647

    return {
        "uid": uid,
        "user_id": user_id,
        "timestamp": timestamp,
        "date": timestamp.date(),
        # device_ip set by caller from request.client.host
    }


async def _bulk_insert(db: AsyncSession, values: list[dict]) -> int:
    """Same on_conflict_do_nothing bulk insert pattern as zk_reader.process_logs()."""
    if not values:
        return 0
    total_inserted = 0
    try:
        for i in range(0, len(values), BATCH_SIZE):
            chunk = values[i:i + BATCH_SIZE]
            stmt = insert(Attendance.__table__).values(chunk)
            stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "timestamp", "date"])
            await db.execute(stmt)
            await db.commit()
            total_inserted += len(chunk)
        return total_inserted
    except Exception as e:
        logger.error(f"[ADMS] bulk insert failed: {e!r}", exc_info=True)
        await db.rollback()
        return 0


# --------------------------------------------------
# ROUTES
# --------------------------------------------------

@router.get("/cdata")
async def adms_handshake(request: Request, SN: str = "", options: str = ""):
    """
    Device registration handshake, sent on boot and periodically.
    Must return plain text (not JSON) or the device treats it as a
    protocol error and will not proceed to push data.
    Minimal accepted response tells the device its config is fine
    and to use the default push intervals.
    """
    device_ip = request.client.host if request.client else "unknown"
    logger.info(f"[ADMS] Handshake from SN={SN} ip={device_ip} options={options}")

    body = (
        "GET OPTION FROM: SERVER\n"
        "ATTLOGStamp=None\n"
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
    db: AsyncSession = Depends(get_async_db),
):
    """
    Device pushes attendance/operation logs here.
    Body is raw text, one record per line (NOT JSON).
    Only ATTLOG (attendance punches) is handled for now — OPERLOG
    (user/enrollment changes) is acknowledged but not persisted,
    since there's no corresponding table yet.
    """
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
    logger.info(
        f"[ADMS] SN={SN} ip={device_ip} table=ATTLOG "
        f"received={len(lines)} parsed={len(values)} skipped={skipped} inserted_batch={inserted}"
    )

    # Device expects the count of records it sent back, as plain text
    return Response(content=str(len(values)), media_type="text/plain")


@router.get("/getrequest")
async def adms_get_request(request: Request, SN: str = ""):
    """
    Device polls this to check for queued commands (e.g. remote user
    delete, clear log). No command queue is implemented yet, so this
    always returns OK (no pending commands).
    """
    device_ip = request.client.host if request.client else "unknown"
    logger.debug(f"[ADMS] getrequest poll from SN={SN} ip={device_ip}")
    return Response(content="OK", media_type="text/plain")


@router.post("/devicecmd")
async def adms_device_cmd_result(request: Request, SN: str = ""):
    """
    Device reports the result of a previously queued command.
    No-op until a command queue exists — just acknowledge so the
    device doesn't retry indefinitely.
    """
    raw_body = (await request.body()).decode("utf-8", errors="replace")
    logger.info(f"[ADMS] devicecmd result from SN={SN}: {raw_body[:200]}")
    return Response(content="OK", media_type="text/plain")