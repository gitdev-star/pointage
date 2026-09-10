"""
tests/integration/test_debauche.py

Standalone API-level tests for EmployeeViewSet.debauche_one
(employees/views.py) and its downstream effect on
employee_termination_signal (employees/signals.py) — the endpoint that
terminates an employee and, via the signal, deletes their clocker device
account through the attendance FastAPI service.

The HTTP call to the attendance service (requests.delete, called from
inside employees/signals.py) is mocked throughout — these tests never
hit a real attendance service. notify_resiliation is also mocked so no
outbound email is attempted.

URL name: "employee-debauche-one" (basename "employee" + the action's
url_path "debauche-one", same pattern as "employee-active" / "employee-import"
in tests/integration/test_employee_api.py).
"""

from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from employees.models import Employee

pytestmark = pytest.mark.django_db


def _make_employee(test_factory, test_department, **overrides):
    defaults = dict(
        employee_id="DBH001",
        first_name="Debauche",
        last_name="Test",
        factory=test_factory,
        department=test_department,
        status="ACTIVE",
    )
    defaults.update(overrides)
    return Employee.objects.create(**defaults)


class TestDebaucheOneAuth:
    def test_requires_auth(self, api_client):
        response = api_client.post(
            reverse("employee-debauche-one"), {"employee_id": "DBH001"}, format="json"
        )
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


class TestDebaucheOneValidation:
    def test_missing_employee_id_returns_400(self, authenticated_client):
        response = authenticated_client.post(
            reverse("employee-debauche-one"), {}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unknown_employee_id_returns_404(self, authenticated_client):
        response = authenticated_client.post(
            reverse("employee-debauche-one"), {"employee_id": "NOPE"}, format="json"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data["found"] is False


class TestDebaucheOneSuccess:
    @patch("employees.signals.notify_resiliation")
    @patch("employees.signals.requests.delete")
    def test_terminates_and_deletes_device(
        self, mock_delete, mock_notify, authenticated_client, test_factory, test_department
    ):
        mock_delete.return_value = MagicMock(
            status_code=200,
            json=lambda: {"user_id": "4242", "results": {"192.168.1.2": "deleted"}},
        )
        emp = _make_employee(
            test_factory, test_department,
            employee_id="DBH001", device_user_id=4242, motif_depart="Fin de contrat",
        )

        response = authenticated_client.post(
            reverse("employee-debauche-one"), {"employee_id": "DBH001"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["found"] is True
        assert response.data["already_terminated"] is False
        assert response.data["status_updated"] is True
        assert response.data["device_deleted"] is True

        emp.refresh_from_db()
        assert emp.status == "TERMINATED"
        assert emp.termination_date == timezone.now().date()

        mock_delete.assert_called_once()
        called_url = mock_delete.call_args.args[0] if mock_delete.call_args.args else mock_delete.call_args.kwargs.get("url")
        assert called_url.endswith("/devices/users/4242")
        mock_notify.assert_called_once()

    @patch("employees.signals.notify_resiliation")
    @patch("employees.signals.requests.delete")
    def test_preserves_existing_termination_date(
        self, mock_delete, mock_notify, authenticated_client, test_factory, test_department
    ):
        mock_delete.return_value = MagicMock(status_code=200, json=lambda: {"results": {}})
        fixed_date = date(2020, 1, 15)
        emp = _make_employee(
            test_factory, test_department,
            employee_id="DBH002", device_user_id=5, termination_date=fixed_date,
        )

        authenticated_client.post(
            reverse("employee-debauche-one"), {"employee_id": "DBH002"}, format="json"
        )

        emp.refresh_from_db()
        assert emp.termination_date == fixed_date  # not overwritten with today()


class TestDebaucheOneNoDeviceUserId:
    @patch("employees.signals.notify_resiliation")
    @patch("employees.signals.requests.delete")
    def test_no_device_user_id_skips_delete_call(
        self, mock_delete, mock_notify, authenticated_client, test_factory, test_department
    ):
        _make_employee(test_factory, test_department, employee_id="DBH003", device_user_id=None)

        response = authenticated_client.post(
            reverse("employee-debauche-one"), {"employee_id": "DBH003"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["device_deleted"] is False
        assert response.data["device_detail"] == "no device_user_id on record"
        mock_delete.assert_not_called()


class TestDebaucheOneDeviceCallFails:
    @patch("employees.signals.notify_resiliation")
    @patch("employees.signals.requests.delete")
    def test_termination_proceeds_even_if_device_delete_raises(
        self, mock_delete, mock_notify, authenticated_client, test_factory, test_department
    ):
        mock_delete.side_effect = ConnectionError("attendance service unreachable")
        emp = _make_employee(test_factory, test_department, employee_id="DBH004", device_user_id=77)

        response = authenticated_client.post(
            reverse("employee-debauche-one"), {"employee_id": "DBH004"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status_updated"] is True
        assert response.data["device_deleted"] is False
        assert "attendance service unreachable" in response.data["device_detail"]

        emp.refresh_from_db()
        assert emp.status == "TERMINATED"  # DB status change is not rolled back

    @patch("employees.signals.notify_resiliation")
    @patch("employees.signals.requests.delete")
    def test_non_200_from_attendance_service_reports_not_deleted(
        self, mock_delete, mock_notify, authenticated_client, test_factory, test_department
    ):
        mock_delete.return_value = MagicMock(status_code=404, json=lambda: {"detail": "unknown user_id"})
        _make_employee(test_factory, test_department, employee_id="DBH005", device_user_id=88)

        response = authenticated_client.post(
            reverse("employee-debauche-one"), {"employee_id": "DBH005"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["device_deleted"] is False
        assert response.data["device_detail"] == {"detail": "unknown user_id"}


class TestDebaucheOneIdempotency:
    @patch("employees.views.log_action")
    @patch("employees.signals.notify_resiliation")
    @patch("employees.signals.requests.delete")
    def test_second_call_does_not_redelete_or_relog(
        self, mock_delete, mock_notify, mock_log_action,
        authenticated_client, test_factory, test_department,
    ):
        mock_delete.return_value = MagicMock(status_code=200, json=lambda: {"results": {}})
        _make_employee(test_factory, test_department, employee_id="DBH006", device_user_id=99)

        first = authenticated_client.post(
            reverse("employee-debauche-one"), {"employee_id": "DBH006"}, format="json"
        )
        assert first.data["already_terminated"] is False
        assert first.data["device_deleted"] is True
        mock_delete.assert_called_once()
        mock_log_action.assert_called_once()

        second = authenticated_client.post(
            reverse("employee-debauche-one"), {"employee_id": "DBH006"}, format="json"
        )
        assert second.status_code == status.HTTP_200_OK
        assert second.data["already_terminated"] is True
        assert second.data["status_updated"] is True

        # Signal only fires on a fresh transition to TERMINATED — the second
        # save() leaves status unchanged, so neither the device delete nor
        # the audit log call should happen again.
        mock_delete.assert_called_once()
        mock_log_action.assert_called_once()
