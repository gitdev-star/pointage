# =====================================================
# PATH: pointage/django_hr/payroll/models.py
# =====================================================

from django.db import models
from employees.models import Employee


class SalaryStructure(models.Model):
    name = models.CharField(max_length=100, unique=True)
    base_salary = models.DecimalField(max_digits=12, decimal_places=2)
    transport_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    housing_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    meal_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    employee_social_charge_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    employer_social_charge_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    @property
    def gross_salary(self):
        return (
            self.base_salary
            + self.transport_allowance
            + self.housing_allowance
            + self.meal_allowance
        )


class EmployeeSalary(models.Model):
    """Link an employee to a salary structure with an effective date."""
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="salaries"
    )
    structure = models.ForeignKey(SalaryStructure, on_delete=models.PROTECT)
    effective_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-effective_date"]

    def __str__(self):
        return f"{self.employee} — {self.structure.name} from {self.effective_date}"


class Payslip(models.Model):

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        VALIDATED = "VALIDATED", "Validated"
        PAID = "PAID", "Paid"

    employee = models.ForeignKey(
        Employee, on_delete=models.PROTECT, related_name="payslips"
    )
    period_month = models.PositiveIntegerField()
    period_year = models.PositiveIntegerField()
    structure = models.ForeignKey(SalaryStructure, on_delete=models.PROTECT)

    base_salary = models.DecimalField(max_digits=12, decimal_places=2)
    allowances = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonuses = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    overtime_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    social_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2)

    worked_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    absent_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    leave_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    validated_by = models.IntegerField(null=True, blank=True)
    paid_at = models.DateField(null=True, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        unique_together = [("employee", "period_month", "period_year")]
        ordering = ["-period_year", "-period_month"]

    def __str__(self):
        return (
            f"Payslip {self.employee} — "
            f"{self.period_month:02d}/{self.period_year} [{self.status}]"
        )
