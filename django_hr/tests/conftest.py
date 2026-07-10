import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from employees.models import Factory, Department, Section, Employee, Poste
from accounts.models import HRProfile


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def test_user(db):
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )


@pytest.fixture
def authenticated_client(test_user):
    client = APIClient()
    refresh = RefreshToken.for_user(test_user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


@pytest.fixture
def test_factory(db):
    return Factory.objects.create(
        name='Test Factory',
        location='Test Location'
    )


@pytest.fixture
def test_department(test_factory):
    return Department.objects.create(
        name='Test Department',
        factory=test_factory
    )


@pytest.fixture
def test_section(test_department):
    return Section.objects.create(
        name='Test Section',
        department=test_department
    )


@pytest.fixture
def test_poste(db):
    return Poste.objects.create(name='Software Engineer')


@pytest.fixture
def test_employee(test_factory, test_department, test_section, test_poste):
    from datetime import date
    return Employee.objects.create(
        employee_id='EMP001',
        first_name='John',
        last_name='Doe',
        email='john@example.com',
        factory=test_factory,
        department=test_department,
        section=test_section,
        job_title=test_poste,
        hire_date=date(2020, 1, 1)
    )


@pytest.fixture
def hr_profile(test_user, test_factory):
    return HRProfile.objects.create(
        auth_user_id=test_user.id,
        username=test_user.username,
        email=test_user.email,
        job_title='HR Manager',
        factory=test_factory,
        is_director=False,
        perm_employees_read=True,
        perm_employees_write=True
    )


@pytest.fixture(scope='session', autouse=True)
def create_unmanaged_tables(django_db_setup, django_db_blocker):
    """
    Classification and Poste both use managed=False (their tables are
    owned/populated outside Django migrations in real environments). The
    test DB (SQLite locally, real Postgres in CI) has no other source for
    these tables, so create them here for the test session only.

    Raw SQL is used for Classification instead of schema_editor.create_model()
    because the Employee->Classification FK was generated against
    Classification's original 'id' primary key (migration 0010), but the
    live model's PK is now 'id_classification' -- a field rename that was
    never migrated. schema_editor's automatic FK check on exit fails on
    that mismatch even though the table itself is fine for ORM use.

    Branches on connection.vendor because CI runs this against a real
    postgres:15 service container (see ci.yml's django_hr test step,
    DATABASE_URL), while local runs without DATABASE_URL fall back to
    SQLite (see config/test_settings.py) -- the two dialects don't share
    AUTOINCREMENT/SERIAL syntax or a common "does this table exist"
    introspection query.
    """
    from django.db import connection
    with django_db_blocker.unblock():
        with connection.cursor() as cursor:
            if connection.vendor == "postgresql":
                cursor.execute(
                    "SELECT to_regclass('public.classification') IS NOT NULL"
                )
                classification_exists = cursor.fetchone()[0]
                if not classification_exists:
                    cursor.execute(
                        "CREATE TABLE classification ("
                        "id_classification SERIAL PRIMARY KEY, "
                        "classe VARCHAR(50) NOT NULL UNIQUE, "
                        "salaire DECIMAL(10, 2) NOT NULL)"
                    )

                cursor.execute(
                    "SELECT to_regclass('public.poste') IS NOT NULL"
                )
                poste_exists = cursor.fetchone()[0]
                if not poste_exists:
                    cursor.execute(
                        "CREATE TABLE poste ("
                        "id SERIAL PRIMARY KEY, "
                        "name VARCHAR(150) NOT NULL UNIQUE, "
                        "description TEXT NULL, "
                        "is_active BOOLEAN NOT NULL DEFAULT TRUE, "
                        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
                    )
            else:
                # SQLite fallback -- only reached for local runs without
                # DATABASE_URL set (see config/test_settings.py default).
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='classification'"
                )
                if not cursor.fetchone():
                    cursor.execute(
                        "CREATE TABLE classification ("
                        "id_classification INTEGER PRIMARY KEY AUTOINCREMENT, "
                        "classe VARCHAR(50) NOT NULL UNIQUE, "
                        "salaire DECIMAL NOT NULL)"
                    )

                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='poste'"
                )
                if not cursor.fetchone():
                    cursor.execute(
                        "CREATE TABLE poste ("
                        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                        "name VARCHAR(150) NOT NULL UNIQUE, "
                        "description TEXT NULL, "
                        "is_active BOOLEAN NOT NULL DEFAULT 1, "
                        "created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)"
                    )