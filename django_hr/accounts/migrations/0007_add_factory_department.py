from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_hrprofile_perm_hr_events_read_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE accounts_hrprofile ADD COLUMN IF NOT EXISTS factory_id integer NULL, ADD COLUMN IF NOT EXISTS department_id integer NULL;",
            reverse_sql="ALTER TABLE accounts_hrprofile DROP COLUMN IF EXISTS factory_id, DROP COLUMN IF EXISTS department_id;"
        ),
    ]
