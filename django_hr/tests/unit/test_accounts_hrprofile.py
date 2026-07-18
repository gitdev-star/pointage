# tests/unit/test_accounts_hrprofile.py
"""
QE gap: accounts/ (director-only write access + the "can't delete the
last director" safeguard) had no dedicated coverage.
"""
import pytest
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def _client_for(user):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def director_profile(test_user, test_factory):
    from accounts.models import HRProfile
    return HRProfile.objects.create(
        auth_user_id=test_user.id, username=test_user.username,
        email=test_user.email, job_title="Directeur RH",
        factory=test_factory, is_director=True,
    )


class TestHRProfileWriteAccess:

    def test_non_director_cannot_create_profile(self, authenticated_client, hr_profile, test_factory):
        resp = authenticated_client.post("/api/accounts/profiles/", {
            "auth_user_id": 999, "username": "newhire", "factory": test_factory.id,
        })
        assert resp.status_code == 403

    def test_director_can_create_profile(self, director_profile, test_factory):
        client = _client_for(_owning_user(director_profile))
        resp = client.post("/api/accounts/profiles/", {
            "auth_user_id": 999, "username": "newhire", "factory": test_factory.id,
        })
        assert resp.status_code == 201

    def test_non_director_can_still_list_profiles(self, authenticated_client, hr_profile):
        assert authenticated_client.get("/api/accounts/profiles/").status_code == 200


class TestLastDirectorProtection:

    def test_cannot_delete_the_last_active_director(self, director_profile):
        client = _client_for(_owning_user(director_profile))
        resp = client.delete(f"/api/accounts/profiles/{director_profile.id}/")
        assert resp.status_code == 400
        assert "Directeur" in resp.data["detail"]

    def test_can_delete_a_director_when_another_remains_active(
        self, director_profile, test_user, test_factory
    ):
        from django.contrib.auth.models import User
        from accounts.models import HRProfile
        other_user = User.objects.create_user(username="dir2", password="x")
        HRProfile.objects.create(
            auth_user_id=other_user.id, username="dir2",
            factory=test_factory, is_director=True,
        )
        client = _client_for(_owning_user(director_profile))
        resp = client.delete(f"/api/accounts/profiles/{director_profile.id}/")
        assert resp.status_code == 204


class TestMeEndpoint:

    def test_returns_404_when_no_profile_exists(self, authenticated_client):
        resp = authenticated_client.get("/api/accounts/me/")
        assert resp.status_code == 404

    def test_returns_profile_when_it_exists(self, authenticated_client, hr_profile):
        resp = authenticated_client.get("/api/accounts/me/")
        assert resp.status_code == 200
        assert resp.data["username"] == hr_profile.username


def _owning_user(hr_profile_instance):
    from django.contrib.auth.models import User
    return User.objects.get(id=hr_profile_instance.auth_user_id)