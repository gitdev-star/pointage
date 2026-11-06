"""LLM transport: free online API first, local Ollama as fallback."""
import asyncio
import logging
import os
import re
import time
from collections import deque
from decimal import Decimal

import httpx
from fastapi import HTTPException

log = logging.getLogger(__name__)
log.setLevel(logging.INFO)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://192.168.8.190:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "omnisql32b")
OLLAMA_TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT", "120"))
OLLAMA_NUM_PREDICT = int(os.environ.get("OLLAMA_NUM_PREDICT", "250"))
LOCAL_MAX_WAITING = int(os.environ.get("LOCAL_MAX_WAITING", "4"))

API_URL = os.environ.get("AI_API_URL", "").rstrip("/")
API_KEY = os.environ.get("AI_API_KEY", "")
API_MODEL = os.environ.get("AI_API_MODEL", "")
API_TIMEOUT = float(os.environ.get("AI_API_TIMEOUT", "25"))
API_MAX_TOKENS = int(os.environ.get("AI_API_MAX_TOKENS", "1024"))
API_CONCURRENCY = int(os.environ.get("AI_API_CONCURRENCY", "6"))
API_MAX_WAITING = int(os.environ.get("AI_API_MAX_WAITING", "40"))
API_RPM = int(os.environ.get("AI_API_RPM", "25"))
API_COOLDOWN = float(os.environ.get("AI_API_COOLDOWN", "60"))

_local_lock = asyncio.Semaphore(1)
_local_waiting = 0
_api_lock = asyncio.Semaphore(API_CONCURRENCY)
_api_waiting = 0
_api_down_until = 0.0
_api_calls: deque = deque()


def api_enabled() -> bool:
    return bool(API_URL and API_KEY and API_MODEL)


def clean_sql(text: str) -> str:
    m = re.search(r"```(?:sql)?\s*(.*?)```", text, flags=re.S | re.I)
    return (m.group(1) if m else text).strip()


async def _rate_slot() -> bool:
    """Stay under the provider's requests-per-minute cap; wait a little, never forever."""
    deadline = time.time() + API_TIMEOUT
    while True:
        now = time.time()
        while _api_calls and now - _api_calls[0] > 60:
            _api_calls.popleft()
        if len(_api_calls) < API_RPM:
            _api_calls.append(now)
            return True
        wait = 60 - (now - _api_calls[0])
        if now + wait > deadline:
            return False
        await asyncio.sleep(wait + 0.05)


async def _call_api(system: str, user: str, sql: bool = True):
    global _api_waiting, _api_down_until
    if not api_enabled() or time.time() < _api_down_until or _api_waiting >= API_MAX_WAITING:
        return None
    _api_waiting += 1
    try:
        if not await _rate_slot():
            return None
        async with _api_lock:
            async with httpx.AsyncClient(timeout=httpx.Timeout(API_TIMEOUT, connect=5.0)) as c:
                r = await c.post(
                    f"{API_URL}/chat/completions",
                    headers={"Authorization": f"Bearer {API_KEY}"},
                    json={"model": API_MODEL, "temperature": 0, "max_tokens": API_MAX_TOKENS,
                          "messages": [{"role": "system", "content": system},
                                       {"role": "user", "content": user}]})
        if r.status_code >= 400:
            wait = API_COOLDOWN
            if r.status_code == 429:
                try:
                    wait = min(float(r.headers.get("retry-after", wait)), 3600)
                except ValueError:
                    pass
            elif r.status_code in (401, 403, 404):
                wait = 600  # bad key or model name: do not hammer it
            _api_down_until = time.time() + wait
            log.warning("online LLM HTTP %s, local fallback for %.0fs: %s", r.status_code, wait, r.text[:200])
            return None
        content = r.json()["choices"][0]["message"]["content"] or ""
        out = clean_sql(content) if sql else content.strip()
        return out or None
    except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as e:
        _api_down_until = time.time() + 30
        log.warning("online LLM failed (%s %r), local fallback for 30s", type(e).__name__, e)
        return None
    finally:
        _api_waiting -= 1


async def _call_local(prompt: str) -> str:
    global _local_waiting
    if _local_waiting >= LOCAL_MAX_WAITING:
        raise HTTPException(429, "L'assistant est occupé, réessayez dans un instant.")
    _local_waiting += 1
    try:
        async with _local_lock:
            async with httpx.AsyncClient(timeout=httpx.Timeout(OLLAMA_TIMEOUT, connect=5.0)) as c:
                r = await c.post(OLLAMA_URL, json={
                    "model": OLLAMA_MODEL, "stream": False, "keep_alive": -1, "prompt": prompt,
                    "options": {"temperature": 0, "num_ctx": 4096, "num_predict": OLLAMA_NUM_PREDICT}})
        r.raise_for_status()
        return r.json().get("response", "")
    except httpx.HTTPError as e:
        log.error("Ollama call failed: %s %r", type(e).__name__, e)
        raise HTTPException(503, "Le serveur IA ne répond pas.")
    finally:
        _local_waiting -= 1


async def generate(system: str, user: str):
    """Return (text, backend) where backend is 'online' or 'local'."""
    t0 = time.time()
    out = await _call_api(system, user)
    if out:
        log.info("ai backend=online %.1fs", time.time() - t0)
        return out, "online"
    out = await _call_local(f"{system}{user}")
    log.info("ai backend=local %.1fs", time.time() - t0)
    return out, "local"


EXPLAIN_ON = os.environ.get("AI_EXPLAIN", "1") != "0"
EXPLAIN_ROWS = int(os.environ.get("AI_EXPLAIN_ROWS", "0"))
ID_COLS = {"user_id", "matricule", "badge", "device_ip"}
PERSON_COLS = {"full_name", "first_name", "last_name", "employee_id"}
EXPLAIN_SYSTEM = (
    "You are an assistant inside an HR attendance system, chatting with HR staff. "
    "Answer their question from the query result below. The result table is shown to them separately, "
    "and you are not given every row. Reply in the language of the question. "
    "Rules: never write a table, a list of rows or a ranking of people or identifiers, because the table is displayed "
    "below your answer; write one to three plain sentences that summarise the result (count, total, minimum, maximum, trend). "
    "Never invent values you were not given. Use only the date given after 'Today' and never write another year."
)


def _strip_tables(t):
    """Drop markdown table lines the model may still produce."""
    if not t:
        return t
    lines = [l for l in t.splitlines() if not l.lstrip().startswith("|")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip() or None


def _summary(cols, rows, trunc) -> str:
    lines = [f"rows returned: {len(rows)}{' (list cut at the limit)' if trunc else ''}"]
    for i, c in enumerate(cols):
        vals = [r[i] for r in rows if r[i] is not None]
        empty = len(rows) - len(vals)
        if not vals:
            lines.append(f"{c}: empty in all {len(rows)} rows")
            continue
        nums = [v for v in vals if isinstance(v, (int, float, Decimal)) and not isinstance(v, bool)]
        if c.lower() in ID_COLS:
            lines.append(f"{c}: {len(set(vals))} distinct values")
        elif nums and len(nums) == len(vals):
            lines.append(f"{c}: sum={sum(nums)} min={min(nums)} max={max(nums)}")
        elif all(hasattr(v, "isoformat") for v in vals):
            lines.append(f"{c}: min={min(vals)} max={max(vals)}")
        else:
            counts = {}
            for v in vals:
                counts[str(v)] = counts.get(str(v), 0) + 1
            if c.lower() not in PERSON_COLS and len(counts) <= 12:
                lines.append(f"{c}: " + ", ".join(f"{k} ({n})" for k, n in counts.items()))
            else:
                lines.append(f"{c}: {len(counts)} distinct values")
        if empty:
            lines[-1] += f" ({empty} of {len(rows)} rows empty)"
    return "\n".join(lines)


NO_SHARE_COLS = re.compile(os.environ.get("AI_NO_SHARE_COLS", r"salair|salary|paie|payroll|wage|brut|net_"), re.I)


async def explain(question, sql, cols, rows, trunc, context=None, today=None):
    """Friendly plain-text answer from the online model; None if unavailable (the table still shows)."""
    if not (EXPLAIN_ON and api_enabled()):
        return None
    personal = any(c.lower() in (ID_COLS | PERSON_COLS) for c in cols)
    n = EXPLAIN_ROWS if personal else (15 if len(rows) <= 15 else EXPLAIN_ROWS)
    secret = any(NO_SHARE_COLS.search(c) for c in cols)
    if secret:
        n = 0
    sample = ("\nRows:\n" + "\n".join(str(list(r)) for r in rows[:n])) if n > 0 else ""
    ctx = f"Earlier in this conversation:\n{context}\n\n" if context else ""
    if (personal or secret) and n == 0:
        sample += "\nThe rows contain names or identifiers that are not shown to you; the user sees them in the table below your answer."
    day = f"Today: {today}. " if today else ""
    user = f"{ctx}{day}Question: {question}\nSQL: {sql}\nColumns: {', '.join(cols)}\n{'' if secret else _summary(cols, rows, trunc)}{sample}"
    out = await _call_api(EXPLAIN_SYSTEM, user, sql=False)
    out = _strip_tables(out)
    log.info("ai explain %s", "ok" if out else "none")
    return out
