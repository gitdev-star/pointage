from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .serializers import UserSerializer, RegisterSerializer, CustomTokenObtainPairSerializer
from .models import User
from .permissions import IsAdmin, IsHR, IsEmployee
from .ldap_service import list_ldap_users, authenticate_ldap_user


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

        # Try AD authentication first
        ldap_info = authenticate_ldap_user(username, password)

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

