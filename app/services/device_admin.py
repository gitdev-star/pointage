# app/services/device_admin.py
import os
import asyncio
import logging
import httpx
from zk import ZK

logger = logging.getLogger(__name__)

CLOCKERS_API_URL = os.getenv("DJANGO_AUTH_URL", "http://django-auth:8000/api/clockers/")

# Caps how many devices are contacted at the same time, so 26+ devices don't
# open 26+ simultaneous OS threads/sockets at once.
MAX_CONCURRENT_DEVICES = 10


async def fetch_active_devices() -> list[tuple[str, int]]:
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
            logger.info(f"[DEVICE_ADMIN] {len(active)} active device(s) found")
            return active
    except Exception as e:
        logger.error(f"[DEVICE_ADMIN] Failed to fetch device list: {e}")
        return []


def _delete_user_sync(ip: str, port: int, user_id: str, timeout: int = 5, retries: int = 2) -> str:
    last_err = None
    for attempt in range(1, retries + 1):
        zk = ZK(ip, port=port, timeout=timeout)
        conn = None
        try:
            conn = zk.connect()
            conn.disable_device()
            conn.delete_user(user_id=user_id)
            conn.enable_device()
            return "deleted"
        except Exception as e:
            last_err = e
            logger.warning(f"[DEVICE_ADMIN] attempt {attempt}/{retries} failed on {ip}: {e!r}")
        finally:
            if conn:
                try:
                    conn.disconnect()
                except Exception:
                    pass
    return f"error: {last_err!r}"


async def delete_user_from_all_devices(user_id: str) -> dict:
    devices = await fetch_active_devices()
    if not devices:
        logger.warning("[DEVICE_ADMIN] No active devices — nothing to delete from")
        return {}

    loop = asyncio.get_running_loop()
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_DEVICES)

    async def _bounded_delete(ip: str, port: int):
        async with semaphore:
            result = await loop.run_in_executor(None, _delete_user_sync, ip, port, user_id)
            logger.info(f"[DEVICE_ADMIN] user_id={user_id} on {ip}: {result}")
            return ip, result

    tasks = [_bounded_delete(ip, port) for ip, port in devices]
    results_list = await asyncio.gather(*tasks)

    return dict(results_list)