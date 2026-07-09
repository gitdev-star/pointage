import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_hrprofile_perm_hr_events_read_and_more'),
        ('employees', '0001_initial'),  # <-- adjust: must be a migration that creates Factory & Department
    ]

    operations = [
        migrations.AddField(
            model_name='hrprofile',
            name='factory',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='hr_managers',
                to='employees.factory',
            ),
        ),
        migrations.AddField(
            model_name='hrprofile',
            name='department',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='hr_managers',
                to='employees.department',
            ),
        ),
    ]