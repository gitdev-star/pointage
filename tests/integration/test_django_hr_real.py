"""
Real cross-service integration tests — hits the ACTUAL running
django-hr container over pointage_net. Read-only: no writes to the
shared Postgres instance (192.168.8.211) under any circumstance.

Must run from inside a container attached to pointage_net (e.g. via
`docker compose exec fastapi pytest ...`) since django-hr:8002 is not
reachable from the host — only `expose`d internally, not `ports`-published.

NOT part of the default `pytest tests/` run — deliberately excluded via
the `real_cross_service` marker so it never runs against the mocked
http://mock-hr URL in the GitHub-hosted `test` job.

This file specifically targets the JWT trust boundary between
django_auth and django_hr: django_auth's LDAPLoginView signs tokens with
JWT_SECRET_KEY, django_hr's HRTokenAuthentication verifies them against
the same env var. These two have already drifted apart once in
production (JWT_SECRET_KEY vs DJANGO_SECRET_KEY) — these tests exist so
that class of bug fails loudly in CI instead of silently in prod.
"""
import os
import time

import jwt
import pytest
import httpx

pytestmark = pytest.mark.real_cross_service

DJANGO_HR_URL = os.environ["DJANGO_HR_URL"]  # e.g. http://django-hr:8002
REAL_JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
WRONG_JWT_SECRET_KEY = "not-the-real-key-" + REAL_JWT_SECRET_KEY[::-1]

EMPLOYEES_ACTIVE_ENDPOINT = f"{DJANGO_HR_URL}/api/employees/active/"

pytestmark = pytest.mark.real_cross_service


def _make_token(secret: str, *, role: str = "ADMIN", username: str = "integration-test-user", user_id: int = 0) -> str:
    """
    Build a JWT with the same claim shape LDAPLoginView actually issues:
    refresh["role"], refresh["username"], plus simplejwt's default
    user_id claim — since django_hr's HRTokenAuthentication reads
    payload.get("user_id"), payload.get("username"), payload.get("role").
    """
    now = int(time.time())
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "token_type": "access",
        "iat": now,
        "exp": now + 60,  # short-lived, this is a throwaway test token
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.mark.asyncio
async def test_jwt_secret_key_env_var_is_set():
    """Sanity check: without this, every token minted below is
    garbage and every assertion downstream would be meaningless."""
    assert REAL_JWT_SECRET_KEY, (
        "JWT_SECRET_KEY is empty inside this container — cannot mint "
        "a token that django_hr would ever accept."
    )


@pytest.mark.asyncio
async def test_django_hr_accepts_real_jwt():
    """
    Mint a token with the SAME secret django_auth actually signs with,
    send it to the real django-hr container, and confirm
    HRTokenAuthentication accepts it (200), not a masked 401/403.

    This is the direct regression test for the JWT_SECRET_KEY vs
    DJANGO_SECRET_KEY mismatch bug already hit once in production.
    """
    token = _make_token(REAL_JWT_SECRET_KEY)

    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            EMPLOYEES_ACTIVE_ENDPOINT,
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 200, (
        f"django-hr rejected a token signed with the real JWT_SECRET_KEY "
        f"— got {r.status_code}. This means django_auth and django_hr "
        f"have drifted apart on signing key or algorithm. "
        f"Body: {r.text[:300]}"
    )


@pytest.mark.asyncio
async def test_django_hr_rejects_jwt_signed_with_wrong_secret():
    """
    Mint a token with a DIFFERENT secret and confirm django-hr correctly
    rejects it. This is the inverse of the test above — proves
    HRTokenAuthentication is actually verifying the signature and not,
    say, silently trusting any well-formed JWT regardless of signer.
    """
    token = _make_token(WRONG_JWT_SECRET_KEY)

    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            EMPLOYEES_ACTIVE_ENDPOINT,
            headers={"Authorization": f"Bearer {token}"},
        )

    # Note: DRF returns 403 here, not 401 -- HRTokenAuthentication does
    # not implement authenticate_header(), so DRF has no WWW-Authenticate
    # challenge to advertise and falls back to 403 by design. Confirmed
    # against the real service: body is {"detail": "Token invalide."}.
    assert r.status_code == 403, (
        f"Expected django-hr to reject a token signed with the wrong "
        f"secret (403), got {r.status_code} instead. If this is 200, "
        f"django_hr is not actually verifying JWT signatures — a "
        f"forged token from any source would be accepted. "
        f"Body: {r.text[:300]}"
    )


@pytest.mark.asyncio
async def test_django_hr_rejects_expired_jwt():
    """
    Confirm django-hr enforces token expiry, not just signature validity.
    HRTokenAuthentication.authenticate() explicitly catches
    jwt.ExpiredSignatureError and raises AuthenticationFailed("Token expiré.")
    — this proves that branch is actually reachable and working end to end.
    """
    now = int(time.time())
    payload = {
        "user_id": 0,
        "username": "integration-test-user",
        "role": "ADMIN",
        "token_type": "access",
        "iat": now - 120,
        "exp": now - 60,  # already expired
    }
    token = jwt.encode(payload, REAL_JWT_SECRET_KEY, algorithm="HS256")

    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            EMPLOYEES_ACTIVE_ENDPOINT,
            headers={"Authorization": f"Bearer {token}"},
        )

    # Note: 403, not 401 -- same DRF authenticate_header() reasoning as
    # test_django_hr_rejects_jwt_signed_with_wrong_secret above.
    assert r.status_code == 403, (
        f"Expected 403 for an expired token, got {r.status_code}. "
        f"Body: {r.text[:300]}"
    )


@pytest.mark.asyncio
async def test_django_hr_rejects_missing_authorization_header():
    """Confirm the endpoint isn't accidentally open when no token is sent at all."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(EMPLOYEES_ACTIVE_ENDPOINT)

    assert r.status_code in (401, 403), (
        f"Expected 401/403 with no Authorization header at all, got "
        f"{r.status_code}. Body: {r.text[:300]}"
    )


# ── Service-to-service auth (X-Service-Key) ─────────────────────────────
#
# django_hr/accounts/urls.py mounts HRProfileViewSet at /api/accounts/profiles/
# and MeHRView at /api/accounts/me/ (django_hr/config/urls.py:
# path("api/accounts/", include("accounts.urls"))).
#
# HRProfileViewSet.authentication_classes = [ServiceAuthentication, HRTokenAuthentication]
# MeHRView.authentication_classes         = [HRTokenAuthentication]  (service key NOT accepted here)

REAL_SERVICE_KEY = os.environ["SERVICE_INTERNAL_KEY"]
WRONG_SERVICE_KEY = "not-the-real-key-" + REAL_SERVICE_KEY[::-1]

HR_PROFILES_ENDPOINT = f"{DJANGO_HR_URL}/api/accounts/profiles/"
HR_ME_ENDPOINT = f"{DJANGO_HR_URL}/api/accounts/me/"


@pytest.mark.asyncio
async def test_service_internal_key_env_var_is_set():
    """Sanity check: without this, every django-hr service-to-service
    call below gets 403, silently, with no clue why."""
    assert REAL_SERVICE_KEY, (
        "SERVICE_INTERNAL_KEY is empty inside this container — every "
        "X-Service-Key call to django-hr will get 403 Forbidden."
    )


@pytest.mark.asyncio
async def test_django_hr_accepts_real_service_key_for_profile_list():
    """
    Confirm ServiceAuthentication actually grants access to
    HRProfileViewSet with the real X-Service-Key header — this is the
    same mechanism django_auth is supposed to use to create/sync
    HRProfiles automatically, per the docstring on ServiceAuthentication.
    """
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            HR_PROFILES_ENDPOINT,
            headers={"X-Service-Key": REAL_SERVICE_KEY},
        )

    assert r.status_code == 200, (
        f"django-hr rejected the real SERVICE_INTERNAL_KEY on "
        f"{HR_PROFILES_ENDPOINT} — got {r.status_code}. Either the key "
        f"has drifted between containers, or ServiceAuthentication is "
        f"broken. Body: {r.text[:300]}"
    )


@pytest.mark.asyncio
async def test_django_hr_rejects_wrong_service_key():
    """Confirm ServiceAuthentication isn't just checking the header exists."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            HR_PROFILES_ENDPOINT,
            headers={"X-Service-Key": WRONG_SERVICE_KEY},
        )

    assert r.status_code in (401, 403), (
        f"Expected 401/403 for a wrong X-Service-Key, got {r.status_code}. "
        f"If this is 200, ServiceAuthentication is accepting any non-empty "
        f"header value rather than checking it against SERVICE_INTERNAL_KEY. "
        f"Body: {r.text[:300]}"
    )


@pytest.mark.asyncio
async def test_django_hr_rejects_missing_service_key():
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(HR_PROFILES_ENDPOINT)

    assert r.status_code in (401, 403), (
        f"Expected 401/403 with no X-Service-Key and no JWT at all, "
        f"got {r.status_code}. Body: {r.text[:300]}"
    )


@pytest.mark.asyncio
async def test_me_endpoint_does_not_accept_service_key():
    """
    MeHRView.authentication_classes = [HRTokenAuthentication] only —
    ServiceAuthentication is deliberately NOT registered here, since
    /me/ is meant to answer "who is this human user", which a service
    key can't meaningfully answer. Confirms that boundary holds in the
    real deployed code, not just in the source as read.
    """
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            HR_ME_ENDPOINT,
            headers={"X-Service-Key": REAL_SERVICE_KEY},
        )

    assert r.status_code in (401, 403), (
        f"Expected /api/accounts/me/ to reject a bare X-Service-Key "
        f"(it only accepts HRTokenAuthentication), got {r.status_code}. "
        f"If this is 200, MeHRView now accepts service-to-service auth "
        f"and something downstream may be relying on request.user "
        f"being a real human — check accounts/urls.py and views.py. "
        f"Body: {r.text[:300]}"
    )