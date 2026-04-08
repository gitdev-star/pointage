# =====================================================
# PATH: pointage/app/services/analysis_service.py
# =====================================================
from datetime import date, time, datetime, timedelta
from typing import List, Optional
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.attendance import Attendance

# --------------------------------------------------
# GLOBAL WORK RULES — fallback when no custom schedule found
# --------------------------------------------------
WORK_START              = time(7, 40)
EARLY_LEAVE_LIMIT       = time(16, 27)
STANDARD_START          = time(7, 30)
STANDARD_END            = time(16, 30)
LUNCH_START             = time(12, 0)
LUNCH_END               = time(13, 0)
STANDARD_WORK_HOURS     = 8.0
OVERTIME_THRESHOLD      = time(17, 0)
OVERTIME_MIN_MINUTES    = 30
OVERTIME_THRESHOLD_HOURS = 8.5


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
    Priority (highest → lowest):
      1. Schedule assigned directly to this employee
      2. Schedule assigned to the employee's section
      3. Schedule assigned to the employee's department
      4. Global defaults (constants above)

    Only schedules that are active and within their validity window are considered.
    Imported here inside the function to avoid circular imports with Django.
    """
    try:
        # Django ORM — safe to import here (runs in sync context via
        # asyncio.to_thread or inside a sync FastAPI dependency)
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
                    # valid_from is null OR <= today
                    models_Q(valid_from__isnull=True) | models_Q(valid_from__lte=today)
                )
                .filter(
                    # valid_until is null OR >= today
                    models_Q(valid_until__isnull=True) | models_Q(valid_until__gte=today)
                )
                .order_by("-created_at")   # most recently created wins ties
                .first()
            )

        from django.db.models import Q as models_Q

        # 1. Employee-level
        ws = _qs({"employee_id": employee_id})
        if ws:
            return _rules_from_schedule(ws)

        # Need the employee's section & department for steps 2 & 3
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

    except Exception:
        # If Django is unavailable (e.g. standalone FastAPI mode) fall back silently
        pass

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
    schedule_name: str          # ← which schedule was used for this day


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
    latest_start  = max(a_start, b_start)
    earliest_end  = min(a_end,   b_end)
    diff = (earliest_end - latest_start).total_seconds()
    return int(diff) if diff > 0 else 0


# --------------------------------------------------
# CORE ANALYSIS  (now schedule-aware)
# --------------------------------------------------
def _analyze_day(row, rules: ScheduleRules) -> DayRecord:
    day:        date           = row.date
    first:      Optional[datetime] = getattr(row, "first_punch", None)
    last:       Optional[datetime] = getattr(row, "last_punch",  None)
    punch_count: int           = int(getattr(row, "punch_count", 0) or 0)

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

    # ── Hours worked ────────────────────────────────────────────────────────
    total_worked_seconds = 0
    if arrival and departure and arrival < departure:
        total_worked_seconds = int((departure - arrival).total_seconds())

        lunch_start_dt = datetime.combine(day, rules.lunch_start)
        lunch_end_dt   = datetime.combine(day, rules.lunch_end)
        lunch_overlap  = _overlap_seconds(arrival, departure, lunch_start_dt, lunch_end_dt)
        total_worked_seconds = max(0, total_worked_seconds - lunch_overlap)

    total_hours_worked = round(total_worked_seconds / 3600.0, 2) if total_worked_seconds > 0 else 0.0
    hours_worked = (
        min(total_hours_worked, rules.standard_work_hours)
        if total_hours_worked > 0 else None
    )

    # ── Overtime ─────────────────────────────────────────────────────────────
    overtime_hours = 0.0
    if total_hours_worked > rules.overtime_threshold_hours:
        overtime_hours = round(total_hours_worked - rules.overtime_threshold_hours, 2)
        if overtime_hours < 0.5:
            overtime_hours = 0.0

    # ── Flags (use schedule-specific thresholds) ─────────────────────────────
    is_late        = bool(arrival   and arrival.time()   > rules.work_start)
    is_early_leave = bool(departure and departure.time() < rules.early_leave_limit and not is_weekend)
    is_overtime    = bool(overtime_hours > 0)

    return DayRecord(
        date          = day,
        day_name      = day_name,
        is_weekend    = is_weekend,
        first_punch   = first,
        last_punch    = last,
        arrival       = arrival,
        departure     = departure,
        hours_worked  = hours_worked,
        overtime_hours= overtime_hours,
        is_late       = is_late,
        is_early_leave= is_early_leave,
        is_overtime   = is_overtime,
        punch_count   = punch_count,
        schedule_name = rules.schedule_name,
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

    total_hours       = sum(d.hours_worked  for d in days if d.hours_worked)
    total_overtime    = sum(d.overtime_hours for d in days)
    total_present     = len(days)
    total_late        = sum(1 for d in days if d.is_late)
    total_early_leave = sum(1 for d in days if d.is_early_leave)
    total_overtime_days = sum(1 for d in days if d.is_overtime)
    total_weekend     = sum(1 for d in days if d.is_weekend)
    avg_hours         = round(total_hours / total_present, 2) if total_present else 0.0

    return UserAnalysis(
        user_id              = user_id,
        date_from            = date_from,
        date_to              = date_to,
        total_days_present   = total_present,
        total_days_late      = total_late,
        total_days_early_leave = total_early_leave,
        total_days_overtime  = total_overtime_days,
        total_weekend_days   = total_weekend,
        total_hours_worked   = round(total_hours,    2),
        total_overtime_hours = round(total_overtime, 2),
        average_hours_per_day= avg_hours,
        days                 = days,
    )
