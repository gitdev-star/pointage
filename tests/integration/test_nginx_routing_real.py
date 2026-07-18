"""
Real cross-service integration test — verifies nginx's /api/hr/ rewrite
actually reaches the real django-hr container correctly, end to end.

Must run from inside a container attached to pointage_net (e.g. via
`docker compose exec fastapi pytest ...`), same as test_django_hr_real.py
and test_cross_service_real.py.

NOT part of the default `pytest tests/` run — excluded via the
real_cross_service marker.

Why this file exists, separately from test_django_hr_real.py:
that file tests the AUTH trust boundary by hitting django-hr:8002
directly, bypassing nginx entirely. Nothing else in this suite exercises
nginx.conf's rewrite rule:

    location /api/hr/ {
        rewrite ^/api/hr/(.*)$ /api/$1 break;
        proxy_pass http://django_hr;
        ...
    }

django_hr's own urls.py has no /api/hr/ prefix at all (routes are
/api/employees/, /api/accounts/, etc.) — the /hr/ segment only exists
on the public-facing side, stripped by this rewrite. If that rewrite
rule is ever broken (typo, removed, reordered relative to another
location block), every request coming through the public HTTPS
endpoint would 404 even though django-hr itself is completely healthy
-- exactly the kind of bug that a direct container-to-container test
can't catch, since it never goes through nginx at all.

Read-only: GET requests only, no writes to the shared Postgres instance.
"""
import os
import time

import jwt
import pytest
import httpx

# nginx is reachable by its docker-compose service/container name on
# pointage_net; self-signed cert on port 443, so TLS verification is
# deliberately disabled below (verify=False) -- this is a controlled,
# known exception for this internal cert, not a general practice.
NGINX_BASE_URL = "https://nginx"

REAL_JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]

pytestmark = pytest.mark.real_cross_service


def _make_token(secret: str, *, role: str = "ADMIN", username: str = "integration-test-user", user_id: int = 0) -> str:
    now = int(time.time())
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "token_type": "access",
        "iat": now,
        "exp": now + 60,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.mark.asyncio
async def test_nginx_is_reachable_on_pointage_net():
    """Sanity check: nginx answers at all on the internal network,
    before asserting anything about the rewrite rule specifically."""
    async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
        r = await client.get(f"{NGINX_BASE_URL}/api/hr/employees/active/")

    assert r.status_code != 502 and r.status_code != 504, (
        f"nginx itself is unreachable or django-hr upstream is down — "
        f"got {r.status_code}. This means either nginx isn't running, "
        f"or its 'depends_on: django-hr' didn't actually wait for it "
        f"to be ready. Body: {r.text[:300]}"
    )


@pytest.mark.asyncio
async def test_api_hr_rewrite_reaches_employees_endpoint():
    """
    The core rewrite test: /api/hr/employees/active/ through nginx
    must reach the SAME real endpoint that test_django_hr_real.py hits
    directly at django-hr:8002/api/employees/active/.

    We only assert the rewrite delivers us to a real, authenticating
    django_hr endpoint (401 for no token) rather than a 404 (route
    doesn't exist -- rewrite broken) or 502/504 (upstream unreachable).
    A 404 here specifically would mean the rewrite rule is stripping
    the wrong segment, or the location block was removed/reordered.
    """
    async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
        r = await client.get(f"{NGINX_BASE_URL}/api/hr/employees/active/")

    assert r.status_code != 404, (
        "Got 404 through nginx's /api/hr/ rewrite -- this means the "
        "rewrite is not correctly stripping '/api/hr/' down to "
        "'/api/' before proxying to django-hr, or django_hr/config/"
        "urls.py no longer has 'employees/active/' at that path. "
        "Compare against django-hr:8002/api/employees/active/ directly "
        "(see test_django_hr_real.py) to isolate nginx vs django_hr."
    )
    assert r.status_code in (401, 403), (
        f"Expected 401/403 (unauthenticated) through the rewrite, got "
        f"{r.status_code}. Body: {r.text[:300]}"
    )


@pytest.mark.asyncio
async def test_api_hr_rewrite_accepts_real_jwt_end_to_end():
    """
    Full end-to-end path: public HTTPS endpoint -> nginx rewrite ->
    django-hr's HRTokenAuthentication, using a real JWT. This is the
    closest thing to what an actual React frontend request experiences.
    """
    token = _make_token(REAL_JWT_SECRET_KEY)

    async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
        r = await client.get(
            f"{NGINX_BASE_URL}/api/hr/employees/active/",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 200, (
        f"A real JWT through the full public path (nginx rewrite -> "
        f"django-hr auth) was rejected -- got {r.status_code}. This "
        f"could be an nginx issue (e.g. Authorization header not "
        f"forwarded -- check proxy_set_header directives) or an auth "
        f"issue already covered by test_django_hr_real.py. "
        f"Body: {r.text[:300]}"
    )


@pytest.mark.asyncio
async def test_api_hr_rewrite_does_not_leak_to_wrong_service():
    """
    Confirm /api/hr/ doesn't accidentally also match a django-auth-only
    route -- i.e. the rewrite is specific to django_hr's upstream and
    isn't shadowed by a broader location block like /api/auth/ or the
    catch-all '/' block (which would serve the React index.html instead
    of a JSON 401, and this test would catch that as a non-JSON body).
    """
    async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
        r = await client.get(f"{NGINX_BASE_URL}/api/hr/employees/active/")

    content_type = r.headers.get("content-type", "")
    assert "html" not in content_type.lower(), (
        f"Got an HTML response (content-type: {content_type}) instead "
        f"of JSON for /api/hr/employees/active/ -- this means the "
        f"request is being served by the React catch-all location "
        f"block instead of being rewritten to django-hr. Check that "
        f"the /api/hr/ location block in nginx.conf is defined BEFORE "
        f"the catch-all 'location /' block."
    )