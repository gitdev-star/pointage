"""
tests/unit/test_employee_serializers.py

Serializer-level tests for the `employees` app, exercised directly
(without going through the view/URL layer) so validation logic is
tested in isolation.
"""

import pytest

from employees.serializers import (
    EmployeeDetailSerializer,
    EmployeeListSerializer,
)
from employees.models import Factory


pytestmark = pytest.mark.django_db


class TestEmployeeDetailSerializerValidation:
    def test_department_must_belong_to_factory(self, test_factory, test_department):
        other_factory = Factory.objects.create(name="Mismatch Factory")
        serializer = EmployeeDetailSerializer(data={
            "employee_id": "EMPX1",
            "first_name": "A",
            "last_name": "B",
            "factory": other_factory.id,
            "department": test_department.id,  # belongs to test_factory
        })
        assert not serializer.is_valid()
        assert "department" in serializer.errors

    def test_department_matching_factory_is_valid(self, test_factory, test_department):
        serializer = EmployeeDetailSerializer(data={
            "employee_id": "EMPX2",
            "first_name": "A",
            "last_name": "B",
            "factory": test_factory.id,
            "department": test_department.id,
        })
        assert serializer.is_valid(), serializer.errors

    def test_duplicate_cin_rejected_on_create(self, test_employee):
        test_employee.cin = "101-001-000099"
        test_employee.save()
        serializer = EmployeeDetailSerializer(data={
            "employee_id": "EMPX3",
            "first_name": "C",
            "last_name": "D",
            "cin": "101-001-000099",
        })
        assert not serializer.is_valid()
        assert "cin" in serializer.errors

    def test_duplicate_cin_excludes_self_on_update(self, test_employee):
        test_employee.cin = "101-001-000099"
        test_employee.save()
        serializer = EmployeeDetailSerializer(
            instance=test_employee,
            data={"cin": "101-001-000099"},
            partial=True,
        )
        # Same employee keeping their own CIN should be valid.
        assert serializer.is_valid(), serializer.errors

    def test_full_name_and_related_names_present(self, test_employee):
        serializer = EmployeeDetailSerializer(instance=test_employee)
        data = serializer.data
        assert data["full_name"] == "John Doe"
        assert data["factory_name"] == test_employee.factory.name
        assert data["department_name"] == test_employee.department.name


class TestEmployeeListSerializer:
    def test_list_serializer_excludes_sensitive_fields(self, test_employee):
        serializer = EmployeeListSerializer(instance=test_employee)
        data = serializer.data
        assert "cin" not in data
        assert "address" not in data
        assert "full_name" in data


