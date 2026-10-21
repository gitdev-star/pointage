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

class PermissionDemandeRecrutement(BasePermission):
    """
    Permission réservée aux demandes de recrutement.

    Lecture :
    perm_recruitment_requests_read.

    Écriture :
    perm_recruitment_requests_write.

    Les anciennes permissions recruitment_read/write
    restent acceptées afin de préserver les accès existants.
    """

    message = (
        "Vous n’avez pas la permission "
        "d’accéder aux demandes de recrutement."
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
            return bool(
                profil.has_perm(
                    "recruitment_requests_read"
                )
                or profil.has_perm(
                    "recruitment_read"
                )
            )

        return bool(
            profil.has_perm(
                "recruitment_requests_write"
            )
            or profil.has_perm(
                "recruitment_write"
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
            return bool(
                profil.has_perm(
                    "recruitment_requests_read"
                )
                or profil.has_perm(
                    "recruitment_read"
                )
            )

        peut_modifier = bool(
            profil.has_perm(
                "recruitment_requests_write"
            )
            or profil.has_perm(
                "recruitment_write"
            )
        )

        return bool(
            peut_modifier
            and objet.demandeur_id == profil.id
        )


def utilisateurs_voir_tout():
    """
    Identifiants (séparés par des virgules) qui voient tous les
    recrutements, sans notifications ni droit de validation :
    variable RECRUTEMENT_VOIR_TOUT du .env.
    Solution provisoire : à remplacer par une permission dans le
    profil RH lors du déploiement du module Transport.
    """
    import os

    return {
        nom.strip().lower()
        for nom in os.environ.get("RECRUTEMENT_VOIR_TOUT", "").split(",")
        if nom.strip()
    }


def voit_tous_les_recrutements(profil):
    """
    Directeur, responsable du recrutement, valideurs et utilisateurs
    de RECRUTEMENT_VOIR_TOUT : accès à toutes les demandes de
    recrutement.
    """
    return bool(
        profil.is_director
        or profil.is_recruitment_responsible
        or getattr(profil, "perm_recruitment_validate", False)
        or (profil.username or "").strip().lower() in utilisateurs_voir_tout()
    )


def filtrer_perimetre_recrutement(request, queryset, prefixe=""):
    """
    Limite les recrutements au périmètre de l'utilisateur :
    les demandes qu'il a créées et celles de son département.
    « prefixe » : chemin vers la demande (ex : "demande__").
    """
    from django.db.models import Q

    if is_service_request(request):
        return queryset

    profil = get_hr_profile(request)

    if not profil:
        return queryset.none()

    if voit_tous_les_recrutements(profil):
        return queryset

    condition = Q(**{f"{prefixe}demandeur": profil})

    departement = profil.department

    if departement:
        # Le département de la demande est retrouvé par son nom dans
        # le site : on compare donc le nom et le site.
        condition |= Q(**{f"{prefixe}departement": departement})
        condition |= Q(**{
            f"{prefixe}departement__name__iexact": departement.name,
            f"{prefixe}departement__factory_id": departement.factory_id,
        })

    return queryset.filter(condition).distinct()
