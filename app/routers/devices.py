#==============================
#app/routers/devices.py
#==============================
import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException

from fastapi import Header
from app.devices.zk_reader import ZKReader

SERVICE_KEY = os.getenv("SERVICE_INTERNAL_KEY")

router = APIRouter(prefix="/devices", tags=["devices"])

logger = logging.getLogger("uvicorn.error")  # shows up in the same docker logs stream

CLOCKERS_API_URL = os.getenv("DJANGO_AUTH_URL", "http://django-auth:8000/api/clockers/")
PING_TIMEOUT = 2  # seconds
PING_COUNT = 1


async def ping_host(ip: str) -> bool:
    """Real ICMP ping using the system 'ping' binary (subprocess)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ping",
            "-c", str(PING_COUNT),
            "-W", str(PING_TIMEOUT),
            ip,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        returncode = await asyncio.wait_for(proc.wait(), timeout=PING_TIMEOUT + 2)
        result = returncode == 0
        logger.info(f"[PING] {ip} -> {'OK' if result else 'FAIL'} (exit code {returncode})")
        return result
    except Exception as e:
        logger.warning(f"[PING] {ip} -> ERROR ({e})")
        return False


async def fetch_clockers() -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(CLOCKERS_API_URL)
        resp.raise_for_status()
        return resp.json()


@router.get("/status")
async def get_devices_status():
    """Return every clocker with a live ICMP ping check (green/red)."""
    try:
        devices = await fetch_clockers()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch device list: {e}")

    async def build_status(device: dict) -> dict:
        ip = device.get("ip_address")
        reachable = await ping_host(ip)
        return {
            "id": device.get("id"),
            "name": device.get("name") or ip,
            "ip_address": ip,
            "port": device.get("port", 4370),
            "is_active": device.get("is_active", True),
            "reachable": reachable,
        }

    results = await asyncio.gather(*(build_status(d) for d in devices))
    logger.info(f"[PING] Summary: {sum(r['reachable'] for r in results)}/{len(results)} reachable")

    return {
        "devices": results,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
    


def _verify_service_key(x_service_key: str):
    if not SERVICE_KEY or x_service_key != SERVICE_KEY:
        raise HTTPException(status_code=403, detail="Invalid service key")


async def _delete_on_device(device: dict, device_user_id: int) -> dict:
    ip = device.get("ip_address")
    name = device.get("name") or ip
    if not await ping_host(ip):
        return {"device": name, "ip": ip, "status": "unreachable"}
    reader = ZKReader(ip, device_port=device.get("port", 4370))
    try:
        await reader.delete_user(device_user_id)
        return {"device": name, "ip": ip, "status": "deleted"}
    except Exception as e:
        logger.error(f"[DELETE] {name} ({ip}) failed for device_user_id={device_user_id}: {e}")
        return {"device": name, "ip": ip, "status": f"error: {e}"}
    finally:
        await reader.disconnect()


@router.post("/delete-user/{device_user_id}")
async def delete_user_from_all_devices(
    device_user_id: int,
    x_service_key: str = Header(...),
):
    _verify_service_key(x_service_key)
    try:
        devices = await fetch_clockers()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch device list: {e}")

    active_devices = [d for d in devices if d.get("is_active", True)]
    if not active_devices:
        return {"device_user_id": device_user_id, "results": [], "detail": "No active devices."}

    results = await asyncio.gather(*(_delete_on_device(d, device_user_id) for d in active_devices))
    ok_count = sum(1 for r in results if r["status"] == "deleted")
    logger.info(f"[DELETE] device_user_id={device_user_id}: {ok_count}/{len(results)} devices succeeded")

    return {"device_user_id": device_user_id, "results": results}