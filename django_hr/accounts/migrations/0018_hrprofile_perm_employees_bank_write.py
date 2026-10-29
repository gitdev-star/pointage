from django.db import migrations, models


class Migration(migrations.Migration):

    # Dépend de 0015 (dernière migration en production) et non de 0017 :
    # le compte bancaire peut ainsi être déployé sans le module Transport.
    dependencies = [
        ('accounts', '0015_hrprofile_perm_classification'),
    ]

    operations = [
        migrations.AddField(
            model_name='hrprofile',
            name='perm_employees_bank_write',
            field=models.BooleanField(default=False),
        ),
    ]