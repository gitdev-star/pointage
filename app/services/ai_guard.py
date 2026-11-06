"""Pure helpers for the AI assistant (no framework imports): SQL guard, question router, forecast maths."""
import fnmatch
import os
import re
from datetime import date, timedelta
from statistics import median

import sqlglot
from sqlglot import exp

ALLOWED_VIEWS = {"v_daily", "v_daily_summary", "v_device_daily", "v_anomalies", "v_employees", "v_daily_employee"}
ALLOWED = set(ALLOWED_VIEWS)   # filled from the catalog by configure(); public tables by name, hr_all tables as "hr_all.<name>"
NO_STAR = set()                # tables that have a hidden column: SELECT * is refused on them
DENY_COLS = re.compile(os.environ.get("AI_DENY_COLS", r"(password|passwd|secret|token|comm_?key|api_?key)"), re.I)


def configure(allowed, no_star=()):
    ALLOWED.clear()
    ALLOWED.update(allowed)
    NO_STAR.clear()
    NO_STAR.update(no_star)
DEFAULT_LIMIT = 200
WHOLE_ROW = re.compile(r"\b(row_to_json|to_jsonb?|jsonb?_agg|json_build_object|jsonb_build_object)\s*\(", re.I)
FORBIDDEN = re.compile(r"\bpg_\w+|\bdblink\w*|\blo_\w+|\bset_config\b|\bcurrent_setting\b", re.I)


class GuardError(ValueError):
    pass


def _extract(raw: str) -> str:
    raw = raw or ""
    m = re.search(r"```(?:sql)?\s*(.*?)```", raw, flags=re.I | re.S)
    if m:
        raw = m.group(1)
    else:
        raw = re.sub(r"```(?:sql)?", "", raw, flags=re.I)
    m = re.search(r"\b(with|select)\b", raw, flags=re.I)
    if m:
        raw = raw[m.start():]
    return raw.split(";")[0].strip()


def guard_sql(raw: str, allowed=None, no_star=None, blocked_cols=()) -> str:
    allowed = ALLOWED if allowed is None else allowed
    no_star = NO_STAR if no_star is None else no_star
    sql = _extract(raw)
    if not sql:
        raise GuardError("Le modèle n'a rien renvoyé.")
    if FORBIDDEN.search(sql):
        raise GuardError("Fonction non autorisée dans la requête.")
    try:
        trees = sqlglot.parse(sql, read="postgres")
    except sqlglot.errors.SqlglotError:
        raise GuardError("Le modèle a produit un SQL invalide.")
    if len(trees) != 1 or not isinstance(trees[0], exp.Select):
        raise GuardError("Seule une requête SELECT unique est autorisée.")
    tree = trees[0]
    if tree.args.get("into") or tree.args.get("locks"):
        raise GuardError("Requête non autorisée.")
    tables = list(tree.find_all(exp.Table))
    ctes = {c.alias_or_name for c in tree.find_all(exp.CTE)}
    refs = set()
    for t in tables:
        if t.catalog or (t.db and t.db != "hr_all"):
            raise GuardError("Schéma non autorisé : utilisez les tables listées (hr_all.<table> pour les tables RH).")
        if t.db:
            refs.add(f"{t.db}.{t.name}")
        elif t.name not in ctes:
            refs.add(t.name)
    bad = refs - allowed
    if not refs or bad:
        err = GuardError("Table non autorisée : " + ", ".join(sorted(bad or {"?"})) + ". Écrivez hr_all.<table> pour les tables RH.")
        err.tables = set(bad)
        raise err
    if any(DENY_COLS.search(c.name or "") for c in tree.find_all(exp.Column)):
        raise GuardError("Colonne non autorisée.")
    if blocked_cols:
        low = [p.lower() for p in blocked_cols]
        cols_ = list(tree.find_all(exp.Column))
        names = {(t.alias_or_name or "").lower() for t in tables}
        hit = (any(fnmatch.fnmatchcase((c.name or "").lower(), p) for c in cols_ for p in low)
               or WHOLE_ROW.search(sql)
               or any(not c.table and (c.name or "").lower() in names for c in cols_))
        if hit:
            err = GuardError("Colonne non autorisée.")
            err.blocked_col = True
            raise err
    if refs & no_star and any(not isinstance(s.parent, exp.Count) for s in tree.find_all(exp.Star)):
        raise GuardError("N'utilisez pas * sur cette table : listez les colonnes.")
    if not tree.args.get("limit"):
        tree = tree.limit(DEFAULT_LIMIT)
    return tree.sql(dialect="postgres")


FORECAST_RE = re.compile(r"pr[ée]vi|pr[ée]dic|forecast|predict|projection|prochains? jours|semaine prochaine|next (week|days)", re.I)
ANOMALY_RE = re.compile(r"anomal|inhabituel|suspect|unusual|abnormal", re.I)


GREETING_RE = re.compile(r"^\s*(bonjour|bonsoir|salut|coucou|hello|hi|hey|howdy|greetings|good\s+(morning|afternoon|evening|day)|salama|manahoana|bonne\s+(journ[ée]e|soir[ée]e))(\s+(à\s+tous|tout\s+le\s+monde|everyone|all|there))?\s*[!.?]*\s*$", re.I)


def intent(question: str) -> str:
    if GREETING_RE.match(question):
        return "greeting"
    if FORECAST_RE.search(question):
        return "forecast"
    if ANOMALY_RE.search(question):
        return "anomaly"
    return "sql"


def next_workdays(start: date, n: int) -> list:
    out, d = [], start
    while len(out) < n:
        d += timedelta(days=1)
        if d.weekday() < 5:
            out.append(d)
    return out


def forecast(rows, today: date, horizon: int = 5):
    """rows: (date, present, late, overtime_hours) for weekdays before `today`.
    late = mean of the last 5 normal working days (best method in your walk-forward test)
    overtime = same weekday last week (naive baseline), fallback: mean of the last 5 normal days."""
    rows = sorted((r for r in rows if r[1]), key=lambda r: r[0])
    if len(rows) < 10:
        return None
    med_p = median(r[1] for r in rows)
    lates = [r[2] for r in rows]
    med_l = median(lates)
    mad = max(median(abs(x - med_l) for x in lates) * 1.4826, 1.0, 0.02 * med_l)
    ok = [r for r in rows if r[1] >= 0.5 * med_p and r[2] / r[1] <= 0.25 and abs(r[2] - med_l) / mad <= 6]
    if len(ok) < 5:
        return None
    late_base = sum(r[2] for r in ok[-5:]) / 5
    ot_mean = sum(float(r[3]) for r in ok[-5:]) / 5
    ot_by_date = {r[0]: float(r[3]) for r in ok}
    out = []
    for d in next_workdays(today, horizon):
        out.append({"date": d.isoformat(), "late_forecast": round(late_base),
                    "overtime_hours_forecast": round(ot_by_date.get(d - timedelta(days=7), ot_mean), 1)})
    return {"rows": out, "days_used": len(ok), "days_removed": len(rows) - len(ok)}
