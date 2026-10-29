# django_hr/alerts/management/commands/send_bank_account_report.py
from django.core.management.base import BaseCommand

from employees.models import Employee
from alerts.bank_account_email import bank_account_recipients, notify_bank_account_opening

STATUTS_FR = {"ACTIVE": "Actif", "ON_LEAVE": "En congé"}


class Command(BaseCommand):
    help = ("Envoie la liste des employés (actifs ou en congé) dont le compte bancaire "
            "est « Ouverture ». Prévu du lundi au vendredi à 8 h.")

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Affiche la liste sans envoyer d'email",
        )

    def handle(self, *args, **options):
        employees = (
            Employee.objects
            .filter(compte_bancaire=Employee.CompteBancaire.OUVERTURE,
                    status__in=[Employee.Status.ACTIVE, Employee.Status.ON_LEAVE])
            .select_related("factory", "department", "job_title")
            .order_by("factory__name", "last_name", "first_name")
        )
        rows = [{
            "full_name":   emp.full_name,
            "employee_id": emp.employee_id,
            "factory":     emp.factory.name if emp.factory_id else "—",
            "department":  emp.department.name if emp.department_id else "—",
            "job_title":   str(emp.job_title) if emp.job_title_id else "—",
            "hire_date":   emp.hire_date.strftime("%d/%m/%Y") if emp.hire_date else "—",
            "status":      STATUTS_FR.get(emp.status, emp.status),
        } for emp in employees]

        if not rows:
            self.stdout.write("Aucun compte bancaire en ouverture : pas d'envoi.")
            return

        recipients = bank_account_recipients()
        self.stdout.write(f"{len(rows)} employe(s) en ouverture — destinataires : {recipients or 'aucun'}")
        for r in rows:
            self.stdout.write(f"  - {r['full_name']} ({r['employee_id']}) {r['factory']} / {r['department']}")

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("Dry-run : aucun email envoye."))
            return
        if not recipients:
            self.stderr.write(self.style.ERROR(
                "EMPLOYEE_CREATED_NOTIFICATION_EMAILS est vide : aucun destinataire, pas d'envoi."
            ))
            return

        if notify_bank_account_opening(rows, recipients):
            self.stdout.write(self.style.SUCCESS(f"Liste envoyee a {len(recipients)} destinataire(s)."))
        else:
            self.stderr.write(self.style.ERROR("Echec de l'envoi."))