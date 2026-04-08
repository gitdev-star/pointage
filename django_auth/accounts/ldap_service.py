# =====================================================
# PATH: django_auth/accounts/ldap_service.py
# =====================================================

from ldap3 import Server, Connection, ALL
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

SYSTEM_ACCOUNTS = {"invité", "krbtgt", "administrateur", "guest", "administrator"}


def get_ldap_connection():
    """Get an authenticated LDAP connection."""
    server = Server(settings.LDAP_SERVER_URI, get_info=ALL)
    conn   = Connection(
        server,
        user=settings.LDAP_BIND_DN,
        password=settings.LDAP_PASSWORD,
        auto_bind=True,
    )
    return conn


def list_ldap_users():
    """
    Returns a list of real AD users (excluding system accounts).
    Each user: { cn, username, email, department, title, first_name, last_name }
    """
    try:
        conn = get_ldap_connection()
        conn.search(
            settings.LDAP_SEARCH_BASE,
            settings.LDAP_USER_FILTER,
            attributes=settings.LDAP_ATTRIBUTES,
        )
        users = []
        for entry in conn.entries:
            username = str(entry.sAMAccountName) if entry.sAMAccountName else ""
            if username.lower() in SYSTEM_ACCOUNTS or not username:
                continue
            # Skip system-looking accounts
            if any(c in username for c in ["$", "KlPx", "cegid", "leuser"]):
                continue
            users.append({
                "cn":         str(entry.cn)         if entry.cn         else "",
                "username":   username,
                "email":      str(entry.mail[0])    if entry.mail       else "",
                "department": str(entry.department[0]) if entry.department else "",
                "title":      str(entry.title[0])   if entry.title      else "",
                "first_name": str(entry.givenName[0]) if entry.givenName else "",
                "last_name":  str(entry.sn[0])      if entry.sn         else "",
            })
        conn.unbind()
        return sorted(users, key=lambda u: u["cn"])
    except Exception as e:
        logger.error(f"LDAP list_users error: {e}")
        return []


def authenticate_ldap_user(username, password):
    """
    Authenticate a user against AD.
    Returns user info dict if successful, None if failed.
    """
    try:
        # First find the user's DN
        conn = get_ldap_connection()
        conn.search(
            settings.LDAP_SEARCH_BASE,
            f"(&(objectClass=person)(sAMAccountName={username}))",
            attributes=settings.LDAP_ATTRIBUTES,
        )
        if not conn.entries:
            conn.unbind()
            return None

        entry  = conn.entries[0]
        user_dn = entry.entry_dn
        conn.unbind()

        # Now authenticate with user's credentials
        server  = Server(settings.LDAP_SERVER_URI)
        user_conn = Connection(server, user=user_dn, password=password, auto_bind=True)

        if user_conn.bound:
            user_conn.unbind()
            return {
                "cn":         str(entry.cn)           if entry.cn         else "",
                "username":   username,
                "email":      str(entry.mail[0])      if entry.mail       else "",
                "first_name": str(entry.givenName[0]) if entry.givenName  else "",
                "last_name":  str(entry.sn[0])        if entry.sn         else "",
            }
        return None
    except Exception as e:
        logger.error(f"LDAP authenticate error: {e}")
        return None
