import os
# sync_service.py
# Runs separately from FastAPI
# Polls ZKTeco devices → writes to PostgreSQL
# Run with: python sync_service.py
import asyncio
import logging
import socket
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

import httpx

from app.database import AsyncSessionLocal, engine
from app.models.attendance import Base
from app.devices.zk_reader import ZKReader

# --------------------------------------------------
# CONFIG
# --------------------------------------------------
CLOCKERS_API_URL = os.getenv("DJANGO_AUTH_URL", "http://django-auth:8000/api/clockers/")
SYNC_INTERVAL        = 60    # seconds between syncs when active
IDLE_INTERVAL        = 120   # seconds between syncs when no new logs
DEVICE_STAGGER       = 10    # seconds between starting each device task

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SYNC] %(levelname)s - %(message)s"
)
logger = logging.getLogger("sync_service")

sync_tasks: Dict[str, asyncio.Task] = {}
device_locks: Dict[str, asyncio.Lock] = {}


# --------------------------------------------------
# HELPERS
# --------------------------------------------------
def get_lock(ip: str) -> asyncio.Lock:
    if ip not in device_locks:
        device_locks[ip] = asyncio.Lock()
    return device_locks[ip]


async def is_reachable(ip: str, port: int, timeout: int = 3) -> bool:
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None,
            lambda: socket.create_connection((ip, port), timeout)
        )
        return True
    except Exception:
        return False


async def fetch_active_devices() -> List[Tuple[str, int]]:
    """Fetch active ZK devices from Django API — same as sync_attendance.py."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(CLOCKERS_API_URL)
            resp.raise_for_status()
            devices = resp.json()
            active = [
                (d["ip_address"], d.get("port", 4370))
                for d in devices
                if d.get("is_active", True)
            ]
            logger.info(f"📡 Found {len(active)} active device(s)")
            return active
    except Exception as e:
        logger.error(f"❌ Failed to fetch device list: {e}")
        return []


# --------------------------------------------------
# CONTINUOUS SYNC LOOP PER DEVICE
# Uses zk_reader.process_logs() which already does:
# - fetch logs from device
# - chunked bulk insert (500/batch)
# - on_conflict_do_nothing (no duplicates)
# --------------------------------------------------
async def sync_device_loop(ip: str, port: int):
    """Runs forever for one device: connect → fetch → bulk insert → sleep → repeat."""
    lock = get_lock(ip)
    logger.info(f"[{ip}] 🔄 Starting sync loop")

    consecutive_errors = 0
    idle_cycles = 0

    while True:
        # Check reachability first to avoid long timeouts
        if not await is_reachable(ip, port):
            consecutive_errors += 1
            logger.warning(f"[{ip}] ⚠️  Unreachable [{consecutive_errors}], retrying in 30s")
            await asyncio.sleep(30)
            continue

        zk = ZKReader(device_ip=ip, device_port=port)

        try:
            # Connect
            async with lock:
                await zk.connect()

            # Fetch + bulk insert using zk_reader.process_logs()
            async with AsyncSessionLocal() as db:
                async with lock:
                    saved = await zk.process_logs(db)

            if saved and saved > 0:
                consecutive_errors = 0
                idle_cycles = 0
                logger.info(f"[{ip}] ✅ {saved} logs inserted")
            else:
                idle_cycles += 1
                logger.debug(f"[{ip}] No new logs (idle #{idle_cycles})")

            consecutive_errors = 0  # reset on successful cycle

        except Exception as e:
            consecutive_errors += 1
            logger.error(f"[{ip}] ❌ Error [{consecutive_errors}]: {e}")
            if consecutive_errors >= 10:
                logger.error(f"[{ip}] 🛑 Too many errors, stopping")
                break
        finally:
            # Always clean up device connection
            try:
                await zk.force_reset()
            except Exception:
                pass

        # Smart sleep: slow down when idle to reduce DB pressure
        sleep_time = IDLE_INTERVAL if idle_cycles >= 3 else SYNC_INTERVAL
        logger.debug(f"[{ip}] 💤 Next sync in {sleep_time}s")
        await asyncio.sleep(sleep_time)


# --------------------------------------------------
# RESET LOGIC
# --------------------------------------------------
async def reset_device(ip: str, port: int):
    """Daily reset: sync device time + clear old logs."""
    if not await is_reachable(ip, port):
        logger.warning(f"[RESET] {ip} unreachable, skipped")
        return

    lock = get_lock(ip)
    zk = ZKReader(device_ip=ip, device_port=port)

    async with lock:
        try:
            await zk.connect()
            await zk.sync_time()
            await zk.clear_attendance_logs()
            logger.info(f"[RESET] ✅ {ip} complete")
        except Exception as e:
            logger.error(f"[RESET] ❌ {ip} failed: {e}")
        finally:
            try:
                await zk.force_reset()
            except Exception:
                pass


async def daily_reset_loop():
    """Trigger device reset every day at 01:00."""
    while True:
        now = datetime.now()
        next_run = now.replace(hour=1, minute=0, second=0, microsecond=0)
        if now >= next_run:
            next_run += timedelta(days=1)
        wait = (next_run - now).total_seconds()
        logger.info(f"⏰ Daily reset in {wait / 3600:.1f}h")
        await asyncio.sleep(wait)
        logger.info("⏰ DAILY RESET STARTED")
        devices = await fetch_active_devices()
        for ip, port in devices:
            await reset_device(ip, port)
        logger.info("⏰ DAILY RESET DONE")


# --------------------------------------------------
# START ALL SYNC TASKS
# --------------------------------------------------
async def start_all_syncs():
    """Periodically re-fetch device list and start loops for new/restored devices."""
    while True:
        devices = await fetch_active_devices()
        if not devices:
            await asyncio.sleep(60)
            continue
        new_count = 0
        for idx, (ip, port) in enumerate(devices):
            task_name = f"sync_{ip}"
            if task_name in sync_tasks and not sync_tasks[task_name].done():
                continue
            if new_count > 0:
                await asyncio.sleep(DEVICE_STAGGER)
            task = asyncio.create_task(sync_device_loop(ip, port), name=task_name)
            sync_tasks[task_name] = task
            logger.info(f"▶️  [{ip}] Sync task started")
            new_count += 1
        if new_count:
            logger.info(f"✅ {len(sync_tasks)} sync task(s) running ({new_count} new)")
        await asyncio.sleep(300)  # re-check for new devices every 5 minutes

async def main():
    logger.info("=" * 50)
    logger.info("  ZKTeco Sync Service")
    logger.info(f"  Active sync : every {SYNC_INTERVAL}s")
    logger.info(f"  Idle sync   : every {IDLE_INTERVAL}s")
    logger.info("=" * 50)

    # Ensure DB tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database ready")

    await asyncio.gather(
        start_all_syncs(),
        daily_reset_loop(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Sync service stopped")
