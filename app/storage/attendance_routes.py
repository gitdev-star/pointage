from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, distinct
from pydantic import BaseModel, Field
from datetime import datetime, date, timedelta

from app.database import get_async_db
from app.models.attendance import Attendance

router = APIRouter()


# === SCHEMAS ===

class AttendanceBase(BaseModel):
    uid: int
    user_id: int
    device_ip: str

    class Config:
        orm_mode = True


class AttendanceResponse(AttendanceBase):
    id: int
    timestamp: datetime
    attendance_date: date = Field(..., alias="date")

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


class MinimalAttendanceResponse(BaseModel):
    user_id: int
    timestamp: datetime
    attendance_date: date = Field(..., alias="date")
    device_ip: str

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


class StatsResponse(BaseModel):
    total_records: int
    unique_users: int
    present_count: int
    absent_count: int
    latest_punch: Optional[datetime]

    class Config:
        orm_mode = True


# === ROUTES ===

# Fetch full attendance with pagination
@router.get("/", response_model=List[AttendanceResponse])
async def get_all_attendance(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[int] = Query(None),
    device_ip: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        query = select(Attendance)
        filters = build_filters(period, user_id, device_ip, date_from, date_to)

        if filters:
            query = query.where(and_(*filters))

        count_query = select(func.count(Attendance.id)).where(and_(*filters)) if filters else select(func.count(Attendance.id))
        total_result = await db.execute(count_query)
        total_count = total_result.scalar() or 0
        response.headers["X-Total-Count"] = str(total_count)

        query = query.order_by(desc(Attendance.timestamp)).offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching records: {str(e)}")


# Fetch minimal data with pagination
@router.get("/minimal", response_model=List[MinimalAttendanceResponse])
async def get_minimal_attendance(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[int] = Query(None),
    device_ip: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        filters = build_filters(period, user_id, device_ip, date_from, date_to)

        query = select(
            Attendance.user_id,
            Attendance.timestamp,
            Attendance.date,
            Attendance.device_ip,
        )
        if filters:
            query = query.where(and_(*filters))

        count_query = select(func.count(Attendance.id)).where(and_(*filters)) if filters else select(func.count(Attendance.id))
        total_result = await db.execute(count_query)
        total_count = total_result.scalar() or 0
        response.headers["X-Total-Count"] = str(total_count)

        query = query.order_by(desc(Attendance.timestamp)).offset(skip).limit(limit)
        result = await db.execute(query)
        rows = result.all()

        return [
            MinimalAttendanceResponse(
                user_id=row.user_id,
                timestamp=row.timestamp,
                attendance_date=row.date,
                device_ip=row.device_ip,
            )
            for row in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching records: {str(e)}")


# Statistics endpoint
@router.get("/stats", response_model=StatsResponse)
async def get_attendance_stats(
    user_id: Optional[int] = Query(None),
    device_ip: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        filters = build_filters(period, user_id, device_ip, date_from, date_to)
        filter_clause = and_(*filters) if filters else None

        total_query = select(func.count(Attendance.id))
        if filter_clause:
            total_query = total_query.where(filter_clause)
        total_result = await db.execute(total_query)
        total_records = total_result.scalar() or 0

        unique_query = select(func.count(distinct(Attendance.user_id)))
        if filter_clause:
            unique_query = unique_query.where(filter_clause)
        unique_result = await db.execute(unique_query)
        unique_users = unique_result.scalar() or 0

        latest_query = select(func.max(Attendance.timestamp))
        if filter_clause:
            latest_query = latest_query.where(filter_clause)
        latest_result = await db.execute(latest_query)
        latest_punch = latest_result.scalar()

        return StatsResponse(
            total_records=total_records,
            unique_users=unique_users,
            present_count=total_records,
            absent_count=0,
            latest_punch=latest_punch,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")


# Get by ID
@router.get("/{attendance_id}", response_model=AttendanceResponse)
async def get_attendance_by_id(
    attendance_id: int,
    db: AsyncSession = Depends(get_async_db),
):
    try:
        query = select(Attendance).where(Attendance.id == attendance_id)
        result = await db.execute(query)
        attendance = result.scalar_one_or_none()

        if not attendance:
            raise HTTPException(status_code=404, detail="Attendance record not found")

        return attendance
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching record: {str(e)}")


# === UTILITIES ===

def build_filters(
    period: Optional[str],
    user_id: Optional[int],
    device_ip: Optional[str],
    date_from: Optional[date],
    date_to: Optional[date],
) -> List:
    filters = []

    today = date.today()

    if period:
        if period == "today":
            filters.append(Attendance.date == today)
        elif period == "yesterday":
            filters.append(Attendance.date == today - timedelta(days=1))
        elif period == "this_week":
            start = today - timedelta(days=today.weekday())
            filters.extend([Attendance.date >= start, Attendance.date <= today])
        elif period == "last_week":
            start = today - timedelta(days=today.weekday() + 7)
            end = start + timedelta(days=6)
            filters.extend([Attendance.date >= start, Attendance.date <= end])

    if user_id:
        filters.append(Attendance.user_id == user_id)
    if device_ip:
        filters.append(Attendance.device_ip == device_ip)
    if date_from:
        filters.append(Attendance.date >= date_from)
    if date_to:
        filters.append(Attendance.date <= date_to)

    return filters
