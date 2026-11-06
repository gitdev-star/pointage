"""Validates the JWT issued by Django (same JWT_SECRET_KEY as the pointage services)."""
import os

import jwt
from fastapi import Header, HTTPException

DJANGO_SECRET = os.environ.get("JWT_SECRET_KEY")
if not DJANGO_SECRET:
    raise RuntimeError("JWT_SECRET_KEY is not set")
ALGORITHM = "HS256"


def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ")[1]
    try:
        return jwt.decode(token, DJANGO_SECRET, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
