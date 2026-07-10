from django.db import migrations


class Migration(migrations.Migration):

    initial = True
    dependencies = []

    # Must exist before employees.0010 issues its first FK to classification(id)
    run_before = [
        ("employees", "0010_classification_alter_employee_classification"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS classification (
                    id BIGINT PRIMARY KEY,
                    id_classification SERIAL UNIQUE,
                    classe VARCHAR(50) UNIQUE,
                    salaire NUMERIC(10, 2) NOT NULL DEFAULT 0
                );
            """,
            reverse_sql="DROP TABLE IF EXISTS classification;",
        ),
    ]