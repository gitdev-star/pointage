from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('employees', '0014_poste_job_title'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='workschedule',
            name='work_start',
        ),
        migrations.RemoveField(
            model_name='workschedule',
            name='lunch_start',
        ),
        migrations.RemoveField(
            model_name='workschedule',
            name='lunch_end',
        ),
        migrations.AlterField(
            model_name='employee',
            name='affectation',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='birth_place',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='cin',
            field=models.CharField(blank=True, max_length=100, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='cin_place',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='cnaps',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='contract_type',
            field=models.CharField(blank=True, choices=[('CDI', 'Permanent (CDI)'), ('CDD', 'Fixed Term (CDD)'), ('INTERN', 'Internship'), ('PART', 'Part Time'), ('SEASONAL', 'Seasonal')], default='CDI', max_length=20, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='first_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='hire_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='hk_ou_pbi',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='last_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='matricule_paie',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='motif_depart',
            field=models.CharField(blank=True, max_length=500, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='n_rh',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='phone',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AlterField(
            model_name='employee',
            name='status',
            field=models.CharField(blank=True, choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive'), ('ON_LEAVE', 'On Leave'), ('TERMINATED', 'Terminated')], default='ACTIVE', max_length=20, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, null=True),
        ),
    ]