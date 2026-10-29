from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('employees', '0019_cantinelist_cantinelistitem'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='compte_bancaire',
            field=models.CharField(
                blank=True, null=True, max_length=20,
                choices=[('RIB', 'RIB'), ('OUVERTURE', 'Ouverture')],
            ),
        ),
    ]