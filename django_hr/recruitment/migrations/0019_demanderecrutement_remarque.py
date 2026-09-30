from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("recruitment", "0018_ajouter_fiche_renseignements"),
    ]

    operations = [
        migrations.AddField(
            model_name="demanderecrutement",
            name="remarque",
            field=models.TextField(blank=True, default=""),
        ),
    ]
