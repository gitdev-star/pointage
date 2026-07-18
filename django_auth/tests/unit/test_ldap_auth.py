"""
Tests for the real LDAP/AD integration path — ldap_service.py and the
views that depend on it (LDAPLoginView's success branch, LDAPUserListView,
LDAPImportUserView).

IMPORTANT — mock target note:
conftest.py's autouse `mock_external_services` fixture patches
"accounts.ldap_service.authenticate_ldap_user". But accounts/views.py does
    from .ldap_service import authenticate_ldap_user
which binds a SEPARATE name inside the accounts.views module at import
time. Patching accounts.ldap_service.authenticate_ldap_user does NOT
affect that already-bound accounts.views.authenticate_ldap_user
reference. In practice the LOCAL login tests still passed anyway,
because authenticate_ldap_user() has its own internal try/except that
swallows real connection failures and returns None — so in an
environment with no real LDAP server reachable, it degrades to None
"by accident" rather than by the mock actually working.

This file patches the CORRECT target — "accounts.views.authenticate_ldap_user"
and "accounts.views.list_ldap_users" — for view-level tests, and patches
"accounts.ldap_service.get_ldap_connection" for service-level tests of
ldap_service.py itself.
"""
import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from accounts.ldap_service import authenticate_ldap_user, list_ldap_users

User = get_user_model()


# ─────────────────────────────────────────────────────────────
# Helpers to fake ldap3 Entry objects
# ─────────────────────────────────────────────────────────────

class FakeLdapValue:
    """Mimics an ldap3 attribute value: str() gives the scalar value,
    and it's indexable for multi-valued attrs like mail[0]."""
    def __init__(self, value=None):
        self._value = value

    def __str__(self):
        return "" if self._value is None else str(self._value)

    def __bool__(self):
        return bool(self._value)

    def __getitem__(self, idx):
        if isinstance(self._value, (list, tuple)):
            return self._value[idx]
        return self._value


def make_fake_entry(cn="", username="", email=None, department=None,
                     title=None, first_name=None, last_name=None,
                     entry_dn="CN=fake,DC=tecma,DC=lan"):
    entry = MagicMock()
    entry.cn = FakeLdapValue(cn)
    entry.sAMAccountName = FakeLdapValue(username)
    entry.mail = FakeLdapValue([email] if email else None)
    entry.department = FakeLdapValue([department] if department else None)
    entry.title = FakeLdapValue([title] if title else None)
    entry.givenName = FakeLdapValue([first_name] if first_name else None)
    entry.sn = FakeLdapValue([last_name] if last_name else None)
    entry.entry_dn = entry_dn
    return entry


# ─────────────────────────────────────────────────────────────
# ldap_service.list_ldap_users() — service-level, direct
# ─────────────────────────────────────────────────────────────

class TestListLdapUsers:

    def test_returns_real_users_correctly_parsed(self):
        fake_conn = MagicMock()
        fake_conn.entries = [
            make_fake_entry(
                cn="Jean Dupont", username="jdupont",
                email="jdupont@tecma.mg", department="IT",
                title="Developer", first_name="Jean", last_name="Dupont",
            )
        ]

        with patch("accounts.ldap_service.get_ldap_connection", return_value=fake_conn):
            users = list_ldap_users()

        assert len(users) == 1
        assert users[0]["username"] == "jdupont"
        assert users[0]["email"] == "jdupont@tecma.mg"
        assert users[0]["first_name"] == "Jean"
        assert users[0]["last_name"] == "Dupont"

    def test_filters_out_system_accounts(self):
        fake_conn = MagicMock()
        fake_conn.entries = [
            make_fake_entry(cn="Guest", username="guest"),
            make_fake_entry(cn="Krbtgt", username="krbtgt"),
            make_fake_entry(cn="Real User", username="realuser", email="r@x.com"),
        ]

        with patch("accounts.ldap_service.get_ldap_connection", return_value=fake_conn):
            users = list_ldap_users()

        usernames = [u["username"] for u in users]
        assert "guest" not in usernames
        assert "krbtgt" not in usernames
        assert "realuser" in usernames

    def test_filters_out_dollar_sign_accounts(self):
        """Machine accounts like COMPUTER$ must be excluded."""
        fake_conn = MagicMock()
        fake_conn.entries = [
            make_fake_entry(cn="Computer Account", username="WORKSTATION1$"),
            make_fake_entry(cn="Real User", username="realuser", email="r@x.com"),
        ]

        with patch("accounts.ldap_service.get_ldap_connection", return_value=fake_conn):
            users = list_ldap_users()

        usernames = [u["username"] for u in users]
        assert "WORKSTATION1$" not in usernames
        assert "realuser" in usernames

    def test_returns_empty_list_on_connection_failure(self):
        """LDAP server unreachable — must degrade gracefully, not crash."""
        with patch("accounts.ldap_service.get_ldap_connection", side_effect=Exception("LDAP timeout")):
            users = list_ldap_users()

        assert users == []

    def test_users_sorted_by_cn(self):
        fake_conn = MagicMock()
        fake_conn.entries = [
            make_fake_entry(cn="Zoe Martin", username="zmartin", email="z@x.com"),
            make_fake_entry(cn="Alice Dubois", username="adubois", email="a@x.com"),
        ]

        with patch("accounts.ldap_service.get_ldap_connection", return_value=fake_conn):
            users = list_ldap_users()

        assert [u["cn"] for u in users] == ["Alice Dubois", "Zoe Martin"]


# ─────────────────────────────────────────────────────────────
# ldap_service.authenticate_ldap_user() — service-level, direct
# ─────────────────────────────────────────────────────────────

class TestAuthenticateLdapUser:

    def test_successful_bind_returns_user_info(self, caplog):
        search_conn = MagicMock()
        search_conn.entries = [
            make_fake_entry(
                cn="Jean Dupont", username="jdupont",
                email="jdupont@tecma.mg", first_name="Jean", last_name="Dupont",
                entry_dn="CN=jdupont,OU=Users,DC=tecma,DC=lan",
            )
        ]

        user_bind_conn = MagicMock()
        user_bind_conn.bound = True

        with caplog.at_level("ERROR"):
            with patch("accounts.ldap_service.get_ldap_connection", return_value=search_conn), \
                 patch("accounts.ldap_service.Connection", return_value=user_bind_conn):
                result = authenticate_ldap_user("jdupont", "correct-password")

        assert result is not None, f"Got None. Captured log: {caplog.text}"

    def test_user_not_found_in_directory_returns_none(self):
        search_conn = MagicMock()
        search_conn.entries = []  # no match

        with patch("accounts.ldap_service.get_ldap_connection", return_value=search_conn):
            result = authenticate_ldap_user("nobody", "whatever")

        assert result is None

    def test_wrong_password_returns_none(self):
        search_conn = MagicMock()
        search_conn.entries = [
            make_fake_entry(cn="Jean Dupont", username="jdupont", email="j@x.com")
        ]

        with patch("accounts.ldap_service.get_ldap_connection", return_value=search_conn), \
             patch("accounts.ldap_service.Connection", side_effect=Exception("invalid credentials")):
            result = authenticate_ldap_user("jdupont", "wrong-password")

        assert result is None

    def test_ldap_server_unreachable_returns_none_not_exception(self):
        """Must not raise — LDAPLoginView has no except clause around this call."""
        with patch("accounts.ldap_service.get_ldap_connection", side_effect=Exception("Connection refused")):
            result = authenticate_ldap_user("anyone", "anypass")

        assert result is None


# ─────────────────────────────────────────────────────────────
# LDAPLoginView — the SUCCESSFUL LDAP branch (previously untested;
# local-fallback branch is already covered in test_api_coverage.py)
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLDAPLoginViewSuccessBranch:

    def test_ldap_success_but_user_not_provisioned_in_django(self, api_client):
        """LDAP accepts credentials, but no matching Django User row
        exists yet — must be denied with a clear message, not a 500."""
        with patch("accounts.views.authenticate_ldap_user") as mock_auth:
            mock_auth.return_value = {
                "cn": "Jean Dupont", "username": "jdupont",
                "email": "jdupont@tecma.mg", "first_name": "Jean", "last_name": "Dupont",
            }
            response = api_client.post(reverse("login"), {
                "username": "jdupont", "password": "correct-ad-password",
            }, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "administrateur" in response.data["detail"]

    def test_ldap_success_and_user_provisioned_returns_tokens(self, api_client, db):
        user = User.objects.create(
            username="jdupont", email="jdupont@tecma.mg", role="HR", is_active=True,
        )
        user.set_unusable_password()
        user.save()

        with patch("accounts.views.authenticate_ldap_user") as mock_auth:
            mock_auth.return_value = {
                "cn": "Jean Dupont", "username": "jdupont",
                "email": "jdupont@tecma.mg", "first_name": "Jean", "last_name": "Dupont",
            }
            response = api_client.post(reverse("login"), {
                "username": "jdupont", "password": "correct-ad-password",
            }, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["user"]["role"] == "HR"
        assert "access" in response.data

    def test_ldap_success_but_django_account_inactive(self, api_client, db):
        user = User.objects.create(
            username="jdupont", email="j@x.com", role="EMPLOYEE", is_active=False,
        )
        user.set_unusable_password()
        user.save()

        with patch("accounts.views.authenticate_ldap_user") as mock_auth:
            mock_auth.return_value = {
                "cn": "Jean Dupont", "username": "jdupont",
                "email": "j@x.com", "first_name": "Jean", "last_name": "Dupont",
            }
            response = api_client.post(reverse("login"), {
                "username": "jdupont", "password": "correct-ad-password",
            }, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_ldap_unreachable_falls_back_to_local_auth(self, api_client, test_user):
        """authenticate_ldap_user raising should not crash the endpoint —
        it should fall through to local password auth."""
        with patch("accounts.views.authenticate_ldap_user", side_effect=Exception("LDAP down")):
            response = api_client.post(reverse("login"), {
                "username": test_user.username, "password": "testpass123",
            }, format="json")

        # LDAPLoginView has no try/except around this call today — if this
        # test fails with a 500, that's a real bug the view should guard against.
        assert response.status_code == status.HTTP_200_OK


# ─────────────────────────────────────────────────────────────
# LDAPUserListView — Admin-only, lists AD users + already_imported flag
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLDAPUserListView:

    def test_requires_admin(self, authenticated_client):
        response = authenticated_client.get(reverse("ldap-users"))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_hr_forbidden(self, hr_client):
        response = hr_client.get(reverse("ldap-users"))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_sees_ldap_users_with_import_flag(self, admin_client, db):
        User.objects.create_user(
            username="already_here", email="a@x.com", password="pass123",
        )
        fake_users = [
            {"cn": "Already Here", "username": "already_here", "email": "a@x.com",
             "department": "", "title": "", "first_name": "", "last_name": ""},
            {"cn": "New Person", "username": "newperson", "email": "n@x.com",
             "department": "", "title": "", "first_name": "", "last_name": ""},
        ]
        with patch("accounts.views.list_ldap_users", return_value=fake_users):
            response = admin_client.get(reverse("ldap-users"))

        assert response.status_code == status.HTTP_200_OK
        by_username = {u["username"]: u for u in response.data}
        assert by_username["already_here"]["already_imported"] is True
        assert by_username["newperson"]["already_imported"] is False


# ─────────────────────────────────────────────────────────────
# LDAPImportUserView — Admin-only, creates a Django user with
# unusable password so they authenticate via AD only
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLDAPImportUserView:

    def test_requires_admin(self, authenticated_client):
        response = authenticated_client.post(reverse("ldap-import"), {
            "username": "jdupont", "role": "HR",
        }, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_missing_username_returns_400(self, admin_client):
        response = admin_client.post(reverse("ldap-import"), {
            "role": "HR",
        }, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_already_existing_username_rejected(self, admin_client, test_user):
        response = admin_client.post(reverse("ldap-import"), {
            "username": test_user.username, "role": "HR",
        }, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_username_not_found_in_ad_returns_404(self, admin_client):
        with patch("accounts.views.list_ldap_users", return_value=[]):
            response = admin_client.post(reverse("ldap-import"), {
                "username": "ghost", "role": "HR",
            }, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_successful_import_creates_user_with_unusable_password(self, admin_client):
        fake_users = [{
            "cn": "Jean Dupont", "username": "jdupont", "email": "j@tecma.mg",
            "department": "IT", "title": "Dev", "first_name": "Jean", "last_name": "Dupont",
        }]
        with patch("accounts.views.list_ldap_users", return_value=fake_users):
            response = admin_client.post(reverse("ldap-import"), {
                "username": "jdupont", "role": "HR",
            }, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        created = User.objects.get(username="jdupont")
        assert created.role == "HR"
        assert created.has_usable_password() is False