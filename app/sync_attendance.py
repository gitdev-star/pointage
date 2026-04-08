import asyncio
import logging
from datetime import datetime
from typing import List, Optional

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.devices.zk_reader import ZKReader
from app.models.attendance import Attendance

logger = logging.getLogger(__name__)

CLOCKERS_API_URL = "http://127.0.0.1:8000/api/clockers/"


# ------------------------------------------------------------------
# Device list
# ------------------------------------------------------------------

async def fetch_active_devices() -> List[tuple[str, int]]:
    """Fetch active ZK devices from Django API"""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(CLOCKERS_API_URL)
        resp.raise_for_status()

        devices = resp.json()
        return [
            (d["ip_address"], d.get("port", 4370))
            for d in devices
            if d.get("is_active", True)
        ]


# ------------------------------------------------------------------
# Core processing
# ------------------------------------------------------------------

async def process_device(
    device_ip: str,
    device_port: int,
    date_filter: datetime,
) -> Optional[dict]:
    """Fetch + save attendance for a single device"""
    zk = ZKReader(device_ip=device_ip, device_port=device_port)

    try:
        logs = await zk.fetch_attendance_logs(date_filter)

        if not logs:
            logger.info(f"[{device_ip}] No logs for today")
            return None

        async with AsyncSessionLocal() as db:
            saved = await save_attendance_logs(
                logs=logs,
                db=db,
                device_ip=device_ip
            )

        logger.info(f"[{device_ip}] Saved {saved} records")
        return None

    except Exception as e:
        logger.error(f"[{device_ip}] Processing error: {e}")
        return {"device_ip": device_ip, "error": str(e)}

    finally:
        await zk.force_reset()


# ------------------------------------------------------------------
# Save logic
# ------------------------------------------------------------------

async def save_attendance_logs(
    logs: List,
    db: AsyncSession,
    device_ip: str
) -> int:
    saved = 0

    for log in logs:
        try:
            if not hasattr(log, "user_id") or not hasattr(log, "timestamp"):
                continue

            uid = getattr(log, "uid", None) or int(
                f"{log.user_id}{int(log.timestamp.timestamp())}"
            )

            await Attendance.insert_attendance(
                session=db,
                uid=int(uid),
                user_id=int(log.user_id),
                timestamp=log.timestamp,
                date=log.timestamp.date(),
                device_ip=device_ip,
            )
            saved += 1

        except Exception as e:
            logger.warning(f"[{device_ip}] Failed record: {e}")

    await db.commit()
    return saved


# ------------------------------------------------------------------
# Public sync entry
# ------------------------------------------------------------------

async def sync_attendance() -> dict:
    """Triggered manually or by scheduler"""
    today = datetime.now()
    devices = await fetch_active_devices()

    if not devices:
        raise HTTPException(status_code=400, detail="No active devices found")

    logger.info(f"Starting sync for {len(devices)} devices")

    tasks = [
        process_device(ip, port, today)
        for ip, port in devices
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    success = 0
    errors = []

    for i, r in enumerate(results):
        if isinstance(r, dict):
            errors.append(r)
        else:
            success += 1

    return {
        "total_devices": len(devices),
        "successful_devices": success,
        "failed_devices": len(errors),
        "errors": errors or None,
    }
