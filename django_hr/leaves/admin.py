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
        "employee", "leave_type", "start_date", "end_date",
        "days_requested", "status", "created_at"
    ]
    list_filter = ["status", "leave_type", "start_date"]
    search_fields = ["employee__first_name", "employee__last_name"]
    readonly_fields = ["created_at", "updated_at", "approved_at"]

    @admin.action(description="Approve selected requests")
    def approve_requests(self, request, queryset):
        queryset.filter(status="PENDING").update(status="APPROVED")

    actions = ["approve_requests"]
