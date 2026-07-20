from django.db import migrations


def set_classification_id_default(apps, schema_editor):
    if schema_editor.connection.vendor == "sqlite":
        # No-op: 0001 already defines id as INTEGER PRIMARY KEY AUTOINCREMENT
        # under SQLite, so there's no separate sequence to retrofit here.
        return
    schema_editor.execute("""
        CREATE SEQUENCE IF NOT EXISTS classification_id_seq OWNED BY classification.id;
        ALTER TABLE classification ALTER COLUMN id SET DEFAULT nextval('classification_id_seq');
        SELECT setval(
            'classification_id_seq',
            COALESCE((SELECT MAX(id) FROM classification), 0) + 1,
            false
        );
    """)


def unset_classification_id_default(apps, schema_editor):
    if schema_editor.connection.vendor == "sqlite":
        return
    schema_editor.execute("""
        ALTER TABLE classification ALTER COLUMN id DROP DEFAULT;
        DROP SEQUENCE IF EXISTS classification_id_seq;
    """)


class Migration(migrations.Migration):
    dependencies = [
        ("testsupport", "0002_shadow_poste"),
    ]
    operations = [
        migrations.RunPython(set_classification_id_default, unset_classification_id_default),
    ]
