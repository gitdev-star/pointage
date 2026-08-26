"""
Integration tests: Employee -> TERMINATED status transition should
call the attendance-service DELETE /devices/users/{user_id} endpoint.

ASSUMPTIONS TO VERIFY AGAINST YOUR ACTUAL CODE:
- Employee model fields used: status, device_user_id, motif_depart
  (adjust field names / add required FKs like department/section/factory
  if your model requires them to create a valid instance)
- settings.ATTENDANCE_SERVICE_URL is configured in test settings
  (or falls back to the http://localhost:8000 default in signals.py)
- Uses pytest + pytest-django. Adjust to Django TestCase / unittest
  style if that's what your existing django_hr tests use.

Place in: django_hr/employees/tests/integration/test_employee_termination_signal.py
(or wherever your tests/integration directory lives for this app)
"""

import pytest
from unittest.mock import patch, MagicMock

from employees.models import Employee  # adjust import path if different


pytestmark = pytest.mark.django_db


def make_employee(**overrides):
    """
    Helper to create a minimal Employee. Adjust required fields
    (department, section, factory, matricule, etc.) to match your
    actual model constraints -- this is a starting point, not final.
    """
    defaults = dict(
        nom="Test",
        prenom="Employee",
        status="ACTIVE",
        device_user_id="99999",
        motif_depart="",
    )
    defaults.update(overrides)
    return Employee.objects.create(**defaults)


class TestTerminationTriggersDeviceDeletion:

    @patch("employees.signals.requests.delete")
    def test_termination_calls_device_deletion_endpoint(self, mock_delete):
        mock_delete.return_value = MagicMock(
            status_code=200,
            json=lambda: {"user_id": "99999", "results": {"192.168.1.2": "deleted"}},
        )

        employee = make_employee(status="ACTIVE", device_user_id="99999")

        employee.status = "TERMINATED"
        employee.motif_depart = "Fin de contrat"
        employee.save()

        mock_delete.assert_called_once()
        called_url = mock_delete.call_args[0][0]
        assert "/devices/users/99999" in called_url

    @patch("employees.signals.requests.delete")
    def test_no_device_call_when_status_unrelated_to_termination(self, mock_delete):
        employee = make_employee(status="ACTIVE", device_user_id="99999")

        employee.nom = "Renamed"
        employee.save()

        mock_delete.assert_not_called()

    @patch("employees.signals.requests.delete")
    def test_no_device_call_on_employee_creation(self, mock_delete):
        # Creating a new employee already TERMINATED should NOT fire the
        # signal -- signals.py explicitly skips `created=True`.
        make_employee(status="TERMINATED", device_user_id="99999")

        mock_delete.assert_not_called()

    @patch("employees.signals.requests.delete")
    def test_no_device_call_when_device_user_id_missing(self, mock_delete):
        employee = make_employee(status="ACTIVE", device_user_id="")

        employee.status = "TERMINATED"
        employee.save()

        mock_delete.assert_not_called()

    @patch("employees.signals.requests.delete")
    def test_resave_as_terminated_does_not_refire(self, mock_delete):
        # Already-terminated employee saved again should NOT re-trigger
        # the device deletion call (old_status == TERMINATED already).
        employee = make_employee(status="TERMINATED", device_user_id="99999")
        # First save happened at creation (created=True, so signal skipped
        # per test above) -- simulate an already-terminated record instead:
        employee.status = "ACTIVE"
        employee.save()
        mock_delete.reset_mock()

        employee.status = "TERMINATED"
        employee.save()
        mock_delete.assert_called_once()
        mock_delete.reset_mock()

        # Re-saving with status still TERMINATED should NOT call again
        employee.nom = "Updated Name"
        employee.save()
        mock_delete.assert_not_called()

    @patch("employees.signals.sentry_sdk.capture_exception")
    @patch("employees.signals.requests.delete")
    def test_device_deletion_failure_does_not_block_employee_save(
        self, mock_delete, mock_capture
    ):
        # If the attendance-service call fails/errors, the employee record
        # must still save successfully -- device sweep failures shouldn't
        # block HR from processing a termination.
        mock_delete.side_effect = ConnectionError("device service unreachable")

        employee = make_employee(status="ACTIVE", device_user_id="99999")
        employee.status = "TERMINATED"
        employee.save()  # should not raise

        employee.refresh_from_db()
        assert employee.status == "TERMINATED"
        mock_capture.assert_called_once()

    @patch("employees.signals.notify_resiliation")
    @patch("employees.signals.requests.delete")
    def test_termination_triggers_both_email_and_device_deletion(
        self, mock_delete, mock_notify
    ):
        mock_delete.return_value = MagicMock(status_code=200, json=lambda: {})

        employee = make_employee(status="ACTIVE", device_user_id="99999")
        employee.status = "TERMINATED"
        employee.motif_depart = "Démission"
        employee.save()

        mock_notify.assert_called_once()
        mock_delete.assert_called_once()