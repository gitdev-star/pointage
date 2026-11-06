"""AI assistant: forecast / anomalies in Python, everything else = Ollama writes a SELECT on 4 read-only views."""
import asyncio
import fnmatch
import hashlib
import json
from contextvars import ContextVar
import logging
import os
import re
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import create_async_engine

from app.services.ai_guard import DENY_COLS, GuardError, configure, forecast, guard_sql, intent
from app.services.ai_llm import explain, generate

from app.auth.django_auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://192.168.8.190:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "omnisql32b")
OLLAMA_TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT", "120"))
OLLAMA_NUM_PREDICT = int(os.environ.get("OLLAMA_NUM_PREDICT", "250"))
TZ = ZoneInfo("Indian/Antananarivo")
MAX_ROWS, MAX_WAITING = 500, 4

PROMPT_BASE = """You are a PostgreSQL expert for an HR attendance database. Reply with ONE read-only SELECT query and nothing else: no explanation, no markdown.
Use only the tables listed below; columns that are not listed do not exist. Tables of schema public are written without a schema; tables of schema hr_all must be written hr_all.<table>.
End the query with LIMIT 200 unless the user asks for a specific number of rows."""
PROMPT_HEAD = PROMPT_BASE

ANOMALY_SQL = """SELECT insight_date AS date, severity, scope_type, scope_value, message, status
FROM v_anomalies WHERE insight_date >= current_date - 14 AND status <> 'false_positive'
ORDER BY insight_date DESC, CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END LIMIT 100"""
FORECAST_SQL = """SELECT date, present, late, overtime_hours FROM v_daily_summary
WHERE date < :today AND date >= :since AND extract(isodow FROM date) < 6 ORDER BY date"""

_llm_lock = asyncio.Semaphore(1)      # the Ollama server is CPU-only: one generation at a time
_waiting = 0
_sql_cache: dict = {}   # (question, day) -> raw SQL, only for questions without context
_engines: dict = {}


def _engine(name: str, env_var: str, **kw):
    if name not in _engines:
        url = os.environ.get(env_var)
        if not url:
            raise HTTPException(503, "Assistant non configuré.")
        _engines[name] = create_async_engine(url, pool_size=3, max_overflow=2, pool_pre_ping=True, **kw)
    return _engines[name]


def _ro():
    return _engine("ro", "AI_DATABASE_URL", connect_args={"server_settings": {
        "statement_timeout": "5000", "default_transaction_read_only": "on"}})


class Ask(BaseModel):
    question: str = Field(min_length=2, max_length=300)
    context: str | None = Field(default=None, max_length=700)


async def _query(sql: str, params: dict | None = None):
    async with _ro().connect() as conn:
        res = await conn.execute(text(sql), params or {})
        cols = list(res.keys())
        rows = res.fetchmany(MAX_ROWS + 1)
    return cols, [list(r) for r in rows[:MAX_ROWS]], len(rows) > MAX_ROWS


_backend: ContextVar = ContextVar("ai_backend", default="")


AI_DENY_TABLES = re.compile(os.environ.get("AI_DENY_TABLES", r"^(ai_|django_|auth_|alembic)"), re.I)
NOTES_FILE = os.environ.get("AI_NOTES_FILE", "app/ai_notes.txt")
_SCHEMA = {"at": 0.0}
SCHEMA_SQL = """SELECT n.nspname AS sch, c.relname AS tbl,
       string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), '|' ORDER BY a.attnum) AS cols
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE n.nspname IN ('public', 'hr_all') AND c.relkind IN ('r', 'v', 'f', 'm', 'p')
GROUP BY 1, 2 ORDER BY 1, 2"""


def _short(t: str) -> str:
    t = re.sub(r"character varying(\(\d+\))?", "text", t)
    for old, new in (("timestamp without time zone", "timestamp"), ("timestamp with time zone", "timestamptz"),
                     ("double precision", "float8"), ("integer", "int"), ("boolean", "bool"), ("bigint", "int8")):
        t = t.replace(old, new)
    return t


ACCESS_FILE = os.environ.get("AI_ACCESS_FILE", "app/ai_access.json")
PROFILE_TTL = 60
NO_ACCESS_MSG = "Vous n'avez pas accès à ces données."
_ACCESS = {"mtime": None, "cfg": None}
_CATALOG: dict = {}      # table key -> prompt line: every table the assistant could ever see
_NO_STAR: set = set()
_NOTES = ""
_COLS: dict = {}       # table key -> [(column, type)] as the model may see them
_perm_cache: dict = {}   # user_id -> (expires, profile or None)


def _access_cfg() -> dict:
    try:
        m = os.path.getmtime(ACCESS_FILE)
        if _ACCESS["cfg"] is None or m != _ACCESS["mtime"]:
            with open(ACCESS_FILE, encoding="utf-8") as f:
                cfg = json.load(f)
            perms = cfg["permissions"]
            if not all(re.fullmatch(r"perm_\w+", p) and isinstance(v, list) for p, v in perms.items()):
                raise ValueError("bad permissions block")
            cfg["always"] = list(cfg.get("always", []))
            cfg["deny"] = list(cfg.get("deny", []))
            cfg["columns"] = dict(cfg.get("columns", {}))
            _ACCESS.update(mtime=m, cfg=cfg)
    except (OSError, ValueError, KeyError, AttributeError):
        logger.exception("ai access file unreadable: %s", ACCESS_FILE)
        if _ACCESS["cfg"] is None:
            raise HTTPException(503, "Assistant non configuré.")
    return _ACCESS["cfg"]


def _match(key: str, patterns) -> bool:
    name = key.split(".")[-1].lower()
    return any(fnmatch.fnmatchcase(name, p.lower()) for p in patterns)


async def _refresh_schema(force: bool = False):
    # Load the full catalog from the database; each user's share of it is cut in _access().
    global _CATALOG, _NO_STAR, _NOTES, _COLS
    if not force and time.time() - _SCHEMA["at"] < 600:
        return
    try:
        _, rows, _ = await _query(SCHEMA_SQL)
    except Exception:
        logger.exception("ai schema refresh failed")
        _SCHEMA["at"] = time.time() - 540  # try again in a minute
        return
    catalog, no_star, cols_by_tbl = {}, set(), {}
    for r in rows:
        sch, tbl, cols = (list(r.values()) if isinstance(r, dict) else list(r))[:3]
        if sch == "public" and AI_DENY_TABLES.search(tbl):
            continue
        allcols = cols.split("|")
        keep = [c for c in allcols if not DENY_COLS.search(c.split(" ")[0])]
        key = tbl if sch == "public" else f"{sch}.{tbl}"
        if len(keep) < len(allcols):
            no_star.add(key)
        catalog[key] = f"{key}(" + ", ".join(_short(c) for c in keep) + ")"
        cols_by_tbl[key] = [(c.split(" ", 1)[0], _short(c.split(" ", 1)[1]) if " " in c else "") for c in keep]
    configure(set(catalog), no_star)
    notes = ""
    try:
        notes = "\nNotes about the data:\n" + open(NOTES_FILE, encoding="utf-8").read().strip()
    except OSError:
        logger.warning("ai notes file not found: %s", NOTES_FILE)
    _CATALOG, _NO_STAR, _NOTES, _COLS = catalog, no_star, notes, cols_by_tbl
    _SCHEMA["at"] = time.time()
    try:
        cfg = _access_cfg()
        pats = list(cfg["always"]) + [p for v in cfg["permissions"].values() for p in v]
        loose = sorted(k for k in catalog if not _match(k, pats))
        logger.info("ai schema: %d tables; %d not in ai_access.json (hidden from everyone): %s",
                    len(catalog), len(loose), ", ".join(loose))
    except HTTPException:
        pass


async def _profile(uid: int):
    hit = _perm_cache.get(uid)
    if hit and hit[0] > time.time():
        return hit[1]
    try:
        async with _engine("main", "DATABASE_URL").connect() as conn:
            res = await conn.execute(text("SELECT * FROM hr_perm.accounts_hrprofile WHERE auth_user_id = :u"), {"u": uid})
            row = res.mappings().first()
    except SQLAlchemyError:
        logger.exception("ai permissions lookup failed")
        raise HTTPException(503, "Permissions indisponibles, réessayez dans un instant.")
    prof = dict(row) if row else None
    if len(_perm_cache) > 500:
        _perm_cache.clear()
    _perm_cache[uid] = (time.time() + PROFILE_TTL, prof)
    return prof


def _col_rule_ok(prof, rule) -> bool:
    if any(prof.get(p) for p in rule.get("any", [])):
        return True
    return any(all(prof.get(p) for p in grp) for grp in rule.get("all_of", []))


async def _access(user) -> dict:
    uid = user.get("user_id") if isinstance(user, dict) else getattr(user, "id", None)
    try:
        uid = int(uid)
    except (TypeError, ValueError):
        raise HTTPException(401, "Utilisateur inconnu.")
    await _refresh_schema()
    cfg = _access_cfg()
    is_super = isinstance(user, dict) and str(user.get("role", "")).upper() == "ADMIN"
    blocked = []   # column-name patterns this user may not see
    if is_super:
        allowed = set(_CATALOG)   # superadmin: every table, no profile needed, deny lists ignored
    else:
        prof = await _profile(uid)
        if not prof or not prof.get("is_active"):
            raise HTTPException(403, "Vous n'avez pas accès à l'assistant.")
        pats = list(cfg["always"])
        for perm, tables in cfg["permissions"].items():
            if prof.get("is_director") or prof.get(perm):
                pats += tables
        allowed = {k for k in _CATALOG if _match(k, pats) and not _match(k, cfg["deny"])}
        if not prof.get("is_director"):
            blocked = sorted(p for p, rule in cfg["columns"].items() if not _col_rule_ok(prof, rule))
    low = [p.lower() for p in blocked]
    lines, no_star = [], set(_NO_STAR & allowed)
    for k in sorted(allowed):
        cols = _COLS.get(k)
        if cols is None:
            lines.append(_CATALOG[k])
            continue
        keep = [c for c in cols if not any(fnmatch.fnmatchcase(c[0].lower(), p) for p in low)]
        if len(keep) < len(cols):
            no_star.add(k)
        lines.append(f"{k}(" + ", ".join(f"{n} {t}".strip() for n, t in keep) + ")")
    prompt = (PROMPT_BASE
              + "\nIf the question needs data that is not in the tables below, reply with exactly NO_ACCESS and nothing else."
              + "\nTables:\n" + "\n".join(lines) + _NOTES)
    fp = "superadmin" if is_super else hashlib.sha1(
        ("|".join(sorted(allowed)) + "#" + "|".join(blocked)).encode()).hexdigest()[:12]
    return {"allowed": allowed, "no_star": no_star, "hidden": set(_CATALOG) - allowed,
            "blocked_cols": blocked, "fp": fp, "prompt": prompt}


def _denied(kind, t0, title="Accès non autorisé", note=NO_ACCESS_MSG):
    return jsonable_encoder({"kind": kind, "title": title, "note": note, "columns": [],
                             "rows": [], "truncated": False, "sql": None, "seconds": round(time.time() - t0, 1),
                             "backend": _backend.get(), "answer": None})


import json as _json
from pathlib import Path as _Path

_LABELS_FILE = _Path(__file__).resolve().parent.parent / "column_labels.json"
try:
    _LABELS = _json.loads(_LABELS_FILE.read_text(encoding="utf-8"))
except Exception:
    _LABELS = {}


def _labels(cols):
    """Header labels for every supported language: {"fr": [...], "en": [...]} (same order as cols)."""
    langs = {l for v in _LABELS.values() for l in v} | {"en", "fr"}
    out = {}
    for lang in sorted(langs):
        seen, row = set(), []
        for c in cols:
            k = str(c).lower()
            entry = _LABELS.get(k, {})
            lab = entry.get(lang) or entry.get("en") or k.replace("_", " ").strip().capitalize() or str(c)
            if lab in seen:
                lab = f"{lab} ({c})"
            seen.add(lab)
            row.append(lab)
        out[lang] = row
    return out


async def _write_sql(question: str, today, access: dict, context: str | None = None) -> str:
    key = (question.strip().lower(), str(today), access["fp"])
    if not context and key in _sql_cache:
        _backend.set("cache")
        return _sql_cache[key]
    ctx = f"{context}\nIf the new question is a follow-up, reuse the previous SQL and keep its filters (employee, device); change only what the new question changes (period, columns).\n" if context else ""
    user = f"{ctx}Today: {today} ({today.strftime('%A')}).\nQuestion: {question}\nSQL:"
    out, backend = await generate(access["prompt"], user)
    _backend.set(backend)
    if not context and re.search(r"\b(select|with)\b", out, flags=re.I):
        if len(_sql_cache) > 200:
            _sql_cache.clear()
        _sql_cache[key] = out
    return out


def _keep_filter(sql: str, context, question: str) -> str:
    """Follow-up safety net: if the previous query was about one employee and the new SQL dropped it, put it back."""
    m = re.search(r"Active employee: user_id\s*=\s*(\d+)", context or "")
    if not m or re.search(r"\b(tous|toutes|tout le monde|everyone|all)\b", question, flags=re.I):
        return sql
    import sqlglot
    from sqlglot import exp
    tree = sqlglot.parse_one(sql, read="postgres")
    if {t.name for t in tree.find_all(exp.Table)} != {"v_daily"}:
        return sql
    if any(c.name == "user_id" for w in tree.find_all(exp.Where) for c in w.find_all(exp.Column)):
        return sql
    return tree.where(f"user_id = {m.group(1)}", dialect="postgres").sql(dialect="postgres")


async def _audit(user, question, kind, sql, ms, error):
    try:
        async with _engine("main", "DATABASE_URL").begin() as conn:
            await conn.execute(text(
                "INSERT INTO ai_audit(username, question, kind, sql, ms, error) VALUES (:u, :q, :k, :s, :m, :e)"),
                {"u": user, "q": question, "k": kind, "s": sql, "m": ms, "e": error})
    except Exception as exc:  # the audit must never break the answer
        logger.warning("ai_audit insert failed: %s", exc)


def _who(user) -> str:
    if isinstance(user, dict):
        return str(user.get("email") or user.get("username") or user.get("sub") or "unknown")[:100]
    return str(getattr(user, "email", None) or getattr(user, "username", None) or user)[:100]


REPAIR_TRIES = int(os.environ.get("AI_REPAIR_TRIES", "2"))


async def _run_with_repair(raw, question, today, context, access):
    """Run the model's SQL; on error, rejection or 0 rows, show the model what happened and let it fix it."""
    last = None
    for attempt in range(REPAIR_TRIES + 1):
        retry = attempt < REPAIR_TRIES and _backend.get() != "local"
        try:
            sql = guard_sql(raw, access["allowed"], access["no_star"], access["blocked_cols"])
            if last and sql == last[0]:
                return last
            cols, data, trunc = await _query(sql)
            last = (sql, cols, data, trunc)
            if data or not retry:
                return last
            problem = ("The query ran but returned 0 rows. If 0 rows is the true answer, return the same SQL. "
                       "Otherwise reconsider the view, the identifier (for example user_id versus employee_id), "
                       "the value format and the dates.")
        except (GuardError, SQLAlchemyError) as e:
            if not retry or (isinstance(e, GuardError) and set(getattr(e, "tables", ())) & access["hidden"]):
                raise
            problem = f"The query was rejected or failed: {str(getattr(e, 'orig', e))[:300]}"
        logger.info("ai repair attempt %d: %s", attempt + 1, problem[:100])
        prompt = f"Today: {today} ({today.strftime('%A')}).\nQuestion: {question}\nYour previous SQL: {raw[:600]}\nProblem: {problem}\nWrite the corrected SQL.\nSQL:"
        raw, backend = await generate(access["prompt"], prompt)
        _backend.set(backend)
    return last


@router.post("/ask")
async def ask(body: Ask, user=Depends(get_current_user)):
    t0, q = time.time(), body.question.strip()
    kind, sql, err = intent(q), None, None
    raw = None
    today = datetime.now(TZ).date()
    title, note, answer = "Résultat", None, None
    access = None
    try:
        access = await _access(user)
        if kind == "greeting":
            h = datetime.now(TZ).hour
            hello = "Bonjour" if h < 12 else "Bon après-midi" if h < 18 else "Bonsoir"
            cols, data, trunc = [], [], False
            title = f"{hello} !"
            note = ("Je suis l'assistant IA du pointage. Posez-moi une question sur les présences, les retards, "
                    "les heures supplémentaires, les pointeuses ou les prévisions.")
        elif kind == "forecast":
            if "v_daily_summary" not in access["allowed"]:
                err = "no access"
                return _denied(kind, t0)
            _, rows, _ = await _query(FORECAST_SQL, {"today": today, "since": today - timedelta(days=60)})
            f = forecast([tuple(r) for r in rows], today)
            if not f:
                raise HTTPException(422, "Pas assez d'historique fiable pour une prévision.")
            cols = ["date", "late_forecast", "overtime_hours_forecast"]
            data, trunc = [[r[c] for c in cols] for r in f["rows"]], False
            title = "Prévision des 5 prochains jours ouvrés"
            note = (f"Retards : moyenne des 5 derniers jours normaux. Heures sup. : même jour la semaine précédente. "
                    f"{f['days_removed']} jour(s) atypique(s) écarté(s). Lors du test sur 8 semaines, l'erreur moyenne "
                    f"était d'environ 10 retards par jour : c'est un ordre de grandeur, pas une certitude.")
        elif kind == "anomaly":
            if "v_anomalies" not in access["allowed"]:
                err = "no access"
                return _denied(kind, t0)
            cols, data, trunc = await _query(ANOMALY_SQL)
            title = "Anomalies des 14 derniers jours"
            if not data:
                note = "Aucune anomalie enregistrée dans la table insights sur cette période."
        else:
            raw = await _write_sql(q, today, access, body.context)
            if raw and "NO_ACCESS" in raw:
                err = "no data (model)"
                if access["hidden"]:
                    return _denied(kind, t0, "Données non disponibles",
                                   "Ces données ne sont pas disponibles pour votre profil.")
                return _denied(kind, t0, "Données introuvables",
                               "Je n'ai pas les données pour répondre à cette question.")
            if not re.search(r'\b(select|with)\b', raw or '', flags=re.I):
                cols, data, trunc, sql = [], [], False, None
                title = 'Question non prise en charge'
                note = ('Je ne traite que les questions sur les présences, retards, heures supplémentaires et pointeuses. '
                        'Exemple : qui était en retard hier ?')
            else:
                sql, cols, data, trunc = await _run_with_repair(raw, q, today, body.context, access)
            if sql:
                answer = await explain(q, sql, cols, data, trunc, body.context, today)
            if sql and not data and not answer:
                note = "Aucun résultat pour cette question."
        return jsonable_encoder({"kind": kind, "title": title, "note": note, "columns": cols, "labels": _labels(cols), "rows": data,
                                 "truncated": trunc, "sql": sql, "seconds": round(time.time() - t0, 1),
                                 "backend": _backend.get(), "answer": answer})
    except HTTPException as e:
        err = str(e.detail)
        raise
    except GuardError as e:
        err = str(e)
        sql = (raw or '')[:500]
        logger.warning('ai guard rejected: %s | raw=%r', e, raw)
        if access and (set(getattr(e, "tables", ())) & access["hidden"] or getattr(e, "blocked_col", False)):
            return _denied(kind, t0)
        raise HTTPException(422, f"{e} Reformulez la question.")
    except SQLAlchemyError as e:
        err = repr(e)[:300]
        logger.warning("ai query failed: %s | sql=%s", err, sql)
        raise HTTPException(422, "La requête générée n'a pas fonctionné. Reformulez la question avec d'autres mots.")
    finally:
        await _audit(_who(user), q, kind, sql, int((time.time() - t0) * 1000), err)
