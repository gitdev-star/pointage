from django.db import migrations


def create_poste_table(apps, schema_editor):
    if schema_editor.connection.vendor == "sqlite":
        schema_editor.execute("""
            CREATE TABLE IF NOT EXISTS poste (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(150) UNIQUE NOT NULL,
                description TEXT,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """)
    else:
        schema_editor.execute("""
            CREATE TABLE IF NOT EXISTS poste (
                id BIGSERIAL PRIMARY KEY,
                name VARCHAR(150) UNIQUE NOT NULL,
                description TEXT,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            );
        """)


def drop_poste_table(apps, schema_editor):
    schema_editor.execute("DROP TABLE IF EXISTS poste;")


class Migration(migrations.Migration):
    dependencies = [
        ("testsupport", "0001_shadow_classification"),
    ]
    run_before = [
        ("employees", "0014_poste_job_title"),
    ]
    operations = [
        migrations.RunPython(create_poste_table, drop_poste_table),
    ]
