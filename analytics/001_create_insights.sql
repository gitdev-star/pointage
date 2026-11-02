CREATE TABLE IF NOT EXISTS insights (
    id           bigserial PRIMARY KEY,
    insight_date date        NOT NULL,
    kind         text        NOT NULL,
    rule         text        NOT NULL,
    severity     text        NOT NULL DEFAULT 'info',
    scope_type   text        NOT NULL DEFAULT 'global',
    scope_value  text        NOT NULL DEFAULT '',
    title        text        NOT NULL,
    message      text        NOT NULL,
    payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    status       text        NOT NULL DEFAULT 'new',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT insights_severity_chk CHECK (severity IN ('info','warning','critical')),
    CONSTRAINT insights_status_chk CHECK (status IN ('new','seen','resolved','false_positive')),
    CONSTRAINT insights_uniq UNIQUE (insight_date, kind, rule, scope_type, scope_value)
);
CREATE INDEX IF NOT EXISTS insights_date_idx ON insights (insight_date, severity);
CREATE INDEX IF NOT EXISTS insights_status_idx ON insights (status);
