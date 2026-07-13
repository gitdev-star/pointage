from django.db import migrations


def create_classification_table(apps, schema_editor):
    if schema_editor.connection.vendor == "sqlite":
        schema_editor.execute("""
            CREATE TABLE IF NOT EXISTS classification (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_classification INTEGER UNIQUE,
                classe VARCHAR(50) UNIQUE NOT NULL,
                salaire DECIMAL(10, 2) NOT NULL DEFAULT 0
            );
        """)
    else:
        schema_editor.execute("""
            CREATE TABLE IF NOT EXISTS classification (
                id BIGINT PRIMARY KEY,
                id_classification SERIAL UNIQUE,
                classe VARCHAR(50) UNIQUE,
                salaire NUMERIC(10, 2) NOT NULL DEFAULT 0
            );
        """)


def drop_classification_table(apps, schema_editor):
    schema_editor.execute("DROP TABLE IF EXISTS classification;")


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    # Must exist before employees.0010 issues its first FK to classification(id)
    run_before = [
        ("employees", "0010_classification_alter_employee_classification"),
    ]
    operations = [
        migrations.RunPython(create_classification_table, drop_classification_table),
    ]
