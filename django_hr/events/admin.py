# =====================================================
# PATH: pointage/django_hr/events/admin.py
# =====================================================

from django.contrib import admin
from .models import PublicHoliday, CompanyEvent, ShiftSchedule, EmployeeShift


@admin.register(PublicHoliday)
class PublicHolidayAdmin(admin.ModelAdmin):
    list_display = ["date", "name", "year", "is_recurring"]
    list_filter = ["year", "is_recurring"]
    search_fields = ["name"]


@admin.register(CompanyEvent)
class CompanyEventAdmin(admin.ModelAdmin):
    list_display = ["title", "event_type", "start_datetime", "end_datetime", "factory", "department"]
    list_filter = ["event_type", "factory"]
    search_fields = ["title"]


@admin.register(ShiftSchedule)
class ShiftScheduleAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "start_time", "end_time", "break_minutes"]
    search_fields = ["name", "code"]


@admin.register(EmployeeShift)
class EmployeeShiftAdmin(admin.ModelAdmin):
    list_display = ["employee", "shift", "start_date", "end_date"]
    list_filter = ["shift"]
    search_fields = ["employee__last_name", "employee__employee_id"]
