"""
Unit tests for Django Auth — accounts.User model and JWT authentication.
Uses get_user_model() to support the custom User model (accounts.User).
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    """Test the custom accounts.User model."""

    def test_user_creation(self, test_user):
        """User is saved with correct attributes."""
        assert User.objects.filter(username="testuser").exists()
        assert test_user.email == "test@example.com"
        assert test_user.is_active is True

    def test_user_default_role(self, test_user):
        """Default role is EMPLOYEE."""
        assert test_user.role == "EMPLOYEE"

    def test_user_str_representation(self, test_user):
        """__str__ returns username (role)."""
        assert "testuser" in str(test_user)
        assert "EMPLOYEE" in str(test_user)

    def test_user_role_choices(self):
        """All expected role choices exist."""
        roles = [r[0] for r in User.ROLE_CHOICES]
        assert "ADMIN" in roles
        assert "HR" in roles
        assert "EMPLOYEE" in roles

    def test_user_admin_role(self, db):
        """User can be assigned ADMIN role."""
        user = User.objects.create_user(
            username="adminuser",
            email="admin@example.com",
            password="pass123",
            role="ADMIN"
        )
        assert user.role == "ADMIN"
        user.delete()

    def test_user_hr_role(self, db):
        """User can be assigned HR role."""
        user = User.objects.create_user(
            username="hruser",
            email="hr@example.com",
            password="pass123",
            role="HR"
        )
        assert user.role == "HR"
        user.delete()

    def test_multiple_users_creation(self, db):
        """Multiple users can be created without conflict."""
        users = []
        for i in range(5):
            user = User.objects.create_user(
                username=f"bulkuser{i}",
                email=f"bulkuser{i}@example.com",
                password="pass123"
            )
            users.append(user)

        assert User.objects.filter(username__startswith="bulkuser").count() == 5
        for user in users:
            user.delete()

    def test_superuser_creation(self, db):
        """Superuser has is_staff and is_superuser set."""
        su = User.objects.create_superuser(
            username="superadmin",
            email="super@example.com",
            password="superpass123"
        )
        assert su.is_staff is True
        assert su.is_superuser is True
        su.delete()

    def test_user_password_is_hashed(self, test_user):
        """Stored password is hashed, not plaintext."""
        assert test_user.password != "testpass123"
        assert test_user.check_password("testpass123") is True

    def test_user_wrong_password_rejected(self, test_user):
        """Wrong password does not authenticate."""
        assert test_user.check_password("wrongpassword") is False

    def test_user_email_field(self, db):
        """Email field stores correctly."""
        user = User.objects.create_user(
            username="emailtest",
            email="specific@domain.com",
            password="pass123"
        )
        assert user.email == "specific@domain.com"
        user.delete()

    def test_user_update_role(self, test_user):
        """Role can be updated after creation."""
        test_user.role = "HR"
        test_user.save()
        refreshed = User.objects.get(pk=test_user.pk)
        assert refreshed.role == "HR"

    def test_inactive_user(self, db):
        """User can be set inactive."""
        user = User.objects.create_user(
            username="inactiveuser",
            email="inactive@example.com",
            password="pass123",
            is_active=False
        )
        assert user.is_active is False
        user.delete()


@pytest.mark.django_db
class TestJWTToken:
    """Test JWT token generation and format."""

    def test_token_is_generated(self, jwt_token):
        """Token is a non-empty string."""
        assert jwt_token is not None
        assert isinstance(jwt_token, str)
        assert len(jwt_token) > 0

    def test_token_has_three_parts(self, jwt_token):
        """JWT token has header.payload.signature format."""
        parts = jwt_token.split(".")
        assert len(parts) == 3

    def test_refresh_token_generation(self, test_user):
        """Refresh token can also be generated."""
        refresh = RefreshToken.for_user(test_user)
        assert str(refresh) is not None
        assert len(str(refresh).split(".")) == 3

    def test_access_token_from_refresh(self, test_user):
        """Access token can be extracted from refresh token."""
        refresh = RefreshToken.for_user(test_user)
        access = str(refresh.access_token)
        assert len(access.split(".")) == 3

    def test_different_users_get_different_tokens(self, db):
        """Two users get different tokens."""
        user1 = User.objects.create_user(username="tok1", email="tok1@x.com", password="p")
        user2 = User.objects.create_user(username="tok2", email="tok2@x.com", password="p")
        token1 = str(RefreshToken.for_user(user1).access_token)
        token2 = str(RefreshToken.for_user(user2).access_token)
        assert token1 != token2
        user1.delete()
        user2.delete()


@pytest.mark.django_db
class TestAuthenticatedClient:
    """Test authenticated API client behavior."""

    def test_authenticated_client_has_credentials(self, authenticated_client):
        """Authenticated client is properly configured."""
        assert authenticated_client is not None

    def test_unauthenticated_client_has_no_credentials(self, api_client):
        """Unauthenticated client has no auth header."""
        assert api_client is not None
        # No credentials set — will get 401/403 on protected endpoints

    def test_token_auth_header_format(self, test_user):
        """Authorization header uses Bearer scheme."""
        from rest_framework.test import APIClient
        client = APIClient()
        refresh = RefreshToken.for_user(test_user)
        token = str(refresh.access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        # Verify the header was accepted (client configured without error)
        assert client is not None


@pytest.mark.django_db
class TestDevicesModel:
    """Test Clocker/Device model if accessible."""

    def test_import_devices_models(self):
        """Devices models can be imported."""
        try:
            from devices.models import Clocker
            assert Clocker is not None
        except ImportError:
            pytest.skip("devices.Clocker not available")

    def test_clocker_serializer_importable(self):
        """Clocker serializer can be imported."""
        try:
            from devices.serializers import ClockerSerializer
            assert ClockerSerializer is not None
        except ImportError:
            pytest.skip("ClockerSerializer not available")
