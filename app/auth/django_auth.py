import os
# app/auth/django_auth.py
from fastapi import Header, HTTPException, Depends
import jwt
import requests

DJANGO_SECRET = os.environ.get("JWT_SECRET_KEY", "supersecretkey")  # Must match Django SIMPLE_JWT SIGNING_KEY
ALGORITHM = "HS256"

def get_current_user(authorization: str = Header(...)):
    """
    Validate JWT from Django and return user info.
    Expected header: Authorization: Bearer <token>
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, DJANGO_SECRET, algorithms=[ALGORITHM])
        # payload contains Django claims, e.g., user_id, username
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

