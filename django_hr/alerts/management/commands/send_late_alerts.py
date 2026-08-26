# django_hr/alerts/management/commands/send_late_alerts.py
import os
import requests
from django.core.management.base import BaseCommand
from django.utils import timezone

from employees.models import Employee
from alerts.models import LateAlertAssignment
from alerts.email_utils import notify_late_employees

ATTENDANCE_SERVICE_URL = os.environ.get("ATTENDANCE_SERVICE_URL", "http://fastapi:8080")


class Command(BaseCommand):
    help = "Send the daily 'employees late today' email per department (run at 10:00)."

    def handle(self, *args, **options):
        today = timezone.now().date()

        try:
            resp = requests.get(
                f"{ATTENDANCE_SERVICE_URL}/attendance/late-today",
                params={"target_date": today.isoformat(), "skip": 0, "limit": 1000},
                timeout=30,
            )
            resp.raise_for_status()
            late_records = resp.json()
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"Failed to fetch late-today: {exc}"))
            return

        if not late_records:
            self.stdout.write("Aucun retard aujourd'hui.")
            return

        device_ids = [r["user_id"] for r in late_records]
        employees = {
            e.device_user_id: e
            for e in Employee.objects.filter(device_user_id__in=device_ids)
            .select_related("department")
        }

        skipped = []
        by_department = {}
        dept_objects = {}
        for r in late_records:
            emp = employees.get(r["user_id"])
            if not emp:
                skipped.append((r["user_id"], "no matching Employee (device_user_id)"))
                continue
            if not emp.department_id:
                skipped.append((r["user_id"], f"{emp.full_name} has no department assigned"))
                continue
            arrival_time = r["arrival"][11:16] if "T" in r["arrival"] else r["arrival"][-8:-3]
            by_department.setdefault(emp.department_id, []).append({
                "full_name":    emp.full_name,
                "employee_id":  emp.employee_id,
                "job_title":    str(emp.job_title) if emp.job_title else "",
                "arrival_time": arrival_time,
                "minutes_late": r["minutes_late"],
            })
            dept_objects[emp.department_id] = emp.department

        if skipped:
            self.stdout.write(self.style.WARNING(f"{len(skipped)} employe(s) ignore(s):"))
            for uid, reason in skipped:
                self.stdout.write(f"  - device_user_id={uid}: {reason}")

        assignments = LateAlertAssignment.objects.filter(is_active=True).select_related("department")
        recipients_by_dept = {}
        for a in assignments:
            recipients_by_dept.setdefault(a.department_id, []).append(a.email)

        sent = 0
        for dept_id, dept_employees in by_department.items():
            recipients = recipients_by_dept.get(dept_id)
            if not recipients:
                continue
            department = dept_objects[dept_id]
            notify_late_employees(department, dept_employees, recipients=recipients)
            sent += len(recipients)

        self.stdout.write(self.style.SUCCESS(f"Alertes envoyees a {sent} destinataire(s), groupe(s) par departement."))