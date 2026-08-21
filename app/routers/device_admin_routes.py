# app/routers/device_admin_routes.py
from fastapi import APIRouter
from app.services.device_admin import delete_user_from_all_devices

router = APIRouter(prefix="/devices", tags=["device-admin"])


@router.delete("/users/{user_id}")
async def delete_user_endpoint(user_id: str):
    results = await delete_user_from_all_devices(user_id)
    return {"user_id": user_id, "results": results}