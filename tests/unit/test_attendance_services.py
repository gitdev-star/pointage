from datetime import date, datetime, time
from types import SimpleNamespace

from app.services.analysis_service import (
    _analyze_day,
    _overlap_seconds,
    _default_rules,
    ScheduleRules,
)
from app.services.late_report_service import _hhmm, _minutes_late


def test_overlap_seconds_no_overlap():
    assert _overlap_seconds(
        datetime(2026, 1, 1, 8, 0),
        datetime(2026, 1, 1, 9, 0),
        datetime(2026, 1, 1, 9, 0),
        datetime(2026, 1, 1, 10, 0),
    ) == 0


def test_overlap_seconds_partial_overlap():
    assert _overlap_seconds(
        datetime(2026, 1, 1, 8, 0),
        datetime(2026, 1, 1, 10, 0),
        datetime(2026, 1, 1, 9, 0),
        datetime(2026, 1, 1, 11, 0),
    ) == 3600


def test_analyze_day_single_punch_before_noon():
    rules = _default_rules()
    row = SimpleNamespace(
        date=date(2026, 1, 1),
        first_punch=datetime(2026, 1, 1, 8, 0),
        last_punch=datetime(2026, 1, 1, 8, 0),
        punch_count=1,
    )

    day = _analyze_day(row, rules)

    assert day.arrival == row.first_punch
    assert day.departure is None
    assert day.is_late is True
    assert day.hours_worked is None
    assert day.overtime_hours == 0.0


def test_analyze_day_full_day():
    rules = _default_rules()
    row = SimpleNamespace(
        date=date(2026, 1, 1),
        first_punch=datetime(2026, 1, 1, 8, 0),
        last_punch=datetime(2026, 1, 1, 17, 0),
        punch_count=2,
    )

    day = _analyze_day(row, rules)

    assert day.arrival == row.first_punch
    assert day.departure == row.last_punch
    assert day.hours_worked == 9.0
    assert day.overtime_hours == 0.0
    assert day.is_late is True
    assert day.is_weekend is False


def test_hhmm_formats_datetime_correctly():
    dt = datetime(2026, 1, 1, 9, 30)
    assert _hhmm(dt) == "09:30"
    assert _hhmm(None) is None


def test_minutes_late_calculation():
    rules = ScheduleRules(
        work_start=time(7, 40),
        early_leave_limit=time(16, 27),
        standard_start=time(7, 30),
        standard_end=time(16, 30),
        lunch_start=time(12, 0),
        lunch_end=time(13, 0),
        standard_work_hours=8.0,
        overtime_threshold_hours=8.5,
        schedule_name="default",
    )
    arrival = datetime(2026, 1, 1, 8, 10)
    assert _minutes_late(arrival, rules) == 30
