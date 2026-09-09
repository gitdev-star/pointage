"""
Integration tests for late-arrival alert recipient assignments
(LateAlertAssignmentViewSet) and the notify_late_employees() email util —
mirrors the existing CDD/maternity notification-assignment test pattern.
"""

import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture
def late_alert_assignment(test_factory):
    from alerts.models import LateAlertAssignment
    return LateAlertAssignment.objects.create(
        factory=test_factory,
        email="chef.usine@example.com",
        username="Chef Usine",
        is_active=True,
    )


class TestLateAlertAssignmentViewSet:

    def test_requires_auth(self, api_client):
        resp = api_client.get("/api/alerts/late-notifications/")
        assert resp.status_code == 401

    def test_lists_assignments_with_factory_name(
        self, authenticated_client, hr_profile, late_alert_assignment, test_factory
    ):
        resp = authenticated_client.get("/api/alerts/late-notifications/")
        assert resp.status_code == 200
        results = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        assert len(results) == 1
        assert results[0]["factory_name"] == test_factory.name
        assert results[0]["email"] == "chef.usine@example.com"

    def test_creates_assignment(self, authenticated_client, hr_profile, test_factory):
        resp = authenticated_client.post("/api/alerts/late-notifications/", {
            "factory": test_factory.id,
            "email": "rh@example.com",
            "username": "RH",
            "is_active": True,
        })
        assert resp.status_code == 201
        from alerts.models import LateAlertAssignment
        assert LateAlertAssignment.objects.filter(email="rh@example.com", factory=test_factory).exists()

    def test_rejects_duplicate_factory_email_pair(
        self, authenticated_client, hr_profile, late_alert_assignment, test_factory
    ):
        resp = authenticated_client.post("/api/alerts/late-notifications/", {
            "factory": test_factory.id,
            "email": late_alert_assignment.email,
            "is_active": True,
        })
        assert resp.status_code == 400

    def test_updates_assignment(self, authenticated_client, hr_profile, late_alert_assignment):
        resp = authenticated_client.patch(
            f"/api/alerts/late-notifications/{late_alert_assignment.id}/",
            {"is_active": False},
        )
        assert resp.status_code == 200
        late_alert_assignment.refresh_from_db()
        assert late_alert_assignment.is_active is False

    def test_deletes_assignment(self, authenticated_client, hr_profile, late_alert_assignment):
        resp = authenticated_client.delete(f"/api/alerts/late-notifications/{late_alert_assignment.id}/")
        assert resp.status_code == 204
        from alerts.models import LateAlertAssignment
        assert not LateAlertAssignment.objects.filter(id=late_alert_assignment.id).exists()

    def test_filters_by_factory(self, authenticated_client, hr_profile, test_factory, late_alert_assignment):
        from employees.models import Factory
        from alerts.models import LateAlertAssignment
        other_factory = Factory.objects.create(name="Other Factory", location="Elsewhere")
        LateAlertAssignment.objects.create(factory=other_factory, email="other@example.com")

        resp = authenticated_client.get(f"/api/alerts/late-notifications/?factory={test_factory.id}")
        assert resp.status_code == 200
        results = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        assert len(results) == 1
        assert results[0]["email"] == late_alert_assignment.email

    def test_filters_by_is_active(self, authenticated_client, hr_profile, test_factory, late_alert_assignment):
        from alerts.models import LateAlertAssignment
        LateAlertAssignment.objects.create(factory=test_factory, email="inactive@example.com", is_active=False)

        resp = authenticated_client.get("/api/alerts/late-notifications/?is_active=true")
        assert resp.status_code == 200
        results = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        emails = {r["email"] for r in results}
        assert "inactive@example.com" not in emails
        assert late_alert_assignment.email in emails


class TestNotifyLateEmployeesEmailUtil:
    """Tests email_utils.notify_late_employees() directly — independent
    of whatever cron/management-command schedules it at 10h00."""

    def test_sends_email_to_all_recipients(self, test_factory):
        from django.core import mail
        from alerts.email_utils import notify_late_employees

        late_employees = [
            {"full_name": "Marie Rakoto", "employee_id": "EMP001",
             "job_title": "Opérateur", "arrival_time": "08:15", "minutes_late": 15},
            {"full_name": "Jean Rabe", "employee_id": "EMP002",
             "job_title": "Technicien", "arrival_time": "08:05", "minutes_late": 5},
        ]
        recipients = ["chef1@example.com", "chef2@example.com"]

        notify_late_employees(test_factory, late_employees, recipients)

        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert set(recipients).issubset(set(sent.to))
        assert test_factory.name in sent.subject
        assert "2" in sent.subject  # count in subject line

    def test_no_recipients_does_not_raise(self, test_factory):
        from alerts.email_utils import notify_late_employees
        notify_late_employees(test_factory, [], [])
