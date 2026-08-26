import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserSerializer, RegisterSerializer
from .models import User
from .permissions import IsAdmin, IsHR, IsEmployee
from .ldap_service import list_ldap_users, authenticate_ldap_user


from .entra_service import (
    get_auth_url, acquire_token_by_code,
    extract_username_from_claims, list_entra_users,
)
from django.shortcuts import redirect
from django.conf import settings

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    """Only ADMIN can create users."""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [IsAuthenticated, IsAdmin]


class UserListView(APIView):
    """List all HR users — ADMIN only."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        users = User.objects.filter(role__in=["HR", "ADMIN"]).values(
            "id", "username", "email", "first_name", "last_name", "role", "is_active"
        )
        return Response(list(users))


class UserDetailView(APIView):
    """Get, update or delete a user — ADMIN only."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            return Response(UserSerializer(user).data)
        except User.DoesNotExist:
            return Response({"detail": "Utilisateur introuvable."}, status=404)

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            if user.is_superuser and not request.user.is_superuser:
                return Response({"detail": "Impossible de modifier ce compte."}, status=403)
            allowed_fields = ["email", "first_name", "last_name", "role", "is_active"]
            for field in allowed_fields:
                if field in request.data:
                    setattr(user, field, request.data[field])
            user.save()
            return Response(UserSerializer(user).data)
        except User.DoesNotExist:
            return Response({"detail": "Utilisateur introuvable."}, status=404)

    def delete(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            if user.is_superuser:
                return Response({"detail": "Impossible de supprimer le superuser."}, status=403)
            if user == request.user:
                return Response({"detail": "Vous ne pouvez pas supprimer votre propre compte."}, status=403)
            username = user.username
            user.delete()
            return Response({"detail": f"Utilisateur {username} supprimé."})
        except User.DoesNotExist:
            return Response({"detail": "Utilisateur introuvable."}, status=404)


class LDAPUserListView(APIView):
    """List all users from Active Directory — ADMIN only."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        users = list_ldap_users()
        # Mark which ones are already imported
        existing = set(User.objects.values_list("username", flat=True))
        for u in users:
            u["already_imported"] = u["username"] in existing
        return Response(users)


class LDAPImportUserView(APIView):
    """
    Import a user from AD into django_auth.
    POST { username, role }
    The user will authenticate with their AD password.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        username = request.data.get("username")
        role     = request.data.get("role", "HR")

        if not username:
            return Response({"detail": "username requis."}, status=400)

        # Check if already exists
        if User.objects.filter(username=username).exists():
            return Response({"detail": f"L'utilisateur {username} existe déjà."}, status=400)

        # Find user in LDAP
        users = list_ldap_users()
        ldap_user = next((u for u in users if u["username"] == username), None)

        if not ldap_user:
            return Response({"detail": f"Utilisateur {username} introuvable dans l'AD."}, status=404)

        # Create user with unusable password (they'll use AD auth)
        user = User.objects.create(
            username=ldap_user["username"],
            email=ldap_user["email"],
            first_name=ldap_user["first_name"],
            last_name=ldap_user["last_name"],
            role=role,
            is_active=True,
        )
        user.set_unusable_password()  # No local password — AD auth only
        user.save()

        return Response(UserSerializer(user).data, status=201)


class LDAPLoginView(APIView):
    """
    Login with AD credentials.
    POST { username, password }
    Validates against AD, returns JWT tokens.
    """
    permission_classes = []

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response({"detail": "username et password requis."}, status=400)

        # Try AD authentication first — never let an LDAP failure crash
        # the endpoint; fall through to local auth instead.
        try:
            ldap_info = authenticate_ldap_user(username, password)
        except Exception:
            ldap_info = None

        if ldap_info:
            # Only allow users already registered in Django (by admin or HR director)
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return Response(
                    {"detail": "Accès refusé. Votre compte n'a pas été activé par un administrateur."},
                    status=401
                )
            if not user.is_active:
                return Response({"detail": "Compte désactivé."}, status=401)

            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            refresh["role"]     = user.role
            refresh["username"] = user.username
            refresh["email"]    = user.email

            return Response({
                "access":  str(refresh.access_token),
                "refresh": str(refresh),
                "user":    UserSerializer(user).data,
            })

        # Fall back to local authentication
        try:
            user = User.objects.get(username=username)
            if user.check_password(password) and user.is_active:
                refresh = RefreshToken.for_user(user)
                refresh["role"]     = user.role
                refresh["username"] = user.username
                refresh["email"]    = user.email
                return Response({
                    "access":  str(refresh.access_token),
                    "refresh": str(refresh),
                    "user":    UserSerializer(user).data,
                })
        except User.DoesNotExist:
            pass

        return Response({"detail": "Identifiants invalides."}, status=401)


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class AdminOnlyView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    def get(self, request):
        return Response({"message": "Hello Admin!"})


class HRView(APIView):
    permission_classes = [IsAuthenticated, IsHR]
    def get(self, request):
        return Response({"message": "Hello HR or Admin!"})


class EmployeeDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsEmployee]
    def get(self, request):
        return Response({"message": "Hello Employee!"})


class HRUserDeleteView(APIView):
    """Allow HR Director to delete HR users only."""
    permission_classes = [IsAuthenticated, IsHR]

    def delete(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            if user.is_superuser:
                return Response({"detail": "Impossible de supprimer le superuser."}, status=403)
            if user.role == "ADMIN":
                return Response({"detail": "Impossible de supprimer un administrateur."}, status=403)
            if user == request.user:
                return Response({"detail": "Vous ne pouvez pas supprimer votre propre compte."}, status=403)
            username = user.username
            user.delete()  # triggers post_delete signal → removes HRProfile automatically
            return Response({"detail": f"Utilisateur {username} supprimé."})
        except User.DoesNotExist:
            return Response({"detail": "Utilisateur introuvable."}, status=404)




#django_auth/accounts/views.py
# =====================================================
# CONCERNING ENTRA ID / MICROSOFT LOGIN
# =====================================================
#    LDAPLoginView and friends are untouched — this is
#    purely additive, so LDAP keeps working exactly as
#    it does today.
# =====================================================


class EntraLoginView(APIView):
    """
    Step 1 of the Entra ID login flow.
    Frontend links/redirects the browser here; we bounce
    it straight to Microsoft's login page.
    """
    permission_classes = []

    def get(self, request):
        try:
            return redirect(get_auth_url())
        except RuntimeError as e:
            return Response({"detail": str(e)}, status=500)


class EntraCallbackView(APIView):
    """
    Step 2 of the Entra ID login flow.
    Microsoft redirects the browser back here with ?code=...
    after the user authenticates. We exchange that code for
    the user's identity, check they're already provisioned
    locally (same admin-approval model as LDAP), then issue
    the same JWT shape LDAPLoginView produces — so FastAPI's
    get_current_user needs zero changes.
    """
    permission_classes = []

    def get(self, request):
        code = request.GET.get("code")
        error = request.GET.get("error")

        if error:
            logger.error(f"Entra ID login error: {error} - {request.GET.get('error_description')}")
            return Response({"detail": "Authentification Entra ID annulée ou refusée."}, status=401)

        if not code:
            return Response({"detail": "Code manquant."}, status=400)

        claims = acquire_token_by_code(code)
        if not claims:
            return Response({"detail": "Échec authentification Entra ID."}, status=401)

        username = extract_username_from_claims(claims)
        if not username:
            return Response({"detail": "Identifiant Entra ID introuvable."}, status=401)

        # Same admin-pre-approval model as LDAP: user must
        # already exist locally, imported by an admin.
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {"detail": "Accès refusé. Votre compte n'a pas été activé par un administrateur."},
                status=401
            )
        if not user.is_active:
            return Response({"detail": "Compte désactivé."}, status=401)

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["username"] = user.username
        refresh["email"] = user.email

        # Hand tokens back to the SPA. Using a redirect with a short-lived
        # code exchange page is more robust than raw tokens in the URL —
        # but to keep this a drop-in parallel to your existing flow, this
        # redirects with tokens directly. Consider hardening later (e.g.
        # a one-time server-side code the frontend exchanges via POST).
        frontend_url = (
            f"{settings.FRONTEND_URL}/auth/callback"
            f"?access={refresh.access_token}&refresh={refresh}"
        )
        return redirect(frontend_url)


class EntraUserListView(APIView):
    """List all users from the Entra ID tenant — ADMIN only."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        users = list_entra_users()
        existing = set(User.objects.values_list("username", flat=True))
        for u in users:
            u["already_imported"] = u["username"] in existing
        return Response(users)


class EntraImportUserView(APIView):
    """
    Import a user from Entra ID into django_auth.
    POST { username, role }
    The user will authenticate via Microsoft login going forward.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        username = request.data.get("username")
        role = request.data.get("role", "HR")

        if not username:
            return Response({"detail": "username requis."}, status=400)

        if User.objects.filter(username=username).exists():
            return Response({"detail": f"L'utilisateur {username} existe déjà."}, status=400)

        users = list_entra_users()
        entra_user = next((u for u in users if u["username"] == username), None)

        if not entra_user:
            return Response({"detail": f"Utilisateur {username} introuvable dans Entra ID."}, status=404)

        user = User.objects.create(
            username=entra_user["username"],
            email=entra_user["email"],
            first_name=entra_user["first_name"],
            last_name=entra_user["last_name"],
            role=role,
            is_active=True,
        )
        user.set_unusable_password()  # No local password — Entra ID auth only
        user.save()

        return Response(UserSerializer(user).data, status=201)