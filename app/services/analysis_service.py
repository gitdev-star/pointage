# =====================================================
# PATH: pointage/app/services/analysis_service.py
# =====================================================
from datetime import date, time, datetime, timedelta
from typing import List, Optional
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.attendance import Attendance

import logging
logger = logging.getLogger(__name__)

# --------------------------------------------------
# GLOBAL WORK RULES — fallback when no custom schedule found
# --------------------------------------------------
WORK_START              = time(7, 40)
EARLY_LEAVE_LIMIT       = time(16, 27)
STANDARD_START          = time(7, 30)
STANDARD_END            = time(16, 30)
LUNCH_START             = time(12, 0)
LUNCH_END               = time(13, 0)
STANDARD_WORK_HOURS     = 9.0          # 07:30-16:30 = 9h
OVERTIME_THRESHOLD      = time(17, 0)
OVERTIME_MIN_MINUTES    = 29           # minimum minutes past standard_end to count as overtime
OVERTIME_THRESHOLD_HOURS = 9.0        # kept for schedule compat but not used in core calc
LATE_THRESHOLD          = time(7, 35)  # UI late flag: arrival strictly after this time


# --------------------------------------------------
# SCHEDULE RESOLVER  (reads from Django ORM via sync call)
# --------------------------------------------------
@dataclass
class ScheduleRules:
    """Resolved work rules for one employee on one day."""
    work_start:               time
    early_leave_limit:        time
    standard_start:           time
    standard_end:             time
    lunch_start:              time
    lunch_end:                time
    standard_work_hours:      float
    overtime_threshold_hours: float
    schedule_name:            str   # for display / debugging


def _default_rules() -> ScheduleRules:
    return ScheduleRules(
        work_start               = WORK_START,
        early_leave_limit        = EARLY_LEAVE_LIMIT,
        standard_start           = STANDARD_START,
        standard_end             = STANDARD_END,
        lunch_start              = LUNCH_START,
        lunch_end                = LUNCH_END,
        standard_work_hours      = STANDARD_WORK_HOURS,
        overtime_threshold_hours = OVERTIME_THRESHOLD_HOURS,
        schedule_name            = "default",
    )


def _rules_from_schedule(ws) -> ScheduleRules:
    """Convert a Django WorkSchedule ORM instance to ScheduleRules."""
    return ScheduleRules(
        work_start               = ws.work_start,
        early_leave_limit        = ws.early_leave_limit,
        standard_start           = ws.standard_start,
        standard_end             = ws.standard_end,
        lunch_start              = ws.lunch_start,
        lunch_end                = ws.lunch_end,
        standard_work_hours      = ws.standard_work_hours,
        overtime_threshold_hours = ws.overtime_threshold_hours,
        schedule_name            = ws.name,
    )


def get_schedule_for_employee(employee_id: int, on_date: date) -> ScheduleRules:
    """
    Priority (highest -> lowest):
      1. Schedule assigned directly to this employee
      2. Schedule assigned to the employee's section
      3. Schedule assigned to the employee's department
      4. Global defaults (constants above)

    Only schedules that are active and within their validity window are considered.
    Imported here inside the function to avoid circular imports with Django.
    """
    try:
        from django_hr.employees.models import WorkSchedule, Employee

        today = on_date

        def _qs(schedule_filter):
            return (
                WorkSchedule.objects
                .filter(
                    is_active=True,
                    **schedule_filter,
                )
                .filter(
                    models_Q(valid_from__isnull=True) | models_Q(valid_from__lte=today)
                )
                .filter(
                    models_Q(valid_until__isnull=True) | models_Q(valid_until__gte=today)
                )
                .order_by("-created_at")
                .first()
            )

        from django.db.models import Q as models_Q

        # 1. Employee-level
        ws = _qs({"employee_id": employee_id})
        if ws:
            return _rules_from_schedule(ws)

        try:
            emp = Employee.objects.only("section_id", "department_id").get(pk=employee_id)
        except Employee.DoesNotExist:
            return _default_rules()

        # 2. Section-level
        if emp.section_id:
            ws = _qs({"section_id": emp.section_id, "employee__isnull": True})
            if ws:
                return _rules_from_schedule(ws)

        # 3. Department-level
        if emp.department_id:
            ws = _qs({"department_id": emp.department_id,
                      "section__isnull": True, "employee__isnull": True})
            if ws:
                return _rules_from_schedule(ws)

    except Exception as e:
        logger.debug(f"Schedule rule lookup failed for employee {employee_id}, using defaults: {e}")

    return _default_rules()


# --------------------------------------------------
# DATA CLASSES
# --------------------------------------------------
@dataclass
class DayRecord:
    date: date
    day_name: str
    is_weekend: bool
    first_punch: Optional[datetime]
    last_punch: Optional[datetime]
    arrival: Optional[datetime]
    departure: Optional[datetime]
    hours_worked: Optional[float]
    overtime_hours: float
    is_late: bool
    is_early_leave: bool
    is_overtime: bool
    punch_count: int
    schedule_name: str          # which schedule was used for this day


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
    total_overtime_hours: float
    average_hours_per_day: float
    days: List[DayRecord]


# --------------------------------------------------
# HELPERS
# --------------------------------------------------
def _overlap_seconds(a_start: datetime, a_end: datetime,
                     b_start: datetime, b_end: datetime) -> int:
    """kept for potential future use but no longer used in core calc"""
    latest_start  = max(a_start, b_start)
    earliest_end  = min(a_end,   b_end)
    diff = (earliest_end - latest_start).total_seconds()
    return int(diff) if diff > 0 else 0


# --------------------------------------------------
# CORE ANALYSIS
# --------------------------------------------------
def _analyze_day(row, rules: ScheduleRules) -> DayRecord:
    day:        date                = row.date
    first:      Optional[datetime]  = getattr(row, "first_punch", None)
    last:       Optional[datetime]  = getattr(row, "last_punch",  None)
    punch_count: int                = int(getattr(row, "punch_count", 0) or 0)

    day_name   = day.strftime("%A")
    is_weekend = day.weekday() >= 5

    effective_count = 1 if (first and last and first == last) else punch_count

    arrival:   Optional[datetime] = None
    departure: Optional[datetime] = None

    if effective_count == 1:
        single_time = first or last
        if single_time and single_time.time().hour < 12:
            arrival   = single_time
            departure = None
        else:
            arrival   = None
            departure = single_time
    else:
        arrival   = first
        departure = last

    # ── Key reference datetimes ───────────────────────────────────────────
    standard_start_dt = datetime.combine(day, rules.standard_start)   # e.g. 07:30
    standard_end_dt   = datetime.combine(day, rules.standard_end)     # e.g. 16:30

    # ── Is the employee late? (UI flag only) ─────────────────────────────
    # Displayed as late on the interface when arrival is strictly after 07:35.
    # The overtime / hours_worked calc still uses standard_start (07:30).
    late_threshold_dt = datetime.combine(day, LATE_THRESHOLD)   # 07:35
    is_late = bool(arrival and arrival > late_threshold_dt)

    # ── Effective work start (for hours_worked calculation) ───────────────
    #
    #   • Early / on-time (arrival ≤ 07:30):
    #       Clock starts at 07:30 regardless of how early they arrived.
    #       hours_worked = departure − 07:30
    #
    #   • Late (arrival > 07:30):
    #       Clock starts at actual arrival.
    #       hours_worked = departure − arrival
    #
    if arrival:
        effective_work_start = max(arrival, standard_start_dt)
    else:
        effective_work_start = standard_start_dt

    # ── Effective standard end (for early-leave & overtime reference) ─────
    #
    #   • Early / on-time (arrival ≤ 07:30): standard_end fixed at 16:30.
    #   • Late (arrival > 07:30):            standard_end = arrival + 9h
    #     (arrival is always ≥ 07:35 when late, so arrival+9h always > 16:30)
    #
    if arrival and arrival > standard_start_dt:
        standard_end_dt = arrival + timedelta(hours=rules.standard_work_hours)

    # ── hours_worked ──────────────────────────────────────────────────────
    # = departure − effective_work_start, capped at standard_work_hours (9h)
    # No lunch deduction — employee is physically inside the premises.
    hours_worked: Optional[float] = None
    if arrival and departure and departure > effective_work_start:
        raw_seconds  = (departure - effective_work_start).total_seconds()
        raw_hours    = round(raw_seconds / 3600.0, 2)
        hours_worked = min(raw_hours, rules.standard_work_hours)

    # ── Overtime ──────────────────────────────────────────────────────────
    #
    # Overtime threshold = standard_end_dt + 29 min
    #   (standard_end_dt is already shifted forward for late employees)
    #
    # Overtime = departure − standard_end_dt  (when departure ≥ threshold)
    #
    # Examples (default schedule 07:30 / 16:30 / 9h):
    #
    #   Arrives 07:06 (early), leaves 17:31
    #     effective_work_start = 07:30  (clamped)
    #     standard_end         = 16:30  (fixed, not late)
    #     threshold            = 16:59
    #     hours_worked         = 17:31 − 07:30 = 10h01 → capped at 9h
    #     overtime             = 17:31 − 16:30 = 1h01  ✓
    #
    #   Arrives 07:30 (on-time), leaves 17:31
    #     effective_work_start = 07:30
    #     standard_end         = 16:30
    #     threshold            = 16:59
    #     hours_worked         = 17:31 − 07:30 = 10h01 → capped at 9h
    #     overtime             = 17:31 − 16:30 = 1h01  ✓
    #
    #   Arrives 07:45 (late), leaves 17:31
    #     effective_work_start = 07:45
    #     standard_end         = 07:45 + 9h = 16:45
    #     threshold            = 17:14
    #     hours_worked         = 17:31 − 07:45 = 9h46 → capped at 9h
    #     overtime             = 17:31 − 16:45 = 0h46  ✓
    #
    #   Arrives 08:00 (late), leaves 17:31
    #     effective_work_start = 08:00
    #     standard_end         = 08:00 + 9h = 17:00
    #     threshold            = 17:29
    #     hours_worked         = 17:31 − 08:00 = 9h31 → capped at 9h
    #     overtime             = 17:31 − 17:00 = 0h31  ✓
    #
    #   Arrives 07:30, leaves 16:50
    #     standard_end         = 16:30
    #     threshold            = 16:59
    #     16:50 < 16:59 → no overtime  ✓
    #
    overtime_hours = 0.0
    if arrival and departure:
        overtime_threshold_dt = standard_end_dt + timedelta(minutes=OVERTIME_MIN_MINUTES)
        if departure >= overtime_threshold_dt:
            overtime_seconds = (departure - standard_end_dt).total_seconds()
            overtime_hours   = round(max(0.0, overtime_seconds / 3600.0), 2)

    # ── Early-leave flag ──────────────────────────────────────────────────
    # Flagged when departure is before the employee's effective standard_end.
    # Weekend days are excluded (no expected departure time).
    is_early_leave = bool(
        departure and not is_weekend
        and departure < standard_end_dt
    )

    is_overtime = bool(overtime_hours > 0)

    return DayRecord(
        date           = day,
        day_name       = day_name,
        is_weekend     = is_weekend,
        first_punch    = first,
        last_punch     = last,
        arrival        = arrival,
        departure      = departure,
        hours_worked   = hours_worked,
        overtime_hours = overtime_hours,
        is_late        = is_late,
        is_early_leave = is_early_leave,
        is_overtime    = is_overtime,
        punch_count    = punch_count,
        schedule_name  = rules.schedule_name,
    )


async def compute_user_analysis(
    db: AsyncSession,
    user_id: int,
    date_from: date,
    date_to: date,
) -> Optional[UserAnalysis]:

    result = await db.execute(
        select(
            Attendance.date.label("date"),
            func.min(Attendance.timestamp).label("first_punch"),
            func.max(Attendance.timestamp).label("last_punch"),
            func.count(Attendance.id).label("punch_count"),
        )
        .where(
            and_(
                Attendance.user_id == user_id,
                Attendance.date    >= date_from,
                Attendance.date    <= date_to,
                Attendance.timestamp.isnot(None),
            )
        )
        .group_by(Attendance.date)
        .order_by(Attendance.date)
    )
    rows = result.all()
    if not rows:
        return None

    # Resolve rules once per day (schedule may have validity window)
    days = [
        _analyze_day(row, get_schedule_for_employee(user_id, row.date))
        for row in rows
    ]

    total_hours         = sum(d.hours_worked   for d in days if d.hours_worked)
    total_overtime      = sum(d.overtime_hours  for d in days)
    total_present       = len(days)
    total_late          = sum(1 for d in days if d.is_late)
    total_early_leave   = sum(1 for d in days if d.is_early_leave)
    total_overtime_days = sum(1 for d in days if d.is_overtime)
    total_weekend       = sum(1 for d in days if d.is_weekend)
    avg_hours           = round(total_hours / total_present, 2) if total_present else 0.0

    return UserAnalysis(
        user_id                = user_id,
        date_from              = date_from,
        date_to                = date_to,
        total_days_present     = total_present,
        total_days_late        = total_late,
        total_days_early_leave = total_early_leave,
        total_days_overtime    = total_overtime_days,
        total_weekend_days     = total_weekend,
        total_hours_worked     = round(total_hours,    2),
        total_overtime_hours   = round(total_overtime, 2),
        average_hours_per_day  = avg_hours,
        days                   = days,
    )
