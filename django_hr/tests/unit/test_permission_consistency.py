"""
tests/unit/test_permission_consistency.py

QE finding: sanctions/, hr_events/, and leaves/ use HRPermission, which
only checks "does an active HRProfile exist at all" -- it does NOT check
per-module permission flags the way accounts/, alerts/, and documents/
do via HasModulePerm(perm_key).

This means an HR profile with ZERO sanctions-related permissions granted
can still fully read/write the sanctions module, purely because they
have *some* active HR profile.

Marked xfail because this is current, real behavior -- flip to a normal
(non-xfail) assertion once sanctions/hr_events/leaves are moved onto the
same HasModulePerm pattern as the rest of the app.
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
    module permissions -- the scenario HasModulePerm is designed to
    reject and HRPermission currently lets through."""
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


@pytest.mark.django_db
class TestPermissionConsistency:

    @pytest.mark.xfail(reason="sanctions/ uses coarse HRPermission, not HasModulePerm -- see QE review", strict=True)
    def test_hr_profile_without_sanctions_perm_is_denied_sanctions_access(
        self, test_user, hr_profile_no_module_perms
    ):
        client = _client_with_role(test_user)
        resp = client.get("/api/sanctions/")
        assert resp.status_code == 403

    @pytest.mark.xfail(reason="leaves/ uses coarse HRPermission, not HasModulePerm -- see QE review", strict=True)
    def test_hr_profile_without_leaves_perm_is_denied_leaves_access(
        self, test_user, hr_profile_no_module_perms
    ):
        client = _client_with_role(test_user)
        resp = client.get("/api/leaves/requests/")
        assert resp.status_code == 403

    @pytest.mark.xfail(reason="hr_events/ uses coarse HRPermission, not HasModulePerm -- see QE review", strict=True)
    def test_hr_profile_without_hr_events_perm_is_denied_access(
        self, test_user, hr_profile_no_module_perms
    ):
        client = _client_with_role(test_user)
        resp = client.get("/api/hr-events/")
        assert resp.status_code == 403

    def test_hr_profile_without_module_perm_IS_correctly_denied_in_alerts(
        self, test_user, hr_profile_no_module_perms
    ):
        """Control case -- alerts/ already uses HasModulePerm correctly.
        This should pass today, proving the fix pattern already exists
        elsewhere in the codebase and just needs to be applied to the
        three modules above."""
        client = _client_with_role(test_user)
        resp = client.get("/api/alerts/inbox/")
        assert resp.status_code == 403