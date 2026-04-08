# =====================================================
# PATH: pointage/app/routers/hr_routes.py
# =====================================================

import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_async_db as get_db

router = APIRouter(prefix="/api/hr", tags=["HR Bridge"])

DJANGO_HR_URL = os.environ.get("DJANGO_HR_URL", "http://127.0.0.1:8002")


async def fetch_employee_by_device_id(device_user_id: int) -> dict | None:
    """Call django_hr to resolve one device user_id → employee profile."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{DJANGO_HR_URL}/api/employees/by-device/{device_user_id}/"
            )
            return r.json() if r.status_code == 200 else None
    except httpx.RequestError:
        return None


async def fetch_all_active_employees() -> list[dict]:
    """Fetch all active employees from django_hr to build a lookup map."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{DJANGO_HR_URL}/api/employees/active/")
            if r.status_code == 200:
                return r.json().get("results", [])
            return []
    except httpx.RequestError:
        return []


def build_employee_map(employees: list[dict]) -> dict[int, dict]:
    return {
        emp["device_user_id"]: emp
        for emp in employees
        if emp.get("device_user_id") is not None
    }


@router.get("/attendance-with-names")
async def get_attendance_with_names(
    db: AsyncSession = Depends(get_db),
    date: str = None,
    limit: int = 100,
):
    """
    Attendance records enriched with employee names.
    Main endpoint used by React dashboard.
    """
    employees = await fetch_all_active_employees()
    emp_map = build_employee_map(employees)

    query = "SELECT id, user_id, timestamp, date, device_ip FROM attendance"
    params: dict = {"limit": limit}
    if date:
        query += " WHERE date = :date"
        params["date"] = date
    query += " ORDER BY timestamp DESC LIMIT :limit"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    records = []
    for row in rows:
        emp = emp_map.get(row.user_id)
        records.append({
            "id": row.id,
            "user_id": row.user_id,
            "timestamp": str(row.timestamp),
            "date": str(row.date),
            "device_ip": row.device_ip,
            "employee": {
                "id": emp["id"],
                "full_name": emp["full_name"],
                "employee_id": emp["employee_id"],
                "department": emp["department_name"],
                "factory": emp["factory_name"],
                "photo": emp.get("photo"),
            } if emp else None,
        })

    return {
        "total": len(records),
        "date": date,
        "unlinked_count": sum(1 for r in records if r["employee"] is None),
        "records": records,
    }


@router.get("/attendance-with-names/{device_user_id}")
async def get_employee_attendance_history(
    device_user_id: int,
    db: AsyncSession = Depends(get_db),
    limit: int = 30,
):
    """Full attendance history for one employee by their device user_id."""
    emp = await fetch_employee_by_device_id(device_user_id)
    if not emp:
        raise HTTPException(
            status_code=404,
            detail=f"No employee linked to device_user_id {device_user_id}",
        )

    result = await db.execute(
        text("""
            SELECT id, user_id, timestamp, date, device_ip
            FROM attendance
            WHERE user_id = :uid
            ORDER BY timestamp DESC
            LIMIT :limit
        """),
        {"uid": device_user_id, "limit": limit},
    )
    rows = result.fetchall()

    return {
        "employee": emp,
        "attendance_count": len(rows),
        "records": [
            {
                "id": r.id,
                "timestamp": str(r.timestamp),
                "date": str(r.date),
                "device_ip": r.device_ip,
            }
            for r in rows
        ],
    }


@router.get("/unlinked-users")
async def get_unlinked_device_users(db: AsyncSession = Depends(get_db)):
    """
    Returns all device user_ids in attendance with no matching employee.
    Use this in admin to see who still needs to be linked.
    """
    result = await db.execute(
        text("SELECT DISTINCT user_id FROM attendance ORDER BY user_id")
    )
    all_device_ids = [row.user_id for row in result.fetchall()]

    employees = await fetch_all_active_employees()
    linked_ids = {emp["device_user_id"] for emp in employees if emp.get("device_user_id")}

    unlinked = [uid for uid in all_device_ids if uid not in linked_ids]

    return {
        "total_device_users": len(all_device_ids),
        "linked": len(linked_ids),
        "unlinked": len(unlinked),
        "unlinked_user_ids": unlinked,
    }
