import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

SERVICE_KEY = "service-internal-token-changeme"


class HRUser:
    """Pseudo-user object for HR authentication."""
    is_authenticated = True
    is_active        = True

    def __init__(self, user_id, username, role):
        self.id       = user_id
        self.pk       = user_id
        self.username = username
        self.role     = role


class ServiceAuthentication(BaseAuthentication):
    """
    Allows internal service-to-service calls using X-Service-Key header.
    Used by django_auth to create HRProfiles automatically.
    """
    def authenticate(self, request):
        key = request.META.get("HTTP_X_SERVICE_KEY", "")
        if key != SERVICE_KEY:
            return None
        # Grant director-level access for internal service calls
        request.hr_user_id  = 0
        request.hr_username = "service"
        request.hr_role     = "ADMIN"
        return (HRUser(0, "service", "ADMIN"), key)


class HRTokenAuthentication(BaseAuthentication):
    """
    Validates JWT from django_auth without touching django_hr's user table.
    """
    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header.split(" ")[1]
        try:
            secret  = settings.SIMPLE_JWT.get("SIGNING_KEY", settings.SECRET_KEY)
            payload = jwt.decode(token, secret, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token expiré.")
        except jwt.InvalidTokenError:
            raise AuthenticationFailed("Token invalide.")

        user_id  = int(payload.get("user_id") or 0)
        username = payload.get("username", "")
        role     = payload.get("role", "")

        request.hr_user_id  = user_id
        request.hr_username = username
        request.hr_role     = role

        return (HRUser(user_id, username, role), token)
