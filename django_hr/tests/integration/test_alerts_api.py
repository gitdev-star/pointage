import pytest
from datetime import date, timedelta
from django.core import mail

pytestmark = pytest.mark.django_db


@pytest.fixture
def cdd_employee(test_factory, test_department, test_section, test_poste):
    from employees.models import Employee
    return Employee.objects.create(
        employee_id="CDD001",
        first_name="Marie",
        last_name="Rakoto",
        email="marie@example.com",
        factory=test_factory,
        department=test_department,
        section=test_section,
        job_title=test_poste,
        hire_date=date(2024, 1, 1),
        contract_type="CDD",
        status="ACTIVE",
        termination_date=date.today() + timedelta(days=20),
    )


@pytest.fixture
def cdd_alert(cdd_employee):
    from alerts.models import CDDAlert
    return CDDAlert.objects.create(
        employee=cdd_employee,
        termination_date=cdd_employee.termination_date,
        days_remaining=20,
        alert_threshold=30,
        status="PENDING",
    )


class TestCDDAlertActions:

    def test_send_email_marks_alert_sent(self, authenticated_client, hr_profile, cdd_alert):
        resp = authenticated_client.post(f"/api/alerts/cdd/{cdd_alert.id}/send_email/")
        assert resp.status_code == 200
        cdd_alert.refresh_from_db()
        assert cdd_alert.status == "SENT"
        assert cdd_alert.email_sent_to
        assert len(mail.outbox) >= 1

    def test_mark_renewed_updates_status_and_note(self, authenticated_client, hr_profile, cdd_alert):
        resp = authenticated_client.post(
            f"/api/alerts/cdd/{cdd_alert.id}/mark_renewed/", {"note": "Renouvelé 6 mois"}
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "RENEWED"
        assert resp.data["note"] == "Renouvelé 6 mois"

    def test_mark_ignored_updates_status(self, authenticated_client, hr_profile, cdd_alert):
        resp = authenticated_client.post(f"/api/alerts/cdd/{cdd_alert.id}/mark_ignored/")
        assert resp.status_code == 200
        assert resp.data["status"] == "IGNORED"


class TestExpiringCDDView:

    def test_lists_employees_within_threshold(self, authenticated_client, hr_profile, cdd_employee):
        resp = authenticated_client.get("/api/alerts/expiring/?days=90")
        assert resp.status_code == 200
        assert resp.data["total"] == 1
        row = resp.data["employees"][0]
        assert row["employee_id"] == "CDD001"
        assert row["urgency"] in ("critical", "warning", "info")

    def test_excludes_employees_outside_threshold(self, authenticated_client, hr_profile, cdd_employee):
        resp = authenticated_client.get("/api/alerts/expiring/?days=5")
        assert resp.status_code == 200
        assert resp.data["total"] == 0

    def test_requires_auth(self, api_client):
        resp = api_client.get("/api/alerts/expiring/")
        assert resp.status_code == 401


class TestSendBulkAlertsView:

    def test_sends_to_configured_assignment_and_creates_alerts(
        self, authenticated_client, hr_profile, cdd_employee, test_factory
    ):
        from alerts.models import CDDNotificationAssignment, CDDAlert
        CDDNotificationAssignment.objects.create(
            auth_user_id=hr_profile.auth_user_id,
            username=hr_profile.username,
            email="rh-lead@example.com",
            factory=test_factory,
            is_active=True,
        )
        resp = authenticated_client.post("/api/alerts/send-bulk/", {"days": 90})
        assert resp.status_code == 200
        assert resp.data["sent"] == 1
        assert CDDAlert.objects.filter(employee=cdd_employee, status="SENT").exists()

    def test_no_expiring_employees_returns_message(self, authenticated_client, hr_profile):
        resp = authenticated_client.post("/api/alerts/send-bulk/", {"days": 5})
        assert resp.status_code == 200
        assert "Aucun CDD" in resp.data["detail"]

    def test_falls_back_to_requesting_profile_when_no_assignments(
        self, authenticated_client, hr_profile, cdd_employee
    ):
        resp = authenticated_client.post("/api/alerts/send-bulk/", {"days": 90})
        assert resp.status_code == 200
        assert resp.data["sent"] == 1


class TestInAppNotifications:

    def test_requires_alerts_read_permission(self, authenticated_client, hr_profile):
        # hr_profile fixture now grants every perm_* flag by default (see conftest.py) —
        # explicitly strip this one to test the denial path.
        hr_profile.perm_alerts_read = False
        hr_profile.save()
        resp = authenticated_client.get("/api/alerts/inbox/")
        assert resp.status_code == 403

    def test_lists_notifications_for_user_and_broadcasts(self, authenticated_client, hr_profile, test_user):
        from alerts.models import InAppNotification
        hr_profile.perm_alerts_read = True
        hr_profile.save()
        InAppNotification.objects.create(
            auth_user_id=test_user.id, title="Mine", message="m", category="system",
        )
        InAppNotification.objects.create(
            auth_user_id=None, title="Broadcast", message="b", category="system",
        )
        InAppNotification.objects.create(
            auth_user_id=999999, title="Someone else's", message="x", category="system",
        )
        resp = authenticated_client.get("/api/alerts/inbox/")
        assert resp.status_code == 200
        titles = {row["title"] for row in resp.data}
        assert titles == {"Mine", "Broadcast"}

    def test_unread_count(self, authenticated_client, hr_profile, test_user):
        from alerts.models import InAppNotification
        hr_profile.perm_alerts_read = True
        hr_profile.save()
        InAppNotification.objects.create(
            auth_user_id=test_user.id, title="A", message="m", is_read=False,
        )
        InAppNotification.objects.create(
            auth_user_id=test_user.id, title="B", message="m", is_read=True,
        )
        resp = authenticated_client.get("/api/alerts/inbox/unread_count/")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_mark_all_read(self, authenticated_client, hr_profile, test_user):
        from alerts.models import InAppNotification
        hr_profile.perm_alerts_read = True
        hr_profile.save()
        InAppNotification.objects.create(
            auth_user_id=test_user.id, title="A", message="m", is_read=False,
        )
        resp = authenticated_client.post("/api/alerts/inbox/mark_all_read/")
        assert resp.status_code == 200
        assert InAppNotification.objects.filter(auth_user_id=test_user.id, is_read=False).count() == 0