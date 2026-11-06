-- Run by a PostgreSQL administrator (a role with CREATEROLE, e.g. postgres), AFTER 002a.
-- psql -h 192.168.8.212 -U postgres -d attendance -v ON_ERROR_STOP=1 -v aipw='CHOOSE_A_PASSWORD' -f 002b_ai_role.sql
CREATE ROLE ai_ro LOGIN PASSWORD :'aipw';
GRANT CONNECT ON DATABASE attendance TO ai_ro;
GRANT USAGE ON SCHEMA public TO ai_ro;
GRANT SELECT ON v_daily, v_daily_summary, v_device_daily, v_anomalies TO ai_ro;
ALTER ROLE ai_ro SET statement_timeout = '5s';
ALTER ROLE ai_ro SET default_transaction_read_only = on;
