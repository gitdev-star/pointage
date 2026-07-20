from django.db import migrations


FORWARD_SQL = """
CREATE SEQUENCE IF NOT EXISTS employee_id_seq;

CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
    NEW.employee_id := LPAD(nextval('employee_id_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_generate_employee_id ON employees_employee;

CREATE TRIGGER trg_generate_employee_id
BEFORE INSERT ON employees_employee
FOR EACH ROW EXECUTE FUNCTION generate_employee_id();
"""

REVERSE_SQL = """
DROP TRIGGER IF EXISTS trg_generate_employee_id ON employees_employee;
DROP FUNCTION IF EXISTS generate_employee_id();
DROP SEQUENCE IF EXISTS employee_id_seq;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0018_merge_20260719_0022"),
    ]

    operations = [
        migrations.RunSQL(sql=FORWARD_SQL, reverse_sql=REVERSE_SQL),
    ]
