"""AI assistant: conversation history. Each user only sees their own conversations."""
import json
import re
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.auth.django_auth import get_current_user
from app.routers.ai_assistant import Ask, _engine, _who, ask

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])


class Chat(BaseModel):
    question: str = Field(min_length=2, max_length=300)
    conversation_id: int | None = None


def _db():
    return _engine("main", "DATABASE_URL")


FOLLOWUP_RE = re.compile(
    r"^\s*(et|and|mais|aussi|pareil|idem|same|only|seulement|plus|moins|en\s+h|en\s+heures?|"
    r"par\s+(jour|pointeuse|employ)|pour\s+(hier|aujourd|le\s+mois|la\s+semaine)|ceux|celles|them|those)\b"
    r"|\b(ces|ceux|celles|eux|them|those|m[êe]me|same)\b", re.I)


DATE_RE = re.compile(
    r"\b(hier|avant-hier|aujourd|today|yesterday|semaine|week|mois|month|janvier|f[ée]vrier|mars|avril|mai|juin|"
    r"juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|"
    r"\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2})\b", re.I)


def _is_followup(q: str) -> bool:
    return True  # the model decides whether the question follows the previous one


EMP_RE = re.compile(r"(?:matricule|badge|employ[ée]e?|user[_ ]?id|user|id)\s*(?:n°|:|#)?\s*(\d{1,6})", re.I)
ALL_RE = re.compile(r"\b(tous|toutes|tout le monde|everyone|all)\b", re.I)


def _active_employee(msgs):
    # last matricule the user mentioned; reset by "tous" / "tout le monde"
    emp = None
    for m in msgs:
        if ALL_RE.search(m):
            emp = None
        found = EMP_RE.findall(m)
        if found:
            emp = found[-1]
    return emp


def _context(rows):
    # previous question + SQL of the conversation, so a follow-up ("en h et mn", "et hier ?") can build on it
    q = next((r[1] for r in rows if r[0] == "user"), None)
    res = next((r[2] for r in rows if r[0] == "assistant" and r[2]), None)
    sql = json.loads(res).get("sql") if res else None
    if not q or not sql:
        return None
    return (f"Previous question: {q[:200]}\nPrevious SQL: {sql[:450]}\n"
            "Use these only if the new question is a follow-up; otherwise ignore them.")[:700]


@router.post("/chat")
async def chat(body: Chat, user=Depends(get_current_user)):
    who, q, cid = _who(user), body.question.strip(), body.conversation_id
    context = None
    async with _db().begin() as c:
        if cid is None:
            cid = (await c.execute(text(
                "INSERT INTO ai_conversation(username, title) VALUES (:u, :t) RETURNING id"),
                {"u": who, "t": q[:60]})).scalar_one()
        else:
            owned = (await c.execute(text(
                "SELECT 1 FROM ai_conversation WHERE id = :i AND username = :u"),
                {"i": cid, "u": who})).first()
            if not owned:
                raise HTTPException(404, "Conversation introuvable.")
            last = (await c.execute(text(
                "SELECT role, content, result FROM ai_message WHERE conversation_id = :i ORDER BY id DESC LIMIT 2"),
                {"i": cid})).all()
            users = (await c.execute(text(
                "SELECT content FROM ai_message WHERE conversation_id = :i AND role = 'user' ORDER BY id"),
                {"i": cid})).scalars().all()
            context = _context(last) if _is_followup(q) else None
            emp = None
            if emp and _is_followup(q):
                context = (context + "\n" if context else "") + f"Active employee: user_id = {emp}"
        await c.execute(text(
            "INSERT INTO ai_message(conversation_id, role, content) VALUES (:c, 'user', :q)"),
            {"c": cid, "q": q})
    result, error = None, None
    try:
        result = await ask(Ask(question=q, context=context), user)
    except HTTPException as e:
        error = str(e.detail)
    except Exception:
        logger.exception("ai chat failed")
        error = "L'assistant n'a pas pu répondre."
    async with _db().begin() as c:
        await c.execute(text(
            "INSERT INTO ai_message(conversation_id, role, content, result) VALUES (:c, 'assistant', :t, :r)"),
            {"c": cid, "t": error or result["title"], "r": json.dumps(result) if result else None})
        await c.execute(text("UPDATE ai_conversation SET updated_at = now() WHERE id = :c"), {"c": cid})
    return {"conversation_id": cid, "result": result, "error": error}


@router.get("/conversations")
async def list_conversations(user=Depends(get_current_user)):
    async with _db().connect() as c:
        rows = (await c.execute(text(
            "SELECT id, title, updated_at FROM ai_conversation WHERE username = :u "
            "ORDER BY updated_at DESC LIMIT 100"), {"u": _who(user)})).all()
    return jsonable_encoder([{"id": r[0], "title": r[1], "updated_at": r[2]} for r in rows])


@router.get("/conversations/{cid}")
async def get_conversation(cid: int, user=Depends(get_current_user)):
    async with _db().connect() as c:
        conv = (await c.execute(text(
            "SELECT id, title FROM ai_conversation WHERE id = :i AND username = :u"),
            {"i": cid, "u": _who(user)})).first()
        if not conv:
            raise HTTPException(404, "Conversation introuvable.")
        rows = (await c.execute(text(
            "SELECT role, content, result, created_at FROM ai_message "
            "WHERE conversation_id = :i ORDER BY id"), {"i": cid})).all()
    msgs = [{"role": r[0], "content": r[1], "result": json.loads(r[2]) if r[2] else None,
             "created_at": r[3]} for r in rows]
    return jsonable_encoder({"id": conv[0], "title": conv[1], "messages": msgs})


@router.delete("/conversations/{cid}")
async def delete_conversation(cid: int, user=Depends(get_current_user)):
    async with _db().begin() as c:
        done = (await c.execute(text(
            "DELETE FROM ai_conversation WHERE id = :i AND username = :u RETURNING id"),
            {"i": cid, "u": _who(user)})).first()
    if not done:
        raise HTTPException(404, "Conversation introuvable.")
    return {"ok": True}
