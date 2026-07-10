import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.fixture(autouse=True)
def mock_external_services():
    """Mock LDAP and signal HTTP calls by default — prevents timeouts in CI.

    NOTE: this forces authenticate_ldap_user() to always return None,
    which means the LDAP branch of LDAPLoginView is NEVER exercised by
    any test that relies on this autouse fixture. Real LDAP-path tests
    must patch accounts.views.authenticate_ldap_user explicitly within
    the test itself (see tests/unit/test_ldap_auth.py) — the explicit
    patch inside a test overrides this one for that test's duration.
    """
    with patch("accounts.signals.requests.get") as mock_get, \
         patch("accounts.signals.requests.post") as mock_post, \
         patch("accounts.signals.requests.patch") as mock_patch, \
         patch("accounts.signals.requests.delete") as mock_delete, \
         patch("accounts.ldap_service.get_ldap_connection") as mock_ldap, \
         patch("accounts.ldap_service.authenticate_ldap_user") as mock_auth:
        mock_get.return_value = MagicMock(json=lambda: {"results": []})
        mock_ldap.return_value = MagicMock()
        mock_auth.return_value = None
        yield


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_user(db):
    """A plain EMPLOYEE-role user."""
    user = User.objects.create_user(
        username="testuser", email="test@example.com",
        password="testpass123", role="EMPLOYEE",
    )
    yield user
    user.delete()


@pytest.fixture
def hr_user(db):
    user = User.objects.create_user(
        username="hrstaff", email="hr@example.com",
        password="pass123", role="HR",
    )
    yield user
    user.delete()


@pytest.fixture
def admin_user(db):
    user = User.objects.create_user(
        username="adminstaff", email="adminstaff@example.com",
        password="pass123", role="ADMIN",
    )
    yield user
    user.delete()


def _client_for(user):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def authenticated_client(test_user):
    yield _client_for(test_user)


@pytest.fixture
def hr_client(hr_user):
    yield _client_for(hr_user)


@pytest.fixture
def admin_client(admin_user):
    yield _client_for(admin_user)


@pytest.fixture
def jwt_token(test_user):
    refresh = RefreshToken.for_user(test_user)
    return str(refresh.access_token)