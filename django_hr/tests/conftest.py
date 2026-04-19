import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from employees.models import Factory, Department, Section, Employee
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
        code='TF001',
        location='Test Location'
    )


@pytest.fixture
def test_department(test_factory):
    return Department.objects.create(
        name='Test Department',
        code='TD001',
        factory=test_factory
    )


@pytest.fixture
def test_section(test_department):
    return Section.objects.create(
        name='Test Section',
        code='TS001',
        department=test_department
    )


@pytest.fixture
def test_employee(test_factory, test_department, test_section):
    from datetime import date
    return Employee.objects.create(
        employee_id='EMP001',
        first_name='John',
        last_name='Doe',
        email='john@example.com',
        factory=test_factory,
        department=test_department,
        section=test_section,
        job_title='Software Engineer',
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
