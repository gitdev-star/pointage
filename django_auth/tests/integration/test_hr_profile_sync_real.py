"""
tests/integration/test_hr_profile_sync_real.py  (place in django_auth/tests/integration/)

QE finding: accounts/signals.py pushes HRProfile create/update/delete to
django-hr over HTTP on every User save, and swallows ALL failures with
just a log warning. Nothing in the current pipeline verifies this
against a REAL django-hr -- conftest.py's autouse mock_external_services
fixture mocks it out for every other test in this suite.

This test deliberately does NOT use that mock -- it needs a live
django-hr reachable at DJANGO_HR_URL, same as the FastAPI repo's
real_cross_service tests. Run it the same way:

    pytest tests/integration/test_hr_profile_sync_real.py -m real_cross_service

Add `real_cross_service` to pytest.ini's `markers` list if not already
registered, and wire this into ci.yml's integration-tests job alongside
the three FastAPI-side real_cross_service files, since this is the one
direction (django_auth -> django-hr) those don't cover.
"""
import os
import pytest
import requests
from django.contrib.auth import get_user_model

User = get_user_model()

DJANGO_HR_URL = os.environ.get("DJANGO_HR_URL", "http://django-hr:8002")
SERVICE_KEY = os.environ.get("SERVICE_INTERNAL_KEY", "")

pytestmark = pytest.mark.real_cross_service


def _get_hr_profile(auth_user_id):
    resp = requests.get(
        f"{DJANGO_HR_URL}/api/accounts/profiles/",
        params={"auth_user_id": auth_user_id},
        headers={"X-Service-Key": SERVICE_KEY},
        timeout=5,
    )
    resp.raise_for_status()
    data = resp.json()
    profiles = data.get("results", data if isinstance(data, list) else [])
    return next((p for p in profiles if p["auth_user_id"] == auth_user_id), None)


@pytest.fixture(autouse=True)
def mock_external_services():
    """Override conftest.py's autouse mock -- this suite needs real
    network calls to a live django-hr, not mocked requests."""
    yield


@pytest.mark.django_db
class TestHRProfileSyncReal:

    def test_creating_hr_user_creates_real_hr_profile(self):
        user = User.objects.create_user(
            username="qe_sync_test_hr",
            email="qe_sync_test@example.com",
            password="testpass123",
            role="HR",
        )
        try:
            profile = _get_hr_profile(user.id)
            assert profile is not None, (
                "post_save signal fired but no HRProfile was found in "
                "django-hr -- check SERVICE_INTERNAL_KEY matches on both "
                "sides, and that DJANGO_HR_URL is reachable from django_auth."
            )
            assert profile["username"] == user.username
            assert profile["is_director"] is False
        finally:
            user.delete()

    def test_creating_admin_user_creates_director_profile(self):
        user = User.objects.create_user(
            username="qe_sync_test_admin",
            email="qe_sync_admin@example.com",
            password="testpass123",
            role="ADMIN",
        )
        try:
            profile = _get_hr_profile(user.id)
            assert profile is not None
            assert profile["is_director"] is True
        finally:
            user.delete()

    def test_creating_employee_user_does_not_create_hr_profile(self):
        """signals.py explicitly skips HRProfile sync for role not in
        [HR, ADMIN] -- confirm that's actually true against real django-hr,
        not just in the (mocked) unit tests."""
        user = User.objects.create_user(
            username="qe_sync_test_employee",
            email="qe_sync_employee@example.com",
            password="testpass123",
            role="EMPLOYEE",
        )
        try:
            profile = _get_hr_profile(user.id)
            assert profile is None
        finally:
            user.delete()

    def test_deleting_hr_user_removes_real_hr_profile(self):
        user = User.objects.create_user(
            username="qe_sync_test_delete",
            email="qe_sync_delete@example.com",
            password="testpass123",
            role="HR",
        )
        user_id = user.id
        assert _get_hr_profile(user_id) is not None, "setup failed: profile was never created"

        user.delete()

        profile = _get_hr_profile(user_id)
        assert profile is None, (
            "post_delete signal fired but HRProfile still exists in "
            "django-hr -- orphaned HR profile left behind."
        )