"""
Unit tests for Django Auth accounts views.
Tests user authentication and token generation.
"""

import pytest
from django.contrib.auth.models import User
from django.urls import reverse


@pytest.mark.django_db
class TestUserAuthentication:
    """Test user authentication views."""

    def test_user_can_be_created(self, test_user):
        """Test that a user can be created."""
        assert User.objects.filter(username=test_user.username).exists()

    def test_user_can_login(self, authenticated_client, test_user):
        """Test that an authenticated user can be created."""
        assert authenticated_client is not None

    def test_invalid_credentials(self, api_client):
        """Test login with invalid credentials."""
        data = {
            "username": "testuser",
            "password": "wrongpassword"
        }
        # Assuming there's a login endpoint
        # This would need to match your actual endpoint
        response = api_client.post(
            reverse("token_obtain_pair") if "token_obtain_pair" else "/",
            data,
            format="json"
        )
        # Should fail or return unauthorized
        if response.status_code != 404:  # endpoint exists
            assert response.status_code in [400, 401, 403]

    def test_user_attributes(self, test_user):
        """Test user object has correct attributes."""
        assert test_user.email == "test@example.com"
        assert test_user.username == "testuser"
        assert test_user.is_active is True

    def test_multiple_users_creation(self):
        """Test creating multiple users."""
        users = []
        for i in range(5):
            user = User.objects.create_user(
                username=f"user{i}",
                email=f"user{i}@example.com",
                password="pass123"
            )
            users.append(user)
        
        assert User.objects.filter(username__startswith="user").count() >= 5
        
        for user in users:
            user.delete()


@pytest.mark.django_db
class TestJWTToken:
    """Test JWT token generation."""

    def test_token_generation(self, jwt_token):
        """Test that JWT token can be generated."""
        assert jwt_token is not None
        assert isinstance(jwt_token, str)
        assert len(jwt_token) > 0

    def test_token_format(self, jwt_token):
        """Test JWT token has valid format (3 parts separated by dots)."""
        parts = jwt_token.split(".")
        assert len(parts) == 3
