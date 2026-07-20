# tests/integration/test_hr_events_api.py
"""
QE gap: hr_events/ (employee status side-effects + type-specific
validation rules) had no dedicated coverage.
"""
import pytest
from datetime import date, timedelta

pytestmark = pytest.mark.django_db


@pytest.fixture
def event_type_departure():
    from hr_events.models import HREventType
    obj, created = HREventType.objects.get_or_create(
        name="Démission",
        defaults=dict(
            code="DEMISSION", category="DEPARTURE",
            affects_status=True, target_status="TERMINATED",
        ),
    )
    if not created:
        obj.code, obj.category = "DEMISSION", "DEPARTURE"
        obj.affects_status, obj.target_status = True, "TERMINATED"
        obj.save()
    return obj


@pytest.fixture
def event_type_perm_heure():
    from hr_events.models import HREventType
    return HREventType.objects.create(
        name="Permission (heure)", code="PERM_HEURE", category="PERMISSION",
    )


@pytest.fixture
def event_type_perm_jour():
    from hr_events.models import HREventType
    return HREventType.objects.create(
        name="Permission (jour)", code="PERM_JOUR", category="PERMISSION",
    )


class TestHREventStatusSideEffects:

    def test_departure_event_terminates_employee(
        self, authenticated_client, hr_profile, test_employee, event_type_departure
    ):
        resp = authenticated_client.post("/api/hr-events/", {
            "employee": test_employee.id,
            "event_type": event_type_departure.id,
            "start_date": str(date.today()),
            "end_date": str(date.today()),
        })
        assert resp.status_code == 201
        test_employee.refresh_from_db()
        assert test_employee.status == "TERMINATED"

    def test_event_without_affects_status_leaves_employee_untouched(
        self, authenticated_client, hr_profile, test_employee, event_type_perm_jour
    ):
        authenticated_client.post("/api/hr-events/", {
            "employee": test_employee.id,
            "event_type": event_type_perm_jour.id,
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=1)),
        })
        test_employee.refresh_from_db()
        assert test_employee.status == "ACTIVE"


class TestHREventTypeSpecificValidation:

    def test_perm_heure_requires_duration_hours(
        self, authenticated_client, hr_profile, test_employee, event_type_perm_heure
    ):
        resp = authenticated_client.post("/api/hr-events/", {
            "employee": test_employee.id,
            "event_type": event_type_perm_heure.id,
            "start_date": str(date.today()),
        })
        assert resp.status_code == 400
        assert "duration_hours" in resp.data

    def test_perm_heure_clears_end_date(
        self, authenticated_client, hr_profile, test_employee, event_type_perm_heure
    ):
        resp = authenticated_client.post("/api/hr-events/", {
            "employee": test_employee.id,
            "event_type": event_type_perm_heure.id,
            "start_date": str(date.today()),
            "end_date": str(date.today()),
            "duration_hours": "2.5",
        })
        assert resp.status_code == 201
        assert resp.data["end_date"] is None

    def test_perm_jour_requires_end_date(
        self, authenticated_client, hr_profile, test_employee, event_type_perm_jour
    ):
        resp = authenticated_client.post("/api/hr-events/", {
            "employee": test_employee.id,
            "event_type": event_type_perm_jour.id,
            "start_date": str(date.today()),
        })
        assert resp.status_code == 400
        assert "end_date" in resp.data

    def test_departure_requires_end_date(
        self, authenticated_client, hr_profile, test_employee, event_type_departure
    ):
        resp = authenticated_client.post("/api/hr-events/", {
            "employee": test_employee.id,
            "event_type": event_type_departure.id,
            "start_date": str(date.today()),
        })
        assert resp.status_code == 400
        assert "end_date" in resp.data


class TestHREventSummary:

    def test_summary_only_counts_active_events(
        self, authenticated_client, hr_profile, test_employee, event_type_perm_jour
    ):
        from hr_events.models import HREvent
        HREvent.objects.create(
            employee=test_employee, event_type=event_type_perm_jour,
            start_date=date.today(), end_date=date.today() + timedelta(days=1),
            status="ACTIVE", created_by=1,
        )
        HREvent.objects.create(
            employee=test_employee, event_type=event_type_perm_jour,
            start_date=date.today(), end_date=date.today() + timedelta(days=1),
            status="CANCELLED", created_by=1,
        )
        resp = authenticated_client.get("/api/hr-events/summary/")
        assert resp.status_code == 200
        row = next(r for r in resp.data if r["event_type__code"] == "PERM_JOUR")
        assert row["count"] == 1

    def test_requires_active_hr_profile(self, authenticated_client, test_employee):
        resp = authenticated_client.get("/api/hr-events/summary/")
        assert resp.status_code == 403