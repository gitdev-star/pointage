# # =====================================================
# # PATH: pointage/django_hr/accounts/middleware.py
# # =====================================================

# import jwt
# from django.conf import settings


# class HRJWTMiddleware:
#     """
#     Decodes the JWT token and attaches user info to the request.
#     This runs before DRF authentication so permissions can access
#     hr_user_id, hr_role, hr_username directly from request.
#     """

#     def __init__(self, get_response):
#         self.get_response = get_response

#     def __call__(self, request):
#         request.hr_user_id  = None
#         request.hr_username = None
#         request.hr_role     = None

#         auth_header = request.META.get("HTTP_AUTHORIZATION", "")
#         if auth_header.startswith("Bearer "):
#             token = auth_header.split(" ")[1]
#             try:
#                 secret = settings.SIMPLE_JWT.get("SIGNING_KEY", settings.SECRET_KEY)
#                 payload = jwt.decode(token, secret, algorithms=["HS256"])
#                 request.hr_user_id  = payload.get("user_id")
#                 request.hr_username = payload.get("username", "")
#                 request.hr_role     = payload.get("role", "")
#             except jwt.ExpiredSignatureError:
#                 pass
#             except jwt.InvalidTokenError:
#                 pass

#         return self.get_response(request)











import jwt
from django.conf import settings
from django.utils import timezone


class HRJWTMiddleware:
    """
    Decodes the JWT token and attaches user info to the request.
    This runs before DRF authentication so permissions can access
    hr_user_id, hr_role, hr_username directly from request.
    Also updates HRProfile.last_seen for presence tracking.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.hr_user_id  = None
        request.hr_username = None
        request.hr_role     = None

        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                secret = settings.SIMPLE_JWT.get("SIGNING_KEY", settings.SECRET_KEY)
                payload = jwt.decode(token, secret, algorithms=["HS256"])
                request.hr_user_id  = payload.get("user_id")
                request.hr_username = payload.get("username", "")
                request.hr_role     = payload.get("role", "")
            except jwt.ExpiredSignatureError:
                pass
            except jwt.InvalidTokenError:
                pass

        response = self.get_response(request)

        # ✅ Présence : met à jour last_seen, au plus une fois par minute par utilisateur
        if request.hr_user_id:
            self._update_last_seen(request.hr_user_id)

        return response

    def _update_last_seen(self, hr_user_id):
        from .models import HRProfile  # import local pour éviter tout souci de chargement au démarrage
        try:
            now = timezone.now()
            HRProfile.objects.filter(auth_user_id=hr_user_id).filter(
                models_Q_last_seen_stale(now)
            ).update(last_seen=now)
        except Exception:
            pass  # ne jamais casser une requête à cause du tracking de présence


def models_Q_last_seen_stale(now):
    from django.db.models import Q
    from datetime import timedelta
    return Q(last_seen__isnull=True) | Q(last_seen__lt=now - timedelta(minutes=1))