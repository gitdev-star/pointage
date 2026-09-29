# import os
# # sync_service.py
# # Runs separately from FastAPI
# # Polls ZKTeco devices → writes to PostgreSQL
# # Run with: python sync_service.py
# import asyncio
# import logging
# import socket
# from datetime import datetime, timedelta
# from typing import Dict, List, Tuple
# from sqlalchemy import text

# import httpx

# from app.database import AsyncSessionLocal, init_db
# from app.devices.zk_reader import ZKReader
# import sentry_sdk
# from sentry_sdk.integrations.logging import LoggingIntegration
# from sqlalchemy import select
# from app.models.device_sync import DeviceSyncState

# # --------------------------------------------------
# # CONFIG
# # --------------------------------------------------
# CLOCKERS_API_URL = os.getenv("DJANGO_AUTH_URL", "http://django-auth:8000/api/clockers/")
# SYNC_INTERVAL        = 60    # seconds between syncs when active
# IDLE_INTERVAL        = 120   # seconds between syncs when no new logs
# DEVICE_STAGGER       = 10    # seconds between starting each device task
# HOURLY_SYNC_INTERVAL  = 3600  # seconds — 1 hour, for clock sync

# # --------------------------------------------------
# # PUSH-AWARENESS
# # --------------------------------------------------
# PUSH_ACTIVE_WINDOW = 300   # seconds — if device pushed within this window, treat push as healthy
# PUSH_BACKOFF_SLEEP = 180   # seconds — how long to wait before re-checking when push is healthy

# async def is_push_active(ip: str) -> bool:
#     """True if this device has pushed data recently — pull should stand down."""
#     async with AsyncSessionLocal() as db:
#         result = await db.execute(
#             select(DeviceSyncState.last_push_at).where(DeviceSyncState.device_ip == ip)
#         )
#         last_push = result.scalar()
#         if last_push is None:
#             return False
#         age = (datetime.utcnow().replace(tzinfo=last_push.tzinfo) - last_push).total_seconds()
#         return age < PUSH_ACTIVE_WINDOW




# logging.basicConfig(
#     level=logging.DEBUG,
#     format="%(asctime)s [SYNC] %(levelname)s - %(message)s"
# )

# # Silence noisy third-party library internals while keeping our own code at DEBUG
# for noisy_logger in ("httpx", "httpcore", "asyncio", "urllib3"):
#     logging.getLogger(noisy_logger).setLevel(logging.WARNING)
# logger = logging.getLogger("sync_service")

# # --------------------------------------------------
# # GLITCHTIP / SENTRY
# # --------------------------------------------------
# # By default, sentry_sdk auto-attaches a LoggingIntegration that turns every
# # logger.error(...) call into a Glitchtip ISSUE. This service logs expected,
# # transient stuff as errors (device unreachable, one-off sync failure, etc.),
# # so we override that integration to stop auto-creating issues from logs.
# # The heartbeat loop below still confirms liveness independently.
# sentry_logging = LoggingIntegration(
#     level=logging.INFO,   # still attached as breadcrumbs if an event IS sent
#     event_level=None,     # <- disables auto-capture of ERROR logs as issues
# )

# GLITCHTIP_DSN = os.getenv("GLITCHTIP_DSN")
# if GLITCHTIP_DSN:
#     sentry_sdk.init(
#         dsn=GLITCHTIP_DSN,
#         environment="sync",
#         ca_certs="/etc/ssl/glitchtip/fullchain.pem",
#         enable_logs=True,
#         integrations=[sentry_logging],
#     )
#     logger.info("Glitchtip configured (log-based issue auto-capture disabled)")

# sync_tasks: Dict[str, asyncio.Task] = {}
# device_locks: Dict[str, asyncio.Lock] = {}


# # --------------------------------------------------
# # HELPERS
# # --------------------------------------------------
# def get_lock(ip: str) -> asyncio.Lock:
#     if ip not in device_locks:
#         device_locks[ip] = asyncio.Lock()
#     return device_locks[ip]


# async def is_reachable(ip: str, port: int, timeout: int = 3) -> bool:
#     loop = asyncio.get_running_loop()
#     try:
#         await loop.run_in_executor(
#             None,
#             lambda: socket.create_connection((ip, port), timeout)
#         )
#         return True
#     except Exception:
#         return False


# async def fetch_active_devices() -> List[Tuple[str, int]]:
#     """Fetch active ZK devices from Django API — same as sync_attendance.py."""
#     try:
#         async with httpx.AsyncClient(timeout=10) as client:
#             resp = await client.get(CLOCKERS_API_URL)
#             resp.raise_for_status()
#             devices = resp.json()
#             active = [
#                 (d["ip_address"], d.get("port", 4370))
#                 for d in devices
#                 if d.get("is_active", True)
#             ]
#             logger.info(f"📡 Found {len(active)} active device(s)")
#             return active
#     except Exception as e:
#         logger.error(f"❌ Failed to fetch device list: {e}")
#         return []


# # --------------------------------------------------
# # CONTINUOUS SYNC LOOP PER DEVICE
# # Uses zk_reader.process_logs() which already does:
# # - fetch logs from device
# # - chunked bulk insert (500/batch)
# # - on_conflict_do_nothing (no duplicates)
# # --------------------------------------------------
# async def sync_device_loop(ip: str, port: int):
#     """Runs forever for one device: connect → fetch → bulk insert → sleep → repeat.
#     Backs off entirely while push is confirmed healthy for this device —
#     pull only takes over as a fallback if push goes quiet."""
#     lock = get_lock(ip)
#     logger.info(f"[{ip}] 🔄 Starting sync loop (fallback mode)")

#     consecutive_errors = 0
#     idle_cycles = 0

#     while True:
#         # NEW: if push is alive for this device, don't contend for the socket at all
#         if await is_push_active(ip):
#             logger.debug(f"[{ip}] 💤 Push active — pull standing down for {PUSH_BACKOFF_SLEEP}s")
#             await asyncio.sleep(PUSH_BACKOFF_SLEEP)
#             continue

#         logger.info(f"[{ip}] ⚠️  No recent push seen — pull taking over as fallback")

#         if not await is_reachable(ip, port):
#             consecutive_errors += 1
#             logger.warning(f"[{ip}] ⚠️  Unreachable [{consecutive_errors}], retrying in 30s")
#             await asyncio.sleep(30)
#             continue

#         zk = ZKReader(device_ip=ip, device_port=port)

#         try:
#             async with lock:
#                 await zk.connect()

#             async with AsyncSessionLocal() as db:
#                 async with lock:
#                     saved = await zk.process_logs(db)

#             if saved and saved > 0:
#                 consecutive_errors = 0
#                 idle_cycles = 0
#                 logger.debug(f"[{ip}] ✅ {saved} logs inserted via fallback pull")
#             else:
#                 idle_cycles += 1
#                 logger.debug(f"[{ip}] No new logs via pull (idle #{idle_cycles})")

#             consecutive_errors = 0

#         except Exception as e:
#             consecutive_errors += 1
#             logger.error(f"[{ip}] ❌ Error [{consecutive_errors}]: {e}")
#             if consecutive_errors >= 10:
#                 logger.error(f"[{ip}] 🛑 Too many errors, stopping")
#                 break
#         finally:
#             try:
#                 await zk.force_reset()
#             except Exception as e:
#                 logger.debug(f"[{ip}] force_reset cleanup failed (non-fatal): {e}")

#         sleep_time = IDLE_INTERVAL if idle_cycles >= 3 else SYNC_INTERVAL
#         logger.debug(f"[{ip}] 💤 Next check in {sleep_time}s")
#         await asyncio.sleep(sleep_time)
# # --------------------------------------------------
# # RESET LOGIC
# # --------------------------------------------------
# async def reset_device(ip: str, port: int, reference_time: datetime):
#     """Daily reset: sync device time + clear old logs."""
#     if not await is_reachable(ip, port):
#         logger.warning(f"[RESET] {ip} unreachable, skipped")
#         return

#     lock = get_lock(ip)
#     zk = ZKReader(device_ip=ip, device_port=port)

#     async with lock:
#         try:
#             await zk.connect()
#             await zk.sync_time(reference_time)
#             await zk.clear_attendance_logs()
#             logger.info(f"[RESET] ✅ {ip} complete")
#         except Exception as e:
#             logger.error(f"[RESET] ❌ {ip} failed: {e}")
#         finally:
#             try:
#                 await zk.force_reset()
#             except Exception as e:
#                 logger.debug(f"[{ip}] force_reset cleanup failed (non-fatal): {e}")


# async def sync_device_time_only(ip: str, port: int, reference_time: datetime):
#     """Time-sync a single device, without touching its attendance logs."""
#     if not await is_reachable(ip, port):
#         logger.warning(f"[TIME_SYNC] {ip} unreachable, skipped")
#         return

#     lock = get_lock(ip)
#     zk = ZKReader(device_ip=ip, device_port=port)

#     async with lock:
#         try:
#             await zk.connect()
#             await zk.sync_time(reference_time)
#             logger.info(f"[TIME_SYNC] ✅ {ip} synced")
#         except Exception as e:
#             logger.error(f"[TIME_SYNC] ❌ {ip} failed: {e}")
#         finally:
#             try:
#                 await zk.force_reset()
#             except Exception as e:
#                 logger.debug(f"[{ip}] force_reset cleanup failed (non-fatal): {e}")


# async def hourly_time_sync_loop():
#     """Sync every device's clock to the DB server's time, once per hour.

#     DISABLED: clock sync is now owned by clocker-time-daemon.service.
#     Keeping this in-code loop active caused write contention with the
#     systemd daemon (both writing device time in the same ~30-40s window),
#     producing large random clock drift. This coroutine is kept as a
#     no-op so it can stay in the existing gather()/task list without
#     touching the call site.
#     """
#     logger.info("⏱️  HOURLY TIME SYNC DISABLED — clock sync owned by clocker-time-daemon.service")
#     while True:
#         await asyncio.sleep(3600)


# async def daily_reset_loop():
#     """Trigger device reset every day at 01:00."""
#     while True:
#         now = datetime.now()
#         next_run = now.replace(hour=1, minute=0, second=0, microsecond=0)
#         if now >= next_run:
#             next_run += timedelta(days=1)
#         wait = (next_run - now).total_seconds()
#         logger.info(f"⏰ Daily reset in {wait / 3600:.1f}h")
#         await asyncio.sleep(wait)
#         logger.info("⏰ DAILY RESET STARTED")

#         reference_time = await get_reference_time()
#         devices = await fetch_active_devices()
#         for ip, port in devices:
#             await reset_device(ip, port, reference_time)

#         logger.info("⏰ DAILY RESET DONE")


# # --------------------------------------------------
# # START ALL SYNC TASKS
# # --------------------------------------------------
# async def start_all_syncs():
#     """Periodically re-fetch device list and start loops for new/restored devices."""
#     while True:
#         devices = await fetch_active_devices()
#         if not devices:
#             await asyncio.sleep(60)
#             continue
#         new_count = 0
#         for idx, (ip, port) in enumerate(devices):
#             task_name = f"sync_{ip}"
#             if task_name in sync_tasks and not sync_tasks[task_name].done():
#                 continue
#             if new_count > 0:
#                 await asyncio.sleep(DEVICE_STAGGER)
#             task = asyncio.create_task(sync_device_loop(ip, port), name=task_name)
#             sync_tasks[task_name] = task
#             logger.info(f"▶️  [{ip}] Sync task started")
#             new_count += 1
#         if new_count:
#             logger.info(f"✅ {len(sync_tasks)} sync task(s) running ({new_count} new)")
#         await asyncio.sleep(300)  # re-check for new devices every 5 minutes


# async def get_reference_time() -> datetime:
#     """
#     Authoritative time for device sync, sourced directly from the
#     PostgreSQL server (192.168.8.211) via SQL NOW() — not a separate
#     NTP query. Guarantees the devices match whatever clock the
#     database itself is already using for all its own timestamps.
#     """
#     try:
#         async with AsyncSessionLocal() as db:
#             result = await db.execute(text("SELECT NOW()"))
#             ref_time = result.scalar()
#             # Postgres returns a tz-aware datetime; ZK devices expect naive local time
#             ref_time = ref_time.replace(tzinfo=None)
#             logger.info(f"⏱️  Reference time from DB (192.168.8.211): {ref_time}")
#             return ref_time
#     except Exception as e:
#         logger.warning(f"⏱️  DB time query failed ({e!r}), using local clock as fallback")
#         return datetime.now()


# # --------------------------------------------------
# # GLITCHTIP HEARTBEAT MONITOR
# # --------------------------------------------------
# HEARTBEAT_URL = os.getenv("GLITCHTIP_HEARTBEAT_URL")

# async def heartbeat_loop():
#     if not HEARTBEAT_URL:
#         logger.warning("GLITCHTIP_HEARTBEAT_URL not set — heartbeat disabled")
#         return
#     async with httpx.AsyncClient(verify=False, timeout=10) as client:
#         while True:
#             try:
#                 await client.post(HEARTBEAT_URL)
#                 logger.debug("💓 Heartbeat sent to Glitchtip")
#             except Exception as e:
#                 logger.warning(f"Heartbeat failed: {e}")
#             await asyncio.sleep(120)


# async def main():
#     logger.info("=" * 50)
#     logger.info("  ZKTeco Sync Service")
#     logger.info(f"  Active sync : every {SYNC_INTERVAL}s")
#     logger.info(f"  Idle sync   : every {IDLE_INTERVAL}s")
#     logger.info("=" * 50)

#     # Ensure DB tables exist
#     await init_db()
#     logger.info("✅ Database ready")
#     await asyncio.gather(
#         start_all_syncs(),
#         hourly_time_sync_loop(),
#         daily_reset_loop(),
#         heartbeat_loop(),
#     )



# if __name__ == "__main__":
#     try:
#         asyncio.run(main())
#     except KeyboardInterrupt:
#         logger.info("🛑 Sync service stopped")









#-----------------------------------------------------------------------------------------------


import os
# sync_service.py
# Runs separately from FastAPI
# Polls ZKTeco devices → writes to PostgreSQL
# Run with: python sync_service.py
import asyncio
import logging
import socket
from datetime import datetime, timedelta
from typing import Dict, List
from itertools import groupby
from sqlalchemy import text, select, update

import httpx

from app.database import AsyncSessionLocal, init_db
from app.devices.zk_reader import ZKReader
from app.models.attendance import Attendance
import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration
from app.models.device_sync import DeviceSyncState

# --------------------------------------------------
# CONFIG
# --------------------------------------------------
CLOCKERS_API_URL = os.getenv("DJANGO_AUTH_URL", "http://django-auth:8000/api/clockers/")
SYNC_INTERVAL        = 60    # seconds between syncs when active
IDLE_INTERVAL        = 120   # seconds between syncs when no new logs
DEVICE_STAGGER       = 10    # seconds between starting each device task
HOURLY_SYNC_INTERVAL  = 3600  # seconds — 1 hour, for clock sync

# ── NOUVEAU : détection permission en heure ────────────────────────────
LEAVES_AUTO_PERMISSION_URL = os.getenv(
    "LEAVES_AUTO_PERMISSION_URL",
    "http://django-hr:8002/api/leaves/requests/auto-permission/",
)
INTERNAL_SYNC_API_KEY = os.getenv("INTERNAL_SYNC_API_KEY", "")
PERMISSION_LOOKBACK_DAYS = 1     # fenêtre de recherche des pointages à traiter
PERMISSION_DETECTION_INTERVAL = 20   # secondes — indépendant du cycle push/pull
PERMISSION_PULL_INTERVAL = 15        # secondes — pull dédié, rapide, pour ce device seul

# --------------------------------------------------
# PUSH-AWARENESS
# --------------------------------------------------
PUSH_ACTIVE_WINDOW = 300   # seconds — if device pushed within this window, treat push as healthy
PUSH_BACKOFF_SLEEP = 180   # seconds — how long to wait before re-checking when push is healthy

async def is_push_active(ip: str) -> bool:
    """True if this device has pushed data recently — pull should stand down."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(DeviceSyncState.last_push_at).where(DeviceSyncState.device_ip == ip)
        )
        last_push = result.scalar()
        if last_push is None:
            return False
        age = (datetime.utcnow().replace(tzinfo=last_push.tzinfo) - last_push).total_seconds()
        return age < PUSH_ACTIVE_WINDOW




logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [SYNC] %(levelname)s - %(message)s"
)

# Silence noisy third-party library internals while keeping our own code at DEBUG
for noisy_logger in ("httpx", "httpcore", "asyncio", "urllib3"):
    logging.getLogger(noisy_logger).setLevel(logging.WARNING)
logger = logging.getLogger("sync_service")

# --------------------------------------------------
# GLITCHTIP / SENTRY
# --------------------------------------------------
sentry_logging = LoggingIntegration(
    level=logging.INFO,   # still attached as breadcrumbs if an event IS sent
    event_level=None,     # <- disables auto-capture of ERROR logs as issues
)

GLITCHTIP_DSN = os.getenv("GLITCHTIP_DSN")
if GLITCHTIP_DSN:
    sentry_sdk.init(
        dsn=GLITCHTIP_DSN,
        environment="sync",
        ca_certs="/etc/ssl/glitchtip/fullchain.pem",
        enable_logs=True,
        integrations=[sentry_logging],
    )
    logger.info("Glitchtip configured (log-based issue auto-capture disabled)")

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


async def fetch_active_devices() -> List[dict]:
    """Fetch active ZK devices from Django API.
    Retourne des dicts (pas des tuples) pour porter is_permission_clocker
    en plus de ip_address/port — tous les appelants ont été adaptés."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(CLOCKERS_API_URL)
            resp.raise_for_status()
            devices = resp.json()
            active = [
                {
                    "ip_address": d["ip_address"],
                    "port": d.get("port", 4370),
                    "is_permission_clocker": d.get("is_permission_clocker", False),
                }
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
    """Runs forever for one device: connect → fetch → bulk insert → sleep → repeat.
    Backs off entirely while push is confirmed healthy for this device —
    pull only takes over as a fallback if push goes quiet."""
    lock = get_lock(ip)
    logger.info(f"[{ip}] 🔄 Starting sync loop (fallback mode)")

    consecutive_errors = 0
    idle_cycles = 0

    while True:
        if await is_push_active(ip):
            logger.debug(f"[{ip}] 💤 Push active — pull standing down for {PUSH_BACKOFF_SLEEP}s")
            await asyncio.sleep(PUSH_BACKOFF_SLEEP)
            continue

        logger.info(f"[{ip}] ⚠️  No recent push seen — pull taking over as fallback")

        if not await is_reachable(ip, port):
            consecutive_errors += 1
            logger.warning(f"[{ip}] ⚠️  Unreachable [{consecutive_errors}], retrying in 30s")
            await asyncio.sleep(30)
            continue

        zk = ZKReader(device_ip=ip, device_port=port)

        try:
            async with lock:
                await zk.connect()

            async with AsyncSessionLocal() as db:
                async with lock:
                    saved = await zk.process_logs(db)

            if saved and saved > 0:
                consecutive_errors = 0
                idle_cycles = 0
                logger.debug(f"[{ip}] ✅ {saved} logs inserted via fallback pull")
            else:
                idle_cycles += 1
                logger.debug(f"[{ip}] No new logs via pull (idle #{idle_cycles})")

            consecutive_errors = 0

        except Exception as e:
            consecutive_errors += 1
            logger.error(f"[{ip}] ❌ Error [{consecutive_errors}]: {e}")
            if consecutive_errors >= 10:
                logger.error(f"[{ip}] 🛑 Too many errors, stopping")
                break
        finally:
            try:
                await zk.force_reset()
            except Exception as e:
                logger.debug(f"[{ip}] force_reset cleanup failed (non-fatal): {e}")

        sleep_time = IDLE_INTERVAL if idle_cycles >= 3 else SYNC_INTERVAL
        logger.debug(f"[{ip}] 💤 Next check in {sleep_time}s")
        await asyncio.sleep(sleep_time)


# --------------------------------------------------
# ── NOUVEAU : DÉTECTION PERMISSION EN HEURE ────────────────────────────
# Volontairement indépendante de sync_device_loop : que les pointages du
# clocker dédié arrivent par PUSH (ADMS, /iclock/) ou par PULL (fallback
# ci-dessus), cette boucle regarde directement la table Attendance et ne
# dépend d'aucun des deux chemins d'ingestion.
# --------------------------------------------------
async def _mark_processed(attendance_id: int) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Attendance)
            .where(Attendance.id == attendance_id)
            .values(processed_for_permission=True)
        )
        await db.commit()


async def process_permission_pairs(device_ip: str) -> int:
    """
    Traite chaque pointage individuellement, dans l'ordre chronologique,
    par (employé, jour) :
        position 0, 2, 4... (paire, 0-based) = SORTIE → ouvre un
            LeaveRequest (end_time=null), affiché immédiatement côté RH.
        position 1, 3, 5... (impaire)        = RETOUR → ferme le
            LeaveRequest ouvert (remplit end_time + duration_hours).
    Retourne le nombre de pointages traités.
    """
    window_start = datetime.now().date() - timedelta(days=PERMISSION_LOOKBACK_DAYS)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Attendance)
            .where(
                Attendance.device_ip == device_ip,
                Attendance.date >= window_start,
            )
            .order_by(Attendance.user_id, Attendance.date, Attendance.device_timestamp)
        )
        rows = result.scalars().all()

    if not rows:
        return 0

    handled = 0

    async with httpx.AsyncClient(timeout=10) as client:
        for (user_id, punch_date), group in groupby(
            rows, key=lambda r: (r.user_id, r.date)
        ):
            punches = list(group)

            for idx, punch in enumerate(punches):
                if punch.processed_for_permission:
                    continue

                is_exit = (idx % 2 == 0)

                if is_exit:
                    payload = {
                        "device_user_id": user_id,
                        "date": punch_date.isoformat(),
                        "start_time": punch.device_timestamp.strftime("%H:%M:%S"),
                        "source_attendance_out_id": punch.id,
                    }
                else:
                    payload = {
                        "device_user_id": user_id,
                        "date": punch_date.isoformat(),
                        "end_time": punch.device_timestamp.strftime("%H:%M:%S"),
                        "source_attendance_in_id": punch.id,
                    }

                try:
                    resp = await client.post(
                        LEAVES_AUTO_PERMISSION_URL,
                        json=payload,
                        headers={"X-Internal-Api-Key": INTERNAL_SYNC_API_KEY},
                    )
                    if resp.status_code in (200, 201):
                        await _mark_processed(punch.id)
                        handled += 1
                        kind = "sortie ouverte" if is_exit else "retour fermé"
                        when = payload.get("start_time") or payload.get("end_time")
                        logger.info(
                            f"[{device_ip}] ✅ Permission {kind} — user_id={user_id} @ {when}"
                        )
                    elif resp.status_code == 409:
                        logger.warning(
                            f"[{device_ip}] ⚠️  409 (pas de permission ouverte) "
                            f"user_id={user_id} punch_id={punch.id} — à vérifier manuellement"
                        )
                    else:
                        logger.warning(
                            f"[{device_ip}] ⚠️  auto-permission a échoué "
                            f"(user_id={user_id}, punch_id={punch.id}): "
                            f"{resp.status_code} {resp.text[:200]}"
                        )
                except Exception as e:
                    logger.error(f"[{device_ip}] ❌ Erreur appel Django auto-permission: {e}")

    return handled


async def permission_clocker_pull_loop():
    """
    Pull dédié, rapide (15s) et indépendant, réservé aux clockers
    is_permission_clocker=True. Ce device (192.168.8.13) n'a jamais
    réellement poussé en ADMS (last_push_at figé depuis plusieurs
    semaines) — le laisser dans la file partagée sync_device_loop
    (27 devices, cycles de 60-120s, staggering) donne des délais de
    plusieurs minutes, inacceptable pour un usage "affiché en direct".
    Ce device est donc exclu de start_all_syncs() (voir plus bas) et
    entièrement pris en charge ici à la place.
    """
    while True:
        devices = await fetch_active_devices()
        permission_devices = [d for d in devices if d.get("is_permission_clocker")]

        for d in permission_devices:
            ip, port = d["ip_address"], d["port"]

            if not await is_reachable(ip, port):
                logger.warning(f"[{ip}] ⚠️  (pull permission dédié) injoignable")
                continue

            lock = get_lock(ip)
            zk = ZKReader(device_ip=ip, device_port=port)

            try:
                async with lock:
                    await zk.connect()

                async with AsyncSessionLocal() as db:
                    async with lock:
                        saved = await zk.process_logs(db)

                if saved and saved > 0:
                    logger.info(f"[{ip}] ✅ (pull permission dédié) {saved} logs insérés")

            except Exception as e:
                logger.error(f"[{ip}] ❌ (pull permission dédié) erreur: {e}")
            finally:
                try:
                    await zk.force_reset()
                except Exception:
                    pass

        await asyncio.sleep(PERMISSION_PULL_INTERVAL)


async def permission_detection_loop():
    """Boucle indépendante, dédiée aux clockers is_permission_clocker=True.
    Tourne en continu, peu importe l'état push/pull des devices."""
    if not INTERNAL_SYNC_API_KEY:
        logger.warning(
            "⚠️  INTERNAL_SYNC_API_KEY n'est pas défini — la détection de "
            "permission tournera mais tous les appels seront rejetés (403)."
        )
    while True:
        devices = await fetch_active_devices()
        permission_ips = [d["ip_address"] for d in devices if d.get("is_permission_clocker")]
        for ip in permission_ips:
            try:
                handled = await process_permission_pairs(ip)
                if handled:
                    logger.info(f"[{ip}] 🕒 {handled} pointage(s) permission traité(s)")
            except Exception as e:
                logger.error(f"[{ip}] ❌ Erreur traitement permissions: {e}")
        await asyncio.sleep(PERMISSION_DETECTION_INTERVAL)


# --------------------------------------------------
# RESET LOGIC
# --------------------------------------------------
async def reset_device(ip: str, port: int, reference_time: datetime):
    """Daily reset: sync device time + clear old logs."""
    if not await is_reachable(ip, port):
        logger.warning(f"[RESET] {ip} unreachable, skipped")
        return

    lock = get_lock(ip)
    zk = ZKReader(device_ip=ip, device_port=port)

    async with lock:
        try:
            await zk.connect()
            await zk.sync_time(reference_time)
            await zk.clear_attendance_logs()
            logger.info(f"[RESET] ✅ {ip} complete")
        except Exception as e:
            logger.error(f"[RESET] ❌ {ip} failed: {e}")
        finally:
            try:
                await zk.force_reset()
            except Exception as e:
                logger.debug(f"[{ip}] force_reset cleanup failed (non-fatal): {e}")


async def sync_device_time_only(ip: str, port: int, reference_time: datetime):
    """Time-sync a single device, without touching its attendance logs."""
    if not await is_reachable(ip, port):
        logger.warning(f"[TIME_SYNC] {ip} unreachable, skipped")
        return

    lock = get_lock(ip)
    zk = ZKReader(device_ip=ip, device_port=port)

    async with lock:
        try:
            await zk.connect()
            await zk.sync_time(reference_time)
            logger.info(f"[TIME_SYNC] ✅ {ip} synced")
        except Exception as e:
            logger.error(f"[TIME_SYNC] ❌ {ip} failed: {e}")
        finally:
            try:
                await zk.force_reset()
            except Exception as e:
                logger.debug(f"[{ip}] force_reset cleanup failed (non-fatal): {e}")


async def hourly_time_sync_loop():
    """Sync every device's clock to the DB server's time, once per hour.

    DISABLED: clock sync is now owned by clocker-time-daemon.service.
    Keeping this in-code loop active caused write contention with the
    systemd daemon (both writing device time in the same ~30-40s window),
    producing large random clock drift. This coroutine is kept as a
    no-op so it can stay in the existing gather()/task list without
    touching the call site.
    """
    logger.info("⏱️  HOURLY TIME SYNC DISABLED — clock sync owned by clocker-time-daemon.service")
    while True:
        await asyncio.sleep(3600)


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

        reference_time = await get_reference_time()
        devices = await fetch_active_devices()
        for d in devices:
            await reset_device(d["ip_address"], d["port"], reference_time)

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
        for d in devices:
            if d.get("is_permission_clocker"):
                # Pris en charge par permission_clocker_pull_loop() à la
                # place — pull dédié et rapide, pas la file partagée.
                continue
            ip, port = d["ip_address"], d["port"]
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


async def get_reference_time() -> datetime:
    """
    Authoritative time for device sync, sourced directly from the
    PostgreSQL server (192.168.8.211) via SQL NOW() — not a separate
    NTP query. Guarantees the devices match whatever clock the
    database itself is already using for all its own timestamps.
    """
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(text("SELECT NOW()"))
            ref_time = result.scalar()
            # Postgres returns a tz-aware datetime; ZK devices expect naive local time
            ref_time = ref_time.replace(tzinfo=None)
            logger.info(f"⏱️  Reference time from DB (192.168.8.211): {ref_time}")
            return ref_time
    except Exception as e:
        logger.warning(f"⏱️  DB time query failed ({e!r}), using local clock as fallback")
        return datetime.now()


# --------------------------------------------------
# GLITCHTIP HEARTBEAT MONITOR
# --------------------------------------------------
HEARTBEAT_URL = os.getenv("GLITCHTIP_HEARTBEAT_URL")

async def heartbeat_loop():
    if not HEARTBEAT_URL:
        logger.warning("GLITCHTIP_HEARTBEAT_URL not set — heartbeat disabled")
        return
    async with httpx.AsyncClient(verify=False, timeout=10) as client:
        while True:
            try:
                await client.post(HEARTBEAT_URL)
                logger.debug("💓 Heartbeat sent to Glitchtip")
            except Exception as e:
                logger.warning(f"Heartbeat failed: {e}")
            await asyncio.sleep(120)


async def main():
    logger.info("=" * 50)
    logger.info("  ZKTeco Sync Service")
    logger.info(f"  Active sync : every {SYNC_INTERVAL}s")
    logger.info(f"  Idle sync   : every {IDLE_INTERVAL}s")
    logger.info("=" * 50)

    # Ensure DB tables exist
    await init_db()
    logger.info("✅ Database ready")
    await asyncio.gather(
        start_all_syncs(),
        hourly_time_sync_loop(),
        daily_reset_loop(),
        heartbeat_loop(),
        permission_clocker_pull_loop(),   # ← NOUVEAU : pull dédié rapide
        permission_detection_loop(),      # ← NOUVEAU : détection sortie/retour
    )



if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Sync service stopped")