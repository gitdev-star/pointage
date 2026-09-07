"""
Unit tests for the Entra ID (Microsoft) login flow — purely additive to
the existing LDAP flow, so none of these touch LDAPLoginView.
"""

import pytest
from unittest.mock import patch
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
class TestEntraLoginView:

    def test_redirects_to_microsoft_auth_url(self, api_client):
        with patch("accounts.views.get_auth_url", return_value="https://login.microsoftonline.com/fake"):
            resp = api_client.get("/api/auth/entra/login/")
        assert resp.status_code == 302
        assert resp.url == "https://login.microsoftonline.com/fake"

    def test_returns_500_when_entra_not_configured(self, api_client):
        with patch("accounts.views.get_auth_url", side_effect=RuntimeError("AZURE_CLIENT_ID not set")):
            resp = api_client.get("/api/auth/entra/login/")
        assert resp.status_code == 500


@pytest.mark.django_db
class TestEntraCallbackView:

    def test_missing_code_returns_400(self, api_client):
        resp = api_client.get("/api/auth/entra/callback/")
        assert resp.status_code == 400

    def test_entra_error_param_returns_401(self, api_client):
        resp = api_client.get("/api/auth/entra/callback/?error=access_denied")
        assert resp.status_code == 401

    def test_unknown_user_denied_not_auto_provisioned(self, api_client):
        """Same admin-pre-approval model as LDAP: an Entra-authenticated
        user who was never imported by an admin must be rejected, not
        silently created."""
        with patch("accounts.views.acquire_token_by_code", return_value={"fake": "claims"}), \
             patch("accounts.views.extract_username_from_claims", return_value="not.imported@example.com"):
            resp = api_client.get("/api/auth/entra/callback/?code=abc123")
        assert resp.status_code == 401
        assert not User.objects.filter(username="not.imported@example.com").exists()

    def test_inactive_user_denied(self, api_client, test_user):
        test_user.is_active = False
        test_user.save()
        with patch("accounts.views.acquire_token_by_code", return_value={"fake": "claims"}), \
             patch("accounts.views.extract_username_from_claims", return_value=test_user.username):
            resp = api_client.get("/api/auth/entra/callback/?code=abc123")
        assert resp.status_code == 401

    def test_valid_preapproved_user_issues_jwt_and_redirects(self, api_client, test_user, settings):
        settings.FRONTEND_URL = "https://front.example.com"
        with patch("accounts.views.acquire_token_by_code", return_value={"fake": "claims"}), \
             patch("accounts.views.extract_username_from_claims", return_value=test_user.username):
            resp = api_client.get("/api/auth/entra/callback/?code=abc123")
        assert resp.status_code == 302
        assert resp.url.startswith("https://front.example.com/auth/callback?access=")

    def test_token_exchange_failure_returns_401(self, api_client):
        with patch("accounts.views.acquire_token_by_code", return_value=None):
            resp = api_client.get("/api/auth/entra/callback/?code=bad-code")
        assert resp.status_code == 401


@pytest.mark.django_db
class TestEntraUserListView:

    def test_requires_admin(self, authenticated_client):
        resp = authenticated_client.get("/api/auth/entra/users/")
        assert resp.status_code == 403

    def test_admin_lists_entra_users_with_import_flag(self, admin_client, test_user):
        fake_entra_users = [
            {"username": test_user.username, "email": test_user.email,
             "first_name": "Existing", "last_name": "User"},
            {"username": "new.person@example.com", "email": "new.person@example.com",
             "first_name": "New", "last_name": "Person"},
        ]
        with patch("accounts.views.list_entra_users", return_value=fake_entra_users):
            resp = admin_client.get("/api/auth/entra/users/")
        assert resp.status_code == 200
        by_username = {u["username"]: u for u in resp.data}
        assert by_username[test_user.username]["already_imported"] is True
        assert by_username["new.person@example.com"]["already_imported"] is False


@pytest.mark.django_db
class TestEntraImportUserView:

    def test_requires_admin(self, authenticated_client):
        resp = authenticated_client.post("/api/auth/entra/import/", {"username": "x"})
        assert resp.status_code == 403

    def test_imports_user_with_unusable_password(self, admin_client):
        fake_entra_users = [
            {"username": "new.hire@example.com", "email": "new.hire@example.com",
             "first_name": "New", "last_name": "Hire"},
        ]
        with patch("accounts.views.list_entra_users", return_value=fake_entra_users):
            resp = admin_client.post(
                "/api/auth/entra/import/",
                {"username": "new.hire@example.com", "role": "HR"},
            )
        assert resp.status_code == 201
        user = User.objects.get(username="new.hire@example.com")
        assert user.role == "HR"
        assert not user.has_usable_password()

    def test_missing_username_returns_400(self, admin_client):
        resp = admin_client.post("/api/auth/entra/import/", {})
        assert resp.status_code == 400

    def test_duplicate_username_returns_400(self, admin_client, test_user):
        with patch("accounts.views.list_entra_users", return_value=[]):
            resp = admin_client.post(
                "/api/auth/entra/import/",
                {"username": test_user.username, "role": "HR"},
            )
        assert resp.status_code == 400

    def test_user_not_found_in_entra_returns_404(self, admin_client):
        with patch("accounts.views.list_entra_users", return_value=[]):
            resp = admin_client.post(
                "/api/auth/entra/import/",
                {"username": "ghost@example.com", "role": "HR"},
            )
        assert resp.status_code == 404
