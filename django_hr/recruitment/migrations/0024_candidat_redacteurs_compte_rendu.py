# Rédacteurs du compte rendu d'entretien cadre, choisis à la
# planification par le responsable recrutement.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0018_hrprofile_perm_employees_bank_write'),
        ('recruitment', '0023_participants_entretien_compte_rendu'),
    ]

    operations = [
        migrations.AddField(
            model_name='candidat',
            name='redacteurs_compte_rendu',
            field=models.ManyToManyField(blank=True, related_name='candidats_compte_rendu', to='accounts.hrprofile'),
        ),
    ]
