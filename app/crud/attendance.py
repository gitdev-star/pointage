from sqlalchemy.future import select
from sqlalchemy import and_
from app.models.attendance import Attendance
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date


async def get_attendance_data(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    device_ip: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Attendance]:

    query = select(Attendance)

    if start_date:
        query = query.where(Attendance.date >= start_date)
    if end_date:
        query = query.where(Attendance.date <= end_date)
    if device_ip:
        query = query.where(Attendance.device_ip == device_ip)

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()
