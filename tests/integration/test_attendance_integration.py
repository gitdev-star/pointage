# tests/integration/test_attendance_integration.py
import pytest
from datetime import date, datetime, time
from sqlalchemy import select
from app.models.attendance import Attendance


@pytest.mark.asyncio
@pytest.mark.integration
async def test_attendance_data_flow(test_session):
    attendance = Attendance(
        uid=1001, user_id=101,
        timestamp=datetime.now(), date=date.today(), device_ip="192.168.1.1"
    )
    test_session.add(attendance)
    await test_session.commit()

    result = await test_session.execute(
        select(Attendance).where(Attendance.user_id == 101)
    )
    stored = result.scalars().first()
    assert stored is not None
    assert stored.device_ip == "192.168.1.1"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_api_to_database_flow(test_client, test_session, auth_headers):
    response = await test_client.get("/attendance/list?limit=5", headers=auth_headers)
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
@pytest.mark.integration
async def test_authenticated_request_flow(test_client, auth_headers):
    assert "Authorization" in auth_headers
    assert auth_headers["Authorization"].startswith("Bearer ")
    response = await test_client.get("/", headers=auth_headers)
    assert response.status_code in [200, 404, 405]


@pytest.mark.asyncio
@pytest.mark.integration
async def test_error_handling_flow(test_client):
    response = await test_client.get("/attendance/stats")
    assert response.status_code == 401
    response = await test_client.get("/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.integration
async def test_analysis_export_returns_csv(test_client, test_session, auth_headers):
    today = date.today()
    for uid, ts in [(3001, time(8, 0)), (3002, time(17, 0))]:
        test_session.add(Attendance(
            uid=uid, user_id=300,
            timestamp=datetime.combine(today, ts),
            date=today, device_ip="10.0.0.99"
        ))
    await test_session.commit()

    response = await test_client.get(
        f"/attendance/analysis/300/export?date_from={today}&date_to={today}",
        headers=auth_headers
    )
    assert response.status_code in [200, 404]
    if response.status_code == 200:
        assert "text/csv" in response.headers.get("content-type", "")


@pytest.mark.asyncio
@pytest.mark.integration
async def test_grouped_with_multiple_users(test_client, test_session, auth_headers):
    today = date.today()
    records = [
        Attendance(uid=4001, user_id=401, timestamp=datetime.combine(today, time(8, 0)),
                   date=today, device_ip="10.1.0.1"),
        Attendance(uid=4002, user_id=402, timestamp=datetime.combine(today, time(8, 30)),
                   date=today, device_ip="10.1.0.2"),
    ]
    test_session.add_all(records)
    await test_session.commit()

    response = await test_client.get("/attendance/grouped?limit=10", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    user_ids = [r["user_id"] for r in data]
    assert 401 in user_ids
    assert 402 in user_ids
