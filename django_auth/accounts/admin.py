from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib import messages
from .models import User
from .ldap_service import list_ldap_users


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display  = ["username", "email", "first_name", "last_name", "role", "is_active", "is_superuser"]
    list_filter   = ["role", "is_active", "is_superuser"]
    search_fields = ["username", "email", "first_name", "last_name"]
    list_editable = ["role", "is_active"]

    fieldsets = UserAdmin.fieldsets + (
        ("Rôle", {"fields": ("role",)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Rôle", {"fields": ("role",)}),
    )

    actions = ["import_from_ldap", "set_role_hr", "set_role_admin", "deactivate_users"]

    @admin.action(description="🔄 Importer depuis Active Directory")
    def import_from_ldap(self, request, queryset):
        """
        This action opens a message — actual import is done via
        the LDAP import page in admin.
        """
        self.message_user(
            request,
            "Utilisez la page 'Import AD' dans le menu pour importer des utilisateurs.",
            messages.INFO,
        )

    @admin.action(description="Set role → HR")
    def set_role_hr(self, request, queryset):
        queryset.update(role="HR")
        self.message_user(request, f"{queryset.count()} utilisateur(s) mis à jour → HR")

    @admin.action(description="Set role → ADMIN")
    def set_role_admin(self, request, queryset):
        queryset.update(role="ADMIN")
        self.message_user(request, f"{queryset.count()} utilisateur(s) mis à jour → ADMIN")

    @admin.action(description="Désactiver les comptes sélectionnés")
    def deactivate_users(self, request, queryset):
        queryset.update(is_active=False)
        self.message_user(request, f"{queryset.count()} compte(s) désactivé(s)")


class LDAPUserImportAdmin(admin.ModelAdmin):
    """Fake model admin to add LDAP import page to admin."""
    pass


# Custom admin view for LDAP import
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib.admin.views.decorators import staff_member_required
from django.utils.decorators import method_decorator
from django.views import View


class LDAPImportView(View):
    """Admin view to import users from Active Directory."""

    @method_decorator(staff_member_required)
    def get(self, request):
        try:
            ldap_users = list_ldap_users()
            existing   = set(User.objects.values_list("username", flat=True))
            for u in ldap_users:
                u["already_imported"] = u["username"] in existing
        except Exception as e:
            ldap_users = []
            messages.error(request, f"Erreur LDAP: {e}")

        return render(request, "admin/ldap_import.html", {
            "ldap_users": ldap_users,
            "title": "Importer depuis Active Directory",
        })

    @method_decorator(staff_member_required)
    def post(self, request):
        username   = request.POST.get("username")
        role       = request.POST.get("role", "HR")
        first_name = request.POST.get("first_name", "")
        last_name  = request.POST.get("last_name", "")
        email      = request.POST.get("email", "")

        if not username:
            messages.error(request, "Username requis.")
            return redirect("/admin/ldap-import/")

        if User.objects.filter(username=username).exists():
            messages.warning(request, f"L'utilisateur '{username}' existe déjà.")
            return redirect("/admin/ldap-import/")

        user = User.objects.create(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_active=True,
        )
        user.set_unusable_password()
        user.save()

        messages.success(request, f"✅ '{username}' importé avec succès comme {role}.")
        return redirect("/admin/ldap-import/")


# ── Add LDAP Import link to admin index ───────────────────────────────
from django.contrib.admin import AdminSite

original_index = AdminSite.index

def custom_index(self, request, extra_context=None):
    extra_context = extra_context or {}
    extra_context['ldap_import_url'] = '/admin/ldap-import/'
    return original_index(self, request, extra_context)

AdminSite.index = custom_index
