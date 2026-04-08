# app/services/analysis_service.py
# ============================================================
# Pure business logic — no FastAPI, no HTTP
# Only job: compute attendance analysis from DB rows
# ============================================================

from datetime import date, time, datetime
from typing import List, Optional
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.attendance import Attendance

# --------------------------------------------------
# WORK RULES — change here only, affects everything
# --------------------------------------------------
WORK_START        = time(7, 40)   # Late if first punch AFTER this
EARLY_LEAVE_LIMIT = time(16, 27)  # Early leave if last punch BEFORE this
OVERTIME_START    = time(16, 35)  # Overtime if last punch AFTER this
MIN_GAP_SECONDS   = 30 * 60       # Punch out must be at least 30min after punch in


# --------------------------------------------------
# DATA CLASSES (plain Python, no Pydantic needed here)
# --------------------------------------------------
@dataclass
class DayRecord:
    date: date
    day_name: str
    is_weekend: bool
    arrival: Optional[datetime]      # Punch IN (None if single punch after noon)
    departure: Optional[datetime]    # Punch OUT (None if single punch before noon)
    hours_worked: Optional[float]    # 8.5 = 8h30
    is_late: bool
    is_early_leave: bool
    is_overtime: bool
    punch_count: int


@dataclass
class UserAnalysis:
    user_id: int
    date_from: date
    date_to: date
    total_days_present: int
    total_days_late: int
    total_days_early_leave: int
    total_days_overtime: int
    total_weekend_days: int
    total_hours_worked: float
    average_hours_per_day: float
    days: List[DayRecord]


# --------------------------------------------------
# CORE ANALYSIS FUNCTION
# --------------------------------------------------
def _analyze_day(row) -> DayRecord:
    """Compute all flags for a single day row."""
    day: date       = row.date
    first: datetime = row.first_punch
    last: datetime  = row.last_punch
    punch_count: int = row.punch_count

    day_name   = day.strftime("%A")
    is_weekend = day.weekday() >= 5  # 5=Saturday, 6=Sunday

    # CRITICAL: treat as single punch if:
    # - first == last (exact duplicate)
    # - gap between first and last is less than 30 minutes (double-tap)
    gap_too_small = (
        first and last and first != last and
        (last - first).total_seconds() < MIN_GAP_SECONDS
    )
    effective_punch_count = 1 if (first and last and first == last) or gap_too_small else punch_count

    # Hours worked: only if we have 2+ DIFFERENT punches
    hours_worked = None
    if effective_punch_count >= 2 and first and last and first != last:
        hours_worked = round((last - first).total_seconds() / 3600, 2)

    # Determine arrival and departure based on single punch logic
    arrival = None
    departure = None
    
    # Single punch logic
    if effective_punch_count == 1:
        single_punch_time = first.time() if first else None
        
        # Single punch before noon (12:00) = punch IN (arrival)
        if single_punch_time and single_punch_time.hour < 12:
            arrival = first
            departure = None
            is_late = single_punch_time > WORK_START
            is_early_leave = False
        # Single punch at/after noon = punch OUT (departure)
        else:
            arrival = None
            departure = first
            is_late = False
            is_early_leave = bool(
                not is_weekend 
                and single_punch_time 
                and single_punch_time < EARLY_LEAVE_LIMIT
            )
    else:
        # Multiple punches: both arrival and departure exist
        arrival = first
        departure = last
        is_late = bool(first and first.time() > WORK_START)
        is_early_leave = bool(
            last
            and not is_weekend
            and last.time() < EARLY_LEAVE_LIMIT
        )

    # Overtime: departure after 16:35 OR worked on weekend
    is_overtime = bool(
        departure and (departure.time() > OVERTIME_START or is_weekend)
    )

    return DayRecord(
        date=day,
        day_name=day_name,
        is_weekend=is_weekend,
        arrival=arrival,
        departure=departure,
        hours_worked=hours_worked,
        is_late=is_late,
        is_early_leave=is_early_leave,
        is_overtime=is_overtime,
        punch_count=punch_count,
    )


async def compute_user_analysis(
    db: AsyncSession,
    user_id: int,
    date_from: date,
    date_to: date,
) -> Optional[UserAnalysis]:
    """
    Single DB query → compute full analysis for one user.
    Returns None if no records found.
    """
    # ONE query: first punch, last punch, count per day
    result = await db.execute(
        select(
            Attendance.date,
            func.min(Attendance.timestamp).label("first_punch"),
            func.max(Attendance.timestamp).label("last_punch"),
            func.count(Attendance.id).label("punch_count"),
        )
        .where(
            and_(
                Attendance.user_id == user_id,
                Attendance.date >= date_from,
                Attendance.date <= date_to,
                Attendance.timestamp.isnot(None),
            )
        )
        .group_by(Attendance.date)
        .order_by(Attendance.date)
    )
    rows = result.all()

    if not rows:
        return None

    # Compute per-day records
    days = [_analyze_day(row) for row in rows]

    # Aggregate totals
    total_hours       = sum(d.hours_worked for d in days if d.hours_worked)
    total_present     = len(days)
    total_late        = sum(1 for d in days if d.is_late)
    total_early_leave = sum(1 for d in days if d.is_early_leave)
    total_overtime    = sum(1 for d in days if d.is_overtime)
    total_weekend     = sum(1 for d in days if d.is_weekend)
    avg_hours         = round(total_hours / total_present, 2) if total_present else 0.0

    return UserAnalysis(
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        total_days_present=total_present,
        total_days_late=total_late,
        total_days_early_leave=total_early_leave,
        total_days_overtime=total_overtime,
        total_weekend_days=total_weekend,
        total_hours_worked=round(total_hours, 2),
        average_hours_per_day=avg_hours,
        days=days,
    )
