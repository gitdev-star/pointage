# tests/integration/test_reports_api.py
"""QE gap: reports/ (cross-app read-only aggregation endpoints) untested."""
import pytest
from datetime import date

pytestmark = pytest.mark.django_db


class TestHeadcountReport:

    def test_requires_auth(self, api_client):
        assert api_client.get("/api/reports/headcount/").status_code == 401

    def test_counts_active_vs_total_per_factory(
        self, authenticated_client, test_factory, test_department, test_section, test_poste
    ):
        from employees.models import Employee
        Employee.objects.create(
            employee_id="EMPX1", first_name="A", last_name="B",
            email="a@x.com", factory=test_factory, department=test_department,
            section=test_section, job_title=test_poste,
            hire_date=date(2020, 1, 1), status="ACTIVE",
        )
        Employee.objects.create(
            employee_id="EMPX2", first_name="C", last_name="D",
            email="c@x.com", factory=test_factory, department=test_department,
            section=test_section, job_title=test_poste,
            hire_date=date(2020, 1, 1), status="TERMINATED",
        )
        resp = authenticated_client.get("/api/reports/headcount/")
        assert resp.status_code == 200
        row = next(r for r in resp.data["by_factory"] if r["id"] == test_factory.id)
        assert row["total_count"] == 2
        assert row["active_count"] == 1


class TestLeaveReport:

    def test_filters_by_year_and_only_approved(self, authenticated_client, test_employee):
        from leaves.models import LeaveType, LeaveRequest
        lt = LeaveType.objects.create(name="CA", code="CA2", days_per_year=20)
        LeaveRequest.objects.create(
            employee=test_employee, leave_type=lt,
            start_date=date(2025, 3, 1), end_date=date(2025, 3, 5),
            days_requested=5, status="APPROVED",
        )
        LeaveRequest.objects.create(
            employee=test_employee, leave_type=lt,
            start_date=date(2024, 3, 1), end_date=date(2024, 3, 5),
            days_requested=5, status="PENDING",
        )
        resp = authenticated_client.get("/api/reports/leaves/?year=2025")
        assert resp.status_code == 200
        assert sum(r["request_count"] for r in resp.data["by_leave_type"]) == 1


class TestPayrollSummaryReport:

    def test_sums_net_salary_by_month_validated_and_paid_only(
        self, authenticated_client, test_employee, test_factory, test_department, test_section, test_poste
    ):
        from payroll.models import SalaryStructure, Payslip
        from employees.models import Employee
        structure = SalaryStructure.objects.create(name="Base", base_salary=50000)
        Payslip.objects.create(
            employee=test_employee, period_month=1, period_year=2026,
            structure=structure, base_salary=50000, net_salary=45000, status="VALIDATED",
        )
        other_employee = Employee.objects.create(
            employee_id="EMPX9", first_name="Jane", last_name="Draft",
            email="jane.draft@example.com", factory=test_factory,
            department=test_department, section=test_section, job_title=test_poste,
            hire_date=date(2020, 1, 1),
        )
        Payslip.objects.create(
            employee=other_employee, period_month=1, period_year=2026,
            structure=structure, base_salary=50000, net_salary=30000, status="DRAFT",
        )
        resp = authenticated_client.get("/api/reports/payroll/?year=2026")
        assert resp.status_code == 200
        row = resp.data["monthly_payroll"][0]
        assert float(row["total_net"]) == 45000.0
        assert row["headcount"] == 1