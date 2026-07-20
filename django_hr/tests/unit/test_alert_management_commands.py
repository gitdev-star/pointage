"""
tests/unit/test_alert_management_commands.py

QE finding: send_cdd_alerts and send_maternity_alerts are cron-only
management commands with NO coverage anywhere in the current pipeline
-- not in django_hr's own tests, and not run by ci.yml. A break here
fails silently in production cron with no automated warning.

These are smoke tests: they don't verify the exact email content, just
that the commands run to completion without raising, against a real
(test) database, and that they call the email backend the expected
number of times for a known fixture scenario.
"""
import pytest
from datetime import date, timedelta
from django.core import mail
from django.core.management import call_command


@pytest.mark.django_db
class TestSendCddAlerts:

    def test_command_runs_without_error_with_no_employees(self):
        """Baseline: command should complete cleanly against an empty DB,
        not raise on missing data."""
        call_command("send_cdd_alerts")

    def test_command_sends_alert_for_contract_expiring_soon(
        self, test_employee
    ):
        """Positive case: an active CDD employee whose termination_date
        falls within the alert window, with a CDDNotificationAssignment
        configured to receive the email (the command exits early with no
        assignments — see send_cdd_alerts.py line 24)."""
        from alerts.models import CDDNotificationAssignment

        test_employee.contract_type = "CDD"
        test_employee.status = "ACTIVE"
        test_employee.termination_date = date.today() + timedelta(days=15)
        test_employee.save()

        CDDNotificationAssignment.objects.create(
            auth_user_id=1,
            username="hr_test_user",
            email="hr_test_user@example.com",
            is_active=True,
        )

        mail.outbox = []
        call_command("send_cdd_alerts")

        assert len(mail.outbox) >= 1, (
            "Expected at least one alert email for a CDD contract "
            "expiring within the alert window; got none."
        )

    def test_command_does_not_alert_for_far_future_expiry(self, test_employee):
        from alerts.models import CDDNotificationAssignment

        CDDNotificationAssignment.objects.create(
            auth_user_id=1,
            username="hr_test_user",
            email="hr_test_user@example.com",
            is_active=True,
        )

        test_employee.contract_type = "CDD"
        test_employee.status = "ACTIVE"
        test_employee.termination_date = date.today() + timedelta(days=180)
        test_employee.save()

        mail.outbox = []
        call_command("send_cdd_alerts")

        assert len(mail.outbox) == 0, (
            "Should not alert for a contract expiring 180 days out -- "
            "if this fails, check the alert window logic."
        )


@pytest.mark.django_db
class TestSendMaternityAlerts:

    def test_command_runs_without_error_with_no_employees(self):
        call_command("send_maternity_alerts")

    # NOTE: a positive-case test (an employee on maternity leave within
    # the alert window triggers an email) needs the actual maternity
    # leave model/fields to write correctly -- see leaves/models.py's
    # MaternityLeave-related model before filling this in. Left as a
    # named gap rather than guessed at, since guessing field names here
    # risks a test that looks like coverage but silently tests nothing.