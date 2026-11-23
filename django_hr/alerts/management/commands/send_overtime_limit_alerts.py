# django_hr/alerts/management/commands/send_overtime_limit_alerts.py
import os
import re
from collections import defaultdict
from datetime import date, timedelta

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from employees.models import Employee
from alerts.email_utils import MONTH_NAMES_FR
from alerts.models import OvertimeLimitAssignment, OvertimeLimitAlertState
from alerts.overtime_email import format_heures, notify_overtime_limit_exceeded

ATTENDANCE_SERVICE_URL = os.environ.get("ATTENDANCE_SERVICE_URL", "http://fastapi:8080")


def _full_name(emp):
    name = getattr(emp, "full_name", None)
    if name:
        return str(name)
    parts = [getattr(emp, "first_name", ""), getattr(emp, "last_name", "")]
    return " ".join(p for p in parts if p).strip() or str(emp)


def _label(value):
    return str(value) if value not in (None, "") else "-"


def _norm(v):
    """Badge normalisé : '007073' et 7073 -> '7073'."""
    t = str(v).strip()
    return t.lstrip("0") or "0"


def _site_key(name):
    """'PBI1 (Itaosy)' -> 'PBI1' ; 'pbi1' -> 'PBI1' ; vide -> ''."""
    if not name:
        return ""
    m = re.match(r"\s*([^\s(]+)", str(name))
    return m.group(1).upper() if m else ""


class Command(BaseCommand):
    help = ("Alerte plafond d'heures supplémentaires : 1 mail global (tous les sites) "
            "vers les destinataires sans site, et 1 mail par groupe de pointeuses vers "
            "les responsables de ce site uniquement. Une seule fois par employé et par mois.")

    def add_arguments(self, parser):
        parser.add_argument("--date", default=None,
                            help="Date de référence AAAA-MM-JJ (défaut : aujourd'hui)")
        parser.add_argument("--limit", type=float, default=None,
                            help="Plafond en heures (défaut : settings.OVERTIME_LIMIT_HOURS)")
        parser.add_argument("--dry-run", action="store_true",
                            help="Affiche sans envoyer ni mémoriser")
        parser.add_argument("--test-to", default="",
                            help="Test : envoie tous les mails uniquement à ces adresses "
                                 "(séparées par des virgules), sans mémoriser les employés")
        parser.add_argument("--no-save", action="store_true",
                            help="Envoie réellement aux destinataires configurés, sujet [TEST], "
                                 "sans mémoriser les employés")

    def handle(self, *args, **options):
        limit = options["limit"] or settings.OVERTIME_LIMIT_HOURS
        normal = settings.OVERTIME_NORMAL_HOURS
        dry = options["dry_run"]
        no_save = options["no_save"]
        test_to = [e.strip() for e in (options["test_to"] or "").split(",") if e.strip()]

        if options["date"]:
            try:
                today = date.fromisoformat(options["date"])
            except ValueError:
                raise CommandError("--date doit être au format AAAA-MM-JJ")
        else:
            today = timezone.localdate()

        fin = today - timedelta(days=1)
        debut = fin.replace(day=1)
        period = f"{fin.year}-{fin.month:02d}"
        label = f"{MONTH_NAMES_FR[fin.month].lower()} {fin.year}"
        self.stdout.write(f"Plafond HS {format_heures(limit)} — {label} ({debut} → {fin})")

        try:
            resp = requests.get(
                f"{ATTENDANCE_SERVICE_URL}/attendance/overtime-report",
                params={"date_from": debut.isoformat(), "date_to": fin.isoformat()},
                timeout=120,
            )
            resp.raise_for_status()
            overtime = resp.json().get("employees", [])
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"Failed to fetch overtime-report: {exc}"))
            return

        over = [o for o in overtime if o["overtime_hours"] > limit]
        if not over:
            self.stdout.write("Personne n'a atteint le plafond.")
            return

        emps = Employee.objects.filter(status="ACTIVE").select_related("factory")
        by_badge = {}
        for e in emps:
            by_badge[_norm(e.employee_id)] = e
            if getattr(e, "device_user_id", None):
                by_badge.setdefault(_norm(e.device_user_id), e)

        rows_all = []
        for o in over:
            uid = str(o.get("user_id", o.get("device_user_id", "")))
            emp = by_badge.get(_norm(uid))
            if emp is None:
                self.stdout.write(f"  badge={uid} : ignoré (inactif ou sans fiche)")
                continue
            if OvertimeLimitAlertState.objects.filter(employee=emp, period=period).exists():
                continue
            group_name = o.get("clocker_group") or ""
            rows_all.append({
                "full_name": _full_name(emp),
                "last_name": str(getattr(emp, "last_name", "") or ""),
                "first_name": str(getattr(emp, "first_name", "") or ""),
                "employee_id": emp.employee_id,
                "factory": group_name or _label(getattr(emp, "factory", "")),
                "department": _label(getattr(emp, "department", "")),
                "section": _label(getattr(emp, "section", "")),
                "overtime_hours": o["overtime_hours"],
                "group_key": _site_key(group_name),
                "emp": emp,
            })

        if not rows_all:
            self.stdout.write("Aucun employé actif à notifier (non appariés, inactifs ou déjà notifiés).")
            return

        # Un seul envoi par jour (les dry-run et tests ne comptent pas)
        if not (dry or test_to or no_save) and OvertimeLimitAlertState.objects.filter(
                notified_at__date=timezone.localdate()).exists():
            self.stdout.write("Un envoi a déjà eu lieu aujourd'hui : un seul mail par jour, rien envoyé.")
            return

        assignments = list(OvertimeLimitAssignment.objects.filter(is_active=True))
        global_rcpt = test_to or sorted({a.email for a in assignments if not a.factory.strip()})

        by_group = defaultdict(list)
        for r in rows_all:
            by_group[r["group_key"] or "-"].append(r)

        ok_all = defaultdict(lambda: True)   # employee pk -> tous ses mails sont partis
        has_mail = defaultdict(bool)         # employee pk -> au moins un mail le concerne

        def send(scope, rows, rcpts):
            names = ", ".join(f"{r['full_name']} ({format_heures(r['overtime_hours'])})" for r in rows)
            self.stdout.write(f"[{scope}] {len(rows)} employé(s) : {names}")
            self.stdout.write(f"[{scope}] -> {', '.join(rcpts)}")
            for r in rows:
                has_mail[r["emp"].pk] = True
            if dry:
                return
            ok = notify_overtime_limit_exceeded(label, normal, limit, rows, rcpts,
                                                scope=scope + (" [TEST]" if (test_to or no_save) else ""))
            if not ok:
                self.stderr.write(self.style.ERROR(f"[{scope}] échec d'envoi"))
                for r in rows:
                    ok_all[r["emp"].pk] = False

        # 1 mail global
        if global_rcpt:
            send("tous les sites", rows_all, global_rcpt)
        else:
            self.stdout.write(self.style.WARNING("Aucun destinataire global actif."))

        # 1 mail par site, uniquement pour ses responsables
        for key, rows in sorted(by_group.items()):
            if key == "-":
                continue
            rcpts = test_to or sorted({a.email for a in assignments if _site_key(a.factory) == key})
            scope = rows[0]["factory"]
            if not rcpts:
                self.stdout.write(self.style.WARNING(f"[{scope}] aucun responsable actif pour {key}"))
                continue
            send(scope, rows, rcpts)

        if dry or test_to or no_save:
            self.stdout.write("Dry-run ou test : employés NON marqués comme notifiés.")
            return

        total = 0
        for r in rows_all:
            pk = r["emp"].pk
            if has_mail[pk] and ok_all[pk]:
                OvertimeLimitAlertState.objects.get_or_create(
                    employee=r["emp"], period=period,
                    defaults={"hours": r["overtime_hours"]},
                )
                total += 1
        self.stdout.write(self.style.SUCCESS(f"{total} employé(s) marqué(s) comme notifiés."))
