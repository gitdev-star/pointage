# leaves/management/commands/seed_leave_types.py
#if leaves_leavetype ever gets wiped (superuser TRUNCATE/DELETE, DB restore gone wrong, whatever), you run:
#python manage.py seed_leave_types



from django.core.management.base import BaseCommand
from leaves.models import LeaveType, PROTECTED_LEAVE_CODES

LEAVE_TYPES = [
    # code, name, days_per_year, is_paid, requires_document, color
    ("ABS", "ABSENCE SANS MOTIF",            0.0, False, False, "#32c855"),
    ("DP",  "DISPONIBILITE",                 0.0, False, False, "#fd810d"),
    ("EDU", "EDUCATION",                     0.0, True,  False, "#3B82F6"),
    ("PEJ", "PERMISSION EN JOUR",            0.0, False, False, "#3B82F6"),
    ("PM",  "PERMISSION EN HEURE",           0.0, True,  False, "#088ff7"),
    ("FCD", "FIN CDD",                       0.0, False, False, "#8c21e4"),
    ("ENC", "ESSAI NON CONCLUANT",           0.0, False, False, "#876875"),
    ("FON", "FONCTION",                      0.0, False, False, "#b5835a"),
    ("ADP", "ABANDON DE POSTE",              0.0, False, False, "#3B82F6"),
    ("MP",  "MIS A PIED",                    0.0, False, True,  "#f54d66"),
    ("AJT", "ATTENTE JUGEMENT DU TRIBUNAL",  0.0, False, True,  "#27d37a"),
    ("DPP", "DROIT DE PREAVIS",              0.0, True,  False, "#aca53e"),
    ("PEF", "Permission événement familial", 0.0, True,  False, "#FCD34D"),
    ("ACT", "Accident de travail",           0.0, True,  True,  "#B91C1C"),
    ("HP",  "HOSPITALISATION",               0.0, True,  True,  "#12e23c"),
    ("INP", "INAPTE",                        0.0, False, True,  "#c2ec18"),
    ("LIC", "LICENCIEMENT",                  0.0, False, True,  "#6e5d89"),
    ("DEM", "DEMISSION",                     0.0, False, True,  "#3B82F6"),
    ("PAT", "Congé de paternité",            0.0, True,  True,  "#0891B2"),
    ("PRM", "PRESENCE MATERNELLE",           0.0, True,  False, "#3B82F6"),
    ("REM", "REPOS MEDICAL",                 0.0, True,  True,  "#203a65"),
    ("CD",  "CONGE",                         30.0, True,  False, "#0fe1f0"),
]

class Command(BaseCommand):
    help = "Recreate all LeaveType rows if the table was wiped (idempotent)."

    def handle(self, *args, **options):
        for code, name, days, paid, doc, color in LEAVE_TYPES:
            obj, created = LeaveType.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "days_per_year": days,
                    "is_paid": paid,
                    "requires_document": doc,
                    "color": color,
                    "is_active": True,
                    "is_protected": code in PROTECTED_LEAVE_CODES,
                },
            )
            action = "Créé" if created else "Mis à jour"
            self.stdout.write(f"{action}: {code} — {name}")