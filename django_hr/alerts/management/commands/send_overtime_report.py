# django_hr/alerts/management/commands/send_overtime_report.py
import os
from datetime import date, timedelta

import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from employees.models import Employee
from alerts.models import LateAlertAssignment
from alerts.email_utils import MONTH_NAMES_FR
from alerts.overtime_email import format_heures, notify_overtime_report

ATTENDANCE_SERVICE_URL = os.environ.get("ATTENDANCE_SERVICE_URL", "http://fastapi:8080")


def _periode(periode: str, today: date):
    """Retourne (debut, fin, libellé, slug) pour la semaine ou le mois précédent."""
    if periode == "semaine":
        debut = today - timedelta(days=today.weekday() + 7)   # lundi de la semaine passée
        fin = debut + timedelta(days=6)                        # dimanche
        label = f"semaine du {debut:%d/%m} au {fin:%d/%m/%Y}"
        slug = f"semaine_{debut:%Y%m%d}"
    else:
        fin = today.replace(day=1) - timedelta(days=1)         # dernier jour du mois passé
        debut = fin.replace(day=1)
        label = f"mois de {MONTH_NAMES_FR[fin.month].lower()} {fin.year}"
        slug = f"{fin.year}_{fin.month:02d}"
    return debut, fin, label, slug


class Command(BaseCommand):
    help = ("Synthèse des heures supplémentaires (hors HC) par site, envoyée aux "
            "destinataires de l'alerte retard. Semaine : le lundi ; mois : le 1er.")

    def add_arguments(self, parser):
        parser.add_argument(
            "--periode", choices=["semaine", "mois"], required=True,
            help="semaine = lundi→dimanche précédents ; mois = mois précédent",
        )
        parser.add_argument(
            "--date", default=None,
            help="Date de référence AAAA-MM-JJ à la place d'aujourd'hui (pour un rattrapage)",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Affiche la synthèse sans envoyer d'email",
        )

    def handle(self, *args, **options):
        if options["date"]:
            try:
                today = date.fromisoformat(options["date"])
            except ValueError:
                raise CommandError("--date doit être au format AAAA-MM-JJ")
        else:
            today = timezone.localdate()

        debut, fin, label, slug = _periode(options["periode"], today)
        self.stdout.write(f"Heures supplémentaires — {label} ({debut} → {fin})")

        try:
            resp = requests.get(
                f"{ATTENDANCE_SERVICE_URL}/attendance/overtime-report",
                params={"date_from": debut.isoformat(), "date_to": fin.isoformat()},
                timeout=120,
            )
            resp.raise_for_status()
            report = resp.json()
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"Failed to fetch overtime-report: {exc}"))
            return

        overtime = report.get("employees", [])
        if not overtime:
            self.stdout.write("Aucune heure supplémentaire sur la période.")
            return

        device_ids = [o["user_id"] for o in overtime]
        employees = {
            e.device_user_id: e
            for e in Employee.objects.filter(device_user_id__in=device_ids)
            .select_related("department", "factory")
        }
        # Secours : employés sans device_user_id renseigné, retrouvés par matricule
        # (Attendance.user_id = int(employee_id), ex. "006720" → 6720)
        missing = [uid for uid in device_ids if uid not in employees]
        if missing:
            candidates = {str(uid).zfill(6): uid for uid in missing}
            candidates.update({str(uid): uid for uid in missing})
            for e in (Employee.objects.filter(employee_id__in=candidates.keys(), device_user_id__isnull=True)
                      .select_related("department", "factory")):
                employees.setdefault(candidates[e.employee_id], e)

        skipped = []
        by_factory = {}
        factory_objects = {}
        for o in overtime:
            emp = employees.get(o["user_id"])
            if not emp:
                skipped.append((o["user_id"], "no matching Employee (device_user_id)"))
                continue
            if not emp.factory_id:
                skipped.append((o["user_id"], f"{emp.full_name} has no factory assigned"))
                continue
            by_factory.setdefault(emp.factory_id, []).append({
                "full_name":      emp.full_name,
                "employee_id":    emp.employee_id,
                "department":     emp.department.name if emp.department_id else "—",
                "job_title":      str(emp.job_title) if emp.job_title else "",
                "overtime_hours": o["overtime_hours"],
                "overtime_days":  o["overtime_days"],
                "days":           o.get("days", []),
            })
            factory_objects[emp.factory_id] = emp.factory

        if skipped:
            self.stdout.write(self.style.WARNING(f"{len(skipped)} employe(s) ignore(s):"))
            for uid, reason in skipped:
                self.stdout.write(f"  - device_user_id={uid}: {reason}")

        recipients_by_factory = {}
        for a in LateAlertAssignment.objects.filter(is_active=True):
            recipients_by_factory.setdefault(a.factory_id, {"to": [], "cc": []})
            recipients_by_factory[a.factory_id][a.recipient_type].append(a.email)

        sent = 0
        for factory_id, rows in by_factory.items():
            factory = factory_objects[factory_id]
            total = sum(r["overtime_hours"] for r in rows)
            entry = recipients_by_factory.get(factory_id)
            dest = f"to={entry['to']} cc={entry['cc']}" if entry and entry["to"] else "aucun destinataire"
            self.stdout.write(f"  {factory.name} : {len(rows)} employe(s), {format_heures(total)} — {dest}")

            if options["dry_run"] or not entry or not entry["to"]:
                continue
            ok = notify_overtime_report(factory, label, slug, rows,
                                        recipients=entry["to"], cc=entry["cc"])
            if ok:
                sent += 1
            else:
                self.stderr.write(self.style.ERROR(f"Failed to send for {factory.name}"))

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("Dry-run : aucun email envoye."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Synthese HS envoyee pour {sent} site(s)."))