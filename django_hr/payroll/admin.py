# =====================================================
# PATH: pointage/django_hr/payroll/admin.py
# =====================================================

from django.contrib import admin
from .models import SalaryStructure, EmployeeSalary, Payslip


@admin.register(SalaryStructure)
class SalaryStructureAdmin(admin.ModelAdmin):
    list_display = ["name", "base_salary", "gross_salary", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name"]


@admin.register(EmployeeSalary)
class EmployeeSalaryAdmin(admin.ModelAdmin):
    list_display = ["employee", "structure", "effective_date", "end_date"]
    search_fields = ["employee__last_name", "employee__employee_id"]


@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = [
        "employee", "period_month", "period_year",
        "net_salary", "status", "paid_at"
    ]
    list_filter = ["status", "period_year"]
    search_fields = ["employee__last_name", "employee__employee_id"]
    readonly_fields = ["generated_at"]
