from django.utils import timezone
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from datetime import timedelta

from employees.models import Employee
from accounts.permissions import get_hr_profile, require_perm
from .models import CDDAlert, CDDNotificationAssignment, InAppNotification
from .serializers import (
    CDDAlertSerializer,
    CDDNotificationAssignmentSerializer,
    InAppNotificationSerializer,
)
from .email_utils import (
    notify_alert_sent,
    notify_alert_renewed,
    notify_alert_ignored,
    notify_bulk_sent,
)

from .models import LateAlertAssignment, MonthlyLateReportAssignment
from .serializers import LateAlertAssignmentSerializer, MonthlyLateReportAssignmentSerializer


class CDDAlertViewSet(viewsets.ModelViewSet):
    queryset = CDDAlert.objects.select_related(
        "employee", "employee__factory", "employee__department"
    ).all()
    serializer_class = CDDAlertSerializer
    filter_backends  = [DjangoFilterBackend]
    filterset_fields = ["status", "alert_threshold"]

    @action(detail=True, methods=["post"])
    def send_email(self, request, pk=None):
        alert   = self.get_object()
        profile = get_hr_profile(request)
        result  = _send_alert_email(alert, profile)
        if result:
            notify_alert_sent(
                alert,
                sent_to_email=profile.email if profile else settings.EMAIL_HOST_USER,
                triggered_by=profile.username if profile else "Systeme",
            )
            return Response({"detail": "Email envoye avec succes."})
        return Response({"detail": "Erreur envoi email."}, status=400)

    @action(detail=True, methods=["post"])
    def mark_renewed(self, request, pk=None):
        alert        = self.get_object()
        alert.status = CDDAlert.AlertStatus.RENEWED
        alert.note   = request.data.get("note", "")
        alert.save()
        profile = get_hr_profile(request)
        notify_alert_renewed(
            alert,
            note=alert.note,
            triggered_by=profile.username if profile else "Inconnu",
        )
        return Response(CDDAlertSerializer(alert).data)

    @action(detail=True, methods=["post"])
    def mark_ignored(self, request, pk=None):
        alert        = self.get_object()
        alert.status = CDDAlert.AlertStatus.IGNORED
        alert.save()
        profile = get_hr_profile(request)
        notify_alert_ignored(
            alert,
            triggered_by=profile.username if profile else "Inconnu",
        )
        return Response(CDDAlertSerializer(alert).data)


class CDDNotificationAssignmentViewSet(viewsets.ModelViewSet):
    queryset = CDDNotificationAssignment.objects.select_related(
        "factory", "department"
    ).all()
    serializer_class = CDDNotificationAssignmentSerializer
    filter_backends  = [DjangoFilterBackend]
    filterset_fields = ["factory", "department", "is_active"]


class ExpiringCDDView(APIView):
    def get(self, request):
        days      = int(request.query_params.get("days", 90))
        today     = timezone.now().date()
        threshold = today + timedelta(days=days)
        profile   = get_hr_profile(request)

        qs = Employee.objects.filter(
            contract_type="CDD",
            status="ACTIVE",
            termination_date__isnull=False,
            termination_date__lte=threshold,
            termination_date__gte=today,
        ).select_related("factory", "department").order_by("termination_date")

        if profile and not profile.is_director:
            if profile.department:
                qs = qs.filter(department=profile.department)
            elif profile.factory:
                qs = qs.filter(factory=profile.factory)

        data = []
        for emp in qs:
            days_left = (emp.termination_date - today).days
            alert     = CDDAlert.objects.filter(employee=emp).first()
            data.append({
                "id":               emp.id,
                "employee_id":      emp.employee_id,
                "full_name":        emp.full_name,
                "job_title":        emp.job_title.name if emp.job_title else None,
                "factory_name":     emp.factory.name,
                "department_name":  emp.department.name,
                "email":            emp.email or "",
                "termination_date": str(emp.termination_date),
                "days_remaining":   days_left,
                "alert_status":     alert.status if alert else None,
                "alert_id":         alert.id     if alert else None,
                "urgency": (
                    "critical" if days_left <= 30 else
                    "warning"  if days_left <= 60 else
                    "info"
                ),
            })

        return Response({
            "total":       len(data),
            "days_range":  days,
            "employees":   data,
            "user_email":  profile.email if profile else "",
            "is_director": profile.is_director if profile else False,
        })


class SendBulkAlertsView(APIView):
    def post(self, request):
        days      = int(request.data.get("days", 30))
        profile   = get_hr_profile(request)
        today     = timezone.now().date()
        threshold = today + timedelta(days=days)

        qs = Employee.objects.filter(
            contract_type="CDD",
            status="ACTIVE",
            termination_date__isnull=False,
            termination_date__lte=threshold,
            termination_date__gte=today,
        ).select_related("factory", "department")

        if not qs.exists():
            return Response({"detail": "Aucun CDD expirant dans cette periode."})

        assignments = CDDNotificationAssignment.objects.filter(
            is_active=True
        ).select_related("factory", "department")

        if not assignments.exists():
            if profile and profile.email:
                assignments_list = [{
                    "email":      profile.email,
                    "username":   profile.username,
                    "factory":    None,
                    "department": None,
                }]
            else:
                return Response({"detail": "Aucun destinataire configure."}, status=400)
        else:
            assignments_list = list(assignments)

        sent_count = 0
        errors     = []

        for assignment in assignments_list:
            if isinstance(assignment, dict):
                factory    = assignment["factory"]
                department = assignment["department"]
                email      = assignment["email"]
                username   = assignment["username"]
            else:
                factory    = assignment.factory
                department = assignment.department
                email      = assignment.email
                username   = assignment.username

            if not email:
                continue

            scoped_qs = qs
            if department:
                scoped_qs = qs.filter(department=department)
            elif factory:
                scoped_qs = qs.filter(factory=factory)

            if not scoped_qs.exists():
                continue

            rows = ""
            for emp in scoped_qs.order_by("termination_date"):
                days_left = (emp.termination_date - today).days
                color = "#f44336" if days_left <= 30 else "#ff9800" if days_left <= 60 else "#2196f3"
                rows += (
                    "<tr>"
                    f"<td style='padding:8px;border:1px solid #ddd;'>{emp.full_name}</td>"
                    f"<td style='padding:8px;border:1px solid #ddd;'>{emp.employee_id}</td>"
                    f"<td style='padding:8px;border:1px solid #ddd;'>{emp.job_title}</td>"
                    f"<td style='padding:8px;border:1px solid #ddd;'>{emp.factory.name}</td>"
                    f"<td style='padding:8px;border:1px solid #ddd;'>{emp.department.name}</td>"
                    f"<td style='padding:8px;border:1px solid #ddd;'>{emp.termination_date}</td>"
                    f"<td style='padding:8px;border:1px solid #ddd;color:{color};font-weight:bold;'>{days_left} jours</td>"
                    "</tr>"
                )

            scope_label = "toute la societe"
            if department:
                scope_label = department.name
            elif factory:
                scope_label = factory.name

            html = (
                "<html><body>"
                f"<p>Bonjour {username},</p>"
                f"<p>Voici les contrats CDD expirant dans les <strong>{days} prochains jours</strong>"
                f" pour <strong>{scope_label}</strong> :</p>"
                "<table style='border-collapse:collapse;width:100%;'>"
                "<tr style='background:#f5f5f5;'>"
                "<th style='padding:8px;border:1px solid #ddd;'>Nom</th>"
                "<th style='padding:8px;border:1px solid #ddd;'>Matricule</th>"
                "<th style='padding:8px;border:1px solid #ddd;'>Poste</th>"
                "<th style='padding:8px;border:1px solid #ddd;'>Usine</th>"
                "<th style='padding:8px;border:1px solid #ddd;'>Departement</th>"
                "<th style='padding:8px;border:1px solid #ddd;'>Fin contrat</th>"
                "<th style='padding:8px;border:1px solid #ddd;'>Jours restants</th>"
                "</tr>"
                f"{rows}"
                "</table>"
                f"<p><strong>Total : {scoped_qs.count()} contrat(s)</strong></p>"
                "<p>Cordialement,<br>Systeme RH</p>"
                "</body></html>"
            )

            text = f"Alerte CDD - {scoped_qs.count()} contrat(s) expirant dans {days} jours.\n"
            for emp in scoped_qs.order_by("termination_date"):
                days_left = (emp.termination_date - today).days
                text += f"- {emp.full_name} ({emp.employee_id}) - {emp.termination_date} - {days_left}j\n"

            try:
                email_msg = EmailMultiAlternatives(
                    subject=f"Alerte CDD - {scoped_qs.count()} contrat(s) expirant dans {days} jours",
                    body=text,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[email],
                )
                email_msg.attach_alternative(html, "text/html")
                email_msg.send()
                sent_count += 1

                for emp in scoped_qs:
                    CDDAlert.objects.update_or_create(
                        employee=emp,
                        alert_threshold=days,
                        defaults={
                            "termination_date": emp.termination_date,
                            "days_remaining":   (emp.termination_date - today).days,
                            "status":           CDDAlert.AlertStatus.SENT,
                            "email_sent_to":    email,
                            "sent_at":          timezone.now(),
                        }
                    )
            except Exception as e:
                errors.append(f"{email}: {str(e)}")

        notify_bulk_sent(
            sent_count=sent_count,
            total_employees=qs.count(),
            days=days,
            errors=errors,
            triggered_by=profile.username if profile else "Systeme",
        )

        return Response({
            "detail": f"Alertes envoyees a {sent_count} destinataire(s).",
            "sent":   sent_count,
            "errors": errors,
        })


def _send_alert_email(alert, profile):
    try:
        emp       = alert.employee
        today     = timezone.now().date()
        days_left = (emp.termination_date - today).days
        to_email  = profile.email if profile and profile.email else settings.EMAIL_HOST_USER

        html = (
            "<html><body>"
            "<p>Bonjour,</p>"
            "<p>Rappel concernant le contrat CDD de :</p>"
            "<table style='border-collapse:collapse;'>"
            f"<tr><td style='padding:6px;font-weight:bold;'>Nom</td><td style='padding:6px;'>{emp.full_name}</td></tr>"
            f"<tr><td style='padding:6px;font-weight:bold;'>Matricule</td><td style='padding:6px;'>{emp.employee_id}</td></tr>"
            f"<tr><td style='padding:6px;font-weight:bold;'>Poste</td><td style='padding:6px;'>{emp.job_title}</td></tr>"
            f"<tr><td style='padding:6px;font-weight:bold;'>Usine</td><td style='padding:6px;'>{emp.factory.name}</td></tr>"
            f"<tr><td style='padding:6px;font-weight:bold;'>Fin contrat</td>"
            f"<td style='padding:6px;color:#f44336;font-weight:bold;'>{emp.termination_date} ({days_left} jours)</td></tr>"
            "</table>"
            "<p>Cordialement,<br>Systeme RH</p>"
            "</body></html>"
        )
        text = f"Rappel CDD - {emp.full_name} - Fin : {emp.termination_date} ({days_left} jours)"

        email_msg = EmailMultiAlternatives(
            subject=f"Alerte CDD - {emp.full_name} - {days_left} jours restants",
            body=text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email],
        )
        email_msg.attach_alternative(html, "text/html")
        email_msg.send()

        alert.status        = CDDAlert.AlertStatus.SENT
        alert.email_sent_to = to_email
        alert.sent_at       = timezone.now()
        alert.save()
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False


class InAppNotificationViewSet(viewsets.ModelViewSet):
    serializer_class   = InAppNotificationSerializer
    http_method_names  = ["get", "post", "patch", "delete"]
    permission_classes = [require_perm("alerts_read")]
    
    def get_queryset(self):
        profile = get_hr_profile(self.request)
        user_id = profile.auth_user_id if profile else None
        return InAppNotification.objects.filter(
            Q(auth_user_id=user_id) | Q(auth_user_id__isnull=True)
        )

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        profile = get_hr_profile(request)
        user_id = profile.auth_user_id if profile else None
        InAppNotification.objects.filter(
            Q(auth_user_id=user_id) | Q(auth_user_id__isnull=True),
            is_read=False,
        ).update(is_read=True)
        return Response({"detail": "Toutes les notifications marquees comme lues."})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        profile = get_hr_profile(request)
        user_id = profile.auth_user_id if profile else None
        count = InAppNotification.objects.filter(
            Q(auth_user_id=user_id) | Q(auth_user_id__isnull=True),
            is_read=False,
        ).count()
        return Response({"count": count})




class LateAlertAssignmentViewSet(viewsets.ModelViewSet):
    queryset = LateAlertAssignment.objects.select_related("factory").all()
    serializer_class = LateAlertAssignmentSerializer
    permission_classes = [require_perm("alerts_read")]
    filter_backends  = [DjangoFilterBackend]
    filterset_fields = ["factory", "is_active"]

class MonthlyLateReportAssignmentViewSet(viewsets.ModelViewSet):
    queryset = MonthlyLateReportAssignment.objects.all()
    serializer_class = MonthlyLateReportAssignmentSerializer
    permission_classes = [require_perm("alerts_read")]
    filter_backends  = [DjangoFilterBackend]
    filterset_fields = ["is_active"]

