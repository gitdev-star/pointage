# =====================================================
# PATH: pointage/django_hr/events/views.py
# =====================================================

from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend

from .models import PublicHoliday, CompanyEvent, ShiftSchedule, EmployeeShift
from .serializers import (
    PublicHolidaySerializer,
    CompanyEventSerializer,
    ShiftScheduleSerializer,
    EmployeeShiftSerializer,
)


class PublicHolidayViewSet(viewsets.ModelViewSet):
    queryset = PublicHoliday.objects.only(
        "id", "name", "date", "year", "is_recurring"
    )
    serializer_class = PublicHolidaySerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["year"]


class CompanyEventViewSet(viewsets.ModelViewSet):
    queryset = (
        CompanyEvent.objects
        .select_related("factory", "department")
        .only(
            "id", "title", "event_type", "description",
            "start_datetime", "end_datetime", "location",
            "created_by", "created_at",
            "factory__id", "factory__name",
            "department__id", "department__name",
        )
    )
    serializer_class = CompanyEventSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["factory", "department", "event_type"]
    search_fields = ["title", "description"]


class ShiftScheduleViewSet(viewsets.ModelViewSet):
    queryset = ShiftSchedule.objects.only(
        "id", "code", "name", "start_time", "end_time",
        "break_minutes", "color",
    )
    serializer_class = ShiftScheduleSerializer


class EmployeeShiftViewSet(viewsets.ModelViewSet):
    queryset = (
        EmployeeShift.objects
        .select_related("employee", "shift")
        .only(
            "id", "start_date", "end_date", "note",
            "employee__id", "employee__first_name", "employee__last_name",
            "employee__employee_id",
            "shift__id", "shift__code", "shift__name",
        )
    )
    serializer_class = EmployeeShiftSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["employee", "shift"]
