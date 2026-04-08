# =====================================================
# PATH: pointage/django_hr/payroll/serializers.py
# =====================================================

from rest_framework import serializers
from .models import SalaryStructure, EmployeeSalary, Payslip


class SalaryStructureSerializer(serializers.ModelSerializer):
    gross_salary = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SalaryStructure
        fields = "__all__"


class EmployeeSalarySerializer(serializers.ModelSerializer):
    structure_name = serializers.CharField(source="structure.name", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = EmployeeSalary
        fields = "__all__"


class PayslipSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = Payslip
        fields = "__all__"
        read_only_fields = ["generated_at", "validated_by"]
