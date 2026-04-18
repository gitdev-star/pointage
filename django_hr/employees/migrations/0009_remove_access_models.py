from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('employees', '0008_accesstimeslot_accesszone_employeeaccessrule'),
    ]

    operations = [
        migrations.DeleteModel(name='EmployeeAccessRule'),
        migrations.DeleteModel(name='AccessTimeSlot'),
        migrations.DeleteModel(name='AccessZone'),
    ]
