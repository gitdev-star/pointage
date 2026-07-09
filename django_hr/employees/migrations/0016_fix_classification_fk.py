from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('employees', '0015_workschedule_and_employee_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RenameField(
                    model_name='classification',
                    old_name='id',
                    new_name='id_classification',
                ),
                migrations.RenameField(
                    model_name='classification',
                    old_name='name',
                    new_name='classe',
                ),
                migrations.AddField(
                    model_name='classification',
                    name='salaire',
                    field=models.DecimalField(max_digits=10, decimal_places=2, default=0),
                    preserve_default=False,
                ),
            ],
        ),
        migrations.RemoveField(
            model_name='employee',
            name='classification',
        ),
        migrations.AddField(
            model_name='employee',
            name='classification',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='employees',
                to='employees.classification',
                to_field='id_classification',
            ),
        ),
    ]
