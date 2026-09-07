# app/routers/device_admin_routes.py
import os
from fastapi import APIRouter, Header, HTTPException
from app.services.device_admin import delete_user_from_all_devices

SERVICE_KEY = os.getenv("SERVICE_INTERNAL_KEY")
router = APIRouter(prefix="/devices", tags=["device-admin"])


def _verify_service_key(x_service_key: str):
    if not SERVICE_KEY or x_service_key != SERVICE_KEY:
        raise HTTPException(status_code=403, detail="Invalid service key")


@router.delete("/users/{user_id}")
async def delete_user_endpoint(user_id: str, x_service_key: str = Header(...)):
    _verify_service_key(x_service_key)
    results = await delete_user_from_all_devices(user_id)
    return {"user_id": user_id, "results": results}