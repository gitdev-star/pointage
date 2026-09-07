# =====================================================
# PATH: pointage/django_hr/leaves/views.py
# =====================================================

from django.utils import timezone
from datetime import timedelta
import django_filters
from django.http import HttpResponse
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from accounts.permissions import require_perm
import csv


from employees.models import WorkSchedule, Employee
from django.db.models import OuterRef, Subquery, CharField
from django.db.models.functions import Cast
from audit_log.models import AuditLog
from audit_log.utils import log_action, diff_dict, snapshot

from .models import (
    LeaveType, LeaveBalance, LeaveRequest, MaternityLeave,
    PROTECTED_LEAVE_CODES, AUTO_APPROVE_LEAVE_CODES,
)
from .serializers import (
    LeaveTypeSerializer,
    LeaveBalanceSerializer,
    LeaveRequestSerializer,
    LeaveApprovalSerializer,
    MaternityLeaveSerializer,
)
from rest_framework.exceptions import PermissionDenied

STATUS_LABELS_FR = {
    "PENDING":   "En attente",
    "APPROVED":  "Approuvé",
    "REJECTED":  "Rejeté",
    "CANCELLED": "Annulé",
}

HOURS_PER_DAY = 8.0

BREASTFEEDING_START             = "07:30"
BREASTFEEDING_END               = "15:30"
BREASTFEEDING_EARLY_LEAVE_LIMIT = "15:27"   # même marge de 3 min que l'horaire standard (16:27 pour 16:30)
BREASTFEEDING_WORK_HOURS        = 8.0        # 07:30 → 15:30, sans déduction pause (cf. analysis_service)
BREASTFEEDING_OVERTIME_HOURS    = 8.5
BREASTFEEDING_DURATION_WEEKS    = 15

def get_hr_name(request):
    """Get HR username from request — works with both middleware and require_perm."""
    # Try hr_profile first (set by require_perm)
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




def resolve_balance_impact(leave_type, duration_hours, days_requested):
    """
    Normally a leave request debits its own leave_type's balance.
    Permissions en heure (PM) are the exception: they're recorded under PM
    for history, but the day-equivalent (hours / 8) is deducted from the
    employee's CD (congé) balance instead.
    """
    if leave_type.code == "PM":
        cd_type = LeaveType.objects.filter(code="CD").first()
        hours = duration_hours or 0
        days_amount = round(float(hours) / HOURS_PER_DAY, 1)
        return (cd_type or leave_type), days_amount
    return leave_type, days_requested



class LeaveTypeViewSet(viewsets.ModelViewSet):
    ordering = ["id"]
    queryset = LeaveType.objects.filter(is_active=True).only(
        "id", "code", "name", "days_per_year",
        "is_paid", "requires_document", "color", "is_active", "is_protected",
    )
    serializer_class = LeaveTypeSerializer

    def get_permissions(self):
        write_actions = {"create", "update", "partial_update", "destroy"}
        perm_key = "leaves_write" if self.action in write_actions else "leaves_read"
        return [require_perm(perm_key)()]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.code in PROTECTED_LEAVE_CODES:
            raise PermissionDenied(
                f"Le type « {instance.name} » est protégé et ne peut pas être supprimé."
            )
        return super().destroy(request, *args, **kwargs)




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

    def list(self, request, *args, **kwargs):
        employee_id = request.query_params.get("employee")
        year = request.query_params.get("year")
        if employee_id and year:
            employee = Employee.objects.filter(pk=employee_id).first()
            if employee:
                existing_ids = set(
                    LeaveBalance.objects.filter(employee=employee, year=year)
                    .values_list("leave_type_id", flat=True)
                )
                for lt in LeaveType.objects.filter(is_active=True).exclude(id__in=existing_ids):
                    LeaveBalance.get_or_create_for(employee, lt, int(year))
        return super().list(request, *args, **kwargs)
    
    def get_permissions(self):
        write_actions = {"create", "update", "partial_update", "destroy"}
        perm_key = "leaves_write" if self.action in write_actions else "leaves_read"
        return [require_perm(perm_key)()]

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

    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["employee", "leave_type", "status"]
    ordering_fields = ["start_date", "created_at"]
    
    def get_permissions(self):
        if self.action == "approve_reject":
            return [require_perm("leaves_approve")()]
        write_actions = {"create", "update", "partial_update", "destroy"}
        perm_key = "leaves_write" if self.action in write_actions else "leaves_read"
        return [require_perm(perm_key)()]

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

        balance_type, balance_days = resolve_balance_impact(
            leave.leave_type, leave.duration_hours, leave.days_requested
        )
        balance = LeaveBalance.get_or_create_for(leave.employee, balance_type, leave.start_date.year)

        if leave.leave_type.code in AUTO_APPROVE_LEAVE_CODES:
            leave.status = "APPROVED"
            leave.approved_by = self.request.user.id
            leave.approved_at = timezone.now()
            leave.save(update_fields=["status", "approved_by", "approved_at"])

            balance.used_days += balance_days
            balance.save(update_fields=["used_days"])
        else:
            balance.pending_days += balance_days
            balance.save(update_fields=["pending_days"])

        log_action(self.request, leave, "CREATE")
        try:
            name = get_hr_name(self.request)
            notify_leave_created(leave, triggered_by=name)
        except Exception as e:
            print(f"[NOTIFY] leave_created error: {e}")


    def perform_update(self, serializer):
        instance = serializer.instance
        old_data = snapshot(instance)

        old_leave_type = instance.leave_type
        old_year       = instance.start_date.year
        old_duration   = instance.duration_hours
        old_days_raw   = instance.days_requested
        status         = instance.status

        leave = serializer.save()

        new_data = snapshot(leave)
        changes = diff_dict(old_data, new_data)
        if changes:
            log_action(self.request, leave, "UPDATE", changes)

        field = {"PENDING": "pending_days", "APPROVED": "used_days"}.get(status)
        if field is None:
            return

        old_balance_type, old_days = resolve_balance_impact(old_leave_type, old_duration, old_days_raw)
        new_balance_type, new_days = resolve_balance_impact(
            leave.leave_type, leave.duration_hours, leave.days_requested
        )
        new_year = leave.start_date.year

        if old_balance_type.id == new_balance_type.id and old_year == new_year:
            balance = LeaveBalance.get_or_create_for(leave.employee, new_balance_type, new_year)
            delta = new_days - old_days
            setattr(balance, field, max(0, getattr(balance, field) + delta))
            balance.save(update_fields=[field])
        else:
            old_balance = LeaveBalance.get_or_create_for(leave.employee, old_balance_type, old_year)
            setattr(old_balance, field, max(0, getattr(old_balance, field) - old_days))
            old_balance.save(update_fields=[field])

            new_balance = LeaveBalance.get_or_create_for(leave.employee, new_balance_type, new_year)
            setattr(new_balance, field, getattr(new_balance, field) + new_days)
            new_balance.save(update_fields=[field])


    def perform_destroy(self, instance):
        balance_type, balance_days = resolve_balance_impact(
            instance.leave_type, instance.duration_hours, instance.days_requested
        )
        balance = LeaveBalance.get_or_create_for(instance.employee, balance_type, instance.start_date.year)

        if instance.status == "PENDING":
            balance.pending_days = max(0, balance.pending_days - balance_days)
            balance.save(update_fields=["pending_days"])
        elif instance.status == "APPROVED":
            balance.used_days = max(0, balance.used_days - balance_days)
            balance.save(update_fields=["used_days"])

        log_action(self.request, instance, "DELETE")
        super().perform_destroy(instance)
            

    @action(detail=False, methods=["get"])
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="evenements_{timezone.now().date()}.csv"'
        )
        response.write("\ufeff")  

        writer = csv.writer(response, delimiter=";")  

        writer.writerow([
            "Matricule", "Employe", "Usine", "Type de conge",
            "Date debut", "Date fin", "Jours demandes", "Duree (heures)",
            "Statut", "Motif", "Approuve par", "Date approbation",
            "Motif de rejet", "Cree le",
        ])

        for leave in queryset:
            writer.writerow([
                leave.employee.employee_id,
                leave.employee.full_name,
                leave.employee.factory.name if leave.employee.factory else "",
                leave.leave_type.name,
                leave.start_date.strftime("%d/%m/%Y"),
                leave.end_date.strftime("%d/%m/%Y"),
                leave.days_requested,
                leave.duration_hours or "",
                STATUS_LABELS_FR.get(leave.status, leave.status),
                leave.reason,
                leave.approved_by or "",
                leave.approved_at.strftime("%d/%m/%Y %H:%M") if leave.approved_at else "",
                leave.rejection_reason,
                leave.created_at.strftime("%d/%m/%Y %H:%M"),
            ])

        return response

    @action(detail=True, methods=["post"])
    def approve_reject(self, request, pk=None):
        leave = self.get_object()

        if leave.status != "PENDING":
            return Response({"detail": "Only pending requests can be actioned."}, status=400)

        serializer = LeaveApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_type = serializer.validated_data["action"]

        balance_type, balance_days = resolve_balance_impact(
            leave.leave_type, leave.duration_hours, leave.days_requested
        )
        balance = LeaveBalance.get_or_create_for(leave.employee, balance_type, leave.start_date.year)
        if action_type == "approve":
            leave.status = "APPROVED"
            leave.approved_by = request.user.id
            leave.approved_at = timezone.now()

            balance.used_days += balance_days
            balance.pending_days = max(0, balance.pending_days - balance_days)
            balance.save(update_fields=["used_days", "pending_days"])

            try:
                name = get_hr_name(request)
                notify_leave_approved(leave, approved_by=name)
            except Exception as e:
                print(f"[NOTIFY] leave_approved error: {e}")

            leave.save(update_fields=["status", "approved_by", "approved_at"])
            log_action(request, leave, "APPROVE", {"status": {"old": "PENDING", "new": "APPROVED"}})

        else:
            leave.status = "REJECTED"
            leave.rejection_reason = serializer.validated_data.get("rejection_reason", "")

            balance.pending_days = max(0, balance.pending_days - balance_days)
            balance.save(update_fields=["pending_days"])

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



    @action(detail=False, methods=["get"], url_path="balance-history")
    def balance_history(self, request):
        employee_id   = request.query_params.get("employee")
        leave_type_id = request.query_params.get("leave_type")
        year          = request.query_params.get("year")

        if not (employee_id and leave_type_id and year):
            return Response(
                {"detail": "employee, leave_type et year sont requis."}, status=400
            )

        balance  = LeaveBalance.objects.filter(
            employee_id=employee_id, leave_type_id=leave_type_id, year=year
        ).first()
        entitled = balance.entitled_days if balance else 0

        requests = (
            LeaveRequest.objects
            .filter(employee_id=employee_id, leave_type_id=leave_type_id, start_date__year=year)
            .order_by("created_at")
        )

        running_used, running_pending = 0, 0
        history = []
        for r in requests:
            if r.status == "APPROVED":
                running_used += r.days_requested
            elif r.status == "PENDING":
                running_pending += r.days_requested
            # REJECTED / CANCELLED shown for the trace, but don't move the balance

            history.append({
                "id": r.id,
                "start_date": r.start_date,
                "end_date": r.end_date,
                "days_requested": r.days_requested,
                "status": r.status,
                "created_at": r.created_at,     # date + heure de la demande
                "approved_at": r.approved_at,   # date + heure de l'approbation, si applicable
                "remaining_days_after": entitled - running_used - running_pending,
            })

        return Response({
            "employee_id": employee_id,
            "leave_type_id": leave_type_id,
            "year": year,
            "entitled_days": entitled,
            "used_days": running_used,
            "pending_days": running_pending,
            "remaining_days": entitled - running_used - running_pending,
            "history": history,
        })



    @action(detail=False, methods=["get"], url_path="employee-overview")
    def employee_overview(self, request):
        today = timezone.now().date()
        year  = request.query_params.get("year", today.year)

        employee_id = request.query_params.get("employee")
        balances_qs = LeaveBalance.objects.filter(year=year).select_related("leave_type", "employee")
        if employee_id:
            balances_qs = balances_qs.filter(employee_id=employee_id)

        current_qs = LeaveRequest.objects.filter(
            status="APPROVED", start_date__lte=today, end_date__gte=today
        ).select_related("leave_type")
        upcoming_qs = LeaveRequest.objects.filter(
            status="APPROVED", start_date__gt=today
        ).select_related("leave_type").order_by("start_date")

        current_by_emp, upcoming_by_emp = {}, {}
        for r in current_qs:
            current_by_emp.setdefault(r.employee_id, []).append({
                "leave_type": r.leave_type.name,
                "start_date": r.start_date,
                "end_date": r.end_date,
            })
        for r in upcoming_qs:
            upcoming_by_emp.setdefault(r.employee_id, []).append({
                "leave_type": r.leave_type.name,
                "start_date": r.start_date,
                "end_date": r.end_date,
            })

        by_employee = {}
        for b in balances_qs:
            emp = by_employee.setdefault(b.employee_id, {
                "employee_id": b.employee_id,
                "employee_name": b.employee.full_name,
                "status": "present",
                "currently_on": current_by_emp.get(b.employee_id, []),
                "upcoming": upcoming_by_emp.get(b.employee_id, []),
                "balances": [],
            })
            emp["balances"].append({
                "leave_type": b.leave_type.name,
                "leave_type_code": b.leave_type.code,
                "entitled_days": b.entitled_days,
                "used_days": b.used_days,
                "pending_days": b.pending_days,
                "remaining_days": b.remaining_days,
            })
            if b.employee_id in current_by_emp:
                emp["status"] = "absent"
            elif b.employee_id in upcoming_by_emp and emp["status"] != "absent":
                emp["status"] = "upcoming"

        return Response(list(by_employee.values()))


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

    def get_permissions(self):
        write_actions = {"create", "update", "partial_update", "destroy", "mark_returned", "extend"}
        perm_key = "leaves_write" if self.action in write_actions else "leaves_read"
        return [require_perm(perm_key)()]