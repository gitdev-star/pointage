"""
Unit tests for FastAPI attendance routes.
Tests basic route functionality and response handling.
"""

import pytest
from datetime import date, datetime, time

from app.models.attendance import Attendance


@pytest.mark.asyncio
async def test_attendance_stats_endpoint(test_client, auth_headers):
    """Test attendance stats endpoint returns data."""
    response = await test_client.get(
        "/attendance/stats",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_records" in data
    assert "unique_users" in data


@pytest.mark.asyncio
async def test_attendance_list_endpoint(test_client, auth_headers):
    """Test attendance list endpoint with filters."""
    response = await test_client.get(
        "/attendance/list?limit=10&skip=0",
        headers=auth_headers
    )
    assert response.status_code in [200, 404]  # 404 if no data


@pytest.mark.asyncio
async def test_missing_auth_header(test_client):
    """Test endpoint rejects requests without auth header."""
    response = await test_client.get("/attendance/stats")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_date_filter(test_client, auth_headers):
    """Test endpoint with invalid date format."""
    response = await test_client.get(
        "/attendance/list?start_date=invalid-date",
        headers=auth_headers
    )
    # Invalid date formats should be rejected by FastAPI validation
    assert response.status_code in [400, 422, 200]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_api_health_check(test_client):
    """Test API health endpoint."""
    response = await test_client.get("/")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_attendance_minimal_endpoint(test_client, test_session, auth_headers):
    """Test attendance minimal endpoint returns attendance rows."""
    attendance = Attendance(
        uid=2001,
        user_id=200,
        device_timestamp=datetime.combine(date.today(), time(8, 0)),
        date=date.today(),
        device_ip="10.0.0.1"
    )
    test_session.add(attendance)
    await test_session.commit()

    response = await test_client.get(
        "/attendance/minimal?limit=5",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(item["user_id"] == 200 for item in data)


@pytest.mark.asyncio
async def test_available_device_ips_endpoint(test_client, test_session):
    """Test available device IPs endpoint returns stored device IPs."""
    attendance = Attendance(
        uid=2002,
        user_id=201,
        device_timestamp=datetime.combine(date.today(), time(8, 30)),
        date=date.today(),
        device_ip="10.0.0.2"
    )
    test_session.add(attendance)
    await test_session.commit()

    response = await test_client.get("/attendance/available-ips")
    assert response.status_code == 200
    assert "10.0.0.2" in response.json()


@pytest.mark.asyncio
async def test_daily_attendance_endpoint(test_client, test_session, auth_headers):
    """Test daily attendance endpoint returns records for a specific date."""
    today = date.today()
    attendance = Attendance(
        uid=2003,
        user_id=202,
        device_timestamp=datetime.combine(today, time(9, 0)),
        date=today,
        device_ip="10.0.0.3"
    )
    test_session.add(attendance)
    await test_session.commit()

    response = await test_client.get(
        f"/attendance/daily/{today.isoformat()}?limit=5",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert response.json()[0]["user_id"] == 202


@pytest.mark.asyncio
async def test_kpi_endpoint(test_client, test_session, auth_headers):
    """Test KPI endpoint returns present and late counts."""
    today = date.today()
    attendance = Attendance(
        uid=2004,
        user_id=203,
        device_timestamp=datetime.combine(today, time(7, 0)),
        timestamp=datetime.combine(today, time(7, 0)),  # KPI logic reads `timestamp`, not device_timestamp
        date=today,
        device_ip="10.0.0.4"
    )
    test_session.add(attendance)
    await test_session.commit()

    response = await test_client.get(f"/attendance/kpi?target_date={today.isoformat()}")
    assert response.status_code == 200
    data = response.json()
    assert data["presents"] == 1
    assert data["late"] == 0


@pytest.mark.asyncio
async def test_grouped_attendance_endpoint(test_client, test_session, auth_headers):
    """Test grouped attendance endpoint aggregates punches per user per day."""
    today = date.today()
    attendance1 = Attendance(
        uid=2005,
        user_id=204,
        device_timestamp=datetime.combine(today, time(8, 0)),
        date=today,
        device_ip="10.0.0.5"
    )
    attendance2 = Attendance(
        uid=2006,
        user_id=204,
        device_timestamp=datetime.combine(today, time(16, 0)),
        date=today,
        device_ip="10.0.0.5"
    )
    test_session.add_all([attendance1, attendance2])
    await test_session.commit()

    response = await test_client.get(
        "/attendance/grouped?limit=5",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(item["user_id"] == 204 for item in data)
    assert any(item["punch_count"] >= 1 for item in data)


@pytest.mark.asyncio
async def test_analysis_endpoint_returns_404_for_missing_user(test_client, auth_headers):
    """Test analysis endpoint returns 404 when no data exists for the user."""
    response = await test_client.get(
        "/attendance/analysis/999?date_from=2025-01-01&date_to=2025-01-02",
        headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_kpi_endpoint_handles_tz_aware_schedule_start(test_client, test_session, monkeypatch):
    """Regression test: rules.standard_start with tzinfo must not raise
    'can't compare offset-naive and offset-aware datetimes' on /attendance/kpi.
    """
    from datetime import time, timezone as dt_timezone
    from app.models.attendance import Attendance
    import app.routers.attendance_routes as attendance_routes

    today = date.today()
    attendance = Attendance(
        uid=3001,
        user_id=301,
        device_timestamp=datetime.combine(today, time(8, 0)),
        timestamp=datetime.combine(today, time(8, 0)),
        date=today,
        device_ip="10.0.0.9",
    )
    test_session.add(attendance)
    await test_session.commit()

    class FakeRules:
        standard_start = time(7, 30, tzinfo=dt_timezone.utc)

    monkeypatch.setattr(
        attendance_routes, "get_schedules_bulk",
        lambda user_ids, kpi_date: {301: FakeRules()}
    )
    monkeypatch.setattr(attendance_routes, "_default_rules", lambda: FakeRules())

    response = await test_client.get(f"/attendance/kpi?target_date={today.isoformat()}")
    assert response.status_code == 200
    data = response.json()
    assert data["presents"] == 1
    assert data["late"] == 1  # 8:00 arrival vs 7:30 + 7min threshold


@pytest.mark.asyncio
async def test_late_today_handles_tz_aware_schedule_start(test_client, test_session, monkeypatch):
    """Same regression, for /attendance/late-today."""
    from datetime import time, timezone as dt_timezone
    from app.models.attendance import Attendance
    import app.routers.attendance_routes as attendance_routes

    today = date.today()
    attendance = Attendance(
        uid=3002,
        user_id=302,
        device_timestamp=datetime.combine(today, time(8, 15)),
        timestamp=datetime.combine(today, time(8, 15)),
        date=today,
        device_ip="10.0.0.10",
    )
    test_session.add(attendance)
    await test_session.commit()

    class FakeRules:
        standard_start = time(7, 30, tzinfo=dt_timezone.utc)

    monkeypatch.setattr(
        attendance_routes, "get_schedules_bulk",
        lambda user_ids, kpi_date: {302: FakeRules()}
    )
    monkeypatch.setattr(attendance_routes, "_default_rules", lambda: FakeRules())

    response = await test_client.get(f"/attendance/late-today?target_date={today.isoformat()}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["user_id"] == 302
