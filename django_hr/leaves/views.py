# =====================================================
# PATH: pointage/django_hr/leaves/views.py
# =====================================================

from django.utils import timezone
from datetime import timedelta
import django_filters
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from employees.models import WorkSchedule
import csv
import django_filters
from django.http import HttpResponse
from django.db.models import OuterRef, Subquery, CharField
from django.db.models.functions import Cast
from audit_log.models import AuditLog
from audit_log.utils import log_action, diff_dict, snapshot

from .models import LeaveType, LeaveBalance, LeaveRequest, MaternityLeave
from .serializers import (
    LeaveTypeSerializer,
    LeaveBalanceSerializer,
    LeaveRequestSerializer,
    LeaveApprovalSerializer,
    MaternityLeaveSerializer,
)

STATUS_LABELS_FR = {
    "PENDING":   "En attente",
    "APPROVED":  "Approuvé",
    "REJECTED":  "Rejeté",
    "CANCELLED": "Annulé",
}

BREASTFEEDING_START             = "07:30"
BREASTFEEDING_END               = "15:30"
BREASTFEEDING_EARLY_LEAVE_LIMIT = "15:27"   # même marge de 3 min que l'horaire standard (16:27 pour 16:30)
BREASTFEEDING_WORK_HOURS        = 8.0        # 07:30 → 15:30, sans déduction pause (cf. analysis_service)
BREASTFEEDING_OVERTIME_HOURS    = 8.5
BREASTFEEDING_DURATION_WEEKS    = 15

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

class LeaveRequestFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(method="filter_date_from")
    date_to   = django_filters.DateFilter(method="filter_date_to")

    class Meta:
        model  = LeaveRequest
        fields = ["employee", "leave_type", "status", "employee__factory"]

    def filter_date_from(self, queryset, name, value):
        # Garde les événements encore actifs à partir de date_from
        # (chevauchement, pas juste ceux qui commencent après)
        return queryset.filter(end_date__gte=value)

    def filter_date_to(self, queryset, name, value):
        # Garde les événements déjà commencés avant date_to
        return queryset.filter(start_date__lte=value)
    
class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = (
        LeaveRequest.objects
        .select_related("employee", "employee__factory", "leave_type")
        .only(
            "id", "start_date", "end_date", "days_requested", "duration_hours",
            "reason", "document", "status",
            "approved_by", "approved_at", "rejection_reason",
            "created_at", "updated_at",
            "employee__id", "employee__first_name", "employee__last_name",
            "employee__employee_id",
            "employee__factory__id", "employee__factory__name",
            "leave_type__id", "leave_type__name", "leave_type__code",
        )
    )
    serializer_class = LeaveRequestSerializer
    filter_backends  = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_class  = LeaveRequestFilter
    search_fields    = ["employee__first_name", "employee__last_name", "employee__employee_id"]
    ordering_fields  = ["start_date", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        latest_log = AuditLog.objects.filter(
            model_name="leaverequest",
            object_id=Cast(OuterRef("pk"), output_field=CharField()),
        ).order_by("-timestamp")
        qs = qs.annotate(
            last_action=Subquery(latest_log.values("action")[:1]),
            last_action_at=Subquery(latest_log.values("timestamp")[:1]),
            last_action_by=Subquery(latest_log.values("username")[:1]),
        )
        return qs

    def perform_create(self, serializer):
        leave = serializer.save()
        log_action(self.request, leave, "CREATE")
        try:
            name = get_hr_name(self.request)
            notify_leave_created(leave, triggered_by=name)
        except Exception as e:
            print(f"[NOTIFY] leave_created error: {e}")

    def perform_update(self, serializer):
        old_data = snapshot(serializer.instance)
        leave = serializer.save()
        new_data = snapshot(leave)
        changes = diff_dict(old_data, new_data)
        if changes:
            log_action(self.request, leave, "UPDATE", changes)

    def perform_destroy(self, instance):
        log_action(self.request, instance, "DELETE")
        super().perform_destroy(instance)

    @action(detail=False, methods=["get"])
    def export(self, request):
        ...  # inchangé

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

            leave.save(update_fields=["status", "approved_by", "approved_at"])
            log_action(request, leave, "APPROVE", {
                "status": {"old": "PENDING", "new": "APPROVED"}
            })
        else:
            leave.status = "REJECTED"
            leave.rejection_reason = serializer.validated_data.get("rejection_reason", "")
            try:
                name = get_hr_name(request)
                notify_leave_rejected(leave, rejected_by=name, reason=leave.rejection_reason)
            except Exception as e:
                print(f"[NOTIFY] leave_rejected error: {e}")

            leave.save(update_fields=["status", "rejection_reason"])
            log_action(request, leave, "REJECT", {
                "status": {"old": "PENDING", "new": "REJECTED"},
                "rejection_reason": {"old": None, "new": leave.rejection_reason},
            })

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

        # ── Assignation automatique de l'horaire d'allaitement ────────────────
        try:
            return_date = ml.actual_return_date
            valid_until = return_date + timedelta(weeks=BREASTFEEDING_DURATION_WEEKS)

            # Si un horaire d'allaitement existe déjà pour cette employée
            # (ex: mark_returned rappelé par erreur), on le met à jour au lieu
            # d'en créer un doublon (name a unique=True sur WorkSchedule).
            existing = WorkSchedule.objects.filter(
                employee=ml.employee,
                name__startswith="Allaitement",
            ).first()

            if existing:
                existing.standard_start     = BREASTFEEDING_START
                existing.standard_end       = BREASTFEEDING_END
                existing.early_leave_limit  = BREASTFEEDING_EARLY_LEAVE_LIMIT
                existing.standard_work_hours = BREASTFEEDING_WORK_HOURS
                existing.overtime_threshold_hours = BREASTFEEDING_OVERTIME_HOURS
                existing.valid_from  = return_date
                existing.valid_until = valid_until
                existing.is_active   = True
                existing.description = "Horaire d'allaitement — assigné automatiquement après congé maternité"
                existing.save()
            else:
                WorkSchedule.objects.create(
                    employee=ml.employee,
                    name=f"Allaitement - {ml.employee.employee_id}",
                    description="Horaire d'allaitement — assigné automatiquement après congé maternité",
                    standard_start=BREASTFEEDING_START,
                    standard_end=BREASTFEEDING_END,
                    early_leave_limit=BREASTFEEDING_EARLY_LEAVE_LIMIT,
                    standard_work_hours=BREASTFEEDING_WORK_HOURS,
                    overtime_threshold_hours=BREASTFEEDING_OVERTIME_HOURS,
                    valid_from=return_date,
                    valid_until=valid_until,
                    is_active=True,
                )
        except Exception as e:
            print(f"[WORKSCHEDULE] auto-assign breastfeeding schedule error: {e}")

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
