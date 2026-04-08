# =====================================================
# PATH: pointage/django_hr/events/urls.py
# =====================================================

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PublicHolidayViewSet,
    CompanyEventViewSet,
    ShiftScheduleViewSet,
    EmployeeShiftViewSet,
)

router = DefaultRouter()
router.register("holidays", PublicHolidayViewSet, basename="holiday")
router.register("company", CompanyEventViewSet, basename="company-event")
router.register("shifts", ShiftScheduleViewSet, basename="shift")
router.register("employee-shifts", EmployeeShiftViewSet, basename="employee-shift")

urlpatterns = [path("", include(router.urls))]
