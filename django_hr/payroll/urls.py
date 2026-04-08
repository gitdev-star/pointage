# =====================================================
# PATH: pointage/django_hr/payroll/urls.py
# =====================================================

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SalaryStructureViewSet, EmployeeSalaryViewSet, PayslipViewSet

router = DefaultRouter()
router.register("structures", SalaryStructureViewSet, basename="salary-structure")
router.register("employee-salaries", EmployeeSalaryViewSet, basename="employee-salary")
router.register("payslips", PayslipViewSet, basename="payslip")

urlpatterns = [path("", include(router.urls))]
