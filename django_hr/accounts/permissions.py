from rest_framework.permissions import BasePermission
from .models import HRProfile


def get_hr_profile(request):
    user_id = getattr(request, "hr_user_id", None)
    if not user_id:
        return None
    try:
        return HRProfile.objects.get(auth_user_id=user_id, is_active=True)
    except HRProfile.DoesNotExist:
        return None


def is_service_request(request):
    return getattr(request, "hr_username", None) == "service"


class IsHRUser(BasePermission):
    message = "Accès réservé aux utilisateurs RH."
    def has_permission(self, request, view):
        return is_service_request(request) or get_hr_profile(request) is not None


class IsDirector(BasePermission):
    message = "Accès réservé au Directeur RH."
    def has_permission(self, request, view):
        if is_service_request(request):
            return True
        profile = get_hr_profile(request)
        return profile is not None and profile.is_director


class HasModulePerm(BasePermission):
    """
    Dynamic permission — usage:
    permission_classes = [HasModulePerm('employees_read')]
    """
    def __init__(self, perm_key):
        self.perm_key = perm_key

    def has_permission(self, request, view):
        if is_service_request(request):
            return True
        profile = get_hr_profile(request)
        return profile is not None and profile.has_perm(self.perm_key)


def require_perm(perm_key):
    """Factory function to create a permission class for a specific perm_key."""
    class DynamicPerm(BasePermission):
        message = f"Permission requise: {perm_key}"
        def has_permission(self, request, view):
            if is_service_request(request):
                return True
            profile = get_hr_profile(request)
            return profile is not None and profile.has_perm(perm_key)
    return DynamicPerm
from rest_framework.permissions import BasePermission


class HRPermission(BasePermission):
    """
    Grants access if the user has an active HRProfile,
    or is a service/admin user (role=ADMIN or is_director).
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        # Service calls always allowed
        if getattr(user, 'role', '') == 'ADMIN':
            return True
        # Check HRProfile exists and is active
        try:
            profile = HRProfile.objects.get(auth_user_id=user.id, is_active=True)
            request.hr_profile = profile
            return True
        except HRProfile.DoesNotExist:
            return False
