from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from datetime import timedelta
from employees.models import Employee
from alerts.models import CDDAlert, CDDNotificationAssignment


class Command(BaseCommand):
    help = "Send CDD expiry alerts daily — once per threshold per employee"

    def handle(self, *args, **kwargs):
        today           = timezone.now().date()
        sent            = 0
        skipped         = 0
        threshold_days  = [30, 60, 90]

        assignments = list(
            CDDNotificationAssignment.objects
            .filter(is_active=True)
            .select_related("factory", "department")
        )
        if not assignments:
            self.stdout.write("No notification assignments configured.")
            return

        for days in threshold_days:
            threshold = today + timedelta(days=days)

            # Employees expiring within this threshold window
            qs = Employee.objects.filter(
                contract_type="CDD",
                status="ACTIVE",
                termination_date__isnull=False,
                termination_date__lte=threshold,
                termination_date__gte=today,
            ).select_related("factory", "department")

            if not qs.exists():
                continue

            for emp in qs:
                # --- DEDUPLICATION: skip if already sent for this threshold ---
                alert, created = CDDAlert.objects.get_or_create(
                    employee=emp,
                    alert_threshold=days,
                    defaults={
                        "termination_date": emp.termination_date,
                        "days_remaining":   (emp.termination_date - today).days,
                        "status":           CDDAlert.AlertStatus.PENDING,
                    },
                )
                if not created and alert.status == CDDAlert.AlertStatus.SENT:
                    skipped += 1
                    continue

                # Find matching assignments for this employee
                recipients = []
                for assignment in assignments:
                    if assignment.department and assignment.department != emp.department:
                        continue
                    if assignment.factory and assignment.factory != emp.factory:
                        continue
                    recipients.append(assignment.email)

                if not recipients:
                    continue

                days_left = (emp.termination_date - today).days
                subject   = f"[RH] Alerte CDD — {emp.full_name} expire dans {days_left} jours"
                body      = (
                    f"Alerte CDD\n"
                    f"Employé      : {emp.full_name} ({emp.employee_id})\n"
                    f"Poste        : {emp.job_title}\n"
                    f"Usine / Dépt : {emp.factory.name} / {emp.department.name}\n"
                    f"Fin contrat  : {emp.termination_date} ({days_left} jours restants)\n"
                    f"Seuil alerte : {days} jours\n"
                )

                try:
                    msg = EmailMultiAlternatives(
                        subject=subject,
                        body=body,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        to=recipients,
                    )
                    msg.send()

                    # --- STATUS UPDATE: mark as SENT in DB ---
                    alert.status       = CDDAlert.AlertStatus.SENT
                    alert.sent_at      = timezone.now()
                    alert.email_sent_to = ", ".join(recipients)
                    alert.days_remaining = days_left
                    alert.save()

                    sent += 1
                    self.stdout.write(f"  ✓ Sent: {emp.full_name} ({days}j threshold)")

                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  ✗ Error {emp.full_name}: {e}"))

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {sent} alert(s) sent, {skipped} skipped (already sent)."
        ))
