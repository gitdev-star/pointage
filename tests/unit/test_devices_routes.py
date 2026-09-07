"""
Unit tests for FastAPI devices status endpoint.
Mocks the Django Auth clocker list, ICMP ping, and ZK device info calls —
no real network or device access.
"""

import pytest
from unittest.mock import AsyncMock, patch

import app.routers.devices as devices_module


FAKE_CLOCKERS = [
    {"id": 1, "name": "F1_entrance", "ip_address": "192.168.1.10", "port": 4370, "is_active": True},
    {"id": 2, "name": "F1_exit", "ip_address": "192.168.1.11", "port": 4370, "is_active": True},
]

FAKE_DEVICE_INFO = {
    "serial_number": "ABC123456",
    "firmware_version": "Ver 6.60",
    "platform": "ZMM220_TFT",
    "device_name": "F1_entrance",
    "mac_address": "00:11:22:33:44:55",
    "user_count": 120,
    "user_capacity": 3000,
    "fingerprint_count": 118,
    "fingerprint_capacity": 3000,
    "record_count": 45210,
    "record_capacity": 100000,
    "face_count": 0,
    "face_capacity": 0,
}


@pytest.fixture(autouse=True)
def _clear_device_info_cache():
    """Prevent one test's cached device info leaking into another."""
    devices_module._device_info_cache.clear()
    yield
    devices_module._device_info_cache.clear()


@pytest.mark.asyncio
async def test_devices_status_returns_all_clockers(test_client):
    with patch.object(devices_module, "fetch_clockers", AsyncMock(return_value=FAKE_CLOCKERS)), \
         patch.object(devices_module, "ping_host", AsyncMock(return_value=True)), \
         patch.object(devices_module, "fetch_device_info", AsyncMock(return_value=FAKE_DEVICE_INFO)):
        response = await test_client.get("/devices/status")

    assert response.status_code == 200
    data = response.json()
    assert len(data["devices"]) == 2
    assert "checked_at" in data


@pytest.mark.asyncio
async def test_devices_status_includes_device_info_when_reachable(test_client):
    with patch.object(devices_module, "fetch_clockers", AsyncMock(return_value=FAKE_CLOCKERS[:1])), \
         patch.object(devices_module, "ping_host", AsyncMock(return_value=True)), \
         patch.object(devices_module, "fetch_device_info", AsyncMock(return_value=FAKE_DEVICE_INFO)):
        response = await test_client.get("/devices/status")

    device = response.json()["devices"][0]
    assert device["reachable"] is True
    assert device["serial_number"] == "ABC123456"
    assert device["user_capacity"] == 3000
    # Original fields still present — this was an additive change, nothing removed
    assert device["id"] == 1
    assert device["ip_address"] == "192.168.1.10"
    assert device["is_active"] is True


@pytest.mark.asyncio
async def test_devices_status_skips_device_info_when_unreachable(test_client):
    """Unreachable devices must not attempt a live ZK connection."""
    fetch_info_mock = AsyncMock(return_value=FAKE_DEVICE_INFO)
    with patch.object(devices_module, "fetch_clockers", AsyncMock(return_value=FAKE_CLOCKERS[:1])), \
         patch.object(devices_module, "ping_host", AsyncMock(return_value=False)), \
         patch.object(devices_module, "fetch_device_info", fetch_info_mock):
        response = await test_client.get("/devices/status")

    device = response.json()["devices"][0]
    assert device["reachable"] is False
    assert device.get("serial_number") is None
    fetch_info_mock.assert_not_called()


@pytest.mark.asyncio
async def test_devices_status_degrades_gracefully_when_zk_read_fails(test_client):
    """If get_device_info() raises, fetch_device_info swallows it and
    /status must still return 200 with the device marked reachable but
    without device-info fields — not a 500.
    """
    with patch.object(devices_module, "fetch_clockers", AsyncMock(return_value=FAKE_CLOCKERS[:1])), \
         patch.object(devices_module, "ping_host", AsyncMock(return_value=True)), \
         patch.object(devices_module.ZKReader, "get_device_info", AsyncMock(side_effect=RuntimeError("device busy"))), \
         patch.object(devices_module.ZKReader, "disconnect", AsyncMock(return_value=None)):
        response = await test_client.get("/devices/status")

    assert response.status_code == 200
    device = response.json()["devices"][0]
    assert device["reachable"] is True
    assert device.get("serial_number") is None


@pytest.mark.asyncio
async def test_devices_status_caches_device_info(test_client):
    """Second call within the TTL should not re-invoke ZKReader."""
    fetch_info_spy = AsyncMock(return_value=FAKE_DEVICE_INFO)
    with patch.object(devices_module, "fetch_clockers", AsyncMock(return_value=FAKE_CLOCKERS[:1])), \
         patch.object(devices_module, "ping_host", AsyncMock(return_value=True)), \
         patch.object(devices_module.ZKReader, "get_device_info", fetch_info_spy), \
         patch.object(devices_module.ZKReader, "disconnect", AsyncMock(return_value=None)):
        r1 = await test_client.get("/devices/status")
        r2 = await test_client.get("/devices/status")

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert fetch_info_spy.call_count == 1  # second call hit the cache


@pytest.mark.asyncio
async def test_devices_status_502_when_clocker_fetch_fails(test_client):
    with patch.object(devices_module, "fetch_clockers", AsyncMock(side_effect=Exception("django-auth down"))):
        response = await test_client.get("/devices/status")

    assert response.status_code == 502
