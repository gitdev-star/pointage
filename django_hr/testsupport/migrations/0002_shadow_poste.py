from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("testsupport", "0001_shadow_classification"),
    ]

    run_before = [
        ("employees", "0014_poste_job_title"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS poste (
                    id BIGSERIAL PRIMARY KEY,
                    name VARCHAR(150) UNIQUE NOT NULL,
                    description TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
                );
            """,
            reverse_sql="DROP TABLE IF EXISTS poste;",
        ),
    ]
