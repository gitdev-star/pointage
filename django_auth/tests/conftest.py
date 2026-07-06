import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.fixture(autouse=True)
def mock_signal_requests():
    """Mock all HTTP calls from signals — prevents 3s timeouts during tests."""
    with patch("accounts.signals.requests.get") as mock_get, \
         patch("accounts.signals.requests.post") as mock_post, \
         patch("accounts.signals.requests.patch") as mock_patch, \
         patch("accounts.signals.requests.delete") as mock_delete:
        mock_get.return_value = MagicMock(json=lambda: {"results": []})
        yield


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_user(db):
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123"
    )
    yield user
    user.delete()


@pytest.fixture
def authenticated_client(test_user):
    client = APIClient()
    refresh = RefreshToken.for_user(test_user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    yield client


@pytest.fixture
def jwt_token(test_user):
    refresh = RefreshToken.for_user(test_user)
    return str(refresh.access_token)