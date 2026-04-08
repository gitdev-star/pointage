# =====================================================
# PATH: pointage/django_hr/payroll/views.py
# =====================================================

from django.utils import timezone
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import SalaryStructure, EmployeeSalary, Payslip
from .serializers import (
    SalaryStructureSerializer,
    EmployeeSalarySerializer,
    PayslipSerializer,
)


class SalaryStructureViewSet(viewsets.ModelViewSet):
    queryset = SalaryStructure.objects.filter(is_active=True).only(
        "id", "name", "base_salary",
        "transport_allowance", "housing_allowance", "meal_allowance",
        "employee_social_charge_pct", "employer_social_charge_pct", "is_active",
    )
    serializer_class = SalaryStructureSerializer


class EmployeeSalaryViewSet(viewsets.ModelViewSet):
    queryset = (
        EmployeeSalary.objects
        .select_related("employee", "structure")
        .only(
            "id", "effective_date", "end_date", "note",
            "employee__id", "employee__first_name", "employee__last_name",
            "employee__employee_id",
            "structure__id", "structure__name",
        )
    )
    serializer_class = EmployeeSalarySerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["employee"]


class PayslipViewSet(viewsets.ModelViewSet):
    queryset = (
        Payslip.objects
        .select_related("employee", "structure")
        .only(
            "id", "period_month", "period_year", "status",
            "base_salary", "allowances", "bonuses", "overtime_pay",
            "deductions", "social_charges", "net_salary",
            "worked_days", "absent_days", "leave_days",
            "generated_at", "validated_by", "paid_at", "note",
            "employee__id", "employee__first_name", "employee__last_name",
            "employee__employee_id",
            "structure__id", "structure__name",
        )
    )
    serializer_class = PayslipSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["employee", "status", "period_year", "period_month"]
    ordering_fields = ["period_year", "period_month"]

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        payslip = self.get_object()
        if payslip.status != "DRAFT":
            return Response(
                {"detail": "Only draft payslips can be validated."}, status=400
            )
        payslip.status = "VALIDATED"
        payslip.validated_by = request.user.id
        payslip.save(update_fields=["status", "validated_by"])
        return Response(PayslipSerializer(payslip).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        payslip = self.get_object()
        if payslip.status != "VALIDATED":
            return Response(
                {"detail": "Only validated payslips can be marked as paid."}, status=400
            )
        payslip.status = "PAID"
        payslip.paid_at = timezone.now().date()
        payslip.save(update_fields=["status", "paid_at"])
        return Response(PayslipSerializer(payslip).data)
