"""
Unit tests for Django HR payroll models.
Tests salary structure, employee salary, and payslip functionality.
"""

import pytest
from decimal import Decimal
from datetime import date
from payroll.models import SalaryStructure, EmployeeSalary, Payslip


@pytest.mark.django_db
class TestSalaryStructureModel:
    """Test SalaryStructure model."""

    def test_salary_structure_creation(self):
        """Test creating a salary structure."""
        salary = SalaryStructure.objects.create(
            name="Senior Developer",
            base_salary=Decimal("75000.00"),
            transport_allowance=Decimal("5000.00"),
            housing_allowance=Decimal("10000.00"),
            meal_allowance=Decimal("3000.00")
        )
        assert salary.name == "Senior Developer"
        assert salary.base_salary == Decimal("75000.00")

    def test_salary_structure_gross_salary_property(self):
        """Test gross_salary property calculation."""
        salary = SalaryStructure.objects.create(
            name="Test",
            base_salary=Decimal("50000.00"),
            transport_allowance=Decimal("5000.00"),
            housing_allowance=Decimal("10000.00"),
            meal_allowance=Decimal("2000.00")
        )
        expected_gross = Decimal("67000.00")
        assert salary.gross_salary == expected_gross


@pytest.mark.django_db
class TestEmployeeSalaryModel:
    """Test EmployeeSalary model."""

    def test_employee_salary_creation(self, test_employee):
        """Test creating an employee salary."""
        salary_struct = SalaryStructure.objects.create(
            name="Standard",
            base_salary=Decimal("50000.00")
        )
        emp_salary = EmployeeSalary.objects.create(
            employee=test_employee,
            structure=salary_struct,
            effective_date=date.today()
        )
        assert emp_salary.employee == test_employee
        assert emp_salary.structure == salary_struct

    def test_employee_salary_history(self, test_employee):
        """Test tracking salary changes over time."""
        struct1 = SalaryStructure.objects.create(
            name="Level 1",
            base_salary=Decimal("40000.00")
        )
        struct2 = SalaryStructure.objects.create(
            name="Level 2",
            base_salary=Decimal("50000.00")
        )
        
        EmployeeSalary.objects.create(
            employee=test_employee,
            structure=struct1,
            effective_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31)
        )
        EmployeeSalary.objects.create(
            employee=test_employee,
            structure=struct2,
            effective_date=date(2024, 1, 1)
        )
        
        salaries = EmployeeSalary.objects.filter(employee=test_employee)
        assert salaries.count() == 2


@pytest.mark.django_db
class TestPayslipModel:
    """Test Payslip model."""

    def test_payslip_creation(self, test_employee):
        """Test creating a payslip."""
        salary_struct = SalaryStructure.objects.create(
            name="Standard",
            base_salary=Decimal("50000.00")
        )
        payslip = Payslip.objects.create(
            employee=test_employee,
            period_month=1,
            period_year=2024,
            structure=salary_struct,
            base_salary=Decimal("50000.00"),
            net_salary=Decimal("45000.00")
        )
        assert payslip.employee == test_employee
        assert payslip.status == Payslip.Status.DRAFT

    def test_payslip_status_workflow(self, test_employee):
        """Test payslip status transitions."""
        salary_struct = SalaryStructure.objects.create(
            name="Standard",
            base_salary=Decimal("50000.00")
        )
        payslip = Payslip.objects.create(
            employee=test_employee,
            period_month=1,
            period_year=2024,
            structure=salary_struct,
            base_salary=Decimal("50000.00"),
            net_salary=Decimal("45000.00")
        )
        
        # Draft → Validated
        payslip.status = Payslip.Status.VALIDATED
        payslip.save()
        assert payslip.status == Payslip.Status.VALIDATED

        # Validated → Paid
        payslip.status = Payslip.Status.PAID
        payslip.save()
        assert payslip.status == Payslip.Status.PAID

    def test_payslip_uniqueness_constraint(self, test_employee):
        """Test payslip uniqueness per employee/period."""
        salary_struct = SalaryStructure.objects.create(
            name="Standard",
            base_salary=Decimal("50000.00")
        )
        
        # Create first payslip
        Payslip.objects.create(
            employee=test_employee,
            period_month=1,
            period_year=2024,
            structure=salary_struct,
            base_salary=Decimal("50000.00"),
            net_salary=Decimal("45000.00")
        )
        
        # Try to create duplicate - should fail or be overwritten
        from django.db import transaction
        with pytest.raises(Exception):
            with transaction.atomic():
                Payslip.objects.create(
                    employee=test_employee,
                    period_month=1,
                    period_year=2024,
                    structure=salary_struct,
                    base_salary=Decimal("50000.00"),
                    net_salary=Decimal("45000.00")
                )
