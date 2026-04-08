# =====================================================
# PATH: pointage/django_hr/reports/views.py
# =====================================================

from django.db.models import Count, Sum, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from employees.models import Employee, Factory, Department
from leaves.models import LeaveRequest
from payroll.models import Payslip


class HeadcountReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        by_factory = list(
            Factory.objects.annotate(
                active_count=Count("employees", filter=Q(employees__status="ACTIVE")),
                total_count=Count("employees"),
            ).values("id", "name", "code", "active_count", "total_count")
        )
        by_department = list(
            Department.objects.annotate(
                active_count=Count("employees", filter=Q(employees__status="ACTIVE")),
            ).values("id", "name", "factory__name", "active_count")
        )
        by_contract = list(
            Employee.objects.filter(status="ACTIVE")
            .values("contract_type")
            .annotate(count=Count("id"))
        )
        return Response({
            "total_active": Employee.objects.filter(status="ACTIVE").count(),
            "by_factory": by_factory,
            "by_department": by_department,
            "by_contract_type": by_contract,
        })


class LeaveReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year = request.query_params.get("year")
        qs = LeaveRequest.objects.filter(status="APPROVED")
        if year:
            qs = qs.filter(start_date__year=year)
        by_type = list(
            qs.values("leave_type__name", "leave_type__code")
            .annotate(request_count=Count("id"))
        )
        by_department = list(
            qs.values("employee__department__name")
            .annotate(request_count=Count("id"))
        )
        return Response({
            "year": year,
            "by_leave_type": by_type,
            "by_department": by_department,
        })


class PayrollSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year = request.query_params.get("year")
        qs = Payslip.objects.filter(status__in=["VALIDATED", "PAID"])
        if year:
            qs = qs.filter(period_year=year)
        monthly = list(
            qs.values("period_month", "period_year")
            .annotate(
                total_net=Sum("net_salary"),
                total_deductions=Sum("deductions"),
                headcount=Count("id"),
            )
            .order_by("period_year", "period_month")
        )
        return Response({"year": year, "monthly_payroll": monthly})
