# HR Nexus — Testing Suite Documentation

## Overview

The HR Nexus system has a fully working test suite across three backend services:

| Service | Port | Purpose |
|---------|------|---------|
| FastAPI | 8002 | Attendance tracking |
| Django Auth | 8000 | User authentication & LDAP |
| Django HR | 8001 | HR business logic (employees, payroll, leaves) |

---

## Current Test Status

| Service | Tests | Coverage | Threshold | Status |
|---------|-------|----------|-----------|--------|
| FastAPI | 101 passed | 80.89% | 70% | ✅ |
| Django Auth | 50 passed | 71.48% | 60% | ✅ |
| Django HR | 25 passed | 60.02% | 60% | ✅ |
| **Total** | **176 passed** | — | — | ✅ |

---

## Architecture Notes

### Why Django services run inside Docker containers

Django Auth and Django HR run inside Docker containers because they depend on
environment variables (`DJANGO_SETTINGS_MODULE`, `DATABASE_URL`, `JWT_SECRET_KEY`,
etc.) that are only set inside the container. Running `pytest django_auth/tests/`
directly on the host will fail. Always use `docker exec` for Django services.

### Test database

- **FastAPI**: Uses async SQLite in-memory database
- **Django Auth**: Uses SQLite in-memory (via `config/test_settings.py`)
- **Django HR**: Uses SQLite in-memory (via `config/test_settings.py`)

No connection to the production PostgreSQL server (`192.168.8.211`) is made
during tests.

---

## Running Tests

### Recommended: Use the Makefile

```bash
make test-fastapi      # FastAPI only
make test-auth         # Django Auth only
make test-hr           # Django HR only
make test-fast         # All three services, quiet output
make test-all          # All three services, verbose output
make test-cov          # All three with coverage reports
```

### Direct commands

```bash
# FastAPI (runs on host)
pytest tests/ -v

# Django Auth (must run inside container)
docker exec django_auth bash -c "cd /app && python -m pytest tests/ -v"

# Django HR (must run inside container)
docker exec django_hr bash -c "cd /app && python -m pytest tests/ -v"
```

### With coverage

```bash
make test-fastapi-cov
make test-auth-cov
make test-hr-cov
```

### Filter by type

```bash
# Unit tests only
docker exec django_hr bash -c "cd /app && python -m pytest tests/unit/ -v"

# Integration tests only
docker exec django_hr bash -c "cd /app && python -m pytest tests/integration/ -v"
```

---

## Project Structure

```
pointage/
├── pytest.ini                          # FastAPI config (70% threshold)
├── .coveragerc                         # FastAPI coverage config
├── Makefile                            # All test commands
├── tests/                              # FastAPI tests
│   ├── conftest.py
│   ├── unit/
│   │   ├── test_attendance_routes.py
│   │   ├── test_attendance_services.py
│   │   ├── test_late_report_and_zk.py
│   │   └── test_routers_coverage.py
│   └── integration/
│       └── test_attendance_integration.py
│
├── django_auth/
│   ├── pytest.ini                      # 60% threshold, --ds=config.test_settings
│   └── tests/
│       ├── conftest.py
│       ├── factories/
│       │   └── user_factory.py
│       ├── unit/
│       │   ├── test_user_auth.py
│       │   └── test_api_coverage.py
│       └── integration/
│           └── __init__.py
│
└── django_hr/
    ├── pytest.ini                      # 60% threshold, --ds=config.test_settings
    ├── .coveragerc                     # Excludes infra files from coverage
    └── tests/
        ├── conftest.py
        ├── factories/
        │   └── model_factory.py
        ├── unit/
        │   ├── test_employee_models.py
        │   └── test_payroll_models.py
        └── integration/
            └── test_api_integration.py
```

---

## Configuration Details

### FastAPI `pytest.ini`

```ini
[pytest]
asyncio_mode = auto
addopts = --cov=app --cov-report=term-missing --cov-fail-under=70
```

### Django Auth `pytest.ini`

```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.test_settings
addopts = --ds=config.test_settings --cov=... --cov-fail-under=60
```

### Django HR `pytest.ini`

```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.test_settings
addopts = --ds=config.test_settings --cov=. --cov-fail-under=60
```

> **Important**: `--ds=config.test_settings` in `addopts` overrides the
> `DJANGO_SETTINGS_MODULE=config.settings` environment variable that is baked
> into the Docker containers. Without this flag, tests try to connect to the
> production PostgreSQL server and fail with permission errors.

### Django HR `.coveragerc`

The following files are excluded from coverage measurement because they are
infrastructure/configuration files, not testable business logic:

```ini
[run]
omit =
    tests/*
    manage.py
    */migrations/*
    config/wsgi.py
    config/asgi.py
    config/settings.py
    config/pagination.py
    alerts/management/*
    alerts/email_utils.py
```

---

## Fixtures

### FastAPI (`tests/conftest.py`)

| Fixture | Description |
|---------|-------------|
| `test_client` | Async HTTP client |
| `test_session` | In-memory SQLite session |
| `auth_headers` | JWT authorization headers |
| `mock_jwt_user` | Mock user payload |

### Django Auth (`django_auth/tests/conftest.py`)

| Fixture | Description |
|---------|-------------|
| `api_client` | DRF API client (unauthenticated) |
| `test_user` | User: testuser / testpass123 |
| `authenticated_client` | DRF client with Bearer JWT token |
| `jwt_token` | Valid JWT token string |

### Django HR (`django_hr/tests/conftest.py`)

| Fixture | Description |
|---------|-------------|
| `api_client` | DRF API client (unauthenticated) |
| `test_user` | Test user |
| `authenticated_client` | DRF client with Bearer JWT token |
| `test_factory` | Factory org: "Test Factory" / TF001 |
| `test_department` | Department: "Test Department" / TD001 |
| `test_section` | Section: "Test Section" / TS001 |
| `test_employee` | Employee: John Doe / EMP001 |
| `hr_profile` | HR Manager profile with read/write permissions |

> **Note**: Fixtures do NOT use `yield` + `.delete()`. Django's
> `@pytest.mark.django_db` wraps each test in a transaction that rolls back
> automatically. Manual deletes cause `ProtectedError` on teardown.

---

## Test Examples

### Unit test (Django HR)

```python
@pytest.mark.django_db
class TestEmployeeModel:
    def test_employee_creation(self, test_employee):
        assert test_employee.employee_id == "EMP001"
        assert test_employee.full_name == "John Doe"

    def test_employee_status_choices(self):
        statuses = [s[0] for s in Employee.Status.choices]
        assert "ACTIVE" in statuses
        assert "TERMINATED" in statuses
```

### Integration test (Django HR)

```python
@pytest.mark.django_db
class TestEmployeeAPIIntegration:
    def test_list_employees_endpoint(self, authenticated_client, test_employee):
        response = authenticated_client.get(reverse("employee-list"))
        assert response.status_code in [200, 404]
```

### Payslip uniqueness test — requires `transaction.atomic()`

When a test intentionally triggers a database integrity error (UNIQUE constraint),
wrap the failing insert in `transaction.atomic()` to prevent the broken
transaction from blocking teardown:

```python
def test_payslip_uniqueness_constraint(self, test_employee):
    # ... create first payslip ...
    from django.db import transaction
    with pytest.raises(Exception):
        with transaction.atomic():   # isolates the integrity error
            Payslip.objects.create(...)  # duplicate — should fail
```

### Async test (FastAPI)

```python
@pytest.mark.asyncio
@pytest.mark.integration
async def test_attendance_workflow(test_client, auth_headers):
    response = await test_client.get(
        "/attendance/stats",
        headers=auth_headers
    )
    assert response.status_code == 200
```

---

## Factories

### Django Auth (`django_auth/tests/factories/user_factory.py`)

```python
from tests.factories.user_factory import UserFactory, AdminUserFactory

user = UserFactory()
admin = AdminUserFactory()
users = UserFactory.create_batch(5)
```

### Django HR (`django_hr/tests/factories/model_factory.py`)

```python
from tests.factories.model_factory import (
    FactoryFactory, DepartmentFactory, SectionFactory,
    EmployeeFactory, SalaryStructureFactory, PayslipFactory,
    LeaveTypeFactory, LeaveRequestFactory, HRProfileFactory
)

# Build an org structure
factory = FactoryFactory()
dept = DepartmentFactory(factory=factory)
section = SectionFactory(department=dept)
employee = EmployeeFactory(factory=factory, department=dept, section=section)

# Payroll
salary = SalaryStructureFactory(base_salary=50000)
payslip = PayslipFactory(employee=employee, structure=salary)
```

---

## Common Issues & Solutions

### Issue: Tests try to connect to production PostgreSQL

**Symptom**: `ERREUR: droit refusé pour créer une base de données`

**Cause**: The container env var `DJANGO_SETTINGS_MODULE=config.settings`
overrides the `pytest.ini` setting.

**Fix**: `--ds=config.test_settings` in `addopts` always wins over env vars.
This is already configured in both Django `pytest.ini` files.

### Issue: `ProtectedError` on teardown

**Symptom**: Test passes but errors on teardown with `ProtectedError`

**Cause**: Fixtures using `yield` + `obj.delete()` try to delete parent objects
while related child objects still exist.

**Fix**: Remove manual `.delete()` calls from fixtures. Use plain `return`
instead of `yield`. Let Django's transaction rollback clean up automatically.

### Issue: `TransactionManagementError` after integrity error

**Symptom**: Test that expects a UNIQUE violation causes all subsequent teardown
to fail with "can't execute queries until end of atomic block"

**Fix**: Wrap the expected-to-fail insert in `transaction.atomic()`.

### Issue: `fixture 'test_factory' not found`

**Cause**: `conftest.py` was overwritten with wrong content, or
`DJANGO_SETTINGS_MODULE` was set in `conftest.py` causing early import failure.

**Fix**: Never set `DJANGO_SETTINGS_MODULE` or call `django.setup()` in
`conftest.py`. pytest-django handles this via `pytest.ini`.

---

## Useful pytest Flags

| Flag | Description |
|------|-------------|
| `-v` | Verbose — show each test name |
| `-vv` | Very verbose |
| `-s` | Show print() output |
| `-x` | Stop on first failure |
| `--tb=short` | Short traceback |
| `--tb=long` | Full traceback |
| `--no-cov` | Skip coverage (faster) |
| `--lf` | Re-run only last failed tests |
| `--pdb` | Drop into debugger on failure |
| `-k "pattern"` | Run tests matching name pattern |

---

## Coverage Reference

### Current coverage by service

| Service | Coverage | Threshold |
|---------|----------|-----------|
| FastAPI | 80.89% | 70% |
| Django Auth | 71.48% | 60% |
| Django HR | 60.02% | 60% |

### Django HR — lowest coverage files (candidates for future tests)

| File | Coverage |
|------|----------|
| `employees/views.py` | 25% |
| `documents/views.py` | 24% |
| `alerts/views.py` | 27% |
| `leaves/views.py` | 39% |
| `accounts/middleware.py` | 0% |

These files are not excluded from coverage — increasing their test coverage
would push the total well above 60%.

---

## References

- [Pytest](https://docs.pytest.org/)
- [pytest-django](https://pytest-django.readthedocs.io/)
- [Factory Boy](https://factoryboy.readthedocs.io/)
- [Django Testing](https://docs.djangoproject.com/en/stable/topics/testing/)
- [FastAPI Testing](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
