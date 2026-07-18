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
"""
import pytest
import httpx
from app.routers.hr_routes import (
    fetch_all_active_employees,
    fetch_employee_by_device_id,
    build_employee_map,
    DJANGO_HR_URL,
    _HR_SERVICE_HEADERS,
)

NONEXISTENT_DEVICE_ID = 999999999

pytestmark = pytest.mark.real_cross_service


@pytest.mark.asyncio
async def test_service_internal_key_is_set():
    """Sanity check: without this, every django-hr call gets 403 and
    fetch_all_active_employees()/fetch_employee_by_device_id() silently
    degrade to []/None with no visible error."""
    assert _HR_SERVICE_HEADERS.get("X-Service-Key"), (
        "SERVICE_INTERNAL_KEY is empty inside the fastapi container — "
        "all calls to django-hr will get 403 Forbidden."
    )


@pytest.mark.asyncio
async def test_django_hr_is_reachable():
    """Sanity check: the real django-hr service responds at all,
    using the same auth header hr_routes.py actually sends."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            f"{DJANGO_HR_URL}/api/employees/active/",
            headers=_HR_SERVICE_HEADERS,
        )
    assert r.status_code == 200, (
        f"django-hr not reachable/authorized at {DJANGO_HR_URL} — "
        f"got {r.status_code}. Body: {r.text[:300]}"
    )


@pytest.mark.asyncio
async def test_active_employees_response_shape():
    """Verify django-hr's real /active/ response matches what
    fetch_all_active_employees() / build_employee_map() assume."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            f"{DJANGO_HR_URL}/api/employees/active/",
            headers=_HR_SERVICE_HEADERS,
        )

    assert r.status_code == 200
    body = r.json()

    assert "results" in body, (
        "django-hr's /active/ endpoint no longer returns a paginated "
        "'results' key — fetch_all_active_employees() does "
        "r.json().get('results', []) and would now silently return []"
    )
    assert isinstance(body["results"], list)

    if body["results"]:
        emp = body["results"][0]
        required_keys = {
            "device_user_id", "id", "full_name",
            "employee_id", "department_name", "factory_name", "photo",
        }
        missing = required_keys - emp.keys()
        assert not missing, (
            f"django_hr's EmployeeListSerializer is missing fields "
            f"hr_routes.py expects: {missing}. Check "
            f"django_hr/employees/serializers.py::EmployeeListSerializer"
        )


@pytest.mark.asyncio
async def test_by_device_returns_404_for_unknown_id():
    """Verify the real 404 contract fetch_employee_by_device_id() relies on."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            f"{DJANGO_HR_URL}/api/employees/by-device/{NONEXISTENT_DEVICE_ID}/",
            headers=_HR_SERVICE_HEADERS,
        )
    assert r.status_code == 404, (
        f"Expected 404 for unknown device_user_id, got {r.status_code}. "
        f"Body: {r.text[:300]}"
    )
    assert "detail" in r.json()


@pytest.mark.asyncio
async def test_fetch_all_active_employees_against_real_service():
    """Call FastAPI's actual function against the real django-hr service,
    and confirm it's ACTUALLY authenticating — not just gracefully
    swallowing a 403 into an empty list."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        raw = await client.get(
            f"{DJANGO_HR_URL}/api/employees/active/",
            headers=_HR_SERVICE_HEADERS,
        )
    assert raw.status_code == 200, (
        "Underlying call is not authenticating (non-200) — "
        "fetch_all_active_employees() would return [] here, "
        "masking this as 'no employees' rather than an auth failure."
    )

    employees = await fetch_all_active_employees()
    assert isinstance(employees, list)

    emp_map = build_employee_map(employees)
    assert isinstance(emp_map, dict)


@pytest.mark.asyncio
async def test_fetch_employee_by_device_id_against_real_service():
    """Call FastAPI's actual function against a known-nonexistent ID,
    and confirm the None comes from a real 404, not a masked 403."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        raw = await client.get(
            f"{DJANGO_HR_URL}/api/employees/by-device/{NONEXISTENT_DEVICE_ID}/",
            headers=_HR_SERVICE_HEADERS,
        )
    assert raw.status_code == 404, (
        f"Expected a real 404 (employee genuinely not found), got "
        f"{raw.status_code} — the None returned by "
        f"fetch_employee_by_device_id() would be masking an auth failure."
    )

    result = await fetch_employee_by_device_id(NONEXISTENT_DEVICE_ID)
    assert result is None