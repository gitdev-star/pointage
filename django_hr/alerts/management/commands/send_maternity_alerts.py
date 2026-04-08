from django.core.management.base import BaseCommand
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from leaves.models import MaternityLeave
from alerts.models import CDDNotificationAssignment


class Command(BaseCommand):
    help = "Send maternity leave email alerts"

    def handle(self, *args, **kwargs):
        today = timezone.now().date()
        sent  = 0

        hr_emails = list(
            CDDNotificationAssignment.objects.filter(is_active=True)
            .values_list("email", flat=True).distinct()
        )
        if not hr_emails:
            hr_emails = [settings.EMAIL_HOST_USER]

        # Alert 1 — upcoming birth in 7 days
        for ml in MaternityLeave.objects.filter(
            status__in=["DECLARED", "ON_LEAVE"],
            expected_birth_date__lte=today + timedelta(days=7),
            expected_birth_date__gte=today,
            alert_birth_sent=False,
        ).select_related("employee", "employee__factory", "employee__department"):
            days = (ml.expected_birth_date - today).days
            self._send(hr_emails,
                f"Accouchement prevu dans {days} jour(s) - {ml.employee.full_name}",
                f"<p>Accouchement de <b>{ml.employee.full_name}</b> prevu dans {days} jour(s) le {ml.expected_birth_date}.</p>"
            )
            ml.alert_birth_sent = True
            ml.save(update_fields=["alert_birth_sent"])
            sent += 1

        # Alert 2 — end of leave in 7 days
        for ml in MaternityLeave.objects.filter(
            status__in=["ON_LEAVE", "EXTENDED"],
            leave_end_date__lte=today + timedelta(days=7),
            leave_end_date__gte=today,
            alert_end_sent=False,
            actual_return_date__isnull=True,
        ).select_related("employee", "employee__factory", "employee__department"):
            days = (ml.effective_end_date - today).days
            self._send(hr_emails,
                f"Fin conge maternite dans {days} jour(s) - {ml.employee.full_name}",
                f"<p>Fin du conge de <b>{ml.employee.full_name}</b> dans {days} jour(s) le {ml.effective_end_date}.</p>"
            )
            ml.alert_end_sent = True
            ml.save(update_fields=["alert_end_sent"])
            sent += 1

        # Alert 3 — return today
        for ml in MaternityLeave.objects.filter(
            status__in=["ON_LEAVE", "EXTENDED"],
            leave_end_date=today,
            alert_return_sent=False,
            actual_return_date__isnull=True,
        ).select_related("employee", "employee__factory", "employee__department"):
            self._send(hr_emails,
                f"Reprise de travail aujourd'hui - {ml.employee.full_name}",
                f"<p><b>{ml.employee.full_name}</b> reprend le travail aujourd'hui.</p>"
            )
            ml.alert_return_sent = True
            ml.status = MaternityLeave.Status.RETURNED
            ml.save(update_fields=["alert_return_sent", "status"])
            sent += 1

        self.stdout.write(self.style.SUCCESS(f"Done. {sent} alert(s) sent."))

    def _send(self, emails, subject, html):
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=subject,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=emails,
            )
            msg.attach_alternative(html, "text/html")
            msg.send()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Email error: {e}"))
