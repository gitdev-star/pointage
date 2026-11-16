# CV du candidat cadre, joint à la planification de l'entretien.

from django.db import migrations, models

import recruitment.models


class Migration(migrations.Migration):

    dependencies = [
        ('recruitment', '0024_candidat_redacteurs_compte_rendu'),
    ]

    operations = [
        migrations.AddField(
            model_name='candidat',
            name='cv',
            field=models.FileField(blank=True, null=True, upload_to=recruitment.models.chemin_cv_candidat),
        ),
        migrations.AddField(
            model_name='candidat',
            name='cv_nom_original',
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
