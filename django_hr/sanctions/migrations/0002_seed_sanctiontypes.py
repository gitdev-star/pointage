# =====================================================
# PATH: pointage/django_hr/sanctions/migrations/0002_seed_sanctiontypes.py
# =====================================================
from django.db import migrations

SANCTION_TYPES = [
    {"code": "RAPPEL",       "name": "Rappel à l'ordre",    "level": 1, "color": "#6B7280"},
    {"code": "AVERT_1",      "name": "1ère avertissement",  "level": 2, "color": "#F59E0B"},
    {"code": "AVERT_2",      "name": "2ème avertissement",  "level": 3, "color": "#F97316"},
    {"code": "AVERT_3",      "name": "3ème avertissement",  "level": 4, "color": "#EF4444"},
    {"code": "BLAME",        "name": "Blâme",               "level": 5, "color": "#DC2626"},
    {"code": "MISE_PIED",    "name": "Mises à pied",        "level": 6, "color": "#991B1B"},
    {"code": "LICENCIEMENT", "name": "Licenciement",        "level": 7, "color": "#450A0A"},
]


def seed(apps, schema_editor):
    SanctionType = apps.get_model("sanctions", "SanctionType")
    for row in SANCTION_TYPES:
        SanctionType.objects.update_or_create(
            code=row["code"],
            defaults={
                "name":      row["name"],
                "level":     row["level"],
                "color":     row["color"],
                "is_active": True,
            },
        )


def unseed(apps, schema_editor):
    SanctionType = apps.get_model("sanctions", "SanctionType")
    SanctionType.objects.filter(code__in=[r["code"] for r in SANCTION_TYPES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("sanctions", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, reverse_code=unseed),
    ]
