"""
tests/integration/test_employee_api.py

API-level tests for the `employees` app, matched against the real
urls.py / views.py / serializers.py as provided (nothing here changes
application code — only exercises it as written).

All notify_* email calls are mocked at the point of use so tests don't
depend on outbound SMTP (test_settings.py has no EMAIL_BACKEND override,
so unmocked calls would attempt a real connection on every request).

URL name reference (from employees/urls.py):
  employee-list / employee-detail / employee-by-device / employee-active / employee-import
  factory-list / factory-detail / factory-departments / factory-employees
  department-list / department-detail / department-employees
  section-list / section-detail
  classification-list / classification-detail
  poste-list / poste-detail
  work-schedules-list / work-schedules-detail / work-schedules-bulk-assign
  employee-export, factories-cached, departments-cached

NOTE: `cached_classifications` (views.py) is not wired into urls.py at all —
it's unreachable via routing as written. Not tested here since there's no
URL name to reverse(); flagging instead of guessing a path.
"""

import io
import csv
from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status

from employees.models import Employee, Factory, Classification


pytestmark = pytest.mark.django_db


# ── Employee CRUD ────────────────────────────────────────────────────────

class TestEmployeeListRetrieve:
    def test_list_requires_auth(self, api_client):
        response = api_client.get(reverse("employee-list"))
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_list_authenticated(self, authenticated_client, test_employee):
        response = authenticated_client.get(reverse("employee-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_employee(self, authenticated_client, test_employee):
        response = authenticated_client.get(
            reverse("employee-detail", kwargs={"pk": test_employee.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["employee_id"] == "EMP001"

    def test_list_uses_list_serializer_fields(self, authenticated_client, test_employee):
        response = authenticated_client.get(reverse("employee-list"))
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        item = results[0]
        assert "full_name" in item
        assert "cin" not in item  # only on EmployeeDetailSerializer


class TestEmployeeCreate:
    @patch("employees.views.notify_employee_created")
    def test_create_employee_success(self, mock_notify, authenticated_client, test_factory, test_department):
        payload = {
            "employee_id": "EMP999",
            "first_name": "Jane",
            "last_name": "Smith",
            "email": "jane@example.com",
            "factory": test_factory.id,
            "department": test_department.id,
            "hire_date": "2024-01-01",
            "contract_type": "CDI",
            "status": "ACTIVE",
        }
        response = authenticated_client.post(reverse("employee-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert Employee.objects.filter(employee_id="EMP999").exists()
        mock_notify.assert_called_once()

    @patch("employees.views.notify_employee_created")
    def test_create_employee_department_factory_mismatch(
        self, mock_notify, authenticated_client, test_factory, test_department
    ):
        other_factory = Factory.objects.create(name="Other Factory")
        payload = {
            "employee_id": "EMP998",
            "first_name": "Jane",
            "last_name": "Smith",
            "factory": other_factory.id,
            "department": test_department.id,  # belongs to test_factory, not other_factory
            "hire_date": "2024-01-01",
        }
        response = authenticated_client.post(reverse("employee-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "department" in response.data
        mock_notify.assert_not_called()

    @patch("employees.views.notify_employee_created")
    def test_create_employee_duplicate_cin_rejected(
        self, mock_notify, authenticated_client, test_factory, test_department, test_employee
    ):
        test_employee.cin = "101-001-000001"
        test_employee.save()
        payload = {
            "employee_id": "EMP997",
            "first_name": "Dup",
            "last_name": "Licate",
            "cin": "101-001-000001",
            "factory": test_factory.id,
            "department": test_department.id,
            "hire_date": "2024-01-01",
        }
        response = authenticated_client.post(reverse("employee-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "cin" in response.data


class TestEmployeeUpdate:
    @patch("employees.views.notify_resiliation")
    def test_update_to_terminated_triggers_notification(self, mock_notify, authenticated_client, test_employee):
        response = authenticated_client.patch(
            reverse("employee-detail", kwargs={"pk": test_employee.pk}),
            {"status": "TERMINATED", "motif_depart": "Fin de contrat"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        mock_notify.assert_called_once()

    @patch("employees.views.notify_resiliation")
    def test_update_without_status_change_does_not_notify(self, mock_notify, authenticated_client, test_employee):
        response = authenticated_client.patch(
            reverse("employee-detail", kwargs={"pk": test_employee.pk}),
            {"phone": "0341234567"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        mock_notify.assert_not_called()

    @patch("employees.views.notify_resiliation")
    def test_update_already_terminated_does_not_renotify(self, mock_notify, authenticated_client, test_employee):
        test_employee.status = "TERMINATED"
        test_employee.save()
        response = authenticated_client.patch(
            reverse("employee-detail", kwargs={"pk": test_employee.pk}),
            {"phone": "0341234567"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        mock_notify.assert_not_called()


# ── Custom actions ───────────────────────────────────────────────────────

class TestEmployeeCustomActions:
    def test_by_device_found(self, authenticated_client, test_employee):
        test_employee.device_user_id = 42
        test_employee.save()
        response = authenticated_client.get(
            reverse("employee-by-device", kwargs={"device_user_id": 42})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["employee_id"] == "EMP001"

    def test_by_device_not_found(self, authenticated_client):
        response = authenticated_client.get(
            reverse("employee-by-device", kwargs={"device_user_id": 999999})
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_active_endpoint_filters_status(self, authenticated_client, test_employee, test_factory, test_department):
        Employee.objects.create(
            employee_id="EMP-INACTIVE",
            first_name="In",
            last_name="Active",
            factory=test_factory,
            department=test_department,
            status="INACTIVE",
        )
        response = authenticated_client.get(reverse("employee-active"))
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        ids = [r["employee_id"] for r in results]
        assert "EMP001" in ids
        assert "EMP-INACTIVE" not in ids


# ── CSV import ───────────────────────────────────────────────────────────

def _csv_upload(rows, fieldnames):
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    from django.core.files.uploadedfile import SimpleUploadedFile
    return SimpleUploadedFile(
        "employees.csv", buf.getvalue().encode("utf-8"), content_type="text/csv"
    )


class TestEmployeeImportCSV:
    REQUIRED = [
        "employee_id", "first_name", "last_name",
        "factory_name", "department_name",
        "job_title", "contract_type", "hire_date",
    ]

    def test_import_no_file(self, authenticated_client):
        response = authenticated_client.post(reverse("employee-import"), {}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_import_wrong_extension(self, authenticated_client):
        from django.core.files.uploadedfile import SimpleUploadedFile
        bad_file = SimpleUploadedFile("employees.txt", b"data", content_type="text/plain")
        response = authenticated_client.post(
            reverse("employee-import"), {"file": bad_file}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_import_missing_required_columns(self, authenticated_client):
        upload = _csv_upload(
            [{"employee_id": "X1", "first_name": "A", "last_name": "B"}],
            fieldnames=["employee_id", "first_name", "last_name"],
        )
        response = authenticated_client.post(
            reverse("employee-import"), {"file": upload}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @patch("employees.views.notify_bulk_resiliation")
    def test_import_unknown_factory_reports_row_error(
        self, mock_notify, authenticated_client, test_department
    ):
        upload = _csv_upload(
            [{
                "employee_id": "NEW001", "first_name": "New", "last_name": "Guy",
                "factory_name": "Nonexistent Factory", "department_name": test_department.name,
                "job_title": "", "contract_type": "CDI", "hire_date": "2024-01-01",
            }],
            fieldnames=self.REQUIRED,
        )
        response = authenticated_client.post(
            reverse("employee-import"), {"file": upload}, format="multipart"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["summary"]["errors"] == 1
        assert response.data["rows"][0]["status"] == "error"

    @patch("employees.views.notify_bulk_resiliation")
    def test_import_success_creates_employee(
        self, mock_notify, authenticated_client, test_factory, test_department
    ):
        upload = _csv_upload(
            [{
                "employee_id": "NEW002", "first_name": "New", "last_name": "Girl",
                "factory_name": test_factory.name, "department_name": test_department.name,
                "job_title": "", "contract_type": "CDI", "hire_date": "2024-01-01",
            }],
            fieldnames=self.REQUIRED,
        )
        response = authenticated_client.post(
            reverse("employee-import"), {"file": upload}, format="multipart"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["summary"]["created"] == 1
        assert Employee.objects.filter(employee_id="NEW002").exists()

    @patch("employees.views.notify_bulk_resiliation")
    def test_import_skips_existing_employee_id(
        self, mock_notify, authenticated_client, test_factory, test_department, test_employee
    ):
        upload = _csv_upload(
            [{
                "employee_id": test_employee.employee_id, "first_name": "Dup", "last_name": "Row",
                "factory_name": test_factory.name, "department_name": test_department.name,
                "job_title": "", "contract_type": "CDI", "hire_date": "2024-01-01",
            }],
            fieldnames=self.REQUIRED,
        )
        response = authenticated_client.post(
            reverse("employee-import"), {"file": upload}, format="multipart"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["summary"]["skipped"] == 1


# ── Factory / Department / Section actions ─────────────────────────────

class TestFactoryActions:
    def test_factory_departments_action(self, authenticated_client, test_factory, test_department):
        response = authenticated_client.get(
            reverse("factory-departments", kwargs={"pk": test_factory.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        names = [d["name"] for d in response.data]
        assert test_department.name in names

    def test_factory_employees_action_filters_active(
        self, authenticated_client, test_factory, test_employee, test_department
    ):
        Employee.objects.create(
            employee_id="EMP-INACTIVE-2",
            first_name="In",
            last_name="Active",
            factory=test_factory,
            department=test_department,
            status="INACTIVE",
        )
        response = authenticated_client.get(
            reverse("factory-employees", kwargs={"pk": test_factory.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        ids = [e["employee_id"] for e in response.data]
        assert "EMP001" in ids
        assert "EMP-INACTIVE-2" not in ids


class TestDepartmentActions:
    def test_department_employees_action(self, authenticated_client, test_department, test_employee):
        response = authenticated_client.get(
            reverse("department-employees", kwargs={"pk": test_department.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        ids = [e["employee_id"] for e in response.data]
        assert "EMP001" in ids


# ── WorkSchedule bulk-assign ─────────────────────────────────────────────

class TestWorkScheduleBulkAssign:
    def test_bulk_assign_success(self, authenticated_client, test_employee):
        payload = {
            "employee_ids": [test_employee.id],
            "name": "Maternity",
            "standard_start": "07:30",
            "standard_end": "16:30",
            "early_leave_limit": "16:27",
        }
        response = authenticated_client.post(
            reverse("work-schedules-bulk-assign"), payload, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["created_count"] == 1

    def test_bulk_assign_missing_employee_ids(self, authenticated_client):
        payload = {
            "employee_ids": [],
            "name": "Maternity",
            "standard_start": "07:30",
            "standard_end": "16:30",
            "early_leave_limit": "16:27",
        }
        response = authenticated_client.post(
            reverse("work-schedules-bulk-assign"), payload, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_bulk_assign_unknown_employee_id(self, authenticated_client):
        payload = {
            "employee_ids": [999999],
            "name": "Maternity",
            "standard_start": "07:30",
            "standard_end": "16:30",
            "early_leave_limit": "16:27",
        }
        response = authenticated_client.post(
            reverse("work-schedules-bulk-assign"), payload, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Function-based views ─────────────────────────────────────────────────

class TestCachedEndpoints:
    def test_cached_factories(self, authenticated_client, test_factory):
        response = authenticated_client.get(reverse("factories-cached"))
        assert response.status_code == status.HTTP_200_OK
        names = [f["name"] for f in response.data]
        assert test_factory.name in names

    def test_cached_departments(self, authenticated_client, test_department):
        response = authenticated_client.get(reverse("departments-cached"))
        assert response.status_code == status.HTTP_200_OK
        names = [d["name"] for d in response.data]
        assert test_department.name in names


class TestEmployeeExport:
    def test_export_requires_auth(self, api_client):
        response = api_client.get(reverse("employee-export"))
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_export_returns_all(self, authenticated_client, test_employee):
        response = authenticated_client.get(reverse("employee-export"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 1

    def test_export_filters_by_status(self, authenticated_client, test_employee, test_factory, test_department):
        Employee.objects.create(
            employee_id="EMP-TERM",
            first_name="Term",
            last_name="Inated",
            factory=test_factory,
            department=test_department,
            status="TERMINATED",
        )
        response = authenticated_client.get(reverse("employee-export"), {"status": "TERMINATED"})
        assert response.status_code == status.HTTP_200_OK
        ids = [r["employee_id"] for r in response.data["results"]]
        assert "EMP-TERM" in ids
        assert "EMP001" not in ids


# ── Section / Poste / Classification viewsets ────────────────────────────

class TestSectionPosteClassificationViewsets:
    def test_section_list(self, authenticated_client, test_section):
        response = authenticated_client.get(reverse("section-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_poste_list(self, authenticated_client, test_poste):
        response = authenticated_client.get(reverse("poste-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_classification_list(self, authenticated_client):
        Classification.objects.create(classe="Cadre", salaire=500000)
        response = authenticated_client.get(reverse("classification-list"))
        assert response.status_code == status.HTTP_200_OK