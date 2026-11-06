CREATE OR REPLACE VIEW public.v_daily_site AS
WITH p AS (
  SELECT a.user_id, a.date,
         g.name AS site_name,
         split_part(g.name, ' ', 1) AS site,
         min(a.device_timestamp) AS first_punch,
         max(a.device_timestamp) AS last_punch,
         count(*) AS punches_site
  FROM attendance a
  JOIN devices_clocker c ON host(c.ip_address) = host(a.device_ip::inet)
  JOIN devices_clocker_group g ON g.id = c.group_id
  WHERE a.device_timestamp IS NOT NULL
  GROUP BY a.user_id, a.date, g.name
)
SELECT p.user_id, e.employee_id, e.full_name, p.date,
       p.site, p.site_name, p.first_punch, p.last_punch, p.punches_site,
       d.arrival, d.departure, d.is_late, d.overtime_hours,
       e.section_name, e.department_name, e.factory_name
FROM p
LEFT JOIN v_daily d ON d.user_id = p.user_id AND d.date = p.date
LEFT JOIN v_employees e ON e.user_id = p.user_id;

GRANT SELECT ON public.v_daily_site TO ai_ro;
