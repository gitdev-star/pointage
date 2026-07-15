"""
Unit tests for Django HR employee models and views.
Tests employee CRUD operations and relationships.
"""

import pytest
from datetime import date
from employees.models import Employee


@pytest.mark.django_db
class TestFactoryModel:
    """Test Factory model."""

    def test_factory_creation(self, test_factory):
        """Test that a factory can be created."""
        assert test_factory.name == "Test Factory"
        # code field removed
        assert test_factory.is_active is True

    def test_factory_str_representation(self, test_factory):
        """Test string representation of factory."""
        expected = test_factory.name
        assert str(test_factory) == expected


@pytest.mark.django_db
class TestDepartmentModel:
    """Test Department model."""

    def test_department_creation(self, test_department, test_factory):
        """Test that a department can be created."""
        assert test_department.factory == test_factory
        # code field removed

    def test_department_factory_relationship(self, test_department, test_factory):
        """Test relationship between department and factory."""
        assert test_department.factory == test_factory
        assert test_factory.departments.count() == 1


@pytest.mark.django_db
class TestSectionModel:
    """Test Section model."""

    def test_section_creation(self, test_section, test_department):
        """Test that a section can be created."""
        assert test_section.department == test_department
        # code field removed


@pytest.mark.django_db
class TestEmployeeModel:
    """Test Employee model."""

    def test_employee_creation(self, test_employee):
        """Test that an employee can be created."""
        assert test_employee.employee_id == "EMP001"
        assert test_employee.first_name == "John"
        assert test_employee.last_name == "Doe"

    def test_employee_full_name_property(self, test_employee):
        """Test employee full name property."""
        assert test_employee.full_name == "John Doe"

    def test_employee_relationships(self, test_employee, test_factory, test_department, test_section):
        """Test employee relationships."""
        assert test_employee.factory == test_factory
        assert test_employee.department == test_department
        assert test_employee.section == test_section

    def test_employee_status_choices(self):
        """Test employee status choices."""
        statuses = [s[0] for s in Employee.Status.choices]
        assert "ACTIVE" in statuses
        assert "INACTIVE" in statuses
        assert "TERMINATED" in statuses

    def test_multiple_employees_creation(self, test_factory, test_department):
        """Test creating multiple employees."""
        employees = []
        for i in range(5):
            emp = Employee.objects.create(
                employee_id=f"EMP{i:04d}",
                first_name=f"Employee{i}",
                last_name="Test",
                email=f"emp{i}@test.com",
                factory=test_factory,
                department=test_department,
                job_title="Engineer",
                hire_date=date.today()
            )
            employees.append(emp)

        assert Employee.objects.filter(employee_id__startswith="EMP").count() >= 5
        
        for emp in employees:
            emp.delete()


@pytest.mark.django_db
class TestEmployeeQueryOptimization:
    """Test employee database queries."""

    def test_employee_with_select_related(self, test_employee):
        """Test that select_related reduces queries."""
        # Get employee with relationships
        emp = Employee.objects.select_related(
            "factory",
            "department",
            "section"
        ).get(pk=test_employee.pk)
        
        assert emp.factory is not None
        assert emp.department is not None
        assert emp.section is not None
