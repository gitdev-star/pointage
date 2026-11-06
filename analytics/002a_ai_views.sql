-- Run as the application user (owner of the tables). No special privilege needed.
-- psql -h 192.168.8.212 -U user -d attendance -v ON_ERROR_STOP=1 -1 -f analytics/002a_ai_views.sql
CREATE OR REPLACE VIEW v_daily AS
WITH d AS (
  SELECT user_id, date, min(device_timestamp) AS f, max(device_timestamp) AS l, count(*) AS punches
  FROM attendance WHERE device_timestamp IS NOT NULL GROUP BY user_id, date),
a AS (
  SELECT user_id, date, punches,
         CASE WHEN f = l THEN (CASE WHEN f::time <  '12:00' THEN f END) ELSE f END AS arrival,
         CASE WHEN f = l THEN (CASE WHEN f::time >= '12:00' THEN f END) ELSE l END AS departure
  FROM d),
s AS (
  SELECT *, CASE WHEN arrival > date + time '07:30' THEN arrival + interval '9 hours'
                 ELSE date + time '16:30' END AS std_end
  FROM a)
SELECT user_id, date, arrival, departure, punches,
       COALESCE(arrival >= date + time '07:37', false) AS is_late,
       CASE WHEN arrival IS NOT NULL AND departure IS NOT NULL
                 AND departure >= std_end + interval '29 minutes'
            THEN round((extract(epoch FROM departure - std_end) / 3600.0)::numeric, 2)
            ELSE 0 END AS overtime_hours
FROM s;

CREATE OR REPLACE VIEW v_daily_summary AS
SELECT date, count(*) AS present, count(*) FILTER (WHERE is_late) AS late,
       coalesce(sum(overtime_hours), 0) AS overtime_hours
FROM v_daily GROUP BY date;

CREATE OR REPLACE VIEW v_device_daily AS
SELECT device_ip, date, count(*) AS punches, count(DISTINCT user_id) AS employees
FROM attendance WHERE device_timestamp IS NOT NULL GROUP BY device_ip, date;

CREATE OR REPLACE VIEW v_anomalies AS
SELECT insight_date, rule, severity, scope_type, scope_value, title, message, status
FROM insights WHERE kind = 'anomaly';

CREATE TABLE IF NOT EXISTS ai_audit (
  id bigserial PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(),
  username text, question text, kind text, sql text, ms int, error text);
