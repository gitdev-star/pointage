# =====================================================
# PATH: django_auth/accounts/entra_service.py
# =====================================================
#
# Mirrors the structure of ldap_service.py so the two
# auth methods stay easy to compare/maintain side by side.
#
# Two separate MSAL flows are used here:
#
#   1. DELEGATED (auth code flow) — used when a real user
#      logs in via the browser redirect. Produces an ID
#      token with the user's own claims.
#
#   2. APP-ONLY (client credentials flow) — used by the
#      admin "list Entra users to import" screen. Lets the
#      backend query Microsoft Graph without a signed-in
#      user, using the app registration's own identity.
#
# Required Azure App Registration permissions:
#   - Delegated:   User.Read          (for login)
#   - Application: User.Read.All      (for admin listing)
#   Both need admin consent granted in the Azure portal.
# =====================================================

import logging

import httpx
import msal
from django.conf import settings

logger = logging.getLogger(__name__)

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"


def _check_config():
    missing = [
        name for name, value in (
            ("AZURE_CLIENT_ID", settings.AZURE_CLIENT_ID),
            ("AZURE_CLIENT_SECRET", settings.AZURE_CLIENT_SECRET),
            ("AZURE_TENANT_ID", settings.AZURE_TENANT_ID),
            ("AZURE_REDIRECT_URI", settings.AZURE_REDIRECT_URI),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(
            f"Entra ID is misconfigured — missing env var(s): {', '.join(missing)}"
        )


def build_msal_app():
    _check_config()
    return msal.ConfidentialClientApplication(
        settings.AZURE_CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}",
        client_credential=settings.AZURE_CLIENT_SECRET,
    )


# --------------------------------------------------
# DELEGATED FLOW — real user login
# --------------------------------------------------

def get_auth_url():
    """Build the Microsoft login redirect URL for the user's browser."""
    app = build_msal_app()
    return app.get_authorization_request_url(
        scopes=["User.Read"],
        redirect_uri=settings.AZURE_REDIRECT_URI,
    )


def acquire_token_by_code(auth_code):
    """
    Exchange the authorization code (from the callback query string)
    for tokens. Returns the ID token claims dict, or None on failure.

    Useful claims typically present:
        preferred_username  -> usually the full UPN, e.g. jdupont@company.com
        name                -> display name
        oid                 -> Entra object id (stable, unique per user)
    """
    app = build_msal_app()
    try:
        result = app.acquire_token_by_authorization_code(
            auth_code,
            scopes=["User.Read"],
            redirect_uri=settings.AZURE_REDIRECT_URI,
        )
    except Exception as e:
        logger.error(f"Entra ID token exchange error: {e}")
        return None

    if "access_token" not in result:
        logger.error(
            f"Entra ID token exchange failed: "
            f"{result.get('error')}: {result.get('error_description')}"
        )
        return None

    return result.get("id_token_claims")


def extract_username_from_claims(claims):
    """
    Map Entra ID's UPN onto your existing local username scheme.

    Current convention: local usernames are bare sAMAccountName-style
    (e.g. "jdupont"), while Entra's preferred_username is normally the
    full UPN (e.g. "jdupont@company.com"). We strip the domain to match.

    NOTE: this assumes a single-domain tenant. If multiple UPN domains
    ever map into this tenant, this stripping could collide two
    different people onto the same local username — revisit if that
    ever becomes true for your org.
    """
    upn = claims.get("preferred_username", "") or ""
    return upn.split("@")[0] if upn else ""


# --------------------------------------------------
# APP-ONLY FLOW — admin "browse tenant users" screen
# --------------------------------------------------

def _get_app_only_token():
    app = build_msal_app()
    result = app.acquire_token_for_client(
        scopes=["https://graph.microsoft.com/.default"]
    )
    if "access_token" not in result:
        logger.error(
            f"Entra ID app-only token error: "
            f"{result.get('error')}: {result.get('error_description')}"
        )
        return None
    return result["access_token"]


def list_entra_users():
    """
    Returns a list of tenant users via Microsoft Graph, in the same
    shape as ldap_service.list_ldap_users(), so the admin import UI
    can treat both sources identically.

    Each user: { cn, username, email, department, title, first_name, last_name }
    """
    token = _get_app_only_token()
    if not token:
        return []

    try:
        resp = httpx.get(
            f"{GRAPH_BASE_URL}/users",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "$select": (
                    "id,displayName,userPrincipalName,mail,"
                    "department,jobTitle,givenName,surname,accountEnabled"
                ),
                "$top": 999,
            },
            timeout=15,
        )
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"Entra ID list_users error: {e}")
        return []

    users = []
    for u in resp.json().get("value", []):
        if not u.get("accountEnabled", True):
            continue
        upn = u.get("userPrincipalName", "") or ""
        username = upn.split("@")[0] if upn else ""
        if not username:
            continue
        users.append({
            "cn": u.get("displayName", ""),
            "username": username,
            "email": u.get("mail") or upn,
            "department": u.get("department") or "",
            "title": u.get("jobTitle") or "",
            "first_name": u.get("givenName") or "",
            "last_name": u.get("surname") or "",
        })
    return sorted(users, key=lambda u: u["cn"])