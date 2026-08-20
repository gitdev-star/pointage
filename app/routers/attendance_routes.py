# ============================================================
# app/routers/attendance_routes.py
# ============================================================
# HTTP layer only — no business logic here
# Delegates to services for any computation
# ============================================================

from typing import List, Optional
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, distinct, text
from pydantic import BaseModel, Field

from app.database import get_async_db
from app.models.attendance import Attendance
from app.auth.django_auth import get_current_user
# from app.services.analysis_service import compute_user_analysis
from app.services.analysis_service import _default_rules, compute_user_analysis, get_schedules_bulk

MADAGASCAR_TZ = ZoneInfo("Indian/Antananarivo")

router = APIRouter()

# --------------------------------------------------
# CACHE
# --------------------------------------------------
_stats_cache: dict = {}
_ip_cache: list = []
_ip_cache_time: Optional[datetime] = None
STATS_CACHE_TTL = 30    # seconds
IP_CACHE_TTL    = 300   # 5 minutes


def _cache_key(**kwargs) -> str:
    params = {k: str(v) for k, v in sorted(kwargs.items()) if v is not None}
    return hashlib.md5(json.dumps(params).encode()).hexdigest()


def _get_cache(cache: dict, key: str, ttl: int):
    if key in cache:
        data, ts = cache[key]
        if (datetime.now() - ts).total_seconds() < ttl:
            return data
    return None


def _set_cache(cache: dict, key: str, data):
    cache[key] = (data, datetime.now())


# --------------------------------------------------
# SCHEMAS
# --------------------------------------------------
class AttendanceResponse(BaseModel):
    id: int
    uid: int
    user_id: int
    device_ip: str
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


class DayRecordResponse(BaseModel):
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


class UserAnalysisResponse(BaseModel):
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
    days: List[DayRecordResponse]


# --------------------------------------------------
# FILTER BUILDER
# --------------------------------------------------
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

    if not period:
        if date_from:
            filters.append(Attendance.date >= date_from)
        if date_to:
            filters.append(Attendance.date <= date_to)

    if target_date and not period:
        filters.append(Attendance.date == target_date)

    if time_from or time_to:
        filter_date = target_date or date_from or date_to
        if filter_date:
            if time_from:
                filters.append(Attendance.timestamp >= datetime.combine(filter_date, time_from))
            if time_to:
                filters.append(Attendance.timestamp <= datetime.combine(filter_date, time_to))
        else:
            if time_from:
                filters.append(
                    func.extract('hour', Attendance.timestamp) * 3600 +
                    func.extract('minute', Attendance.timestamp) * 60 +
                    func.extract('second', Attendance.timestamp) >=
                    time_from.hour * 3600 + time_from.minute * 60 + time_from.second
                )
            if time_to:
                filters.append(
                    func.extract('hour', Attendance.timestamp) * 3600 +
                    func.extract('minute', Attendance.timestamp) * 60 +
                    func.extract('second', Attendance.timestamp) <=
                    time_to.hour * 3600 + time_to.minute * 60 + time_to.second
                )

    if user_id:
        filters.append(Attendance.user_id == user_id)
    if device_ip:
        if ',' in device_ip:
            ip_list = [ip.strip() for ip in device_ip.split(',')]
            filters.append(Attendance.device_ip.in_(ip_list))
        else:
            filters.append(Attendance.device_ip == device_ip)

    return filters


# --------------------------------------------------
# ROUTES
# --------------------------------------------------

@router.get("/secure-data")
async def secure_endpoint(user=Depends(get_current_user)):
    return {"message": f"Hello {user['username']}, this is protected by Django JWT!"}


@router.get("/list", response_model=List[AttendanceResponse])
@router.get("/", response_model=List[AttendanceResponse])
async def get_all_attendance(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=50000),
    user: dict = Depends(get_current_user),
    user_id: Optional[int] = Query(None),
    device_ip: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    time_from: Optional[time] = Query(None),
    time_to: Optional[time] = Query(None),
    target_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        filters = build_filters(
            period=period, user_id=user_id, device_ip=device_ip,
            date_from=date_from or start_date, date_to=date_to or end_date,
            time_from=time_from, time_to=time_to, target_date=target_date
        )
        filter_clause = and_(*filters) if filters else text("1=1")

        count_result = await db.execute(
            select(func.count(Attendance.id)).where(filter_clause)
        )
        total = count_result.scalar() or 0
        response.headers["X-Total-Count"] = str(total)

        query = (
            select(Attendance)
            .where(filter_clause)
            .order_by(desc(Attendance.timestamp))
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        return result.scalars().all()

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/minimal", response_model=List[MinimalAttendanceResponse])
async def get_minimal_attendance(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=50000),
    user: dict = Depends(get_current_user),
    user_id: Optional[int] = Query(None),
    device_ip: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    time_from: Optional[time] = Query(None),
    time_to: Optional[time] = Query(None),
    target_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        filters = build_filters(
            period=period, user_id=user_id, device_ip=device_ip,
            date_from=date_from, date_to=date_to,
            time_from=time_from, time_to=time_to, target_date=target_date
        )
        filter_clause = and_(*filters) if filters else text("1=1")

        count_result = await db.execute(
            select(func.count(Attendance.id)).where(filter_clause)
        )
        total = count_result.scalar() or 0
        response.headers["X-Total-Count"] = str(total)

        query = (
            select(
                Attendance.user_id,
                Attendance.timestamp,
                Attendance.date,
                Attendance.device_ip,
            )
            .where(filter_clause)
            .order_by(desc(Attendance.timestamp))
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        rows = result.all()

        return [
            MinimalAttendanceResponse(
                user_id=row.user_id,
                timestamp=row.timestamp,
                date=row.date,
                device_ip=row.device_ip,
            )
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=StatsResponse)
async def get_attendance_stats(
    user: dict = Depends(get_current_user),
    user_id: Optional[int] = Query(None),
    device_ip: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    time_from: Optional[time] = Query(None),
    time_to: Optional[time] = Query(None),
    target_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        key = _cache_key(
            user_id=user_id, device_ip=device_ip,
            date_from=date_from, date_to=date_to,
            time_from=time_from, time_to=time_to,
            target_date=target_date, period=period
        )
        cached = _get_cache(_stats_cache, key, STATS_CACHE_TTL)
        if cached:
            return cached

        filters = build_filters(
            period=period, user_id=user_id, device_ip=device_ip,
            date_from=date_from, date_to=date_to,
            time_from=time_from, time_to=time_to, target_date=target_date
        )
        filter_clause = and_(*filters) if filters else text("1=1")

        result = await db.execute(
            select(
                func.count(Attendance.id).label("total_records"),
                func.count(distinct(Attendance.user_id)).label("unique_users"),
                func.max(Attendance.timestamp).label("latest_punch"),
            ).where(filter_clause)
        )
        row = result.first()

        stats = StatsResponse(
            total_records=row.total_records or 0,
            unique_users=row.unique_users or 0,
            present_count=row.total_records or 0,
            absent_count=0,
            latest_punch=row.latest_punch,
        )
        _set_cache(_stats_cache, key, stats)
        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/{user_id}", response_model=UserAnalysisResponse)
async def get_user_analysis(
    user_id: int,
    date_from: date = Query(..., description="Start date e.g. 2026-02-01"),
    date_to: date = Query(..., description="End date e.g. 2026-02-17"),
    db: AsyncSession = Depends(get_async_db),
):
    """Full attendance analysis for one user over a date range."""
    result = await compute_user_analysis(db, user_id, date_from, date_to)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No records found for user {user_id} between {date_from} and {date_to}"
        )

    return result


@router.get("/analysis/{user_id}/export")
async def export_user_analysis_csv(
    user_id: int,
    date_from: date = Query(..., description="Start date e.g. 2026-02-01"),
    date_to: date = Query(..., description="End date e.g. 2026-02-17"),
    db: AsyncSession = Depends(get_async_db),
):
    """Export user analysis as CSV file."""
    result = await compute_user_analysis(db, user_id, date_from, date_to)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No records found for user {user_id} between {date_from} and {date_to}"
        )

    def fmt_time(dt):
        return dt.strftime("%H:%M") if dt else "—"

    def fmt_hours(h):
        if h is None or h == 0:
            return "0h00"
        hh = int(h)
        mm = int(round((h - hh) * 60))
        return f"{hh}h{mm:02d}"

    headers = ["Date", "Jour", "Arrivée", "Départ", "Heures", "Pointages", "Retard", "Départ tôt", "Heures sup.", "Week-end"]
    rows = [headers]

    for d in result.days:
        rows.append([
            str(d.date),
            d.day_name,
            fmt_time(d.arrival),
            fmt_time(d.departure),
            fmt_hours(d.hours_worked),
            str(d.punch_count),
            "Oui" if d.is_late else "Non",
            "Oui" if d.is_early_leave else "Non",
            "Oui" if d.is_overtime else "Non",
            "Oui" if d.is_weekend else "Non",
        ])

    csv_content = "\n".join([";".join(row) for row in rows])

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=analyse_employe{user_id}_{date_from}_{date_to}.csv"
        }
    )


@router.get("/available-ips", response_model=List[str])
async def get_available_device_ips(db: AsyncSession = Depends(get_async_db)):
    global _ip_cache, _ip_cache_time
    try:
        if _ip_cache and _ip_cache_time:
            if (datetime.now() - _ip_cache_time).total_seconds() < IP_CACHE_TTL:
                return _ip_cache

        result = await db.execute(
            select(distinct(Attendance.device_ip))
            .where(Attendance.device_ip.isnot(None))
            .order_by(Attendance.device_ip)
        )
        ips = [ip for ip in result.scalars().all() if ip]
        _ip_cache = ips
        _ip_cache_time = datetime.now()
        return ips

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/daily/{target_date}", response_model=List[AttendanceResponse])
async def get_daily_attendance(
    target_date: date,
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=50000),
    user_id: Optional[int] = Query(None),
    device_ip: Optional[str] = Query(None),
    time_from: Optional[time] = Query(None),
    time_to: Optional[time] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        filters = build_filters(
            period=None, user_id=user_id, device_ip=device_ip,
            date_from=target_date, date_to=target_date,
            time_from=time_from, time_to=time_to, target_date=target_date
        )
        filter_clause = and_(*filters) if filters else text("1=1")

        count_result = await db.execute(
            select(func.count(Attendance.id)).where(filter_clause)
        )
        total = count_result.scalar() or 0
        response.headers["X-Total-Count"] = str(total)

        query = (
            select(Attendance)
            .where(filter_clause)
            .order_by(Attendance.timestamp)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        return result.scalars().all()

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------------------------------
# KPI ENDPOINT
# --------------------------------------------------
class KpiResponse(BaseModel):
    date: date
    presents: int
    late: int
    late_threshold: str


@router.get("/kpi", response_model=KpiResponse)
async def get_daily_kpi(
    target_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    kpi_date = target_date or date.today()

    r1 = await db.execute(
        select(func.count(distinct(Attendance.user_id)))
        .where(Attendance.date == kpi_date)
    )
    presents = r1.scalar() or 0

    subq = (
        select(Attendance.user_id, func.min(Attendance.timestamp).label("first_punch"))
        .where(Attendance.date == kpi_date)
        .group_by(Attendance.user_id)
        .subquery()
    )
    r2 = await db.execute(select(subq.c.user_id, subq.c.first_punch))
    rows = r2.all()

    schedules = get_schedules_bulk([row.user_id for row in rows], kpi_date)
    default_rules = _default_rules()

    late = 0
    for row in rows:
        rules = schedules.get(row.user_id, default_rules)
        threshold = datetime.combine(kpi_date, rules.standard_start) + timedelta(minutes=7)
        if row.first_punch >= threshold:
            late += 1

    return KpiResponse(
        date=kpi_date,
        presents=presents,
        late=late,
        late_threshold="Standard : 07:36 (variable selon horaire personnalisé)",
    )
# --------------------------------------------------
# LATE TODAY — list of employees late today (same logic as /kpi)
# --------------------------------------------------
# --------------------------------------------------
# LATE TODAY — paginated list of employees late today (same logic as /kpi)
# --------------------------------------------------
class LateEmployeeResponse(BaseModel):
    user_id: int
    arrival: datetime
    minutes_late: int


@router.get("/late-today", response_model=List[LateEmployeeResponse])
async def get_late_today(
    response: Response,
    target_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    db: AsyncSession = Depends(get_async_db),
):
    kpi_date = target_date or date.today()

    subq = (
        select(Attendance.user_id, func.min(Attendance.timestamp).label("first_punch"))
        .where(Attendance.date == kpi_date)
        .group_by(Attendance.user_id)
        .subquery()
    )
    result = await db.execute(select(subq.c.user_id, subq.c.first_punch))
    all_rows = result.all()

    schedules = get_schedules_bulk([row.user_id for row in all_rows], kpi_date)
    default_rules = _default_rules()

    late_rows = []
    for row in all_rows:
        rules = schedules.get(row.user_id, default_rules)
        threshold = datetime.combine(kpi_date, rules.standard_start) + timedelta(minutes=7)
        if row.first_punch >= threshold:
            late_rows.append((row.user_id, row.first_punch, threshold))

    late_rows.sort(key=lambda r: r[1])

    total = len(late_rows)
    response.headers["X-Total-Count"] = str(total)
    page = late_rows[skip: skip + limit]

    return [
        LateEmployeeResponse(
            user_id=uid,
            arrival=arrival,
            minutes_late=int((arrival - threshold).total_seconds() // 60),
        )
        for uid, arrival, threshold in page
    ]
# --------------------------------------------------
# PRESENT TODAY — lightweight list of user_ids present (for factory aggregation)
# --------------------------------------------------
class PresentUserResponse(BaseModel):
    user_id: int


@router.get("/present-today", response_model=List[PresentUserResponse])
async def get_present_today(
    target_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    """Returns the list of distinct user_ids present on the given day.
    Lightweight — used to compute per-factory presence/late rates on the frontend."""
    kpi_date = target_date or date.today()

    result = await db.execute(
        select(distinct(Attendance.user_id))
        .where(Attendance.date == kpi_date)
    )
    rows = result.scalars().all()

    return [PresentUserResponse(user_id=uid) for uid in rows]

# --------------------------------------------------
# GROUPED ATTENDANCE — first/last punch per user per day
# --------------------------------------------------
class GroupedAttendanceResponse(BaseModel):
    user_id: int
    attendance_date: date
    arrival: Optional[datetime]
    departure: Optional[datetime]
    punch_count: int
    device_ip: Optional[str]


@router.get("/grouped", response_model=List[GroupedAttendanceResponse])
async def get_grouped_attendance(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=50000),
    user_id: Optional[int] = Query(None),
    device_ip: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    time_from: Optional[time] = Query(None),
    time_to: Optional[time] = Query(None),
    target_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    """Returns one row per user per day with first punch (arrival) and last punch (departure)."""
    filters = build_filters(
        period=period, user_id=user_id, device_ip=device_ip,
        date_from=date_from, date_to=date_to,
        time_from=time_from, time_to=time_to,
        target_date=target_date,
    )
    filter_clause = and_(*filters) if filters else text("1=1")

    # Subquery-based count — works on both SQLite and PostgreSQL (no concat needed)
    count_subq = (
        select(Attendance.user_id, Attendance.date)
        .where(filter_clause)
        .group_by(Attendance.user_id, Attendance.date)
        .subquery()
    )
    count_result = await db.execute(select(func.count()).select_from(count_subq))
    total = count_result.scalar() or 0
    response.headers["X-Total-Count"] = str(total)

    query = (
        select(
            Attendance.user_id,
            Attendance.date.label("attendance_date"),
            func.min(Attendance.timestamp).label("arrival"),
            func.max(Attendance.timestamp).label("departure"),
            func.count(Attendance.id).label("punch_count"),
            func.max(Attendance.device_ip).label("device_ip"),
        )
        .where(filter_clause)
        .group_by(Attendance.user_id, Attendance.date)
        .order_by(desc(Attendance.date), Attendance.user_id)
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    return [
        GroupedAttendanceResponse(
            user_id=row.user_id,
            attendance_date=row.attendance_date,
            arrival=row.arrival,
            departure=(
                row.departure
                if (
                    row.punch_count > 1
                    and row.arrival != row.departure
                    and (row.departure - row.arrival).total_seconds() >= 30 * 60
                )
                else None
            ),
            punch_count=row.punch_count,
            device_ip=row.device_ip,
        )
        for row in rows
    ]
