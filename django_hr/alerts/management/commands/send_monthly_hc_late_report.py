# django_hr/alerts/management/commands/send_monthly_hc_late_report.py
import os
import requests

from django.core.management.base import BaseCommand
from django.utils import timezone

from employees.models import Employee
from alerts.email_utils import notify_monthly_hc_late_report
from alerts.models import MonthlyLateReportAssignment

ATTENDANCE_SERVICE_URL = os.environ.get("ATTENDANCE_SERVICE_URL", "http://fastapi:8080")

MONTH_NAMES = [
    "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]


class Command(BaseCommand):
    help = "Send the monthly late-report summary for HC (managers) employees only."

    def add_arguments(self, parser):
        parser.add_argument(
            "--min-late", type=int, default=1,
            help="Minimum late occurrences to include an employee (default: 1)",
        )
        parser.add_argument(
            "--year", type=int, default=None,
            help="Year to report on (default: previous month's year)",
        )
        parser.add_argument(
            "--month", type=int, default=None,
            help="Month to report on, 1-12 (default: previous month)",
        )

    def handle(self, *args, **options):
        today = timezone.now().date()

        if options["year"] and options["month"]:
            year, month = options["year"], options["month"]
        else:
            # Default: previous calendar month (command is meant to run on the 1st)
            first_of_this_month = today.replace(day=1)
            last_day_prev_month = first_of_this_month - timezone.timedelta(days=1)
            year, month = last_day_prev_month.year, last_day_prev_month.month

        min_late = options["min_late"]

        try:
            resp = requests.get(
                f"{ATTENDANCE_SERVICE_URL}/attendance/late-report",
                params={
                    "year": year,
                    "month": month,
                    "min_late": min_late,
                    "classification": "HC",
                },
                timeout=60,
            )
            resp.raise_for_status()
            report = resp.json()
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"Failed to fetch late-report: {exc}"))
            return

        employees_data = report.get("employees", [])
        if not employees_data:
            self.stdout.write(
                f"Aucun retard HC pour {MONTH_NAMES[month]} {year} (seuil >= {min_late})."
            )
            return

        device_ids = [e["user_id"] for e in employees_data]
        employees = {
            e.device_user_id: e
            for e in Employee.objects.filter(device_user_id__in=device_ids)
            .select_related("department", "factory")
        }

        rows = []
        skipped = []
        for e in employees_data:
            emp = employees.get(e["user_id"])
            if not emp:
                skipped.append(e["user_id"])
                continue
            rows.append({
                "full_name":          emp.full_name,
                "employee_id":        emp.employee_id,
                "department":         emp.department.name if emp.department_id else "—",
                "job_title":          str(emp.job_title) if emp.job_title else "",
                "late_count":         e["late_count"],
                "total_days_present": e["total_days_present"],
                "late_rate_pct":      e["late_rate_pct"],
                "late_days":          e.get("late_days", []),
            })

        if skipped:
            self.stdout.write(self.style.WARNING(
                f"{len(skipped)} device_user_id(s) sans Employee correspondant: {skipped}"
            ))

        if not rows:
            self.stdout.write("Aucun employe HC correspondant trouve apres jointure.")
            return

        recipients = list(
            MonthlyLateReportAssignment.objects.filter(is_active=True)
            .values_list("email", flat=True)
        )
        ok = notify_monthly_hc_late_report(
            month=month, year=year, min_late=min_late, rows=rows,
            recipients=recipients or None,
        )
        if ok:
            self.stdout.write(self.style.SUCCESS(
                f"Rapport mensuel HC envoye pour {MONTH_NAMES[month]} {year} ({len(rows)} employe(s))."
            ))
        else:
            self.stderr.write(self.style.ERROR("Echec envoi du rapport mensuel HC."))
