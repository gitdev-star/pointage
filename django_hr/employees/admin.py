# =====================================================
# PATH: pointage/django_hr/employees/admin.py
# =====================================================

from django.contrib import admin
from django.utils.html import format_html
from .models import Factory, Department, Employee, Section, WorkSchedule


@admin.register(WorkSchedule)
class WorkScheduleAdmin(admin.ModelAdmin):
    list_display  = ["name", "employee", "section", "department",
                     "work_start", "early_leave_limit", "standard_start",
                     "standard_end", "valid_from", "valid_until", "is_active"]
    list_filter   = ["is_active", "department", "section"]
    search_fields = ["name", "employee__first_name", "employee__last_name",
                     "employee__employee_id", "department__name", "section__name"]
    fieldsets = (
        ("General", {
            "fields": ("name", "description", "is_active"),
        }),
        ("Assign to (pick one)", {
            "fields": ("employee", "section", "department"),
            "description": "Priority: Employee > Section > Department. Leave all blank to use as a template only.",
        }),
        ("Schedule Times", {
            "fields": (
                "work_start", "early_leave_limit",
                "standard_start", "standard_end",
                "lunch_start", "lunch_end",
                "standard_work_hours", "overtime_threshold_hours",
            ),
        }),
        ("Validity Window (optional)", {
            "fields": ("valid_from", "valid_until"),
            "description": "Leave blank for no time limit.",
        }),
    )


@admin.register(Factory)
class FactoryAdmin(admin.ModelAdmin):
    list_display = ["name", "location", "department_count", "employee_count", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name"]

    def department_count(self, obj):
        return obj.departments.count()
    department_count.short_description = "Departments"

    def employee_count(self, obj):
        return obj.employees.filter(status="ACTIVE").count()
    employee_count.short_description = "Active Employees"


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["name", "factory", "manager", "employee_count", "is_active"]
    list_filter = ["factory", "is_active"]
    search_fields = ["name"]

    def employee_count(self, obj):
        return obj.employees.filter(status="ACTIVE").count()
    employee_count.short_description = "Active Employees"


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = [
        "employee_id", "photo_thumbnail", "last_name", "first_name",
        "factory", "department", "job_title", "contract_type",
        "status", "device_user_id", "hire_date",
    ]
    list_filter = ["factory", "department", "status", "contract_type"]
    search_fields = ["first_name", "last_name", "employee_id", "email", "device_user_id"]
    readonly_fields = ["created_at", "updated_at", "photo_thumbnail"]

    fieldsets = (
        ("Identity", {
            "fields": ("employee_id", "first_name", "last_name", "photo", "photo_thumbnail")
        }),
        ("Contact", {
            "fields": ("email", "phone")
        }),
        ("Organisation", {
            "fields": ("factory", "department", "job_title", "contract_type")
        }),
        ("Employment", {
            "fields": ("hire_date", "termination_date", "status")
        }),
        ("Device & Auth Link", {
            "fields": ("device_user_id", "auth_user_id"),
            "description": "device_user_id links this employee to their biometric clocker record.",
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    def photo_thumbnail(self, obj):
        if obj.photo:
            return format_html(
                '<img src="{}" style="height:40px;border-radius:4px;" />',
                obj.photo.url
            )
        return "—"
    photo_thumbnail.short_description = "Photo"


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display  = ["name", "department", "is_active"]
    list_filter   = ["department", "is_active"]
    search_fields = ["name"]
