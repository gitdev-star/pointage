from io import BytesIO

from rest_framework.viewsets import ModelViewSet

from .emails import (
    notifier_decision_demande,
    notifier_nouvelle_demande,
    notifier_validation_directeur_au_drh,
    envoyer_compte_rendu_cadre,
    notifier_services_preparation_cadre,
    envoyer_documents_onboarding_cadre,
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

from openpyxl import Workbook

from rest_framework import (
    filters,
    serializers as drf_serializers,
    status,
    viewsets,
)

from rest_framework.exceptions import ValidationError

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
    TACHES_PREPARATION_CADRE,
)

from .permissions import (
    PermissionRecrutement,
    PermissionDirecteurRecrutement,
    PermissionDRHRecrutement,
    PermissionProprietaireDemande,
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
    CompteRenduEntretienCadreSerializer,
    TachePreparationEmbaucheSerializer,
    creer_employe_depuis_embauche,
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

        if self.action in [
            "update",
            "partial_update",
            "destroy",
        ]:
            return [
                PermissionRecrutement(),
                PermissionProprietaireDemande(),
            ]

        return [
            PermissionRecrutement()
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
                        "Cette demande n’est plus en "
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
                        "Cette demande n’est pas en "
                        "attente de l’approbation du DRH."
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
                        "Cette demande n’est pas en "
                        "attente de l’approbation du DRH."
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

    filterset_fields = [
        "statut",
        "etape_actuelle",
        "offre",
        "demande__type_recrutement",
    ]

    search_fields = [
        "demande__reference",
        "demande__poste__name",
        "demande__departement__name",
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

        # Étape 1 commune :
        # création ou sélection de l’offre.
        if numero_etape == 1:
            if not processus.offre_id:
                return (
                    "Sélectionnez ou téléversez "
                    "une offre avant de terminer "
                    "l’étape 1."
                )

            if not processus.offre.active:
                return (
                    "L’offre sélectionnée "
                    "n’est plus active."
                )

            if not processus.offre.fichier:
                return (
                    "Le fichier de l’offre "
                    "est introuvable."
                )

            return None

        # Étape 2 commune :
        # publication de l’offre.
        if numero_etape == 2:
            if not (
                processus
                .publications
                .exists()
            ):
                return (
                    "Ajoutez au moins une "
                    "publication avant de "
                    "terminer l’étape 2."
                )

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
        # Étape 3 :
        # candidatures, entretiens
        # et comptes rendus.
        if numero_etape == 3:
            candidats = (
                processus.candidats.all()
            )

            if not candidats.exists():
                return (
                    "Ajoutez au moins un "
                    "candidat cadre."
                )

            statuts_finaux = [
                Candidat.Statut.RETENU,
                Candidat.Statut.NON_RETENU,
                Candidat.Statut.EMBAUCHE,
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
                    "L’entretien et le compte "
                    "rendu doivent être terminés "
                    "pour le candidat "
                    f"{candidat_non_traite.nom_complet}."
                )

            compte_rendu_non_envoye = (
                candidats
                .exclude(
                    statut=(
                        Candidat.Statut.EMBAUCHE
                    )
                )
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
                    "doit être envoyé au DRH."
                )

            candidat_retenu_existe = (
                candidats
                .filter(
                    statut__in=[
                        Candidat.Statut.RETENU,
                        Candidat.Statut.EMBAUCHE,
                    ]
                )
                .exists()
            )

            if not candidat_retenu_existe:
                return (
                    "Au moins un candidat cadre "
                    "doit être retenu."
                )

            return None

        # Étape 4 :
        # préparation de l’embauche.
        # Étape 4 :
# préparation automatique de l’embauche.
        if numero_etape == 4:
            candidats_retenus = (
                processus
                .candidats
                .filter(
                    statut__in=[
                        Candidat.Statut.RETENU,
                        Candidat.Statut.EMBAUCHE,
                    ]
                )
            )

            if not candidats_retenus.exists():
                return (
                    "Aucun candidat cadre "
                    "retenu n’est disponible."
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
                        "préparation n’ont pas été "
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

        # Étape 5 :
        # embauche, onboarding et clôture.
        if numero_etape == 5:
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
                    "La checklist d’embauche et d’onboarding doit être "
                    "complète pour chaque candidat cadre retenu. "
                    "Le RI et le Code société doivent également avoir "
                    "été envoyés par e-mail lorsque le candidat possède "
                    "une adresse e-mail."
                )

            return None

        return (
            "Cette étape n’existe pas dans "
            "le parcours de recrutement "
            "des cadres."
        )

    def verifier_etape_ouvrier(
        self,
        processus,
        numero_etape,
    ):
        # Étape 3 :
        # fiche de transparence.
        if numero_etape == 3:
            if not hasattr(
                processus,
                "fiche_transparence",
            ):
                return (
                    "La fiche de transparence "
                    "est obligatoire."
                )

            return None

        # Étape 4 :
        # suivi des candidatures.
        if numero_etape == 4:
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

            # L’e-mail au Chargé RH du site
            # sera déclenché automatiquement
            # au moment de terminer cette étape.

            return None

        # Étape 5 :
        # Retour RH.
        if numero_etape == 5:
            candidats_retenus = (
                processus
                .candidats
                .filter(
                    statut=(
                        Candidat.Statut.RECU
                    )
                )
            )

            if not candidats_retenus.exists():
                return (
                    "Aucun candidat reçu "
                    "n’est disponible."
                )

            retour_absent = (
                candidats_retenus
                .filter(
                    retour_rh__isnull=True
                )
                .first()
            )

            if retour_absent:
                return (
                    "Le Retour RH est absent "
                    "pour "
                    f"{retour_absent.nom_complet}."
                )

            retour_incomplet = (
                candidats_retenus
                .filter(
                    retour_rh__liste_remise=False
                )
                .first()
            )

            if retour_incomplet:
                return (
                    "Le Retour RH doit être "
                    "validé pour "
                    f"{retour_incomplet.nom_complet}."
                )

            return None

        # Étape 6 :
        # embauche et clôture.
        if numero_etape == 6:
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
            "Cette étape n’existe pas dans "
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
                        "d’étape valide."
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
                                "Le profil RH de l’utilisateur connecté "
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
                processus.date_cloture = timezone.now()
                processus.cloture_par = profil_cloture
                processus.save(
                    update_fields=[
                        "date_cloture",
                        "cloture_par",
                        "date_modification",
                    ]
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
                    f"L’étape {numero_etape} "
                    "a été terminée."
                ),
                "processus": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="fichier-suivi-excel",
    )
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
                        candidat.fiche_test.name
                        if candidat.fiche_test
                        else ""
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
        )
        .all()
    )

    serializer_class = (
        CandidatSerializer
    )

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
            .Statut.TERMINE
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
            3 if est_cadre else 4
        )

        if (
            processus.etape_actuelle
            != etape_attendue
        ):
            raise drf_serializers.ValidationError(
                {
                    "processus": (
                        "Les candidats peuvent "
                        "être ajoutés uniquement "
                        f"pendant l’étape "
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
            .Statut.TERMINE
        ):
            raise drf_serializers.ValidationError(
                {
                    "detail": (
                        "Ce processus est terminé."
                    )
                }
            )

        if processus.etape_actuelle != 3:
            raise drf_serializers.ValidationError(
                {
                    "detail": (
                        "Les entretiens cadres "
                        "sont disponibles uniquement "
                        "pendant l’étape 3."
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
                        "L’entretien ne peut "
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

        if date_entretien <= timezone.now():
            raise drf_serializers.ValidationError(
                {
                    "date_entretien_prevue": (
                        "La date prévue doit "
                        "être dans le futur."
                    )
                }
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

        candidat.save(
            update_fields=[
                "date_entretien_prevue",
                "date_entretien_realisee",
                "statut",
                "date_modification",
            ]
        )

        log_action(
            request,
            candidat,
            "INT_PLAN",
            {
                "date_entretien_prevue": (
                    date_entretien.isoformat()
                )
            },
        )

        serializer = self.get_serializer(
            candidat
        )

        return Response(
            {
                "message": (
                    "L’entretien a été "
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
                        "L’entretien doit d’abord "
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
                    "L’entretien est marqué "
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

        if not candidat.est_cadre:
            raise ValidationError(
                {
                    "candidat": (
                        "Le compte rendu concerne "
                        "uniquement un candidat cadre."
                    )
                }
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
                        "L’entretien doit être "
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
                        "Un compte rendu déjà "
                        "envoyé ne peut plus "
                        "être modifié."
                    )
                }
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
                            "Le compte rendu a déjà "
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
                            "Ce candidat n’est pas "
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
                            "l’état actuel du candidat."
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
                            "Le compte rendu n’a pas "
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
                        "Aucune tâche n’est disponible "
                        "pour ce service."
                    )
                }
            )

        resultat_service = {
            "envoye": False,
            "destinataires": [],
            "erreur": (
                "Aucun résultat d’envoi disponible."
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
                or "La notification n’a pas pu être envoyée."
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

    def verifier_documents(self, embauche):
        try:
            retour_rh = (
                embauche
                .candidat
                .retour_rh
            )
        except Exception:
            raise ValidationError(
                {
                    "detail": (
                        "Le Retour RH du candidat "
                        "est introuvable."
                    )
                }
            )

        if not retour_rh.liste_remise:
            raise ValidationError(
                {
                    "detail": (
                        "La liste des documents "
                        "n’a pas été remise au candidat."
                    )
                }
            )

        documents = retour_rh.documents.all()

        if not documents.exists():
            raise ValidationError(
                {
                    "detail": (
                        "Aucune pièce obligatoire "
                        "n’est enregistrée pour ce candidat."
                    )
                }
            )

        documents_manquants = list(
            documents
            .filter(recu=False)
            .values_list(
                "libelle",
                flat=True,
            )
        )

        if documents_manquants:
            raise ValidationError(
                {
                    "documents": (
                        "Les pièces suivantes ne sont "
                        "pas encore reçues : "
                        + ", ".join(
                            documents_manquants
                        )
                    )
                }
            )

    def verifier_informations_embauche(
        self,
        embauche,
    ):
        erreurs = {}

        est_cadre = embauche.est_cadre

        if not embauche.verificateur.strip():
            erreurs["verificateur"] = (
                "Le nom du vérificateur "
                "est obligatoire."
            )

        if not embauche.date_verification:
            erreurs["date_verification"] = (
                "La date de vérification "
                "est obligatoire."
            )

        if not embauche.date_debut_contrat:
            erreurs["date_debut_contrat"] = (
                "La date de début du contrat "
                "est obligatoire."
            )

        if est_cadre:
            if not embauche.dossier_embauche_complet:
                erreurs["dossier_embauche_complet"] = (
                    "Le dossier d’embauche doit être complet."
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
                    "La signature de l’employeur doit être confirmée."
                )

        if erreurs:
            raise ValidationError(erreurs)

    def verifier_quota_contrat(
        self,
        embauche,
    ):
        demande = (
            embauche
            .candidat
            .processus
            .demande
        )

        embauches_confirmees = (
            Embauche.objects
            .filter(
                candidat__processus=(
                    embauche
                    .candidat
                    .processus
                ),
                type_contrat=(
                    embauche.type_contrat
                ),
                date_confirmation__isnull=False,
            )
            .exclude(pk=embauche.pk)
            .count()
        )

        if (
            embauche.type_contrat
            == Embauche.TypeContrat.CDI
        ):
            quota = demande.nombre_cdi
        else:
            quota = demande.nombre_cdd

        if embauches_confirmees >= quota:
            raise ValidationError(
                {
                    "type_contrat": (
                        f"Le quota de {quota} contrat(s) "
                        f"{embauche.type_contrat} "
                        "est déjà atteint."
                    )
                }
            )

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

            # Une embauche déjà confirmée n'est pas recréée. Pour un
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

                # Le Retour RH et les pièces détaillées concernent
                # uniquement le parcours ouvrier.
                if not est_cadre:
                    self.verifier_documents(embauche)

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
                            "L’embauche a été confirmée, mais l’envoi du "
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
