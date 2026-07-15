# tests/integration/test_events_api.py
"""QE gap: events/ (holidays, company events, shift scheduling) untested."""
import pytest
from datetime import date

pytestmark = pytest.mark.django_db


class TestPublicHoliday:

    def test_create_and_list(self, authenticated_client):
        resp = authenticated_client.post("/api/events/holidays/", {
            "name": "Fête de l'Indépendance", "date": "2026-06-26", "year": 2026,
        })
        assert resp.status_code == 201

    def test_duplicate_date_and_name_rejected(self, authenticated_client):
        from events.models import PublicHoliday
        PublicHoliday.objects.create(name="Nouvel An", date=date(2026, 1, 1), year=2026)
        resp = authenticated_client.post("/api/events/holidays/", {
            "name": "Nouvel An", "date": "2026-01-01", "year": 2026,
        })
        assert resp.status_code == 400


class TestCompanyEvent:

    def test_created_by_is_set_from_authenticated_user_not_client(
        self, authenticated_client, test_user
    ):
        resp = authenticated_client.post("/api/events/company/", {
            "title": "Réunion trimestrielle",
            "start_datetime": "2026-08-01T09:00:00Z",
            "end_datetime": "2026-08-01T11:00:00Z",
        })
        assert resp.status_code == 201
        assert resp.data["created_by"] == test_user.id

    def test_created_by_cannot_be_spoofed_by_client(self, authenticated_client, test_user):
        resp = authenticated_client.post("/api/events/company/", {
            "title": "Réunion", "created_by": 99999,
            "start_datetime": "2026-08-01T09:00:00Z",
            "end_datetime": "2026-08-01T11:00:00Z",
        })
        assert resp.status_code == 201
        assert resp.data["created_by"] == test_user.id  # not 99999


class TestShiftAssignment:

    def test_assign_shift_to_employee(self, authenticated_client, test_employee):
        from events.models import ShiftSchedule
        shift = ShiftSchedule.objects.create(
            name="Matin", code="MATIN", start_time="06:00", end_time="14:00",
        )
        resp = authenticated_client.post("/api/events/employee-shifts/", {
            "employee": test_employee.id, "shift": shift.id,
            "start_date": str(date.today()),
        })
        assert resp.status_code == 201
        assert resp.data["shift_name"] == "Matin"
        assert resp.data["employee_name"] == test_employee.full_name

    def test_filter_shifts_by_employee(self, authenticated_client, test_employee):
        from events.models import ShiftSchedule, EmployeeShift
        shift = ShiftSchedule.objects.create(
            name="Nuit", code="NUIT", start_time="22:00", end_time="06:00",
        )
        EmployeeShift.objects.create(employee=test_employee, shift=shift, start_date=date.today())
        resp = authenticated_client.get(f"/api/events/employee-shifts/?employee={test_employee.id}")
        assert resp.status_code == 200
        assert len(resp.data) == 1