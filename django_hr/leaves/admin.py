# =====================================================
# PATH: pointage/django_hr/leaves/admin.py
# =====================================================

from django.contrib import admin
from .models import LeaveType, LeaveBalance, LeaveRequest, PROTECTED_LEAVE_CODES


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "days_per_year", "is_paid", "requires_document", "is_active", "is_protected"]
    list_filter = ["is_paid", "is_active", "is_protected"]
    search_fields = ["name", "code"]

    def has_delete_permission(self, request, obj=None):
        if obj is not None and obj.code in PROTECTED_LEAVE_CODES:
            return False
        return super().has_delete_permission(request, obj)

@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ["employee", "leave_type", "year", "entitled_days", "used_days", "pending_days"]
    list_filter = ["year", "leave_type"]
    search_fields = ["employee__first_name", "employee__last_name", "employee__employee_id"]


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = [
        "employee",
        "leave_type",
        "start_date",
        "end_date",
        "display_schedule",
        "display_duration",
        "days_requested",
        "created_at",
    ]
    list_filter = [        
        "leave_type",
        "start_date",
        "end_date",
]
    search_fields = [
        "employee__first_name",
        "employee__last_name",
        "employee__employee_id",
        "reason",
]
    readonly_fields = [
        "duration_hours",
        "created_at",
        "updated_at",
]
    ordering = ["-created_at"]

    @admin.display(description="Horaire")
    def display_schedule(self, obj):
        if not obj.start_time or not obj.end_time:
            return "—"

        start = obj.start_time.strftime("%H:%M")
        end = obj.end_time.strftime("%H:%M")

        return f"{start} – {end}"

    @admin.display(description="Durée")
    def display_duration(self, obj):
        if not obj.start_time or not obj.end_time:
            return "—"

        start_minutes = (
            obj.start_time.hour * 60
            + obj.start_time.minute
        )

        end_minutes = (
            obj.end_time.hour * 60
            + obj.end_time.minute
        )

        total_minutes = end_minutes - start_minutes

        if total_minutes <= 0:
            return "—"

        hours, minutes = divmod(total_minutes, 60)

        return f"{hours:02d} h {minutes:02d} min"