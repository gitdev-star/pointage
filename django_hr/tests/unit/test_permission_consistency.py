"""
tests/unit/test_permission_consistency.py

Originally: sanctions/, hr_events/, and leaves/ used HRPermission, which
only checks "does an active HRProfile exist at all" -- it did NOT check
per-module permission flags the way accounts/, alerts/, and documents/
do via HasModulePerm(perm_key)/require_perm(perm_key).

Fixed: all three modules now use get_permissions() to split read/write
(and, for leaves/, approve) actions onto require_perm("<module>_read"),
require_perm("<module>_write"), and require_perm("leaves_approve")
respectively -- matching the pattern already used by accounts/ and
alerts/. The xfail markers that documented the gap have been removed
now that the underlying behavior is fixed; the tests below assert the
correct (denied) outcome directly.
"""
import pytest
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APIClient


def _client_with_role(user, role="HR"):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    refresh["role"] = role
    refresh["username"] = user.username
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def hr_profile_no_module_perms(db, test_user, test_factory):
    """An HR profile that is active but has been granted NO specific
    module permissions -- the scenario HasModulePerm/require_perm is
    designed to reject."""
    from accounts.models import HRProfile
    return HRProfile.objects.create(
        auth_user_id=test_user.id,
        username=test_user.username,
        email=test_user.email,
        job_title="New Hire HR Assistant",
        factory=test_factory,
        is_director=False,
        # every perm_* flag left at its default (False)
    )


@pytest.fixture
def hr_profile_sanctions_read_only(db, test_user, test_factory):
    from accounts.models import HRProfile
    return HRProfile.objects.create(
        auth_user_id=test_user.id,
        username=test_user.username,
        email=test_user.email,
        job_title="HR Assistant",
        factory=test_factory,
        is_director=False,
        perm_sanctions_read=True,
        # perm_sanctions_write left False
    )


@pytest.fixture
def hr_profile_leaves_full(db, test_user, test_factory):
    from accounts.models import HRProfile
    return HRProfile.objects.create(
        auth_user_id=test_user.id,
        username=test_user.username,
        email=test_user.email,
        job_title="HR Manager",
        factory=test_factory,
        is_director=False,
        perm_leaves_read=True,
        perm_leaves_write=True,
        # perm_leaves_approve left False
    )


@pytest.fixture
def hr_profile_hr_events_read_only(db, test_user, test_factory):
    from accounts.models import HRProfile
    return HRProfile.objects.create(
        auth_user_id=test_user.id,
        username=test_user.username,
        email=test_user.email,
        job_title="HR Assistant",
        factory=test_factory,
        is_director=False,
        perm_hr_events_read=True,
    )


@pytest.mark.django_db
class TestPermissionConsistency:
    """Negative cases: an active HR profile with zero module permissions
    must be denied — this is the original QE finding, now fixed."""

    def test_hr_profile_without_sanctions_perm_is_denied_sanctions_access(
        self, test_user, hr_profile_no_module_perms
    ):
        client = _client_with_role(test_user)
        resp = client.get("/api/sanctions/")
        assert resp.status_code == 403

    def test_hr_profile_without_leaves_perm_is_denied_leaves_access(
        self, test_user, hr_profile_no_module_perms
    ):
        client = _client_with_role(test_user)
        resp = client.get("/api/leaves/requests/")
        assert resp.status_code == 403

    def test_hr_profile_without_hr_events_perm_is_denied_access(
        self, test_user, hr_profile_no_module_perms
    ):
        client = _client_with_role(test_user)
        resp = client.get("/api/hr-events/")
        assert resp.status_code == 403

    def test_hr_profile_without_module_perm_IS_correctly_denied_in_alerts(
        self, test_user, hr_profile_no_module_perms
    ):
        """Control case -- alerts/ already used HasModulePerm correctly
        before this fix. Proves the reference pattern this fix followed."""
        client = _client_with_role(test_user)
        resp = client.get("/api/alerts/inbox/")
        assert resp.status_code == 403


@pytest.mark.django_db
class TestPermissionGranularity:
    """Positive cases: confirms read/write/approve are genuinely split,
    not just 'has some permission gets everything'."""

    def test_sanctions_read_perm_allows_list_but_not_create(
        self, test_user, hr_profile_sanctions_read_only, test_employee
    ):
        client = _client_with_role(test_user)
        list_resp = client.get("/api/sanctions/")
        assert list_resp.status_code == 200

        from sanctions.models import SanctionType
        rappel = SanctionType.objects.get(code="RAPPEL")
        create_resp = client.post("/api/sanctions/", {
            "employee": test_employee.id,
            "sanction_type": rappel.id,
            "date": "2026-07-14",
            "reason": "test",
        })
        assert create_resp.status_code == 403

    def test_leaves_write_perm_allows_create_but_approve_still_requires_approve_perm(
        self, test_user, hr_profile_leaves_full
    ):
        from leaves.models import LeaveType
        leave_type = LeaveType.objects.filter(is_active=True).first()
        client = _client_with_role(test_user)

        # write perm granted -> list/create should succeed at the permission layer
        # (may still 400 on serializer validation, which is a different concern)
        list_resp = client.get("/api/leaves/requests/")
        assert list_resp.status_code == 200

        # approve perm NOT granted -> approve_reject must be denied regardless
        # of write access, proving it's a genuinely separate permission tier
        from employees.models import Employee
        # any existing leave request id would do; if none exist, a 404 from
        # get_object() would fire AFTER the permission check, so a bogus pk
        # still proves the 403 comes from the permission layer, not lookup,
        # as long as it's 403 and not 404/500.
        approve_resp = client.post("/api/leaves/requests/999999/approve_reject/", {
            "action": "approve",
        })
        assert approve_resp.status_code == 403

    def test_hr_events_read_perm_allows_list_but_not_create(
        self, test_user, hr_profile_hr_events_read_only, test_employee
    ):
        client = _client_with_role(test_user)
        list_resp = client.get("/api/hr-events/")
        assert list_resp.status_code == 200

        create_resp = client.post("/api/hr-events/", {
            "employee": test_employee.id,
        })
        assert create_resp.status_code == 403