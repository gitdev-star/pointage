from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ("testsupport", "0002_shadow_poste"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE SEQUENCE IF NOT EXISTS classification_id_seq OWNED BY classification.id;
                ALTER TABLE classification ALTER COLUMN id SET DEFAULT nextval('classification_id_seq');
                SELECT setval(
                    'classification_id_seq',
                    COALESCE((SELECT MAX(id) FROM classification), 0) + 1,
                    false
                );
            """,
            reverse_sql="""
                ALTER TABLE classification ALTER COLUMN id DROP DEFAULT;
                DROP SEQUENCE IF EXISTS classification_id_seq;
            """,
        ),
    ]
