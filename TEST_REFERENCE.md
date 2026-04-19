# HR Nexus — Test Quick Reference

## Run Commands

```bash
# All three services
make test-fast         # quiet
make test-all          # verbose
make test-cov          # with coverage

# Individual services
make test-fastapi
make test-auth
make test-hr

# With coverage
make test-fastapi-cov
make test-auth-cov
make test-hr-cov

# Direct (FastAPI runs on host, Django must use docker exec)
pytest tests/ -v
docker exec django_auth bash -c "cd /app && python -m pytest tests/ -v"
docker exec django_hr bash -c "cd /app && python -m pytest tests/ -v"
```

---

## Current Results

| Service | Tests | Coverage | Pass? |
|---------|-------|----------|-------|
| FastAPI | 101 | 80.89% | ✅ |
| Django Auth | 50 | 71.48% | ✅ |
| Django HR | 25 | 60.02% | ✅ |
| **Total** | **176** | | ✅ |

---

## Test Files

### FastAPI (`tests/`)
- `unit/test_attendance_routes.py`
- `unit/test_attendance_services.py`
- `unit/test_late_report_and_zk.py`
- `unit/test_routers_coverage.py`
- `integration/test_attendance_integration.py`

### Django Auth (`django_auth/tests/`)
- `unit/test_user_auth.py` — User model, JWT tokens, auth client
- `unit/test_api_coverage.py` — All API endpoints

### Django HR (`django_hr/tests/`)
- `unit/test_employee_models.py` — Factory, Department, Section, Employee
- `unit/test_payroll_models.py` — SalaryStructure, EmployeeSalary, Payslip
- `integration/test_api_integration.py` — Employee, Payroll, Leave, Permissions APIs

---

## Fixtures

### Django Auth
```python
api_client              # unauthenticated DRF client
test_user               # testuser / testpass123
authenticated_client    # client with Bearer token
jwt_token               # token string
```

### Django HR
```python
api_client              # unauthenticated DRF client
test_user               # test user
authenticated_client    # client with Bearer token
test_factory            # Factory: TF001
test_department         # Department: TD001
test_section            # Section: TS001
test_employee           # Employee: John Doe / EMP001
hr_profile              # HR Manager with read/write perms
```

---

## Writing Tests

### Django unit test
```python
@pytest.mark.django_db
class TestMyModel:
    def test_something(self, test_employee):
        assert test_employee.first_name == "John"
```

### Django API test
```python
@pytest.mark.django_db
class TestMyAPI:
    def test_endpoint(self, authenticated_client):
        response = authenticated_client.get(reverse("my-list"))
        assert response.status_code == 200
```

### FastAPI async test
```python
@pytest.mark.asyncio
async def test_endpoint(test_client, auth_headers):
    response = await test_client.get("/route", headers=auth_headers)
    assert response.status_code == 200
```

### Integrity error test (must use transaction.atomic)
```python
def test_unique_constraint(self, test_employee):
    MyModel.objects.create(employee=test_employee, ...)
    from django.db import transaction
    with pytest.raises(Exception):
        with transaction.atomic():
            MyModel.objects.create(employee=test_employee, ...)  # duplicate
```

---

## Factories

```python
# Django HR
from tests.factories.model_factory import (
    EmployeeFactory, SalaryStructureFactory,
    PayslipFactory, LeaveRequestFactory
)

employee = EmployeeFactory()
employees = EmployeeFactory.create_batch(5)
payslip = PayslipFactory(employee=employee)

# Django Auth
from tests.factories.user_factory import UserFactory, AdminUserFactory

user = UserFactory()
admin = AdminUserFactory()
```

---

## Pytest Flags

| Flag | Use |
|------|-----|
| `-v` | verbose |
| `-s` | show prints |
| `-x` | stop on first fail |
| `--no-cov` | skip coverage (faster) |
| `--lf` | re-run last failures |
| `--pdb` | debug on failure |
| `--tb=short` | short traceback |
| `-k "name"` | filter by test name |

---

## Key Rules

1. **Never run Django tests on the host** — always use `docker exec`
2. **Never set `DJANGO_SETTINGS_MODULE` in `conftest.py`** — pytest-django handles it via `pytest.ini`
3. **Never use `yield` + `.delete()` in fixtures** — let transaction rollback handle cleanup
4. **Always wrap expected integrity errors in `transaction.atomic()`**
5. **`RegisterView` requires admin auth** — it is not a public signup endpoint
6. **`/api/clockers/` is public** — `permission_classes = [AllowAny]`
