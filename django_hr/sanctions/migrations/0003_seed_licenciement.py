from django.db import migrations

def seed_licenciement(apps, schema_editor):
    SanctionType = apps.get_model('sanctions', 'SanctionType')
    # Update existing OR create — handles both name and code duplicates
    obj = SanctionType.objects.filter(code='LICENCIEMENT').first() \
       or SanctionType.objects.filter(name__icontains='licenci').first()
    if obj:
        obj.code     = 'LICENCIEMENT'
        obj.name     = 'Licenciement'
        obj.level    = 5
        obj.color    = '#DC2626'
        obj.is_active = True
        obj.save()
    else:
        SanctionType.objects.create(
            code='LICENCIEMENT',
            name='Licenciement',
            level=5,
            color='#DC2626',
            is_active=True,
        )

def reverse_seed(apps, schema_editor):
    pass  # never delete — it's a system type

class Migration(migrations.Migration):

    dependencies = [
        ('sanctions', '0002_seed_sanctiontypes'),
    ]

    operations = [
        migrations.RunPython(seed_licenciement, reverse_seed),
    ]
