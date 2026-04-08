# =====================================================
# PATH: pointage/django_hr/reports/urls.py
# =====================================================

from django.urls import path
from .views import HeadcountReportView, LeaveReportView, PayrollSummaryView

urlpatterns = [
    path("headcount/", HeadcountReportView.as_view(), name="report-headcount"),
    path("leaves/", LeaveReportView.as_view(), name="report-leaves"),
    path("payroll/", PayrollSummaryView.as_view(), name="report-payroll"),
]
