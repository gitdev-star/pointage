from rest_framework.permissions import (
    SAFE_METHODS,
    BasePermission,
)

from accounts.permissions import (
    get_hr_profile,
    is_service_request,
)


class PermissionRecrutement(BasePermission):
    """
    Lecture :
    perm_recruitment_read.

    Écriture :
    perm_recruitment_write.

    Le Directeur RH et les appels internes
    disposent automatiquement de l'accès.
    """

    message = (
        "Vous n’avez pas la permission "
        "d’accéder au module Recrutement."
    )

    def has_permission(self, request, view):
        if is_service_request(request):
            return True

        profil = get_hr_profile(request)

        if not profil or not profil.is_active:
            return False

        if profil.is_director:
            return True

        if request.method in SAFE_METHODS:
            return profil.has_perm(
                "recruitment_read"
            )

        return profil.has_perm(
            "recruitment_write"
        )

    def has_object_permission(
        self,
        request,
        view,
        objet,
    ):
        return self.has_permission(
            request,
            view,
        )

class PermissionDirecteurRecrutement(
    BasePermission
):
    message = (
        "Seul un directeur autorisé peut "
        "valider ou refuser cette demande."
    )

    def has_permission(self, request, view):
        if is_service_request(request):
            return True

        profil = get_hr_profile(request)

        return bool(
            profil
            and profil.is_active
            and (
                profil.is_director
                or getattr(
                    profil,
                    "perm_recruitment_validate",
                    False,
                )
            )
        )

    def has_object_permission(
        self,
        request,
        view,
        objet,
    ):
        return self.has_permission(
            request,
            view,
        )

class PermissionDRHRecrutement(BasePermission):
    """
    Deuxième décision : approbation ou refus final
    par le Directeur RH.
    """

    message = (
        "Seul le Directeur RH peut approuver "
        "ou refuser définitivement cette demande."
    )

    def has_permission(self, request, view):
        if is_service_request(request):
            return True

        profil = get_hr_profile(request)

        return bool(
            profil
            and profil.is_active
            and profil.is_director
        )

    def has_object_permission(
        self,
        request,
        view,
        objet,
    ):
        return self.has_permission(request, view)


class PermissionProprietaireDemande(
    BasePermission
):
    """
    Le propriétaire peut modifier sa demande.
    Le DRH peut accéder à toutes les demandes.
    """

    message = (
        "Vous ne pouvez pas modifier "
        "la demande d’un autre utilisateur."
    )

    def has_object_permission(
        self,
        request,
        view,
        objet,
    ):
        if is_service_request(request):
            return True

        profil = get_hr_profile(request)

        if not profil or not profil.is_active:
            return False

        if profil.is_director:
            return True

        if request.method in SAFE_METHODS:
            return profil.has_perm(
                "recruitment_read"
            )

        return bool(
            profil.has_perm(
                "recruitment_write"
            )
            and objet.demandeur_id
            == profil.id
        )
