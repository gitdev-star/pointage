from django.db import migrations, models


def convertir_statuts(apps, schema_editor):
    Processus = apps.get_model("recruitment", "ProcessusRecrutement")
    Processus.objects.filter(statut="TERMINE").update(statut="CLOTURE")
    Processus.objects.filter(statut="EN_COURS", etapes_terminees=[]).update(
        statut="PAS_COMMENCE"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("recruitment", "0019_demanderecrutement_remarque"),
    ]

    operations = [
        migrations.AddField(
            model_name="processusrecrutement",
            name="date_pause",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="processusrecrutement",
            name="motif_pause",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="processusrecrutement",
            name="statut",
            field=models.CharField(
                choices=[
                    ("PAS_COMMENCE", "Pas commencé"),
                    ("EN_COURS", "En cours"),
                    ("EN_PAUSE", "En pause"),
                    ("CLOTURE", "Clôturé"),
                    ("RELANCE_DESISTEMENT", "Relancé suite à un désistement"),
                ],
                default="PAS_COMMENCE",
                max_length=30,
            ),
        ),
        migrations.RunPython(convertir_statuts, migrations.RunPython.noop),
    ]
