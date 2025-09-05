from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, distinct
from pydantic import BaseModel, Field, validator
from datetime import datetime, date, time, timedelta

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
        time_from: Optional[time] = Query(None, description="Start time filter (HH:MM:SS)"),
        time_to: Optional[time] = Query(None, description="End time filter (HH:MM:SS)"),
        target_date: Optional[date] = Query(None, description="Specific date for time filtering"),
        period: Optional[str] = Query(None),
        db: AsyncSession = Depends(get_async_db),
):
    """
    Fetch attendance records with comprehensive filtering options.

    - **time_from/time_to**: Filter by time of day (requires target_date or works with date_from/date_to)
    - **target_date**: Specific date to combine with time filtering
    - **period**: Predefined periods (today, yesterday, this_week, last_week)
    """
    try:
        query = select(Attendance)
        filters = build_filters(
            period=period,
            user_id=user_id,
            device_ip=device_ip,
            date_from=date_from,
            date_to=date_to,
            time_from=time_from,
            time_to=time_to,
            target_date=target_date
        )

        if filters:
            query = query.where(and_(*filters))

        count_query = select(func.count(Attendance.id)).where(and_(*filters)) if filters else select(
            func.count(Attendance.id))
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
        time_from: Optional[time] = Query(None, description="Start time filter (HH:MM:SS)"),
        time_to: Optional[time] = Query(None, description="End time filter (HH:MM:SS)"),
        target_date: Optional[date] = Query(None, description="Specific date for time filtering"),
        period: Optional[str] = Query(None),
        db: AsyncSession = Depends(get_async_db),
):
    try:
        filters = build_filters(
            period=period,
            user_id=user_id,
            device_ip=device_ip,
            date_from=date_from,
            date_to=date_to,
            time_from=time_from,
            time_to=time_to,
            target_date=target_date
        )

        query = select(
            Attendance.user_id,
            Attendance.timestamp,
            Attendance.date,
            Attendance.device_ip,
        )
        if filters:
            query = query.where(and_(*filters))

        count_query = select(func.count(Attendance.id)).where(and_(*filters)) if filters else select(
            func.count(Attendance.id))
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
        time_from: Optional[time] = Query(None, description="Start time filter (HH:MM:SS)"),
        time_to: Optional[time] = Query(None, description="End time filter (HH:MM:SS)"),
        target_date: Optional[date] = Query(None, description="Specific date for time filtering"),
        period: Optional[str] = Query(None),
        db: AsyncSession = Depends(get_async_db),
):
    try:
        filters = build_filters(
            period=period,
            user_id=user_id,
            device_ip=device_ip,
            date_from=date_from,
            date_to=date_to,
            time_from=time_from,
            time_to=time_to,
            target_date=target_date
        )
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


# New endpoint: Get attendance for specific day with hourly breakdown
@router.get("/daily/{target_date}", response_model=List[AttendanceResponse])
async def get_daily_attendance(
        target_date: date,
        response: Response,
        skip: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=1000),
        user_id: Optional[int] = Query(None),
        device_ip: Optional[str] = Query(None),
        time_from: Optional[time] = Query(None, description="Start time filter (HH:MM:SS)"),
        time_to: Optional[time] = Query(None, description="End time filter (HH:MM:SS)"),
        db: AsyncSession = Depends(get_async_db),
):
    """
    Get attendance records for a specific date with optional time filtering.
    """
    try:
        filters = build_filters(
            period=None,
            user_id=user_id,
            device_ip=device_ip,
            date_from=target_date,
            date_to=target_date,
            time_from=time_from,
            time_to=time_to,
            target_date=target_date
        )

        query = select(Attendance)
        if filters:
            query = query.where(and_(*filters))

        count_query = select(func.count(Attendance.id)).where(and_(*filters)) if filters else select(
            func.count(Attendance.id))
        total_result = await db.execute(count_query)
        total_count = total_result.scalar() or 0
        response.headers["X-Total-Count"] = str(total_count)

        query = query.order_by(Attendance.timestamp).offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching daily records: {str(e)}")


@router.get("/available-ips", response_model=List[str])
async def get_available_device_ips(
        db: AsyncSession = Depends(get_async_db),
):
    """
    Get list of unique device IPs from attendance records.
    """
    try:
        query = select(distinct(Attendance.device_ip)).where(
            Attendance.device_ip.isnot(None)
        ).order_by(Attendance.device_ip)

        result = await db.execute(query)
        ips = result.scalars().all()

        return [ip for ip in ips if ip]  # Filter out any None values
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching available IPs: {str(e)}")

# === UTILITIES ===

def build_filters(
        period: Optional[str],
        user_id: Optional[int],
        device_ip: Optional[str],
        date_from: Optional[date],
        date_to: Optional[date],
        time_from: Optional[time] = None,
        time_to: Optional[time] = None,
        target_date: Optional[date] = None,
) -> List:
    """
    Build SQL filters for attendance queries.

    Args:
        time_from: Start time for filtering (works with target_date or date range)
        time_to: End time for filtering (works with target_date or date range)
        target_date: Specific date for time filtering (overrides date_from/date_to for time filters)
    """
    filters = []
    today = date.today()

    # Handle predefined periods
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

    # Handle date range filters
    if date_from:
        filters.append(Attendance.date >= date_from)
    if date_to:
        filters.append(Attendance.date <= date_to)

    # Handle time-based filtering
    if time_from is not None or time_to is not None:
        # Use target_date if provided, otherwise use date_from/date_to range
        if target_date:
            # Filter for specific date with time range
            base_datetime = datetime.combine(target_date, time(0, 0, 0))

            if time_from is not None:
                start_datetime = datetime.combine(target_date, time_from)
                filters.append(Attendance.timestamp >= start_datetime)

            if time_to is not None:
                end_datetime = datetime.combine(target_date, time_to)
                filters.append(Attendance.timestamp <= end_datetime)

            # Ensure we're only looking at the target date
            filters.append(Attendance.date == target_date)

        else:
            # Apply time filtering to existing date range
            if time_from is not None:
                # Extract time from timestamp and compare
                filters.append(func.extract('hour', Attendance.timestamp) * 3600 +
                               func.extract('minute', Attendance.timestamp) * 60 +
                               func.extract('second', Attendance.timestamp) >=
                               time_from.hour * 3600 + time_from.minute * 60 + time_from.second)

            if time_to is not None:
                filters.append(func.extract('hour', Attendance.timestamp) * 3600 +
                               func.extract('minute', Attendance.timestamp) * 60 +
                               func.extract('second', Attendance.timestamp) <=
                               time_to.hour * 3600 + time_to.minute * 60 + time_to.second)

    # Handle other filters
    if user_id:
        filters.append(Attendance.user_id == user_id)
    if device_ip:
        filters.append(Attendance.device_ip == device_ip)

    return filters


def get_time_range_filters(
        target_date: date,
        time_from: Optional[time] = None,
        time_to: Optional[time] = None
) -> List:
    """
    Helper function to create datetime range filters for a specific date.
    """
    filters = []

    if time_from is not None:
        start_datetime = datetime.combine(target_date, time_from)
        filters.append(Attendance.timestamp >= start_datetime)
    else:
        # Default to start of day
        start_datetime = datetime.combine(target_date, time(0, 0, 0))
        filters.append(Attendance.timestamp >= start_datetime)

    if time_to is not None:
        end_datetime = datetime.combine(target_date, time_to)
        filters.append(Attendance.timestamp <= end_datetime)
    else:
        # Default to end of day
        end_datetime = datetime.combine(target_date, time(23, 59, 59))
        filters.append(Attendance.timestamp <= end_datetime)

    return filters