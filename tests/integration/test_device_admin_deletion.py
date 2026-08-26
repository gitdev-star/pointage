"""
Integration tests for:
- app/services/device_admin.py (delete_user_from_all_devices, fetch_active_devices)
- app/routers/device_admin_routes.py (DELETE /devices/users/{user_id})

Uses pytest + pytest-asyncio for the async service function, and
FastAPI's TestClient for the HTTP endpoint. Mocks both the django-auth
device-list call and the ZK SDK -- no real network/device access needed.

Place in: tests/integration/test_device_admin_deletion.py
(adjust import paths below to match your actual test setup / conftest.py)
"""

import pytest
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient

from main import app
from app.services import device_admin


client = TestClient(app)


# ---------------------------------------------------------------------
# fetch_active_devices()
# ---------------------------------------------------------------------

class TestFetchActiveDevices:

    @pytest.mark.asyncio
    async def test_returns_only_active_devices(self, respx_mock=None):
        # Using unittest.mock instead of respx here to avoid an extra
        # dependency -- swap for respx/httpx_mock if your suite already
        # uses one of those for httpx mocking.
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {"ip_address": "192.168.1.2", "port": 4370, "is_active": True},
            {"ip_address": "192.168.1.3", "port": 4370, "is_active": False},
            {"ip_address": "192.168.1.4", "port": 4370},  # is_active defaults True
        ]
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.device_admin.httpx.AsyncClient") as mock_client_cls:
            mock_client = mock_client_cls.return_value.__aenter__.return_value
            mock_client.get.return_value = mock_response

            devices = await device_admin.fetch_active_devices()

        assert ("192.168.1.2", 4370) in devices
        assert ("192.168.1.4", 4370) in devices
        assert ("192.168.1.3", 4370) not in devices
        assert len(devices) == 2

    @pytest.mark.asyncio
    async def test_returns_empty_list_on_fetch_failure(self):
        with patch("app.services.device_admin.httpx.AsyncClient") as mock_client_cls:
            mock_client = mock_client_cls.return_value.__aenter__.return_value
            mock_client.get.side_effect = ConnectionError("django-auth unreachable")

            devices = await device_admin.fetch_active_devices()

        assert devices == []


# ---------------------------------------------------------------------
# delete_user_from_all_devices()
# ---------------------------------------------------------------------

class TestDeleteUserFromAllDevices:

    @pytest.mark.asyncio
    async def test_deletes_from_all_active_devices(self):
        devices = [("192.168.1.2", 4370), ("192.168.1.3", 4370)]

        with patch.object(device_admin, "fetch_active_devices", return_value=devices), \
             patch.object(device_admin, "_delete_user_sync", return_value="deleted") as mock_sync:

            results = await device_admin.delete_user_from_all_devices("3445")

        assert results == {"192.168.1.2": "deleted", "192.168.1.3": "deleted"}
        assert mock_sync.call_count == 2

    @pytest.mark.asyncio
    async def test_no_devices_returns_empty_dict(self):
        with patch.object(device_admin, "fetch_active_devices", return_value=[]):
            results = await device_admin.delete_user_from_all_devices("3445")

        assert results == {}

    @pytest.mark.asyncio
    async def test_partial_failure_reported_per_device(self):
        devices = [("192.168.1.2", 4370), ("192.168.1.3", 4370)]

        def fake_sync(ip, port, user_id, timeout=5, retries=2):
            if ip == "192.168.1.3":
                return "error: ZKNetworkError(\"timed out\")"
            return "deleted"

        with patch.object(device_admin, "fetch_active_devices", return_value=devices), \
             patch.object(device_admin, "_delete_user_sync", side_effect=fake_sync):

            results = await device_admin.delete_user_from_all_devices("3445")

        assert results["192.168.1.2"] == "deleted"
        assert "error" in results["192.168.1.3"]

    @pytest.mark.asyncio
    async def test_respects_concurrency_cap(self):
        # Sanity check that MAX_CONCURRENT_DEVICES doesn't silently drop
        # devices when the device count exceeds the cap.
        devices = [(f"192.168.1.{i}", 4370) for i in range(2, 2 + 15)]  # 15 devices, cap=10

        with patch.object(device_admin, "fetch_active_devices", return_value=devices), \
             patch.object(device_admin, "_delete_user_sync", return_value="deleted"):

            results = await device_admin.delete_user_from_all_devices("3445")

        assert len(results) == 15


# ---------------------------------------------------------------------
# DELETE /devices/users/{user_id} endpoint
# ---------------------------------------------------------------------

class TestDeleteUserEndpoint:

    def test_endpoint_returns_results_from_service(self):
        fake_results = {"192.168.1.2": "deleted", "192.168.1.3": "deleted"}

        with patch(
            "app.routers.device_admin_routes.delete_user_from_all_devices",
            return_value=fake_results,
        ):
            response = client.delete("/devices/users/3445")

        assert response.status_code == 200
        body = response.json()
        assert body["user_id"] == "3445"
        assert body["results"] == fake_results

    def test_endpoint_handles_no_active_devices(self):
        with patch(
            "app.routers.device_admin_routes.delete_user_from_all_devices",
            return_value={},
        ):
            response = client.delete("/devices/users/3445")

        assert response.status_code == 200
        assert response.json()["results"] == {}