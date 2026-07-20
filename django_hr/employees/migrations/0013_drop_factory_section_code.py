from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('employees', '0012_remove_code_fields'),
    ]

    operations = [
        # Step 1: restore 'code' to Django's state only (it's still physically
        # present in the DB from before 0012, which was state-only).
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name='factory',
                    name='code',
                    field=models.CharField(max_length=50, unique=True, null=True, blank=True),
                ),
                migrations.AddField(
                    model_name='section',
                    name='code',
                    field=models.CharField(max_length=50, unique=True, null=True, blank=True),
                ),
                migrations.AddField(
                    model_name='department',
                    name='code',
                    field=models.CharField(max_length=50, unique=True, null=True, blank=True),
                ),
            ],
        ),
        # Step 2: now that state knows about 'code', a normal RemoveField
        # handles both state and DB correctly on every backend, including
        # SQLite's table-rebuild for unique columns.
        migrations.RemoveField(model_name='factory', name='code'),
        migrations.RemoveField(model_name='section', name='code'),
        migrations.RemoveField(model_name='department', name='code'),
    ]
