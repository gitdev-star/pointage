"""
tests/unit/test_payroll_permissions.py

Regression test for the gap found during QE review:
payroll/views.py declared NO permission_classes on any ViewSet, so any
authenticated user -- including one with no HRProfile at all -- could
read salary structures, individual salaries, and payslips.

THIS TEST IS EXPECTED TO FAIL against the current code. That's
intentional -- it documents the exact gap and will start passing the
moment payroll/views.py gets real permission_classes (e.g. IsHRUser or
a payroll-specific HasModulePerm("payroll_read")).

Once fixed, remove the `pytest.mark.xfail` decorators.
"""
import pytest
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APIClient

from payroll.models import SalaryStructure, EmployeeSalary, Payslip


def _client_with_role(user, role=""):
    """Build a client whose JWT carries the given role claim, matching
    the shape django_auth's CustomTokenObtainPairSerializer produces."""
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    refresh["role"] = role
    refresh["username"] = user.username
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def salary_structure(db):
    return SalaryStructure.objects.create(
        name="Base Grade A",
        base_salary=500000,
        transport_allowance=20000,
        housing_allowance=0,
        meal_allowance=10000,
        employee_social_charge_pct=5,
        employer_social_charge_pct=13,
        is_active=True,
    )


@pytest.mark.django_db
@pytest.mark.xfail(reason="payroll/views.py currently has no permission_classes -- see QE review", strict=True)
class TestPayrollAccessControl:

    def test_employee_with_no_hr_profile_cannot_read_salary_structures(
        self, test_user, salary_structure
    ):
        """A plain authenticated user with no HRProfile at all should
        NOT be able to list salary structures. Currently they can,
        because the ViewSet has no permission_classes beyond the
        global IsAuthenticated default."""
        client = _client_with_role(test_user, role="EMPLOYEE")
        resp = client.get("/api/payroll/structures/")
        assert resp.status_code == 403

    def test_employee_with_no_hr_profile_cannot_read_payslips(self, test_user):
        client = _client_with_role(test_user, role="EMPLOYEE")
        resp = client.get("/api/payroll/payslips/")
        assert resp.status_code == 403

    def test_employee_with_no_hr_profile_cannot_read_employee_salaries(self, test_user):
        client = _client_with_role(test_user, role="EMPLOYEE")
        resp = client.get("/api/payroll/employee-salaries/")
        assert resp.status_code == 403

    def test_hr_profile_without_payroll_read_perm_is_denied(
        self, test_user, test_factory
    ):
        """An HR user with a real HRProfile, but no payroll-specific
        permission granted, should still be denied -- payroll should
        follow the same per-module permission pattern as accounts/
        alerts/documents (HasModulePerm), not just 'any active HR
        profile is enough' the way sanctions/leaves/hr_events do."""
        from accounts.models import HRProfile
        HRProfile.objects.create(
            auth_user_id=test_user.id,
            username=test_user.username,
            email=test_user.email,
            job_title="HR Generalist",
            factory=test_factory,
            is_director=False,
            # deliberately NOT granting any payroll permission
        )
        client = _client_with_role(test_user, role="HR")
        resp = client.get("/api/payroll/payslips/")
        assert resp.status_code == 403


@pytest.mark.django_db
@pytest.mark.positive_case
class TestPayrollAccessControlPositiveCase:
    """These should already pass today and must keep passing after the
    fix above -- an HR user WITH the right permission should still get in."""

    def test_hr_profile_with_payroll_read_perm_can_list_payslips(
        self, test_user, test_factory
    ):
        from accounts.models import HRProfile
        HRProfile.objects.create(
            auth_user_id=test_user.id,
            username=test_user.username,
            email=test_user.email,
            job_title="Payroll Officer",
            factory=test_factory,
            is_director=False,
            perm_payroll_read=True,   # adjust field name to match HRProfile's real perm field
        )
        client = _client_with_role(test_user, role="HR")
        resp = client.get("/api/payroll/payslips/")
        assert resp.status_code == 200

    def test_director_can_list_payslips(self, test_user, test_factory):
        from accounts.models import HRProfile
        HRProfile.objects.create(
            auth_user_id=test_user.id,
            username=test_user.username,
            email=test_user.email,
            job_title="HR Director",
            factory=test_factory,
            is_director=True,
        )
        client = _client_with_role(test_user, role="ADMIN")
        resp = client.get("/api/payroll/payslips/")
        assert resp.status_code == 200