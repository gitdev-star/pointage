from io import BytesIO

from rest_framework.viewsets import ModelViewSet

from .emails import (
    notifier_decision_demande,
    notifier_nouvelle_demande,
    notifier_validation_directeur_au_drh,
    envoyer_compte_rendu_cadre,
    notifier_services_preparation_cadre,
    envoyer_documents_onboarding_cadre,
    notifier_processus_recrutement_cree,
)

from django.core.exceptions import (
    ValidationError as DjangoValidationError,
    ImproperlyConfigured
)
from django.db import transaction, close_old_connections 
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone

from django_filters.rest_framework import (
    DjangoFilterBackend,
)


from .services.compte_rendu_pdf import (
    generer_pdf_compte_rendu,
)

from .services.preparation_embauche import (
    creer_taches_preparation_cadre,
    supprimer_taches_si_non_retenu,
)

from .services.fiche_poste import generer_fiche_poste

from openpyxl import Workbook

from rest_framework import (
    filters,
    serializers as drf_serializers,
    status,
    viewsets,
)

from rest_framework.exceptions import PermissionDenied, ValidationError

from rest_framework.decorators import action

from rest_framework.parsers import (
    FormParser,
    JSONParser,
    MultiPartParser,
)

from rest_framework.response import Response

from accounts.permissions import get_hr_profile
from audit_log.utils import log_action

from .models import (
    DemandeRecrutement,
    ProcessusRecrutement,
    OffreRecrutement,
    PublicationOffre,
    FicheTransparence,
    Candidat,
    RetourRHCandidat,
    DocumentCandidat,
    Embauche,
    CompteRenduEntretienCadre,
    TachePreparationEmbauche,
    DesistementEmbauche,
    TACHES_PREPARATION_CADRE,
)

from .permissions import (
    PermissionRecrutement,
    PermissionCompteRendu,
    acces_recrutement_complet,
    PermissionDemandeRecrutement,
    PermissionDirecteurRecrutement,
    PermissionDRHRecrutement,
    PermissionProprietaireDemande,
    filtrer_perimetre_recrutement,
)

from .serializers import (
    DemandeRecrutementSerializer,
    ProcessusRecrutementSerializer,
    OffreRecrutementSerializer,
    PublicationOffreSerializer,
    FicheTransparenceSerializer,
    CandidatSerializer,
    RetourRHCandidatSerializer,
    DocumentCandidatSerializer,
    EmbaucheSerializer,
    DesistementEmbaucheSerializer,
    CompteRenduEntretienCadreSerializer,
    TachePreparationEmbaucheSerializer,
    creer_employe_depuis_embauche,
    DOCUMENTS_RH_PAR_DEFAUT,
)

from datetime import datetime

from django.db.models import (
    Count,
    F,
    IntegerField,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce, ExtractMonth
from django.utils.timezone import make_aware

def lire_emails_participants(valeur, obligatoire=True):
    """
    Emails des participants à l'entretien cadre : liste, ou texte
    séparé par des virgules, points-virgules ou retours à la ligne.
    Au moins une adresse, toutes valides ; doublons retirés.
    """
    from django.core.validators import validate_email

    if isinstance(valeur, str):
        valeur = valeur.replace(";", ",").replace("\n", ",").split(",")

    emails = []

    for email in valeur or []:
        email = str(email).strip().lower()

        if email and email not in emails:
            emails.append(email)

    if obligatoire and not emails:
        raise drf_serializers.ValidationError({
            "emails_participants": (
                "Indiquez l'email d'au moins un participant : "
                "il recevra la demande de compte rendu."
            )
        })

    invalides = []

    for email in emails:
        try:
            validate_email(email)
        except DjangoValidationError:
            invalides.append(email)

    if invalides:
        raise drf_serializers.ValidationError({
            "emails_participants": (
                "Adresse(s) invalide(s) : " + ", ".join(invalides)
            )
        })

    return emails


def email_profil(profil):
    """Adresse d'un profil RH (email, ou username s'il en est une)."""
    email = (profil.email or "").strip().lower()

    if not email and "@" in (profil.username or ""):
        email = profil.username.strip().lower()

    return email


def noms_profils(profils):
    """
    Nom affiché de chaque profil RH ({id: nom}), retrouvé dans la
    fiche employé par l'email, sinon le username.
    """
    from employees.models import Employee

    employes = {}

    for email, prenom, nom in (
        Employee.objects
        .exclude(email__isnull=True)
        .exclude(email="")
        .values_list("email", "first_name", "last_name")
    ):
        employes[email.strip().lower()] = " ".join(
            partie for partie in [prenom, nom] if partie
        )

    noms = {}

    for profil in profils:
        email = email_profil(profil)
        nom = employes.get(email, "")

        if not nom and profil.username and "@" not in profil.username:
            debut = f"{profil.username.strip().lower()}@"
            trouves = [
                valeur for cle, valeur in employes.items()
                if cle.startswith(debut)
            ]
            if len(trouves) == 1:
                nom = trouves[0]

        noms[profil.pk] = nom or profil.username

    return noms


def lire_redacteurs_compte_rendu(valeur, obligatoire=True):
    """
    Rédacteurs du compte rendu choisis à la planification :
    liste d'identifiants de profils RH actifs, chacun avec un email.
    """
    from accounts.models import HRProfile

    identifiants = []

    for identifiant in valeur or []:
        try:
            identifiant = int(identifiant)
        except (TypeError, ValueError):
            raise drf_serializers.ValidationError({
                "redacteurs": "Rédacteur invalide."
            })

        if identifiant not in identifiants:
            identifiants.append(identifiant)

    if obligatoire and not identifiants:
        raise drf_serializers.ValidationError({
            "redacteurs": (
                "Choisissez au moins un rédacteur : il recevra "
                "la demande de compte rendu."
            )
        })

    profils = list(
        HRProfile.objects.filter(pk__in=identifiants, is_active=True)
    )

    if len(profils) != len(identifiants):
        raise drf_serializers.ValidationError({
            "redacteurs": "Un rédacteur choisi n'existe pas ou est inactif."
        })

    sans_email = [p.username for p in profils if not email_profil(p)]

    if sans_email:
        raise drf_serializers.ValidationError({
            "redacteurs": (
                "Pas d'adresse email dans le profil de : "
                + ", ".join(sans_email)
            )
        })

    return profils


def candidat_pour_redacteur(candidat):
    """Informations du candidat utiles au rédacteur du compte rendu."""
    compte_rendu = getattr(candidat, "compte_rendu_cadre", None)
    demande = candidat.processus.demande

    return {
        "id": candidat.pk,
        "nom": candidat.nom,
        "prenom": candidat.prenom,
        "nom_complet": candidat.nom_complet,
        "email": candidat.email,
        "telephone": candidat.telephone,
        "poste_nom": demande.poste.name if demande.poste else "",
        "reference_processus": demande.reference,
        "date_entretien_prevue": candidat.date_entretien_prevue,
        "date_entretien_realisee": candidat.date_entretien_realisee,
        "statut": candidat.statut,
        "statut_libelle": candidat.get_statut_display(),
        "compte_rendu_id": compte_rendu.pk if compte_rendu else None,
        "compte_rendu_statut": (
            compte_rendu.statut if compte_rendu else None
        ),
        "a_rediger": entretien_a_rediger(candidat),
    }


def entretien_a_rediger(candidat):
    """
    Compte rendu à rédiger : entretien réalisé (ou date prévue
    passée) et compte rendu pas encore envoyé.
    """
    if candidat.statut in [
        Candidat.Statut.ENTRETIEN_REALISE,
        Candidat.Statut.COMPTE_RENDU_BROUILLON,
    ]:
        return True

    return bool(
        candidat.statut == Candidat.Statut.ENTRETIEN_PLANIFIE
        and candidat.date_entretien_prevue
        and candidat.date_entretien_prevue <= timezone.now()
    )


class ViewSetRecrutementBase(
    viewsets.ModelViewSet
):
    """
    Classe commune aux ViewSets du recrutement.
    """

    permission_classes = [
        PermissionRecrutement,
    ]

    parser_classes = [
        JSONParser,
        MultiPartParser,
        FormParser,
    ]

    def perform_create(self, serializer):
        instance = serializer.save()

        log_action(
            self.request,
            instance,
            "CREATE",
        )

    def perform_update(self, serializer):
        instance = serializer.save()

        log_action(
            self.request,
            instance,
            "UPDATE",
        )

    def perform_destroy(self, instance):
        log_action(
            self.request,
            instance,
            "DELETE",
        )

        instance.delete()


class DemandeRecrutementViewSet(
    ViewSetRecrutementBase
):
    queryset = (
        DemandeRecrutement.objects
        .select_related(
            "demandeur",
            "factory",
            "departement",
            "poste",
            "decide_par",
            "approuve_par_drh",
        )
        .all()
    )

    serializer_class = (
        DemandeRecrutementSerializer
    )

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_fields = [
        "statut",
        "factory",
        "departement",
        "poste",
        "motif",
        "motif_remplacement",
    ]

    search_fields = [
        "reference",
        "nom_demandeur",
        "matricule_demandeur",
        "poste__name",
        "departement__name",
    ]

    ordering_fields = [
        "date_creation",
        "date_prevue_recrutement",
        "statut",
    ]

    ordering = [
        "-date_creation",
    ]

    def get_queryset(self):
        # Un manager ne voit que les demandes de son périmètre.
        return filtrer_perimetre_recrutement(
            self.request,
            super().get_queryset(),
        )

    @action(
    detail=False,
    methods=["get"],
    url_path="tableau-de-bord",
)
    def tableau_de_bord(self, request):
        try:
            annee = int(
                request.query_params.get(
                    "annee",
                    timezone.localdate().year,
                )
            )

            trimestre = int(
                request.query_params.get(
                    "trimestre",
                    ((timezone.localdate().month - 1) // 3) + 1,
                )
            )
        except (TypeError, ValueError):
            return Response(
                {
                    "detail": (
                        "L’année et le trimestre doivent "
                        "être des nombres entiers."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if trimestre not in [1, 2, 3, 4]:
            return Response(
                {
                    "detail": (
                        "Le trimestre doit être compris "
                        "entre 1 et 4."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        mois_debut = ((trimestre - 1) * 3) + 1

        debut = make_aware(
            datetime(
                annee,
                mois_debut,
                1,
            )
        )

        if trimestre == 4:
            fin = make_aware(
                datetime(
                    annee + 1,
                    1,
                    1,
                )
            )
        else:
            fin = make_aware(
                datetime(
                    annee,
                    mois_debut + 3,
                    1,
                )
            )

        # Seules les demandes approuvées par le DRH
        # sont comptées.
        statuts_valides = [
            DemandeRecrutement.Statut.VALIDEE,
            DemandeRecrutement.Statut.TERMINEE,
        ]

        demandes = (
            DemandeRecrutement.objects
            .filter(
                date_creation__gte=debut,
                date_creation__lt=fin,
                statut__in=statuts_valides,
            )
        )

        embauches = (
            Embauche.objects
            .filter(
                date_confirmation__gte=debut,
                date_confirmation__lt=fin,
                date_confirmation__isnull=False,
            )
        )

        demandes_par_departement = {
            item["departement_id"]: {
                "departement": (
                    f"{item['departement__factory__name']}"
                    f" / {item['departement__name']}"
                ),
                "demandes": item["demandes"] or 0,
            }
            for item in (
                demandes
                .values(
                    "departement_id",
                    "departement__name",
                    "departement__factory__name",
                )
                .annotate(
                    demandes=Coalesce(
                        Sum(
                            F("nombre_cdi")
                            + F("nombre_cdd")
                        ),
                        Value(0),
                        output_field=IntegerField(),
                    )
                )
                .order_by("departement__name")
            )
        }

        prefixe = "candidat__processus__demande__departement"

        recrutes_par_departement = {}
        noms_departements_recrutes = {}

        for item in (
            embauches
            .values(
                f"{prefixe}_id",
                f"{prefixe}__name",
                f"{prefixe}__factory__name",
            )
            .annotate(
                recrutes=Count("id")
            )
        ):
            departement_id = item[f"{prefixe}_id"]

            recrutes_par_departement[
                departement_id
            ] = item["recrutes"]

            if item[f"{prefixe}__name"]:
                noms_departements_recrutes[
                    departement_id
                ] = (
                    f"{item[f'{prefixe}__factory__name']}"
                    f" / {item[f'{prefixe}__name']}"
                )

        ids_departements = set(
            demandes_par_departement
        ) | set(
            recrutes_par_departement
        )

        departements = []

        for departement_id in ids_departements:
            demande_info = demandes_par_departement.get(
                departement_id,
                {},
            )

            nombre_demande = demande_info.get(
                "demandes",
                0,
            )

            nombre_recrute = recrutes_par_departement.get(
                departement_id,
                0,
            )

            departements.append(
                {
                    "departement": demande_info.get(
                        "departement",
                        noms_departements_recrutes.get(
                            departement_id,
                            "Département non renseigné",
                        ),
                    ),
                    "demandes": nombre_demande,
                    "recrutes": nombre_recrute,
                    "ecart": max(
                        nombre_demande - nombre_recrute,
                        0,
                    ),
                }
            )

        departements.sort(
            key=lambda item: item["departement"]
        )

        recrutes_par_mois = {
            item["mois"]: item["recrutes"]
            for item in (
                embauches
                .annotate(
                    mois=ExtractMonth(
                        "date_confirmation"
                    )
                )
                .values("mois")
                .annotate(
                    recrutes=Count("id")
                )
                .order_by("mois")
            )
        }

        noms_mois = {
            1: "Janvier",
            2: "Février",
            3: "Mars",
            4: "Avril",
            5: "Mai",
            6: "Juin",
            7: "Juillet",
            8: "Août",
            9: "Septembre",
            10: "Octobre",
            11: "Novembre",
            12: "Décembre",
        }

        mois = [
            {
                "mois": noms_mois[numero],
                "recrutes": recrutes_par_mois.get(
                    numero,
                    0,
                ),
            }
            for numero in range(
                mois_debut,
                mois_debut + 3,
            )
        ]

        return Response(
            {
                "annee": annee,
                "trimestre": trimestre,
                "mois": mois,
                "departements": departements,
                "indicateurs": {
                    # Besoins exprimés : nombre de demandes.
                    "total_demandes": demandes.count(),
                    # Personnes à recruter : total CDI + CDD.
                    "total_personnes": sum(
                        item["demandes"]
                        for item in departements
                    ),
                    "total_recrutes": sum(
                        item["recrutes"]
                        for item in departements
                    ),
                    "total_ecart": sum(
                        item["ecart"]
                        for item in departements
                    ),
                    "total_departements": len(
                        departements
                    ),
                },
            }
        )

    def perform_create(self, serializer):
        demande = serializer.save()

        log_action(
            self.request,
            demande,
            "CREATE",
        )

        transaction.on_commit(
            lambda: notifier_nouvelle_demande(demande)
        )

    def get_permissions(self):
        if self.action in [
            "valider",
            "refuser",
        ]:
            return [
                PermissionDirecteurRecrutement()
            ]

        if self.action in [
            "approuver_drh",
            "refuser_drh",
        ]:
            return [
                PermissionDRHRecrutement()
            ]

        # Le tableau de bord et l'action liée au
        # processus restent soumis à la permission
        # générale du module Recrutement.
        if self.action in [
            "tableau_de_bord",
            "changer_statut_processus_indisponible",
        ]:
            return [
                PermissionRecrutement()
            ]

        if self.action in [
            "update",
            "partial_update",
            "destroy",
        ]:
            return [
                PermissionDemandeRecrutement(),
                PermissionProprietaireDemande(),
            ]

        # Créer, lister, consulter, mes-demandes :
        # permission « Demandes de recrutement ».
        return [
            PermissionDemandeRecrutement()
        ]

    @action(
        detail=False,
        methods=["get"],
        url_path="mes-demandes",
    )
    def mes_demandes(self, request):
        profil = get_hr_profile(request)

        if not profil:
            return Response(
                {
                    "detail": (
                        "Profil utilisateur introuvable."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        demandes = (
            self.get_queryset()
            .filter(demandeur=profil)
        )

        page = self.paginate_queryset(demandes)

        if page is not None:
            serializer = self.get_serializer(
                page,
                many=True,
            )

            return self.get_paginated_response(
                serializer.data
            )

        serializer = self.get_serializer(
            demandes,
            many=True,
        )

        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="valider",
    )
    @transaction.atomic
    def valider(self, request, pk=None):
        demande = get_object_or_404(
            DemandeRecrutement.objects
            .select_for_update(),
            pk=pk,
        )

        self.check_object_permissions(
            request,
            demande,
        )

        if (
            demande.statut
            != DemandeRecrutement.Statut.EN_ATTENTE
        ):
            return Response(
                {
                    "detail": (
                        "Cette demande n'est plus en "
                        "attente du directeur."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        profil = get_hr_profile(request)

        demande.statut = (
            DemandeRecrutement
            .Statut.EN_ATTENTE_DRH
        )

        demande.decide_par = profil

        demande.date_decision = (
            timezone.now()
        )

        demande.motif_decision = str(
            request.data.get(
                "motif_decision",
                "",
            )
        ).strip()

        demande.save(
            update_fields=[
                "statut",
                "decide_par",
                "date_decision",
                "motif_decision",
                "date_modification",
            ]
        )

        log_action(
            request,
            demande,
            "VALIDATE",
        )

        transaction.on_commit(
            lambda demande_id=demande.pk: (
                notifier_validation_directeur_au_drh(
                    DemandeRecrutement.objects
                    .select_related(
                        "demandeur",
                        "factory",
                        "departement",
                        "poste",
                        "decide_par",
                    )
                    .get(pk=demande_id)
                )
            )
        )

        serializer = self.get_serializer(
            demande
        )

        return Response(
            {
                "message": (
                    "La demande a été validée par "
                    "le directeur et transmise au DRH."
                ),
                "processus_cree": False,
                "demande": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="changer-statut-processus-indisponible",
    )
    def changer_statut_processus_indisponible(self, request, pk=None):
        processus = self.get_object()
        nouveau_statut = request.data.get("statut")

        if nouveau_statut == ProcessusRecrutement.Statut.EN_PAUSE:
            motif = str(request.data.get("motif_pause", "")).strip()
            if not motif:
                return Response(
                    {"motif_pause": "Précisez la raison de la mise en pause."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if processus.statut == ProcessusRecrutement.Statut.CLOTURE:
                return Response(
                    {"detail": "Un recrutement clôturé ne peut pas être mis en pause."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            processus.statut = ProcessusRecrutement.Statut.EN_PAUSE
            processus.motif_pause = motif
            processus.date_pause = timezone.now()
        elif nouveau_statut == ProcessusRecrutement.Statut.EN_COURS:
            if processus.statut != ProcessusRecrutement.Statut.EN_PAUSE:
                return Response(
                    {"detail": "Seul un recrutement en pause peut être repris."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            processus.statut = (
                ProcessusRecrutement.Statut.EN_COURS
                if processus.etapes_terminees
                else ProcessusRecrutement.Statut.PAS_COMMENCE
            )
            processus.motif_pause = ""
            processus.date_pause = None
        else:
            return Response(
                {"statut": "Statut demandé non autorisé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        processus.save(
            update_fields=["statut", "motif_pause", "date_pause", "date_modification"]
        )
        return Response(self.get_serializer(processus).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="refuser",
    )
    @transaction.atomic
    def refuser(self, request, pk=None):
        demande = get_object_or_404(
            DemandeRecrutement.objects
            .select_for_update(),
            pk=pk,
        )

        self.check_object_permissions(
            request,
            demande,
        )

        if (
            demande.statut
            != DemandeRecrutement.Statut.EN_ATTENTE
        ):
            return Response(
                {
                    "detail": (
                        "Cette demande a déjà "
                        "été traitée."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        motif_decision = str(
            request.data.get(
                "motif_decision",
                "",
            )
        ).strip()

        if not motif_decision:
            return Response(
                {
                    "motif_decision": (
                        "Le motif du refus "
                        "est obligatoire."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        profil = get_hr_profile(request)

        demande.statut = (
            DemandeRecrutement
            .Statut.REFUSEE_DIRECTEUR
        )

        demande.motif_decision = (
            motif_decision
        )

        demande.decide_par = profil

        demande.date_decision = (
            timezone.now()
        )

        demande.save(
            update_fields=[
                "statut",
                "motif_decision",
                "decide_par",
                "date_decision",
                "date_modification",
            ]
        )

        log_action(
            request,
            demande,
            "REJECT",
        )

        transaction.on_commit(
            lambda: notifier_decision_demande(demande)
        )

        serializer = self.get_serializer(
            demande
        )

        return Response(
            {
                "message": (
                    "La demande a été refusée."
                ),
                "demande": serializer.data,
            }
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="approuver-drh",
    )
    @transaction.atomic
    def approuver_drh(self, request, pk=None):
        demande = get_object_or_404(
            DemandeRecrutement.objects
            .select_for_update(),
            pk=pk,
        )

        self.check_object_permissions(
            request,
            demande,
        )

        if (
            demande.statut
            != DemandeRecrutement.Statut.EN_ATTENTE_DRH
        ):
            return Response(
                {
                    "detail": (
                        "Cette demande n'est pas en "
                        "attente de l'approbation du DRH."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        profil = get_hr_profile(request)

        if not profil:
            return Response(
                {"detail": "Profil DRH introuvable."},
                status=status.HTTP_403_FORBIDDEN,
            )

        demande.statut = (
            DemandeRecrutement.Statut.VALIDEE
        )
        demande.approuve_par_drh = profil
        demande.date_approbation_drh = timezone.now()
        demande.commentaire_drh = str(
            request.data.get("commentaire_drh", "")
        ).strip()

        demande.save(
            update_fields=[
                "statut",
                "approuve_par_drh",
                "date_approbation_drh",
                "commentaire_drh",
                "date_modification",
            ]
        )

        processus, cree = (
            ProcessusRecrutement.objects
            .get_or_create(demande=demande)
        )

        log_action(
            request,
            demande,
            "APPROVE_DRH",
        )

        transaction.on_commit(
            lambda demande_id=demande.pk: (
                notifier_decision_demande(
                    DemandeRecrutement.objects
                    .select_related(
                        "demandeur",
                        "poste",
                    )
                    .get(pk=demande_id)
                )
            )
        )

        transaction.on_commit(
            lambda processus_id=processus.pk: (
                notifier_processus_recrutement_cree(
                    ProcessusRecrutement.objects
                    .select_related(
                        "demande",
                        "demande__poste",
                    )
                    .get(pk=processus_id)
                )
            )
        )

        return Response(
            {
                "message": (
                    "La demande a été approuvée par le "
                    "DRH et le processus est disponible."
                ),
                "processus_cree": cree,
                "demande": self.get_serializer(demande).data,
                "processus": (
                    ProcessusRecrutementSerializer(
                        processus,
                        context={"request": request},
                    ).data
                ),
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="refuser-drh",
    )
    @transaction.atomic
    def refuser_drh(self, request, pk=None):
        demande = get_object_or_404(
            DemandeRecrutement.objects
            .select_for_update(),
            pk=pk,
        )

        self.check_object_permissions(
            request,
            demande,
        )

        if (
            demande.statut
            != DemandeRecrutement.Statut.EN_ATTENTE_DRH
        ):
            return Response(
                {
                    "detail": (
                        "Cette demande n'est pas en "
                        "attente de l'approbation du DRH."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        commentaire = str(
            request.data.get("commentaire_drh", "")
        ).strip()

        if not commentaire:
            return Response(
                {
                    "commentaire_drh": (
                        "Le motif du refus du DRH est "
                        "obligatoire."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        profil = get_hr_profile(request)

        if not profil:
            return Response(
                {"detail": "Profil DRH introuvable."},
                status=status.HTTP_403_FORBIDDEN,
            )

        demande.statut = (
            DemandeRecrutement.Statut.REFUSEE_DRH
        )
        demande.approuve_par_drh = profil
        demande.date_approbation_drh = timezone.now()
        demande.commentaire_drh = commentaire

        demande.save(
            update_fields=[
                "statut",
                "approuve_par_drh",
                "date_approbation_drh",
                "commentaire_drh",
                "date_modification",
            ]
        )

        log_action(
            request,
            demande,
            "REJECT_DRH",
        )

        transaction.on_commit(
            lambda demande_id=demande.pk: (
                notifier_decision_demande(
                    DemandeRecrutement.objects
                    .select_related(
                        "demandeur",
                        "poste",
                    )
                    .get(pk=demande_id)
                )
            )
        )

        return Response(
            {
                "message": "La demande a été refusée par le DRH.",
                "demande": self.get_serializer(demande).data,
            },
            status=status.HTTP_200_OK,
        )


class ProcessusRecrutementViewSet(
    ViewSetRecrutementBase
):
    queryset = (
        ProcessusRecrutement.objects
        .select_related(
            "demande",
            "demande__factory",
            "demande__departement",
            "demande__poste",
            "offre",
            "cloture_par",
        )
        .prefetch_related(
            "publications",
            "candidats",
            "candidats__embauche__desistement",
        )
        .all()
    )

    serializer_class = (
        ProcessusRecrutementSerializer
    )

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "demande__reference",
        "demande__poste__name",
        "demande__departement__name",
        "candidats__nom",
        "candidats__prenom",
        "candidats__email",
        "offre__reference",
        "offre__titre",
        "offre__nom_fichier_original",
    ]

    ordering_fields = [
        "date_creation",
        "date_modification",
        "etape_actuelle",
    ]

    ordering = [
        "-date_creation",
    ]

    def get_queryset(self):
        # Un manager ne voit que les recrutements de son périmètre.
        return filtrer_perimetre_recrutement(
            self.request,
            super().get_queryset(),
            prefixe="demande__",
        )

    def verifier_etape(
        self,
        processus,
        numero_etape,
    ):
        demande = processus.demande

        est_cadre = (
            demande.type_recrutement
            ==
            DemandeRecrutement
            .TypeRecrutement.CADRE
        )

        # Etape 1 commune : création et publication
        # de l'offre (facultatives).
        if numero_etape == 1:
            return None

        if est_cadre:
            return self.verifier_etape_cadre(
                processus,
                numero_etape,
            )

        return self.verifier_etape_ouvrier(
            processus,
            numero_etape,
        )

    def verifier_etape_cadre(
        self,
        processus,
        numero_etape,
    ):
        # Etape 2 :
        # candidatures, entretiens
        # et comptes rendus.
        if numero_etape == 2:
            candidats = (
                processus.candidats.exclude(
                    statut__in=[
                        Candidat.Statut.DESISTE,
                        Candidat.Statut.EMBAUCHE,
                    ]
                )
            )

            if not candidats.exists():
                return (
                    "Ajoutez au moins un "
                    "candidat cadre."
                )

            statuts_finaux = [
                Candidat.Statut.RETENU,
                Candidat.Statut.NON_RETENU,
            ]

            candidat_non_traite = (
                candidats
                .exclude(
                    statut__in=statuts_finaux
                )
                .first()
            )

            if candidat_non_traite:
                return (
                    "L'entretien et le compte "
                    "rendu doivent etre termines "
                    "pour le candidat "
                    f"{candidat_non_traite.nom_complet}."
                )

            compte_rendu_non_envoye = (
                candidats
                .exclude(
                    compte_rendu_cadre__statut=(
                        CompteRenduEntretienCadre
                        .Statut.ENVOYE
                    )
                )
                .first()
            )

            if compte_rendu_non_envoye:
                return (
                    "Le compte rendu de "
                    f"{compte_rendu_non_envoye.nom_complet} "
                    "doit etre envoye au DRH."
                )

            candidat_retenu_existe = (
                candidats
                .filter(
                    statut__in=[
                        Candidat.Statut.RETENU,
                    ]
                )
                .exists()
            )

            if not candidat_retenu_existe:
                return (
                    "Au moins un candidat cadre "
                    "doit etre retenu."
                )

            return None

        # Etape 3 :
        # préparation de l'embauche.
        # Etape 3 :
# préparation automatique de l'embauche.
        if numero_etape == 3:
            candidats_retenus = (
                processus
                .candidats
                .filter(
                    statut=Candidat.Statut.RETENU
                )
            )

            if not candidats_retenus.exists():
                return (
                    "Aucun candidat cadre "
                    "retenu n'est disponible."
                )

            nombre_taches_attendues = len(
                TACHES_PREPARATION_CADRE
            )

            for candidat in candidats_retenus:
                taches = (
                    candidat
                    .taches_preparation_embauche
                    .all()
                )

                if (
                    taches.count()
                    < nombre_taches_attendues
                ):
                    return (
                        "Toutes les demandes de "
                        "préparation n'ont pas été "
                        "créées pour "
                        f"{candidat.nom_complet}."
                    )

                notification_non_envoyee = (
                    taches
                    .filter(
                        notification_email_envoyee=False
                    )
                    .first()
                )

                if notification_non_envoyee:
                    return (
                        "La notification du service "
                        f"« {notification_non_envoyee.get_service_display()} » "
                        "n’a pas encore été envoyée pour "
                        f"{candidat.nom_complet}."
                    )

            return None

        # Etape 4 :
        # embauche, onboarding et clôture.
        if numero_etape == 4:
            nombre_embauches = (
                processus
                .candidats
                .filter(
                    statut=(
                        Candidat.Statut.EMBAUCHE
                    )
                )
                .count()
            )

            if nombre_embauches == 0:
                return (
                    "Au moins une embauche doit "
                    "être confirmée avant de "
                    "clôturer le recrutement."
                )

            if not processus.peut_etre_cloture:
                return (
                    "La checklist d'embauche et d'onboarding doit être "
                    "complète pour chaque candidat cadre retenu. "
                    "Le RI et le Code société doivent également avoir "
                    "été envoyés par e-mail lorsque le candidat possède "
                    "une adresse e-mail."
                )

            return None

        return (
            "Cette étape n'existe pas dans "
            "le parcours de recrutement "
            "des cadres."
        )

    def verifier_etape_ouvrier(
        self,
        processus,
        numero_etape,
    ):
        # Etape 2 :
        # fiche de transparence.
        if numero_etape == 2:
            if not (
                processus
                .fiches_transparence
                .exists()
            ):
                return (
                    "La fiche de transparence "
                    "est obligatoire."
                )

            return None

        # Etape 3 :
        # suivi des candidatures.
        if numero_etape == 3:
            if not (
                processus
                .liste_candidats_confirmee
            ):
                return (
                    "Confirmez la liste "
                    "des candidats."
                )

            candidat_retenu_existe = (
                processus
                .candidats
                .filter(
                    statut=(
                        Candidat.Statut.RECU
                    )
                )
                .exists()
            )

            if not candidat_retenu_existe:
                return (
                    "Au moins un candidat doit "
                    "avoir une fiche de test."
                )

            # La liste des dossiers à fournir est facultative :
            # elle n'empêche pas de passer à l'étape suivante.
            return None

        # Etape 4 :
        # embauche et clôture.
        if numero_etape == 4:
            nombre_embauches = (
                processus
                .candidats
                .filter(
                    statut=(
                        Candidat.Statut.EMBAUCHE
                    )
                )
                .count()
            )

            if nombre_embauches == 0:
                return (
                    "Au moins une embauche doit "
                    "être confirmée avant de "
                    "clôturer le recrutement."
                )

            return None

        return (
            "Cette étape n'existe pas dans "
            "le parcours de recrutement "
            "des ouvriers."
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="terminer-etape",
    )
    def terminer_etape(
        self,
        request,
        pk=None,
    ):
        processus_initial = (
            self.get_object()
        )

        if processus_initial.statut == ProcessusRecrutement.Statut.EN_PAUSE:
            return Response(
                {"detail": "Reprenez le processus avant de terminer une étape."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            numero_etape = int(
                request.data.get(
                    "numero_etape"
                )
            )

        except (TypeError, ValueError):
            return Response(
                {
                    "numero_etape": (
                        "Indiquez un numéro "
                        "d'étape valide."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        with transaction.atomic():
            processus = (
                ProcessusRecrutement
                .objects
                .select_for_update(
                    of=("self",)
                )
                .select_related(
                    "demande",
                    "demande__factory",
                    "demande__departement",
                    "demande__poste",
                    "offre",
                )
                .get(
                    pk=processus_initial.pk
                )
            )

            erreur = self.verifier_etape(
                processus,
                numero_etape,
            )

            if erreur:
                return Response(
                    {
                        "detail": erreur
                    },
                    status=(
                        status
                        .HTTP_400_BAD_REQUEST
                    ),
                )

            profil_cloture = None

            if numero_etape == processus.nombre_etapes:
                profil_cloture = get_hr_profile(request)

                if not profil_cloture:
                    return Response(
                        {
                            "detail": (
                                "Le profil RH de l'utilisateur connecté "
                                "est introuvable."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            try:
                processus.terminer_etape(
                    numero_etape
                )

            except (
                DjangoValidationError
            ) as erreur:
                detail = (
                    erreur.message_dict
                    if hasattr(
                        erreur,
                        "message_dict",
                    )
                    else erreur.messages
                )

                return Response(
                    {
                        "detail": detail
                    },
                    status=(
                        status
                        .HTTP_400_BAD_REQUEST
                    ),
                )

            if (
                numero_etape
                == processus.nombre_etapes
            ):
                nouvelle_date_cloture = (
                    timezone.now()
                )

                # Recherche d'une reprise qui n'a
                # pas encore été clôturée.
                desistements_en_reprise = (
                    DesistementEmbauche.objects
                    .filter(
                        embauche__candidat__processus=(
                            processus
                        ),
                        relancer_recrutement=True,
                        date_nouvelle_cloture__isnull=True,
                    )
                )

                processus.date_cloture = (
                    nouvelle_date_cloture
                )

                processus.cloture_par = (
                    profil_cloture
                )

                processus.save(
                    update_fields=[
                        "date_cloture",
                        "cloture_par",
                        "date_modification",
                    ]
                )

                # Si le processus avait été repris après
                # un désistement, on conserve la trace
                # de sa nouvelle clôture.
                desistements_en_reprise.update(
                    date_nouvelle_cloture=(
                        nouvelle_date_cloture
                    )
                )

        log_action(
            request,
            processus,
            "STEP_DONE",
            {
                "numero_etape": (
                    numero_etape
                ),
                "type_recrutement": (
                    processus
                    .demande
                    .type_recrutement
                ),
            },
        )

        serializer = self.get_serializer(
            processus
        )

        return Response(
            {
                "message": (
                    f"L'étape {numero_etape} "
                    "a été terminée."
                ),
                "processus": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="changer-statut")
    def changer_statut(self, request, pk=None):
        processus = self.get_object()
        nouveau_statut = request.data.get("statut")

        if nouveau_statut == ProcessusRecrutement.Statut.EN_PAUSE:
            motif = str(request.data.get("motif_pause", "")).strip()
            if not motif:
                return Response(
                    {"motif_pause": "Précisez la raison de la mise en pause."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if processus.statut == ProcessusRecrutement.Statut.CLOTURE:
                return Response(
                    {"detail": "Un recrutement clôturé ne peut pas être mis en pause."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            processus.statut = ProcessusRecrutement.Statut.EN_PAUSE
            processus.motif_pause = motif
            processus.date_pause = timezone.now()
        elif nouveau_statut == ProcessusRecrutement.Statut.EN_COURS:
            if processus.statut != ProcessusRecrutement.Statut.EN_PAUSE:
                return Response(
                    {"detail": "Seul un recrutement en pause peut être repris."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            processus.statut = (
                ProcessusRecrutement.Statut.EN_COURS
                if processus.etapes_terminees
                else ProcessusRecrutement.Statut.PAS_COMMENCE
            )
            processus.motif_pause = ""
            processus.date_pause = None
        else:
            return Response(
                {"statut": "Statut demandé non autorisé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        processus.save(
            update_fields=["statut", "motif_pause", "date_pause", "date_modification"]
        )
        return Response(self.get_serializer(processus).data)

    @action(detail=True, methods=["get"], url_path="fichier-suivi-excel")
    def fichier_suivi_excel(
        self,
        request,
        pk=None,
    ):
        """Génération facultative du fichier Excel de suivi."""
        processus = self.get_object()
        workbook = Workbook()
        feuille = workbook.active
        feuille.title = "Suivi des candidatures"

        feuille.append(
            [
                "N°",
                "Référence",
                "Poste",
                "Nom",
                "Prénom",
                "Téléphone",
                "E-mail",
                "Date de candidature",
                "Source",
                "Fiche de test",
                "Résultat",
            ]
        )

        for numero, candidat in enumerate(
            processus.candidats.all(),
            start=1,
        ):
            feuille.append(
                [
                    numero,
                    processus.demande.reference,
                    processus.demande.poste.name,
                    candidat.nom,
                    candidat.prenom,
                    candidat.telephone,
                    candidat.email,
                    candidat.date_candidature.isoformat(),
                    candidat.source,
                    (
                        "Oui"
                        if candidat.fiche_test_recue
                        else "Non"
                    ),
                    candidat.get_statut_display(),
                ]
            )

        sortie = BytesIO()
        workbook.save(sortie)

        reponse = HttpResponse(
            sortie.getvalue(),
            content_type=(
                "application/vnd.openxmlformats-"
                "officedocument.spreadsheetml.sheet"
            ),
        )
        nom_fichier = f"suivi-{processus.demande.reference}.xlsx"
        reponse["Content-Disposition"] = (
            f'attachment; filename="{nom_fichier}"'
        )
        return reponse


    @action(
        detail=True,
        methods=["post"],
        url_path="generer-liste-dossiers",
    )
    @transaction.atomic
    def generer_liste_dossiers(
        self,
        request,
        pk=None,
    ):
        """
        Étape 3 des ouvriers : génère en une seule fois la
        liste des dossiers à fournir pour tous les candidats
        reçus. Remplace l'ancienne étape "Retour RH" : un
        RetourRHCandidat est créé (ou complété) pour chaque
        candidat, afin que l'étape Embauche dispose de la
        liste des pièces à vérifier.
        """
        processus = self.get_object()

        if (
            processus.demande.type_recrutement
            ==
            DemandeRecrutement
            .TypeRecrutement.CADRE
        ):
            return Response(
                {
                    "detail": (
                        "La liste des dossiers concerne "
                        "uniquement les ouvriers."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            processus.statut
            == ProcessusRecrutement.Statut.CLOTURE
        ):
            return Response(
                {
                    "detail": (
                        "Ce processus de "
                        "recrutement est terminé."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        candidats_recus = list(
            processus.candidats.filter(
                statut=Candidat.Statut.RECU
            )
        )

        if not candidats_recus:
            return Response(
                {
                    "detail": (
                        "Cochez la fiche de test d'au "
                        "moins un candidat avant de "
                        "générer la liste."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        profil = get_hr_profile(request)

        responsable_rh = (
            (
                getattr(profil, "nom_complet", "")
                or getattr(profil, "username", "")
            )
            if profil
            else ""
        ) or "RH"

        for candidat in candidats_recus:
            retour_rh = (
                RetourRHCandidat.objects
                .filter(candidat=candidat)
                .first()
            )

            if retour_rh is None:
                retour_rh = RetourRHCandidat(
                    candidat=candidat,
                    responsable_rh=responsable_rh,
                )

            retour_rh.date_remise_liste = (
                timezone.localdate()
            )
            retour_rh.liste_imprimee = True
            retour_rh.liste_remise = True
            retour_rh.save()

            if not retour_rh.documents.exists():
                DocumentCandidat.objects.bulk_create(
                    [
                        DocumentCandidat(
                            retour_rh=retour_rh,
                            libelle=libelle,
                        )
                        for libelle in (
                            DOCUMENTS_RH_PAR_DEFAUT
                        )
                    ]
                )

        log_action(
            request,
            processus,
            "UPDATE",
            {
                "liste_dossiers_generee": [
                    candidat.nom_complet
                    for candidat in candidats_recus
                ],
            },
        )

        return Response(
            {
                "message": (
                    "La liste des dossiers à fournir "
                    f"a été générée pour "
                    f"{len(candidats_recus)} candidat(s)."
                ),
                "documents": DOCUMENTS_RH_PAR_DEFAUT,
                "candidats": [
                    candidat.nom_complet
                    for candidat in candidats_recus
                ],
            },
            status=status.HTTP_200_OK,
        )


class OffreRecrutementViewSet(
    ViewSetRecrutementBase
):
    queryset = (
        OffreRecrutement.objects
        .prefetch_related(
            "processus_recrutement",
        )
        .all()
    )

    serializer_class = (
        OffreRecrutementSerializer
    )

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_fields = [
        "active",
    ]

    search_fields = [
        "reference",
        "titre",
        "nom_fichier_original",
    ]

    ordering_fields = [
        "reference",
        "titre",
        "date_creation",
        "date_modification",
    ]

    ordering = [
        "-date_creation",
    ]

    def get_queryset(self):
        queryset = super().get_queryset()

        inclure_inactives = (
            self.request.query_params.get(
                "inclure_inactives"
            )
        )

        if inclure_inactives not in [
            "1",
            "true",
            "True",
        ]:
            queryset = queryset.filter(
                active=True
            )

        return queryset

class PublicationOffreViewSet(
    ViewSetRecrutementBase
):
    queryset = (
        PublicationOffre.objects
        .select_related(
            "processus",
            "processus__demande",
            "processus__demande__poste",
            "processus__offre",
        )
        .all()
    )

    serializer_class = (
        PublicationOffreSerializer
    )

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_fields = [
        "processus",
        "canal",
        "date_publication",
        "date_limite_candidature",
    ]

    search_fields = [
        "canal",
        "lien_ou_reference",
        "commentaire",
        "processus__demande__reference",
        "processus__demande__poste__name",
        "processus__offre__reference",
        "processus__offre__titre",
    ]

    ordering_fields = [
        "date_publication",
        "date_limite_candidature",
        "date_creation",
        "date_modification",
    ]

    ordering = [
        "-date_publication",
    ]

class FicheTransparenceViewSet(
    ViewSetRecrutementBase
):
    queryset = (
        FicheTransparence.objects
        .select_related(
            "processus",
            "processus__demande",
            "processus__demande__poste",
        )
        .all()
    )

    serializer_class = (
        FicheTransparenceSerializer
    )

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_fields = [
        "processus",
        "lieu",
        "original_signe",
        "date_fiche",
    ]

    search_fields = [
        "processus__demande__reference",
        "processus__demande__poste__name",
        "observations",
    ]

    ordering_fields = [
        "date_fiche",
        "date_upload",
        "date_modification",
    ]

    ordering = [
        "-date_upload",
    ]

class CandidatViewSet(
    ViewSetRecrutementBase
):
    queryset = (
        Candidat.objects
        .select_related(
            "processus",
            "processus__demande",
            "processus__demande__poste",
            "processus__demande__factory",
        )
        .prefetch_related(
            "processus__publications",
            "redacteurs_compte_rendu",
        )
        .all()
    )

    serializer_class = (
        CandidatSerializer
    )

    @action(
        detail=False,
        methods=["get"],
        url_path="redacteurs-possibles",
    )
    def redacteurs_possibles(self, request):
        """
        Profils RH actifs pouvant être choisis comme rédacteurs
        du compte rendu (ils ont un compte dans l'application).
        """
        from accounts.models import HRProfile

        profils = list(
            HRProfile.objects.filter(is_active=True).order_by("username")
        )
        noms = noms_profils(profils)

        resultats = [
            {
                "id": profil.pk,
                "username": profil.username,
                "email": email_profil(profil),
                "nom": noms[profil.pk],
                "fonction": profil.job_title,
            }
            for profil in profils
        ]

        resultats.sort(key=lambda r: (r["nom"] or "").lower())

        return Response(resultats)

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_fields = [
        "processus",
        "statut",
        "date_candidature",
        "date_entretien_prevue",
        "date_entretien_realisee",
    ]

    search_fields = [
        "nom",
        "prenom",
        "email",
        "telephone",
        "source",
        (
            "processus__demande"
            "__reference"
        ),
    ]

    ordering_fields = [
        "date_candidature",
        "date_entretien_prevue",
        "date_entretien_realisee",
        "date_creation",
        "nom",
        "prenom",
    ]

    ordering = [
        "nom",
        "prenom",
    ]

    def perform_create(
        self,
        serializer,
    ):
        processus = (
            serializer
            .validated_data[
                "processus"
            ]
        )

        if (
            processus.statut
            ==
            ProcessusRecrutement
            .Statut.CLOTURE
        ):
            raise drf_serializers.ValidationError(
                {
                    "processus": (
                        "Ce processus de "
                        "recrutement est terminé."
                    )
                }
            )

        est_cadre = (
            processus
            .demande
            .type_recrutement
            ==
            DemandeRecrutement
            .TypeRecrutement.CADRE
        )

        etape_attendue = (
            2 if est_cadre else 3
        )

        # Tant que le recrutement n'est pas clôturé,
        # on peut revenir à l'étape de suivi des
        # candidatures pour ajouter des candidats.
        if (
            processus.etape_actuelle
            < etape_attendue
        ):
            raise drf_serializers.ValidationError(
                {
                    "processus": (
                        "Les candidats peuvent "
                        "être ajoutés à partir "
                        f"de l'étape "
                        f"{etape_attendue}."
                    )
                }
            )

        candidat = serializer.save()

        log_action(
            self.request,
            candidat,
            "CREATE",
        )

    def perform_destroy(self, instance):
        embauche = getattr(
            instance,
            "embauche",
            None,
        )

        if embauche and embauche.confirmee:
            raise ValidationError({
                "detail": (
                    "Un candidat dont l'embauche est "
                    "confirmee ne peut pas etre supprime. "
                    "En cas de depart, enregistrez un "
                    "desistement afin de conserver "
                    "l'historique."
                )
            })

        super().perform_destroy(instance)

    def verifier_candidat_cadre(
        self,
        candidat,
    ):
        if not candidat.est_cadre:
            raise drf_serializers.ValidationError(
                {
                    "detail": (
                        "Cette action concerne "
                        "uniquement les candidats "
                        "cadres."
                    )
                }
            )

        processus = (
            candidat.processus
        )

        if (
            processus.statut
            ==
            ProcessusRecrutement
            .Statut.CLOTURE
        ):
            raise drf_serializers.ValidationError(
                {
                    "detail": (
                        "Ce processus est terminé."
                    )
                }
            )

        # Tant que le recrutement n'est pas clôturé,
        # on peut revenir à l'étape 2 pour gérer
        # les entretiens des candidats cadres.
        if processus.etape_actuelle < 2:
            raise drf_serializers.ValidationError(
                {
                    "detail": (
                        "Les entretiens cadres "
                        "sont disponibles à partir "
                        "de l'étape 2."
                    )
                }
            )

    @action(
        detail=True,
        methods=["post"],
        url_path=(
            "planifier-entretien"
        ),
    )
    def planifier_entretien(
        self,
        request,
        pk=None,
    ):
        candidat = self.get_object()

        self.verifier_candidat_cadre(
            candidat
        )

        if (
            candidat.statut
            not in [
                Candidat.Statut.AJOUTE,
                Candidat.Statut
                .ENTRETIEN_PLANIFIE,
            ]
        ):
            raise drf_serializers.ValidationError(
                {
                    "detail": (
                        "L'entretien ne peut "
                        "plus être planifié pour "
                        "ce candidat."
                    )
                }
            )

        champ_date = (
            drf_serializers
            .DateTimeField()
        )

        try:
            date_entretien = (
                champ_date.run_validation(
                    request.data.get(
                        "date_entretien_prevue"
                    )
                )
            )
        except (
            drf_serializers
            .ValidationError
        ) as error:
            raise drf_serializers.ValidationError(
                {
                    "date_entretien_prevue": (
                        error.detail
                    )
                }
            )

        # Date passée acceptée pour l'instant : permet d'enregistrer
        # un entretien déjà tenu, en attendant la synchronisation
        # avec le calendrier Outlook.

        # avec le calendrier Outlook. Les emails ne sont alors pas
        # obligatoires.

        # Rédacteurs choisis par le responsable recrutement : leurs
        # emails reçoivent le mail et la relance. L'ancienne saisie
        # libre des emails reste acceptée.
        redacteurs = None

        if "redacteurs" in request.data:
            redacteurs = lire_redacteurs_compte_rendu(
                request.data.get("redacteurs"),
                obligatoire=date_entretien > timezone.now(),
            )
            emails_participants = []

            for profil in redacteurs:
                email = email_profil(profil)
                if email not in emails_participants:
                    emails_participants.append(email)
        else:
            emails_participants = lire_emails_participants(
                request.data.get("emails_participants"),
                obligatoire=date_entretien > timezone.now(),
            )

        candidat.date_entretien_prevue = (
            date_entretien
        )

        candidat.date_entretien_realisee = (
            None
        )

        candidat.statut = (
            Candidat.Statut
            .ENTRETIEN_PLANIFIE
        )

        # Nouvelle date : le mail de compte rendu et sa relance
        # repartent de cette date.
        candidat.emails_participants_entretien = (
            emails_participants
        )
        candidat.date_mail_compte_rendu = None
        candidat.date_relance_compte_rendu = None

        candidat.save(
            update_fields=[
                "date_entretien_prevue",
                "date_entretien_realisee",
                "statut",
                "emails_participants_entretien",
                "date_mail_compte_rendu",
                "date_relance_compte_rendu",
                "date_modification",
            ]
        )

        if redacteurs is not None:
            candidat.redacteurs_compte_rendu.set(redacteurs)

        log_action(
            request,
            candidat,
            "INT_PLAN",
            {
                "date_entretien_prevue": (
                    date_entretien.isoformat()
                ),
                "emails_participants": (
                    emails_participants
                ),
                "redacteurs": (
                    [profil.username for profil in redacteurs]
                    if redacteurs is not None
                    else None
                ),
            },
        )

        serializer = self.get_serializer(
            candidat
        )

        return Response(
            {
                "message": (
                    "L'entretien a été "
                    "planifié."
                ),
                "candidat": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path=(
            "terminer-entretien"
        ),
    )
    def terminer_entretien(
        self,
        request,
        pk=None,
    ):
        candidat = self.get_object()

        self.verifier_candidat_cadre(
            candidat
        )

        if (
            candidat.statut
            !=
            Candidat.Statut
            .ENTRETIEN_PLANIFIE
        ):
            raise drf_serializers.ValidationError(
                {
                    "detail": (
                        "L'entretien doit d'abord "
                        "être planifié."
                    )
                }
            )

        valeur_date = request.data.get(
            "date_entretien_realisee"
        )

        if valeur_date:
            champ_date = (
                drf_serializers
                .DateTimeField()
            )

            try:
                date_realisation = (
                    champ_date
                    .run_validation(
                        valeur_date
                    )
                )
            except (
                drf_serializers
                .ValidationError
            ) as error:
                raise (
                    drf_serializers
                    .ValidationError(
                        {
                            (
                                "date_entretien"
                                "_realisee"
                            ): error.detail
                        }
                    )
                )
        else:
            date_realisation = (
                timezone.now()
            )

        if (
            date_realisation
            > timezone.now()
        ):
            raise drf_serializers.ValidationError(
                {
                    (
                        "date_entretien"
                        "_realisee"
                    ): (
                        "La date de réalisation "
                        "ne peut pas être dans "
                        "le futur."
                    )
                }
            )

        candidat.date_entretien_realisee = (
            date_realisation
        )

        candidat.statut = (
            Candidat.Statut
            .ENTRETIEN_REALISE
        )

        try:
            candidat.save(
                update_fields=[
                    (
                        "date_entretien"
                        "_realisee"
                    ),
                    "statut",
                    "date_modification",
                ]
            )

        except DjangoValidationError as error:
            if hasattr(
                error,
                "message_dict",
            ):
                raise (
                    drf_serializers
                    .ValidationError(
                        error.message_dict
                    )
                )

            raise drf_serializers.ValidationError(
                {
                    "detail": error.messages
                }
            )

        log_action(
            request,
            candidat,
            "INT_DONE",
            {
                (
                    "date_entretien"
                    "_realisee"
                ): (
                    date_realisation
                    .isoformat()
                )
            },
        )

        serializer = self.get_serializer(
            candidat
        )

        return Response(
            {
                "message": (
                    "L'entretien est marqué "
                    "comme réalisé. Le compte "
                    "rendu peut maintenant être "
                    "rédigé."
                ),
                "candidat": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path="fiche-test",
    )
    def supprimer_fiche_test(
        self,
        request,
        pk=None,
    ):
        candidat = self.get_object()

        if candidat.est_cadre:
            raise drf_serializers.ValidationError(
                {
                    "detail": (
                        "La fiche de test ne "
                        "concerne pas les cadres."
                    )
                }
            )

        if candidat.fiche_test:
            candidat.fiche_test.delete(
                save=False
            )

        candidat.fiche_test = None

        candidat.save()

        log_action(
            request,
            candidat,
            "TEST_DEL",
        )

        serializer = self.get_serializer(
            candidat
        )

        return Response(
            {
                "message": (
                    "La fiche de test "
                    "a été supprimée."
                ),
                "candidat": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

class CompteRenduEntretienCadreViewSet(
    ViewSetRecrutementBase
):
    queryset = (
        CompteRenduEntretienCadre.objects
        .select_related(
            "candidat",
            "candidat__processus",
            "candidat__processus__demande",
            "candidat__processus__demande__poste",
            "cree_par",
            "valide_par",
        )
        .all()
    )

    serializer_class = (
        CompteRenduEntretienCadreSerializer
    )

    # Accès habituel, ou rédacteur choisi à la planification
    permission_classes = [
        PermissionCompteRendu,
    ]

    def get_queryset(self):
        queryset = super().get_queryset()

        if acces_recrutement_complet(self.request, self):
            return queryset

        # Rédacteur : ses candidats uniquement
        return queryset.filter(
            candidat__redacteurs_compte_rendu=get_hr_profile(
                self.request
            )
        )

    def verifier_redacteur(self, candidat):
        """Un rédacteur ne travaille que sur ses candidats."""
        if acces_recrutement_complet(self.request, self):
            return

        profil = get_hr_profile(self.request)

        if not (
            profil
            and candidat.redacteurs_compte_rendu
            .filter(pk=profil.pk)
            .exists()
        ):
            raise PermissionDenied(
                "Vous n’êtes pas rédacteur du compte "
                "rendu de ce candidat."
            )

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_fields = [
        "candidat",
        "candidat__processus",
        "statut",
        "decision_finale",
    ]

    search_fields = [
        "reference",
        "candidat__nom",
        "candidat__prenom",
        "candidat__email",
        "poste",
    ]

    ordering_fields = [
        "date_entretien",
        "date_creation",
        "date_modification",
        "date_validation",
        "date_envoi",
    ]

    ordering = [
        "-date_creation",
    ]

    def perform_create(
        self,
        serializer,
    ):
        profil = get_hr_profile(
            self.request
        )

        if not profil:
            raise ValidationError(
                {
                    "detail": (
                        "Profil utilisateur "
                        "introuvable."
                    )
                }
            )

        candidat = (
            serializer
            .validated_data["candidat"]
        )

        self.verifier_redacteur(candidat)

        if not candidat.est_cadre:
            raise ValidationError(
                {
                    "candidat": (
                        "Le compte rendu concerne "
                        "uniquement un candidat cadre."
                    )
                }
            )

        # Entretien passé mais pas encore marqué réalisé : le
        # rédacteur, prévenu par mail, peut tout de même commencer.
        if (
            candidat.statut
            == Candidat.Statut.ENTRETIEN_PLANIFIE
            and entretien_a_rediger(candidat)
        ):
            candidat.date_entretien_realisee = (
                candidat.date_entretien_prevue
            )
            candidat.statut = (
                Candidat.Statut.ENTRETIEN_REALISE
            )

        if (
            candidat.statut
            !=
            Candidat.Statut
            .ENTRETIEN_REALISE
        ):
            raise ValidationError(
                {
                    "candidat": (
                        "L'entretien doit être "
                        "terminé avant de rédiger "
                        "le compte rendu."
                    )
                }
            )

        compte_rendu = serializer.save(
            cree_par=profil
        )

        candidat.statut = (
            Candidat.Statut
            .COMPTE_RENDU_BROUILLON
        )

        candidat.save(
            update_fields=[
                "statut",
                "date_entretien_realisee",
                "date_modification",
            ]
        )

        log_action(
            self.request,
            compte_rendu,
            "CR_CREATE",
        )

    def perform_update(
        self,
        serializer,
    ):
        compte_rendu = (
            serializer.instance
        )

        if (
            compte_rendu.statut
            ==
            CompteRenduEntretienCadre
            .Statut.ENVOYE
        ):
            raise ValidationError(
                {
                    "detail": (
                        "Un compte rendu déjà  "
                        "envoyé ne peut plus "
                        "être modifié."
                    )
                }
            )

        # Un rédacteur ne peut pas déplacer le compte rendu
        # vers un autre candidat.
        self.verifier_redacteur(
            serializer.validated_data.get(
                "candidat",
                compte_rendu.candidat,
            )
        )

        instance = serializer.save()

        log_action(
            self.request,
            instance,
            "CR_UPDATE",
        )

    def perform_destroy(
        self,
        instance,
    ):
        if (
            instance.statut
            ==
            CompteRenduEntretienCadre
            .Statut.ENVOYE
        ):
            raise ValidationError(
                {
                    "detail": (
                        "Un compte rendu envoyé "
                        "ne peut pas être supprimé."
                    )
                }
            )

        candidat = instance.candidat

        log_action(
            self.request,
            instance,
            "CR_DELETE",
        )

        instance.delete()

        candidat.statut = (
            Candidat.Statut
            .ENTRETIEN_REALISE
        )

        candidat.save(
            update_fields=[
                "statut",
                "date_modification",
            ]
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="pdf",
    )
    def telecharger_pdf(
        self,
        request,
        pk=None,
    ):
        close_old_connections()
        compte_rendu = (
            self.get_object()
        )

        contenu_pdf = (
            generer_pdf_compte_rendu(
                compte_rendu
            )
        )

        reference = (
            compte_rendu.reference
            or f"CR-{compte_rendu.pk}"
        )

        response = HttpResponse(
            contenu_pdf,
            content_type="application/pdf",
        )

        response[
            "Content-Disposition"
        ] = (
            f'attachment; filename="'
            f'{reference}.pdf"'
        )

        log_action(
            request,
            compte_rendu,
            "CR_PDF",
        )

        return response

    @action(
        detail=True,
        methods=["post"],
        url_path="valider-envoyer",
    )
    def valider_envoyer(
        self,
        request,
        pk=None,
    ):
        profil = get_hr_profile(request)

        if not profil:
            raise ValidationError(
                {
                    "detail": (
                        "Profil utilisateur "
                        "introuvable."
                    )
                }
            )

        with transaction.atomic():
            compte_rendu = (
                CompteRenduEntretienCadre
                .objects
                .select_for_update()
                .select_related(
                    "candidat",
                    "candidat__processus",
                    (
                        "candidat__processus"
                        "__demande"
                    ),
                )
                .get(
                    pk=self.get_object().pk
                )
            )

            if (
                compte_rendu.statut
                ==
                CompteRenduEntretienCadre
                .Statut.ENVOYE
            ):
                serializer = (
                    self.get_serializer(
                        compte_rendu
                    )
                )

                return Response(
                    {
                        "message": (
                            "Le compte rendu a déjà  "
                            "été envoyé au DRH."
                        ),
                        "compte_rendu": (
                            serializer.data
                        ),
                    },
                    status=status.HTTP_200_OK,
                )

            candidat = (
                compte_rendu.candidat
            )

            if not candidat.est_cadre:
                raise ValidationError(
                    {
                        "detail": (
                            "Ce candidat n'est pas "
                            "un candidat cadre."
                        )
                    }
                )

            if (
                candidat.statut
                not in [
                    Candidat.Statut
                    .ENTRETIEN_REALISE,
                    Candidat.Statut
                    .COMPTE_RENDU_BROUILLON,
                ]
            ):
                raise ValidationError(
                    {
                        "detail": (
                            "Le compte rendu ne peut "
                            "pas être validé dans "
                            "l'état actuel du candidat."
                        )
                    }
                )

            decision = str(
                request.data.get(
                    "decision_finale",
                    compte_rendu
                    .decision_finale,
                )
            ).strip()

            decisions_valides = [
                CompteRenduEntretienCadre
                .DecisionFinale.RETENU,
                CompteRenduEntretienCadre
                .DecisionFinale.NON_RETENU,
            ]

            if decision not in decisions_valides:
                raise ValidationError(
                    {
                        "decision_finale": (
                            "Sélectionnez Retenu "
                            "ou Non retenu."
                        )
                    }
                )

            compte_rendu.decision_finale = (
                decision
            )

            compte_rendu.statut = (
                CompteRenduEntretienCadre
                .Statut.VALIDE
            )

            compte_rendu.valide_par = (
                profil
            )

            compte_rendu.date_validation = (
                timezone.now()
            )

            try:
                compte_rendu.full_clean()

            except DjangoValidationError as error:
                if hasattr(
                    error,
                    "message_dict",
                ):
                    raise ValidationError(
                        error.message_dict
                    )

                raise ValidationError(
                    {
                        "detail": (
                            error.messages
                        )
                    }
                )

            compte_rendu.save()

            try:
                envoyer_compte_rendu_cadre(
                    compte_rendu
                )

            except ImproperlyConfigured as error:
                raise ValidationError(
                    {
                        "email": str(error)
                    }
                )

            except Exception as error:
                raise ValidationError(
                    {
                        "email": (
                            "Le compte rendu n'a pas "
                            "pu être envoyé au DRH : "
                            f"{str(error)}"
                        )
                    }
                )

            compte_rendu.statut = (
                CompteRenduEntretienCadre
                .Statut.ENVOYE
            )

            compte_rendu.date_envoi = (
                timezone.now()
            )

            compte_rendu.save(
                update_fields=[
                    "statut",
                    "date_envoi",
                    "date_modification",
                ]
            )

            if (
                decision
                ==
                CompteRenduEntretienCadre
                .DecisionFinale.RETENU
            ):
                candidat.statut = (
                    Candidat.Statut.RETENU
                )

                candidat.save(
                    update_fields=[
                        "statut",
                        "date_modification",
                    ]
                )

                taches = (
                    creer_taches_preparation_cadre(
                        candidat=candidat,
                        cree_par=profil,
                    )
                )

            else:
                candidat.statut = (
                    Candidat.Statut.NON_RETENU
                )

                candidat.save(
                    update_fields=[
                        "statut",
                        "date_modification",
                    ]
                )

                supprimer_taches_si_non_retenu(
                    candidat
                )

                taches = []

        log_action(
            request,
            compte_rendu,
            "CR_SEND",
            {
                "decision_finale": (
                    decision
                ),
                "nombre_taches_creees": (
                    len(taches)
                ),
            },
        )

        serializer = self.get_serializer(
            compte_rendu
        )

        return Response(
            {
                "message": (
                    "Le compte rendu a été "
                    "validé et envoyé au DRH."
                ),
                "candidat_retenu": (
                    decision
                    ==
                    CompteRenduEntretienCadre
                    .DecisionFinale.RETENU
                ),
                "nombre_taches_preparation": (
                    len(taches)
                ),
                "compte_rendu": (
                    serializer.data
                ),
            },
            status=status.HTTP_200_OK,
        )


class MesComptesRendusViewSet(viewsets.ViewSet):
    """
    Page « Mes comptes rendus à rédiger » : candidats dont
    l'utilisateur connecté est rédacteur du compte rendu.
    Ouverte à tout profil RH actif ; la liste est vide pour
    les autres.
    """

    def get_candidats(self):
        profil = get_hr_profile(self.request)

        if not profil:
            return Candidat.objects.none()

        return (
            Candidat.objects
            .filter(
                redacteurs_compte_rendu=profil,
                processus__demande__type_recrutement=(
                    DemandeRecrutement.TypeRecrutement.CADRE
                ),
            )
            .exclude(statut=Candidat.Statut.AJOUTE)
            .select_related(
                "processus__demande__poste",
                "compte_rendu_cadre",
            )
            .order_by("-date_entretien_prevue")
        )

    def list(self, request):
        return Response(
            [
                candidat_pour_redacteur(candidat)
                for candidat in self.get_candidats()
            ]
        )

    def retrieve(self, request, pk=None):
        candidat = get_object_or_404(self.get_candidats(), pk=pk)

        return Response(candidat_pour_redacteur(candidat))

class TachePreparationEmbaucheViewSet(
    viewsets.ModelViewSet
):
    serializer_class = (
        TachePreparationEmbaucheSerializer
    )

    queryset = (
        TachePreparationEmbauche.objects
        .select_related(
            "candidat",
            "candidat__processus",
            "candidat__processus__demande",
            "assignee_a",
            "cree_par",
            "terminee_par",
        )
        .order_by(
            "statut",
            "service",
            "date_creation",
        )
    )

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_fields = {
        "candidat": ["exact"],
        "candidat__processus": ["exact"],
        "service": ["exact"],
        "statut": ["exact"],
        "assignee_a": ["exact"],
        "terminee_par": ["exact"],
    }

    search_fields = [
        "candidat__nom",
        "candidat__prenom",
        "candidat__email",
        "libelle",
        "commentaire",
    ]

    ordering_fields = [
        "date_creation",
        "date_modification",
        "service",
        "statut",
    ]

    ordering = [
        "statut",
        "service",
        "date_creation",
    ]

    http_method_names = [
        "get",
        "patch",
        "post",
        "head",
        "options",
    ]

    @action(
        detail=True,
        methods=["post"],
        url_path="renvoyer-notification",
    )
    def renvoyer_notification(
        self,
        request,
        pk=None,
    ):
        """
        Renvoie l'e-mail pour toutes les tâches
        du même service et du même candidat.
        """
        tache = self.get_object()
        candidat = tache.candidat

        if not candidat.est_cadre:
            raise ValidationError(
                {
                    "detail": (
                        "Les notifications de préparation "
                        "concernent uniquement les candidats cadres."
                    )
                }
            )

        taches_service = list(
            TachePreparationEmbauche.objects
            .filter(
                candidat=candidat,
                service=tache.service,
            )
            .order_by("type_tache")
        )

        if not taches_service:
            raise ValidationError(
                {
                    "detail": (
                        "Aucune tâche n'est disponible "
                        "pour ce service."
                    )
                }
            )

        resultat_service = {
            "envoye": False,
            "destinataires": [],
            "erreur": (
                "Aucun résultat d'envoi disponible."
            ),
        }

        resultats = (
            notifier_services_preparation_cadre(
                candidat=candidat,
                taches=taches_service,
            )
            or {}
        )

        if isinstance(resultats, dict):
            resultat_service = resultats.get(
                tache.service,
                resultat_service,
            )

        tache.refresh_from_db()

        envoi_reussi = bool(
            resultat_service.get("envoye", False)
        )

        log_action(
            request,
            tache,
            "MAIL_RETRY",
            {
                "service": tache.service,
                "envoye": envoi_reussi,
            },
        )

        code_reponse = (
            status.HTTP_200_OK
            if envoi_reussi
            else status.HTTP_400_BAD_REQUEST
        )

        message = (
            "La notification a été renvoyée avec succès."
            if envoi_reussi
            else (
                resultat_service.get("erreur")
                or "La notification n'a pas pu être envoyée."
            )
        )

        return Response(
            {
                "message": message,
                "resultat": resultat_service,
                "tache": self.get_serializer(tache).data,
            },
            status=code_reponse,
        )
    
class RetourRHCandidatViewSet(ModelViewSet):
    queryset = (
        RetourRHCandidat.objects
        .select_related(
            "candidat",
            "candidat__processus",
        )
        .prefetch_related("documents")
        .order_by("-date_creation")
    )

    serializer_class = RetourRHCandidatSerializer

    filterset_fields = {
        "candidat": ["exact"],
        "candidat__processus": ["exact"],
        "liste_imprimee": ["exact"],
        "liste_remise": ["exact"],
    }

    search_fields = [
        "candidat__nom",
        "candidat__prenom",
        "responsable_rh",
    ]

class DocumentCandidatViewSet(
    ViewSetRecrutementBase
):
    queryset = (
        DocumentCandidat.objects
        .select_related(
            "retour_rh",
            "retour_rh__candidat",
        )
        .all()
    )

    serializer_class = (
        DocumentCandidatSerializer
    )

    filter_backends = [
        DjangoFilterBackend,
    ]

    filterset_fields = [
        "retour_rh",
        "recu",
    ]

    # Les documents sont créés automatiquement
    # lors de la création du Retour RH.
    http_method_names = [
        "get",
        "post",
        "patch",
        "head",
        "options",
    ]


class EmbaucheViewSet(ModelViewSet):
    serializer_class = EmbaucheSerializer

    queryset = (
        Embauche.objects
        .select_related(
            "candidat",
            "candidat__processus",
            "candidat__processus__demande",
            "candidat__processus__demande__poste",
            "candidat__processus__demande__departement",
            "employe",
        )
        .prefetch_related(
            "candidat__retour_rh__documents",
        )
        .order_by("-date_creation")
    )

    filterset_fields = {
        "candidat": ["exact"],
        "candidat__processus": ["exact"],
        "type_contrat": ["exact"],
        "date_confirmation": [
            "isnull",
        ],
    }

    search_fields = [
        "candidat__nom",
        "candidat__prenom",
        "candidat__email",
        "candidat__telephone",
        "verificateur",
    ]

    ordering_fields = [
        "date_creation",
        "date_confirmation",
        "date_debut_contrat",
    ]

    ordering = [
        "-date_creation",
    ]

    @action(
        detail=True,
        methods=["get"],
        url_path="fiche-poste",
    )
    def fiche_poste(self, request, pk=None):
        embauche = self.get_object()

        if not embauche.confirmee:
            raise ValidationError({
                "detail": (
                    "La fiche de poste est disponible après "
                    "la confirmation de l’embauche."
                )
            })

        contenu = generer_fiche_poste(embauche)
        nom_fichier = (
            f"fiche_de_poste_{embauche.candidat.nom}_"
            f"{embauche.candidat.prenom}.docx"
        ).replace(" ", "_")

        reponse = HttpResponse(
            contenu.getvalue(),
            content_type=(
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document"
            ),
        )
        reponse["Content-Disposition"] = (
            f'attachment; filename="{nom_fichier}"'
        )
        return reponse

    def perform_destroy(self, instance):
        if instance.date_confirmation:
            raise ValidationError(
                {
                    "detail": (
                        "Une embauche confirmée "
                        "ne peut pas être supprimée."
                    )
                }
            )

        instance.delete()

    def verifier_informations_embauche(
        self,
        embauche,
    ):
        erreurs = {}

        est_cadre = embauche.est_cadre

        # La date de vérification et le vérificateur ne sont plus
        # saisis à l'écran : ils sont remplis automatiquement
        # (date du jour, utilisateur connecté) et restent facultatifs.

        if not embauche.date_debut_contrat:
            erreurs["date_debut_contrat"] = (
                "La date de début du contrat "
                "est obligatoire."
            )

        if est_cadre:
            if not embauche.dossier_embauche_complet:
                erreurs["dossier_embauche_complet"] = (
                    "Le dossier d'embauche doit être complet."
                )

            if not embauche.contrat_travail_signe:
                erreurs["contrat_travail_signe"] = (
                    "Le contrat de travail signé doit être confirmé."
                )

            # La journée d'intégration et la communication des deux
            # documents sont vérifiées lors de la clôture finale.
            # L'e-mail envoyé après confirmation marque automatiquement
            # le RI et le Code société comme communiqués.
        else:
            if not embauche.signe_candidat:
                erreurs["signe_candidat"] = (
                    "La signature du candidat doit être confirmée."
                )

            if not embauche.signe_employeur:
                erreurs["signe_employeur"] = (
                    "La signature de l'employeur doit être confirmée."
                )

        if erreurs:
            raise ValidationError(erreurs)

    def verifier_quota_contrat(
        self,
        embauche,
    ):
        processus = (
            embauche
            .candidat
            .processus
        )

        demande = processus.demande

        if (
            embauche.type_contrat
            == Embauche.TypeContrat.CDI
        ):
            quota = demande.nombre_cdi
        else:
            quota = demande.nombre_cdd

        # On compte uniquement les personnes
        # toujours réellement embauchées.
        embauches_actives = (
            Embauche.objects
            .filter(
                candidat__processus=processus,
                candidat__statut=(
                    Candidat.Statut.EMBAUCHE
                ),
                type_contrat=(
                    embauche.type_contrat
                ),
                date_confirmation__isnull=False,
                desistement__isnull=True,
            )
            .exclude(
                pk=embauche.pk
            )
            .count()
        )

        if embauches_actives >= quota:
            raise ValidationError({
                "type_contrat": (
                    f"Le quota de {quota} contrat(s) "
                    f"{embauche.type_contrat} "
                    "est deja atteint."
                )
            })

    @action(
        detail=True,
        methods=["post"],
        url_path="confirmer",
    )
    def confirmer(self, request, pk=None):
        with transaction.atomic():
            embauche = (
                Embauche.objects
                .select_for_update()
                .select_related(
                    "candidat",
                    "candidat__processus",
                    "candidat__processus__demande",
                )
                .prefetch_related(
                    "candidat__retour_rh__documents",
                )
                .get(pk=self.get_object().pk)
            )

            demande = embauche.candidat.processus.demande
            est_cadre = (
                demande.type_recrutement
                == DemandeRecrutement.TypeRecrutement.CADRE
            )

            # Une embauche déjà  confirmée n'est pas recréée. Pour un
            # cadre, l'action permet toutefois de retenter un e-mail
            # qui aurait échoué lors de la première confirmation.
            deja_confirmee = bool(embauche.date_confirmation)

            if not deja_confirmee:
                if est_cadre:
                    statuts_autorises = [
                        Candidat.Statut.RETENU,
                        Candidat.Statut.EMBAUCHE,
                    ]
                    message_statut = (
                        "Seul un candidat cadre retenu peut être embauché."
                    )
                else:
                    statuts_autorises = [
                        Candidat.Statut.RECU,
                        Candidat.Statut.EMBAUCHE,
                    ]
                    message_statut = (
                        "Seul un candidat ouvrier reçu peut être embauché."
                    )

                if embauche.candidat.statut not in statuts_autorises:
                    raise ValidationError({"detail": message_statut})

                # La liste des dossiers à fournir est facultative :
                # elle n'est plus exigée pour confirmer l'embauche.
                self.verifier_informations_embauche(embauche)
                self.verifier_quota_contrat(embauche)

                embauche.date_confirmation = timezone.now()
                embauche.save(
                    update_fields=[
                        "date_confirmation",
                        "date_modification",
                    ]
                )

                candidat = embauche.candidat
                candidat.statut = Candidat.Statut.EMBAUCHE
                candidat.save(
                    update_fields=[
                        "statut",
                        "date_modification",
                    ]
                )

        resultat_email = None

        if (
            est_cadre
            and not embauche.documents_cadre_email_envoyes
        ):
            resultat_email = envoyer_documents_onboarding_cadre(
                embauche
            )

            # Recharge les champs de traçabilité modifiés par le
            # service d'e-mail avant de construire la réponse.
            embauche.refresh_from_db()

            if not resultat_email.get("envoye"):
                return Response(
                    {
                        "detail": (
                            "L'embauche a été confirmée, mais l'envoi du "
                            "RI et du Code société a échoué."
                        ),
                        "email": resultat_email,
                        "embauche": self.get_serializer(embauche).data,
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        serializer = self.get_serializer(
            embauche
        )

        return Response(
            {
                **serializer.data,
                "email_onboarding": resultat_email,
            },
            status=status.HTTP_200_OK,
        )

class DesistementEmbaucheViewSet(
    ViewSetRecrutementBase
):

    serializer_class = (
        DesistementEmbaucheSerializer
    )

    queryset = (
        DesistementEmbauche.objects
        .select_related(
            "embauche",
            "embauche__candidat",
            "embauche__candidat__processus",
            (
                "embauche__candidat__processus__"
                "demande"
            ),
            (
                "embauche__candidat__processus__"
                "demande__poste"
            ),
            "enregistre_par",
        )
        .order_by(
            "-date_enregistrement"
        )
    )

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_fields = {
        "embauche": [
            "exact",
        ],

        "embauche__candidat": [
            "exact",
        ],

        "embauche__candidat__processus": [
            "exact",
        ],

        "relancer_recrutement": [
            "exact",
        ],

        "date_desistement": [
            "exact",
            "gte",
            "lte",
        ],

        "date_reprise_recrutement": [
            "exact",
            "gte",
            "lte",
            "isnull",
        ],
    }

    search_fields = [
        "embauche__candidat__nom",
        "embauche__candidat__prenom",
        "embauche__candidat__email",
        (
            "embauche__candidat__processus__"
            "demande__reference"
        ),
        (
            "embauche__candidat__processus__"
            "demande__poste__name"
        ),
        "motif",
        "commentaire",
    ]

    ordering_fields = [
        "date_desistement",
        "date_reprise_recrutement",
        "date_enregistrement",
    ]

    ordering = [
        "-date_enregistrement",
    ]

    def create(
        self,
        request,
        *args,
        **kwargs,
    ):
        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        embauche = (
            serializer
            .validated_data[
                "embauche"
            ]
        )

        with transaction.atomic():
            # Verrouillage afin d'éviter que deux
            # désistements soient enregistrés
            # simultanément pour la même embauche.
            embauche_verrouillee = (
                Embauche.objects
                .select_for_update()
                .select_related(
                    "candidat",
                    "candidat__processus",
                    (
                        "candidat__processus__"
                        "demande"
                    ),
                )
                .get(pk=embauche.pk)
            )

            if not embauche_verrouillee.confirmee:
                raise ValidationError({
                    "embauche": (
                        "Cette embauche n'a pas "
                        "encore été confirmée."
                    )
                })

            if (
                DesistementEmbauche.objects
                .filter(
                    embauche=(
                        embauche_verrouillee
                    )
                )
                .exists()
            ):
                raise ValidationError({
                    "embauche": (
                        "Le désistement de cette "
                        "personne a déjà  été "
                        "enregistré."
                    )
                })

            desistement = serializer.save(
                embauche=(
                    embauche_verrouillee
                )
            )

            processus = (
                embauche_verrouillee
                .candidat
                .processus
            )

            # Le candidat reste dans l'historique, mais ne doit plus
            # être compté parmi les reçus ou les embauchés actifs.
            Candidat.objects.filter(
                pk=embauche_verrouillee.candidat_id
            ).update(
                statut=Candidat.Statut.DESISTE,
                date_modification=timezone.now(),
            )

            embauche_verrouillee.candidat.refresh_from_db()

            if desistement.relancer_recrutement:
                # Dans les deux parcours, la reprise commence à
                # l'étape 2 : candidatures et entretiens pour les
                # cadres, fiche de transparence pour les ouvriers.
                etape_reprise = 2

                processus.statut = (
                    ProcessusRecrutement.Statut.RELANCE_DESISTEMENT
                )
                processus.etape_actuelle = etape_reprise
                processus.etapes_terminees = [
                    numero
                    for numero in processus.etapes_terminees
                    if numero < etape_reprise
                ]

                # La date_cloture existante est volontairement
                # conservée : elle représente la première clôture.
                processus.save(
                    update_fields=[
                        "statut",
                        "etape_actuelle",
                        "etapes_terminees",
                        "date_modification",
                    ]
                )

            log_action(
                request,
                desistement,
                "DESISTEMENT",
                changes={
                    "embauche_id": (
                        embauche_verrouillee.id
                    ),

                    "candidat_id": (
                        embauche_verrouillee
                        .candidat_id
                    ),

                    "date_desistement": (
                        str(
                            desistement
                            .date_desistement
                        )
                    ),

                    "relancer_recrutement": (
                        desistement
                        .relancer_recrutement
                    ),

                    "date_reprise_recrutement": (
                        str(
                            desistement
                            .date_reprise_recrutement
                        )
                        if desistement
                        .date_reprise_recrutement
                        else None
                    ),
                },
            )

        serializer_reponse = (
            self.get_serializer(
                desistement
            )
        )

        return Response(
            {
                "message": (
                    "Le désistement a été "
                    "enregistré."
                ),

                "desistement": (
                    serializer_reponse.data
                ),

                "reprise_recrutement": {
                    "demandee": (
                        desistement
                        .relancer_recrutement
                    ),

                    "date_prevue": (
                        desistement
                        .date_reprise_recrutement
                    ),

                    "processus_cree": False,
                },
            },
            status=status.HTTP_201_CREATED,
        )

    def perform_destroy(
        self,
        instance,
    ):

        instance.delete()

    @action(
        detail=False,
        methods=["get"],
        url_path="a-reprendre",
    )
    def a_reprendre(
        self,
        request,
    ):
        desistements = (
            self.get_queryset()
            .filter(
                relancer_recrutement=True,
                date_reprise_recrutement__lte=(
                    timezone.localdate()
                ),
                date_nouvelle_cloture__isnull=True,
            )
        )

        page = self.paginate_queryset(
            desistements
        )

        if page is not None:
            serializer = self.get_serializer(
                page,
                many=True,
            )

            return (
                self.get_paginated_response(
                    serializer.data
                )
            )

        serializer = self.get_serializer(
            desistements,
            many=True,
        )

        return Response(
            serializer.data
        )
