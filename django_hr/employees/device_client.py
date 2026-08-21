import requests
from django.conf import settings

ATTENDANCE_SERVICE_URL = getattr(settings, "ATTENDANCE_SERVICE_URL", "http://localhost:8000")
SERVICE_KEY = getattr(settings, "FASTAPI_SERVICE_KEY", None)

def delete_user_from_devices(device_user_id: int) -> dict:
    resp = requests.post(
        f"{ATTENDANCE_SERVICE_URL}/devices/delete-user/{device_user_id}",
        headers={"X-Service-Key": SERVICE_KEY},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()