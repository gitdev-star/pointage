# =====================================================
# PATH: pointage/django_hr/leaves/views.py
# =====================================================

from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import LeaveType, LeaveBalance, LeaveRequest, MaternityLeave
from .serializers import (
    LeaveTypeSerializer,
    LeaveBalanceSerializer,
    LeaveRequestSerializer,
    LeaveApprovalSerializer,
    MaternityLeaveSerializer,
)
def get_hr_name(request):
    """Get HR username from request — works with both middleware and HRPermission."""
    # Try hr_profile first (set by HRPermission)
    profile = getattr(request, 'hr_profile', None)
    if profile:
        return profile.username
    # Fallback: use hr_username set by HRJWTMiddleware
    username = getattr(request, 'hr_username', None)
    if username:
        return username
    # Last resort: query by hr_user_id
    user_id = getattr(request, 'hr_user_id', None)
    if user_id:
        try:
            from accounts.models import HRProfile
            p = HRProfile.objects.get(auth_user_id=user_id)
            return p.username
        except Exception:
            pass
    return "Inconnu"


from alerts.email_utils import (
    notify_leave_created,
    notify_leave_approved,
    notify_leave_rejected,
    notify_maternity_created,
    notify_maternity_ending_soon,
    notify_maternity_returned,
    notify_maternity_extended,
)


class LeaveTypeViewSet(viewsets.ModelViewSet):
    ordering = ["id"]
    queryset = LeaveType.objects.filter(is_active=True).only(
        "id", "code", "name", "days_per_year",
        "is_paid", "requires_document", "color", "is_active",
    )
    serializer_class = LeaveTypeSerializer


class LeaveBalanceViewSet(viewsets.ModelViewSet):
    queryset = (
        LeaveBalance.objects
        .select_related("employee", "leave_type")
        .only(
            "id", "year", "entitled_days", "used_days", "pending_days",
            "employee__id", "employee__first_name", "employee__last_name",
            "employee__employee_id",
            "leave_type__id", "leave_type__name", "leave_type__code",
        )
    )
    serializer_class = LeaveBalanceSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["employee", "leave_type", "year"]


class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = (
        LeaveRequest.objects
        .select_related("employee", "leave_type")
        .only(
            "id", "start_date", "end_date", "days_requested",
            "reason", "document", "status",
            "approved_by", "approved_at", "rejection_reason",
            "created_at", "updated_at",
            "employee__id", "employee__first_name", "employee__last_name",
            "employee__employee_id",
            "leave_type__id", "leave_type__name", "leave_type__code",
        )
    )
    serializer_class = LeaveRequestSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["employee", "leave_type", "status"]
    ordering_fields = ["start_date", "created_at"]

    def perform_create(self, serializer):
        leave = serializer.save()
        try:
            name = get_hr_name(self.request)
            notify_leave_created(leave, triggered_by=name)
        except Exception as e:
            print(f"[NOTIFY] leave_created error: {e}")

    @action(detail=True, methods=["post"])
    def approve_reject(self, request, pk=None):
        leave = self.get_object()

        if leave.status != "PENDING":
            return Response(
                {"detail": "Only pending requests can be actioned."}, status=400
            )

        serializer = LeaveApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_type = serializer.validated_data["action"]

        if action_type == "approve":
            leave.status = "APPROVED"
            leave.approved_by = request.user.id
            leave.approved_at = timezone.now()
            try:
                name = get_hr_name(request)
                notify_leave_approved(leave, approved_by=name)
            except Exception as e:
                print(f"[NOTIFY] leave_approved error: {e}")
            try:
                balance = LeaveBalance.objects.get(
                    employee=leave.employee,
                    leave_type=leave.leave_type,
                    year=leave.start_date.year,
                )
                balance.used_days += leave.days_requested
                balance.pending_days = max(0, balance.pending_days - leave.days_requested)
                balance.save(update_fields=["used_days", "pending_days"])
            except LeaveBalance.DoesNotExist:
                pass
        else:
            leave.status = "REJECTED"
            leave.rejection_reason = serializer.validated_data.get("rejection_reason", "")
            try:
                name = get_hr_name(request)
                notify_leave_rejected(leave, rejected_by=name, reason=leave.rejection_reason)
            except Exception as e:
                print(f"[NOTIFY] leave_rejected error: {e}")

        leave.save(update_fields=[
            "status", "approved_by", "approved_at", "rejection_reason"
        ])
        return Response(LeaveRequestSerializer(leave).data)


class MaternityLeaveViewSet(viewsets.ModelViewSet):
    queryset = MaternityLeave.objects.select_related(
        "employee", "employee__factory", "employee__department"
    ).all()
    serializer_class = MaternityLeaveSerializer
    filter_backends  = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["employee", "status"]
    ordering_fields  = ["leave_start_date", "expected_birth_date"]

    def perform_create(self, serializer):
        maternity = serializer.save()
        try:
            name = get_hr_name(self.request)
            notify_maternity_created(maternity, triggered_by=name)
        except Exception as e:
            print(f"[NOTIFY] maternity_created error: {e}")

    @action(detail=True, methods=["post"])
    def mark_returned(self, request, pk=None):
        ml = self.get_object()
        ml.actual_return_date = request.data.get("return_date") or timezone.now().date()
        ml.status = MaternityLeave.Status.RETURNED
        ml.save()
        try:
            name = get_hr_name(request)
            notify_maternity_returned(ml, triggered_by=name)
        except Exception as e:
            print(f"[NOTIFY] maternity_returned error: {e}")
        return Response(MaternityLeaveSerializer(ml).data)

    @action(detail=True, methods=["post"])
    def extend(self, request, pk=None):
        ml = self.get_object()
        extended_end = request.data.get("extended_end_date")
        if not extended_end:
            return Response({"detail": "extended_end_date requis."}, status=400)
        ml.extended_end_date = extended_end
        ml.status = MaternityLeave.Status.EXTENDED
        ml.note   = request.data.get("note", ml.note)
        ml.save()
        try:
            name = get_hr_name(request)
            notify_maternity_extended(ml, triggered_by=name)
        except Exception as e:
            print(f"[NOTIFY] maternity_extended error: {e}")
        return Response(MaternityLeaveSerializer(ml).data)

    @action(detail=False, methods=["get"])
    def active(self, request):
        today = timezone.now().date()
        qs = self.queryset.filter(
            status__in=["DECLARED", "ON_LEAVE", "EXTENDED"],
            leave_end_date__gte=today,
        )
        return Response(MaternityLeaveSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def upcoming_returns(self, request):
        today     = timezone.now().date()
        threshold = today + timedelta(days=30)
        qs = self.queryset.filter(
            status__in=["ON_LEAVE", "EXTENDED"],
            leave_end_date__lte=threshold,
            leave_end_date__gte=today,
            actual_return_date__isnull=True,
        )
        return Response(MaternityLeaveSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def ending_soon(self, request):
        """Maternity leaves ending in <= 7 days — also sends alert emails."""
        today     = timezone.now().date()
        threshold = today + timedelta(days=7)
        qs = self.queryset.filter(
            status__in=["ON_LEAVE", "EXTENDED"],
            leave_end_date__lte=threshold,
            leave_end_date__gte=today,
        )
        for ml in qs:
            days_remaining = (ml.leave_end_date - today).days
            try:
                notify_maternity_ending_soon(ml, days_remaining=days_remaining)
            except Exception as e:
                print(f"[NOTIFY] maternity_ending_soon error: {e}")
        return Response(MaternityLeaveSerializer(qs, many=True).data)
