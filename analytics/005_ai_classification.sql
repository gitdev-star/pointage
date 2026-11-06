-- Run as postgres on the attendance database.
-- Needs: v_daily, v_employees, and the hr_all foreign schema (pointing to the real hr_db).
CREATE TABLE IF NOT EXISTS public.classification_group (
  classe     varchar(50) PRIMARY KEY,
  group_name varchar(50) NOT NULL
);
INSERT INTO public.classification_group (classe, group_name) VALUES
  ('HC','Cadres'),
  ('M1','Ouvriers'),('1A','Ouvriers'),('M2','Ouvriers'),('1B','Ouvriers'),
  ('OS1','Ouvriers'),('2A','Ouvriers'),('OS2','Ouvriers'),('2B','Ouvriers'),
  ('OS3','Ouvriers'),('3A','Ouvriers'),('A3','Ouvriers'),('OP1A','Ouvriers'),
  ('3B','Ouvriers'),('OP1B','Ouvriers'),('4A','Ouvriers'),('OP2A','Ouvriers'),
  ('4B','Ouvriers'),('OP2B','Ouvriers'),('5A','Ouvriers'),('OP3','Ouvriers'),('5B','Ouvriers')
ON CONFLICT (classe) DO UPDATE SET group_name = EXCLUDED.group_name;

CREATE OR REPLACE VIEW public.v_daily_class AS
SELECT d.user_id, e.employee_id, e.full_name, d.date,
       d.arrival, d.departure, d.is_late, d.overtime_hours,
       c.classe AS classification,
       e.section_name, e.department_name, e.factory_name,
       g.group_name AS classification_group
FROM v_daily d
LEFT JOIN v_employees e ON e.user_id = d.user_id
LEFT JOIN hr_all.employees_employee ee ON ee.device_user_id = d.user_id
LEFT JOIN hr_all.classification c ON c.id_classification = ee.classification_id
LEFT JOIN public.classification_group g ON g.classe = upper(trim(c.classe));

ALTER TABLE public.classification_group OWNER TO "user";
ALTER VIEW  public.v_daily_class        OWNER TO "user";
-- GRANT SELECT ON public.v_daily_class TO <ai_role>;   -- use the role created in 002b
