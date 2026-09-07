#==============================
#app/routers/devices.py
#==============================
import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException

from app.devices.zk_reader import ZKReader

router = APIRouter(prefix="/devices", tags=["devices"])

logger = logging.getLogger("uvicorn.error")  # shows up in the same docker logs stream

CLOCKERS_API_URL = os.getenv("DJANGO_AUTH_URL", "http://django-auth:8000/api/clockers/")
PING_TIMEOUT = 2  # seconds
PING_COUNT = 1

_device_info_cache: dict = {}
DEVICE_INFO_CACHE_TTL = 300  # 5 minutes -- capacity/firmware barely change


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


async def fetch_device_info(ip: str, port: int) -> dict:
    cached = _device_info_cache.get(ip)
    if cached:
        data, ts = cached
        if (datetime.now(timezone.utc) - ts).total_seconds() < DEVICE_INFO_CACHE_TTL:
            return data

    reader = ZKReader(ip, device_port=port, timeout=5)
    try:
        info = await reader.get_device_info()
    except Exception:
        info = {}
    finally:
        await reader.disconnect()

    _device_info_cache[ip] = (info, datetime.now(timezone.utc))
    return info


@router.get("/status")
async def get_devices_status():
    """Return every clocker with a live ICMP ping check (green/red) plus device info."""
    try:
        devices = await fetch_clockers()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch device list: {e}")

    async def build_status(device: dict) -> dict:
        ip = device.get("ip_address")
        port = device.get("port", 4370)
        reachable = await ping_host(ip)

        info = {}
        if reachable:
            info = await fetch_device_info(ip, port)

        return {
            "id": device.get("id"),
            "name": device.get("name") or ip,
            "ip_address": ip,
            "port": port,
            "is_active": device.get("is_active", True),
            "reachable": reachable,
            **info,
        }

    results = await asyncio.gather(*(build_status(d) for d in devices))
    logger.info(f"[PING] Summary: {sum(r['reachable'] for r in results)}/{len(results)} reachable")

    return {
        "devices": results,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
