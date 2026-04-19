"""
Pytest configuration for Django Auth tests.
Uses get_user_model() to support custom User model (accounts.User).
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.fixture
def api_client():
    """Create a REST API client."""
    return APIClient()


@pytest.fixture
def test_user(db):
    """Create a test user."""
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123"
    )
    yield user
    user.delete()


@pytest.fixture
def authenticated_client(test_user):
    """Create an authenticated REST API client."""
    client = APIClient()
    refresh = RefreshToken.for_user(test_user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    yield client


@pytest.fixture
def jwt_token(test_user):
    """Generate a JWT token for a test user."""
    refresh = RefreshToken.for_user(test_user)
    return str(refresh.access_token)
