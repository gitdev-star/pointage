"""
Coverage tests for django_auth.
Targets: accounts/views.py, accounts/serializers.py,
         accounts/permissions.py, accounts/urls.py

RECTIFIED VERSION: every test now asserts the single correct status
code implied by the view's actual permission_classes, instead of a
list of "acceptable" outcomes. A test that accepts multiple outcomes
as a pass will not catch a real regression — this file fixes that.

Permission map (from accounts/permissions.py + views.py), for reference:
  IsAdmin:    role == 'ADMIN'
  IsHR:       role in ['HR', 'ADMIN']
  IsEmployee: role in ['EMPLOYEE', 'HR', 'ADMIN']   (i.e. any authenticated user)

  RegisterView, UserListView, UserDetailView,
  LDAPUserListView, LDAPImportUserView, AdminOnlyView  -> [IsAuthenticated, IsAdmin]
  HRView, HRUserDeleteView                             -> [IsAuthenticated, IsHR]
  EmployeeDashboardView, MeView                        -> [IsAuthenticated] / IsEmployee
  LDAPLoginView                                        -> [] (open)
  ClockerListAPI, ClockerGroupListAPI                  -> [AllowAny]
"""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

User = get_user_model()


# ─────────────────────────────────────────────────────────────
# Auth endpoints: login, register, token
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLoginEndpoint:
    """Covers LDAPLoginView's LOCAL fallback path only.
    (LDAP branch is force-disabled by the autouse mock_external_services
    fixture — see tests/unit/test_ldap_auth.py for the real LDAP path.)"""

    def test_login_valid_credentials(self, api_client, test_user):
        response = api_client.post(reverse("login"), {
            "username": "testuser",
            "password": "testpass123",
        }, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data

    def test_login_invalid_password(self, api_client, test_user):
        response = api_client.post(reverse("login"), {
            "username": "testuser",
            "password": "wrongpassword",
        }, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_nonexistent_user(self, api_client):
        response = api_client.post(reverse("login"), {
            "username": "nobody",
            "password": "somepassword",
        }, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_missing_fields(self, api_client):
        response = api_client.post(reverse("login"), {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_inactive_user_rejected(self, api_client, db):
        user = User.objects.create_user(
            username="inactive", email="i@x.com", password="pass123",
            is_active=False,
        )
        response = api_client.post(reverse("login"), {
            "username": "inactive", "password": "pass123",
        }, format="json")
        # local-auth branch checks `user.check_password(...) and user.is_active`
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        user.delete()


# ─────────────────────────────────────────────────────────────
# Register — Admin-only
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRegisterEndpoint:

    def test_register_requires_authentication(self, api_client):
        response = api_client.post(reverse("register"), {
            "username": "newuser", "email": "newuser@example.com",
            "password": "securepass123", "role": "EMPLOYEE",
        }, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_register_requires_admin_role(self, authenticated_client):
        """A plain EMPLOYEE must NOT be able to create accounts."""
        response = authenticated_client.post(reverse("register"), {
            "username": "newuser", "email": "newuser@example.com",
            "password": "securepass123", "role": "EMPLOYEE",
        }, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_register_hr_role_also_forbidden(self, hr_client):
        """RegisterView is IsAdmin only — HR must NOT be able to create accounts."""
        response = hr_client.post(reverse("register"), {
            "username": "newuser2", "email": "newuser2@example.com",
            "password": "securepass123", "role": "EMPLOYEE",
        }, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_register_new_user_as_admin(self, admin_client):
        response = admin_client.post(reverse("register"), {
            "username": "newuser3", "email": "newuser3@example.com",
            "password": "securepass123", "role": "EMPLOYEE",
        }, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert User.objects.filter(username="newuser3").exists()

    def test_register_duplicate_username_as_admin(self, admin_client, test_user):
        response = admin_client.post(reverse("register"), {
            "username": "testuser",  # already exists
            "email": "other@example.com",
            "password": "securepass123", "role": "EMPLOYEE",
        }, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ─────────────────────────────────────────────────────────────
# Token refresh
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTokenRefresh:

    def test_refresh_with_valid_token(self, api_client, test_user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(test_user)
        response = api_client.post(reverse("token_refresh"), {
            "refresh": str(refresh),
        }, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data

    def test_refresh_with_invalid_token(self, api_client):
        response = api_client.post(reverse("token_refresh"), {
            "refresh": "invalid.token.here",
        }, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ─────────────────────────────────────────────────────────────
# /me/ — any authenticated user
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMeEndpoint:

    def test_me_authenticated(self, authenticated_client, test_user):
        response = authenticated_client.get(reverse("me"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["username"] == test_user.username

    def test_me_unauthenticated(self, api_client):
        response = api_client.get(reverse("me"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ─────────────────────────────────────────────────────────────
# User management — Admin-only
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUserListEndpoint:

    def test_user_list_unauthenticated(self, api_client):
        response = api_client.get(reverse("user-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_user_list_employee_forbidden(self, authenticated_client):
        response = authenticated_client.get(reverse("user-list"))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_user_list_hr_forbidden(self, hr_client):
        """UserListView is IsAdmin only — HR must be rejected too."""
        response = hr_client.get(reverse("user-list"))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_user_list_admin_allowed(self, admin_client):
        response = admin_client.get(reverse("user-list"))
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestUserDetailEndpoint:

    def test_user_detail_employee_forbidden_even_for_own_profile(
        self, authenticated_client, test_user
    ):
        """UserDetailView has no 'is this my own profile' exception —
        it's pure IsAdmin. An employee must be denied even when
        requesting their own record."""
        response = authenticated_client.get(
            reverse("user-detail", kwargs={"pk": test_user.pk})
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_user_detail_admin_can_view_any_user(self, admin_client, test_user):
        response = admin_client.get(
            reverse("user-detail", kwargs={"pk": test_user.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["username"] == test_user.username

    def test_user_detail_nonexistent_as_admin(self, admin_client):
        response = admin_client.get(
            reverse("user-detail", kwargs={"pk": 999999})
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_user_detail_patch_updates_allowed_fields(self, admin_client, test_user):
        response = admin_client.patch(
            reverse("user-detail", kwargs={"pk": test_user.pk}),
            {"first_name": "Updated"}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        test_user.refresh_from_db()
        assert test_user.first_name == "Updated"

    def test_user_detail_delete_self_forbidden(self, admin_client, admin_user):
        """Admin cannot delete their own account via this endpoint."""
        response = admin_client.delete(
            reverse("user-detail", kwargs={"pk": admin_user.pk})
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_user_detail_delete_superuser_forbidden(self, admin_client, db):
        su = User.objects.create_superuser(
            username="superadmin", email="s@x.com", password="pass123",
        )
        response = admin_client.delete(
            reverse("user-detail", kwargs={"pk": su.pk})
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        su.delete()

    def test_user_detail_delete_regular_user_succeeds(self, admin_client, test_user):
        pk = test_user.pk
        response = admin_client.delete(
            reverse("user-detail", kwargs={"pk": pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert not User.objects.filter(pk=pk).exists()


# ─────────────────────────────────────────────────────────────
# Employee dashboard — any authenticated user
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestEmployeeDashboard:

    def test_dashboard_authenticated(self, authenticated_client):
        response = authenticated_client.get(reverse("employee_dashboard"))
        assert response.status_code == status.HTTP_200_OK

    def test_dashboard_unauthenticated(self, api_client):
        response = api_client.get(reverse("employee_dashboard"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ─────────────────────────────────────────────────────────────
# Role-gated endpoints — real RBAC contract, both directions
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRoleBasedEndpoints:
    """These lock in the actual cross-role matrix — the thing most
    likely to silently break if permissions.py is ever refactored."""

    def test_hr_only_denies_employee(self, authenticated_client):
        response = authenticated_client.get(reverse("hr_only"))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_hr_only_allows_hr(self, hr_client):
        response = hr_client.get(reverse("hr_only"))
        assert response.status_code == status.HTTP_200_OK

    def test_hr_only_allows_admin(self, admin_client):
        """IsHR permits role in ['HR', 'ADMIN'] — admin must also pass."""
        response = admin_client.get(reverse("hr_only"))
        assert response.status_code == status.HTTP_200_OK

    def test_admin_only_denies_employee(self, authenticated_client):
        response = authenticated_client.get(reverse("admin_only"))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_only_denies_hr(self, hr_client):
        """IsAdmin is strictly role == 'ADMIN' — HR must be rejected."""
        response = hr_client.get(reverse("admin_only"))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_only_allows_admin(self, admin_client):
        response = admin_client.get(reverse("admin_only"))
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestHRUserDeleteView:
    """HRUserDeleteView: IsHR, but with extra guards — cannot delete
    superuser, cannot delete an ADMIN, cannot delete self."""

    def test_hr_delete_employee_succeeds(self, hr_client, test_user):
        pk = test_user.pk
        response = hr_client.delete(
            reverse("hr-user-delete", kwargs={"pk": pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert not User.objects.filter(pk=pk).exists()

    def test_hr_cannot_delete_admin(self, hr_client, admin_user):
        response = hr_client.delete(
            reverse("hr-user-delete", kwargs={"pk": admin_user.pk})
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert User.objects.filter(pk=admin_user.pk).exists()

    def test_hr_cannot_delete_self(self, hr_client, hr_user):
        response = hr_client.delete(
            reverse("hr-user-delete", kwargs={"pk": hr_user.pk})
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_employee_forbidden_from_hr_delete(self, authenticated_client, hr_user):
        response = authenticated_client.delete(
            reverse("hr-user-delete", kwargs={"pk": hr_user.pk})
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ─────────────────────────────────────────────────────────────
# Clockers / Devices — AllowAny (public by design — confirm this
# is actually the intended posture; see review notes)
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestClockerEndpoints:

    def test_clockers_list_authenticated(self, authenticated_client):
        response = authenticated_client.get(reverse("clockers-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_clockers_list_unauthenticated_also_allowed(self, api_client):
        """AllowAny — confirmed intentional per views.py. If this ever
        needs to change to IsAuthenticated, this test should fail loudly
        as a prompt to update the permission class deliberately."""
        response = api_client.get(reverse("clockers-list"))
        assert response.status_code == status.HTTP_200_OK


# ─────────────────────────────────────────────────────────────
# Serializer unit tests (no DB round trip needed beyond user creation)
# ─────────────────────────────────────────────────────────────

class TestUserSerializer:

    @pytest.mark.django_db
    def test_serializer_valid_data(self, db):
        from accounts.serializers import UserSerializer
        user = User.objects.create_user(
            username="sertest", email="ser@example.com", password="pass123",
        )
        s = UserSerializer(user)
        assert s.data["username"] == "sertest"
        assert s.data["email"] == "ser@example.com"
        user.delete()

    def test_serializer_missing_required_field(self):
        from accounts.serializers import UserSerializer
        s = UserSerializer(data={"email": "x@x.com"})
        assert s.is_valid() is False
        assert "username" in s.errors


# ─────────────────────────────────────────────────────────────
# Permissions unit tests — direct, no more ImportError-skip padding
# since these classes are confirmed to exist in accounts/permissions.py
# ─────────────────────────────────────────────────────────────

class TestPermissionsClasses:

    def test_is_admin_denies_non_admin_role(self):
        from accounts.permissions import IsAdmin
        from unittest.mock import MagicMock
        perm = IsAdmin()
        request = MagicMock(user=MagicMock(is_authenticated=True, role="HR"))
        assert perm.has_permission(request, None) is False

    def test_is_admin_allows_admin_role(self):
        from accounts.permissions import IsAdmin
        from unittest.mock import MagicMock
        perm = IsAdmin()
        request = MagicMock(user=MagicMock(is_authenticated=True, role="ADMIN"))
        assert perm.has_permission(request, None) is True

    def test_is_hr_allows_hr_and_admin_only(self):
        from accounts.permissions import IsHR
        from unittest.mock import MagicMock
        perm = IsHR()
        for role, expected in [("HR", True), ("ADMIN", True), ("EMPLOYEE", False)]:
            request = MagicMock(user=MagicMock(is_authenticated=True, role=role))
            assert perm.has_permission(request, None) is expected, f"role={role}"

    def test_is_employee_allows_any_authenticated_role(self):
        from accounts.permissions import IsEmployee
        from unittest.mock import MagicMock
        perm = IsEmployee()
        for role in ["EMPLOYEE", "HR", "ADMIN"]:
            request = MagicMock(user=MagicMock(is_authenticated=True, role=role))
            assert perm.has_permission(request, None) is True, f"role={role}"

    def test_permissions_deny_unauthenticated_regardless_of_role(self):
        from accounts.permissions import IsAdmin, IsHR, IsEmployee
        from unittest.mock import MagicMock
        request = MagicMock(user=MagicMock(is_authenticated=False, role="ADMIN"))
        for perm_cls in (IsAdmin, IsHR, IsEmployee):
            assert perm_cls().has_permission(request, None) is False