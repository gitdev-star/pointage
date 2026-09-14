from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from accounts.permissions import get_hr_profile
from employees.models import Employee

from .models import (
    ajouter_jours_ouvres,
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
)


DOCUMENTS_RH_PAR_DEFAUT = [
    "2 photocopies de la CIN",
    "1 photocopie lÃƒÆ’Ã‚Â©galisÃƒÆ’Ã‚Â©e de la CIN",
    "2 certificats de rÃƒÆ’Ã‚Â©sidence",
    "4 photos rÃƒÆ’Ã‚Â©centes",
    "1 photocopie de la carte CNAPS",
    "NumÃƒÆ’Ã‚Â©ro de compte bancaire ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â RIB de 23 chiffres",
    (
        "Copie du livret de famille ou actes de naissance "
        "des enfants de moins de 21 ans"
    ),
    "Photocopies de tous les diplÃƒÆ’Ã‚Â´mes",
    "Copies des certificats de travail",
    "CV et demande dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢emploi",
]


def valider_fichier(
    fichier,
    extensions_autorisees=(
        "pdf",
        "jpg",
        "jpeg",
        "png",
    ),
):
    if not fichier:
        return fichier

    nom_fichier = fichier.name.lower()

    extension = (
        nom_fichier.rsplit(".", 1)[-1]
        if "." in nom_fichier
        else ""
    )

    if extension not in extensions_autorisees:
        extensions = ", ".join(
            valeur.upper()
            for valeur in extensions_autorisees
        )

        raise serializers.ValidationError(
            f"Formats autorisÃƒÆ’Ã‚Â©s : {extensions}."
        )

    taille_maximale = 10 * 1024 * 1024

    if fichier.size > taille_maximale:
        raise serializers.ValidationError(
            "Le fichier ne doit pas dÃƒÆ’Ã‚Â©passer 10 Mo."
        )

    return fichier


class TachePreparationEmbaucheSerializer(
    serializers.ModelSerializer
):
    candidat_nom = serializers.CharField(
        source="candidat.nom_complet",
        read_only=True,
    )

    processus_id = serializers.IntegerField(
        source="candidat.processus_id",
        read_only=True,
    )

    reference_recrutement = serializers.CharField(
        source=(
            "candidat.processus."
            "demande.reference"
        ),
        read_only=True,
    )

    poste = serializers.CharField(
        source=(
            "candidat.processus."
            "demande.poste.name"
        ),
        read_only=True,
    )

    service_libelle = serializers.CharField(
        source="get_service_display",
        read_only=True,
    )

    type_tache_libelle = (
        serializers.CharField(
            source="get_type_tache_display",
            read_only=True,
        )
    )

    statut_libelle = serializers.CharField(
        source="get_statut_display",
        read_only=True,
    )

    class Meta:
        model = (
            TachePreparationEmbauche
        )

        fields = [
            "id",
            "candidat",
            "candidat_nom",
            "processus_id",
            "reference_recrutement",
            "poste",
            "service",
            "service_libelle",
            "type_tache",
            "type_tache_libelle",
            "libelle",
            "statut",
            "statut_libelle",
            "assignee_a",
            "cree_par",
            "terminee_par",
            "commentaire",
            "date_debut",
            "date_fin",
            "notification_email_envoyee",
            "date_notification_email",
            "destinataires_notification",
            "erreur_notification",
            "nombre_tentatives_notification",
            "date_creation",
            "date_modification",
        ]

        read_only_fields = [
            "id",
            "candidat",
            "service",
            "type_tache",
            "libelle",
            "statut",
            "cree_par",
            "terminee_par",
            "date_debut",
            "date_fin",
            "notification_email_envoyee",
            "date_notification_email",
            "destinataires_notification",
            "erreur_notification",
            "nombre_tentatives_notification",
            "date_creation",
            "date_modification",
        ]

    def get_assignee_nom(
        self,
        tache,
    ):
        profil = tache.assignee_a

        if not profil:
            return ""

        return (
            getattr(
                profil,
                "nom_complet",
                "",
            )
            or getattr(
                profil,
                "username",
                "",
            )
        )
    
class DemandeRecrutementSerializer(
    serializers.ModelSerializer
):
    nombre_total = serializers.IntegerField(
        read_only=True
    )

    poste_nom = serializers.CharField(
        source="poste.name",
        read_only=True,
    )

    factory_nom = serializers.CharField(
        source="factory.name",
        read_only=True,
    )

    departement_nom = serializers.CharField(
        source="departement.name",
        read_only=True,
    )

    statut_libelle = serializers.CharField(
        source="get_statut_display",
        read_only=True,
    )

    motif_libelle = serializers.CharField(
        source="get_motif_display",
        read_only=True,
    )

    motif_remplacement_libelle = (
        serializers.CharField(
            source=(
                "get_motif_remplacement_display"
            ),
            read_only=True,
        )
    )

    validation_directeur_effectuee = (
        serializers.BooleanField(
            read_only=True,
        )
    )

    approbation_drh_effectuee = (
        serializers.BooleanField(
            read_only=True,
        )
    )

    validateur_directeur_nom = (
        serializers.SerializerMethodField()
    )

    approbateur_drh_nom = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = DemandeRecrutement
        fields = "__all__"

        read_only_fields = [
            "reference",
            "demandeur",

            # Remplis automatiquement avec
            # les informations de lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢utilisateur connectÃƒÆ’Ã‚Â©.
            "matricule_demandeur",
            "nom_demandeur",
            "poste_demandeur",
            "departement_demandeur",

            "statut",
            "motif_decision",
            "decide_par",
            "date_decision",

            # Ces informations sont exclusivement
            # renseignÃƒÆ’Ã‚Â©es par l'action d'approbation DRH.
            "approuve_par_drh",
            "date_approbation_drh",
            "commentaire_drh",

            "date_creation",
            "date_modification",
        ]

    @staticmethod
    def _nom_profil(profil):
        if not profil:
            return ""

        nom_complet = getattr(
            profil,
            "nom_complet",
            "",
        )

        if nom_complet:
            return nom_complet

        nom = " ".join(
            valeur.strip()
            for valeur in [
                getattr(profil, "first_name", ""),
                getattr(profil, "last_name", ""),
            ]
            if valeur and valeur.strip()
        )

        return (
            nom
            or getattr(profil, "username", "")
            or getattr(profil, "email", "")
        )

    def get_validateur_directeur_nom(self, demande):
        return self._nom_profil(
            demande.decide_par
        )

    def get_approbateur_drh_nom(self, demande):
        return self._nom_profil(
            demande.approuve_par_drh
        )

    def validate(self, donnees):
        instance = self.instance

        nombre_cdi = donnees.get(
            "nombre_cdi",
            getattr(
                instance,
                "nombre_cdi",
                0,
            ),
        )

        nombre_cdd = donnees.get(
            "nombre_cdd",
            getattr(
                instance,
                "nombre_cdd",
                0,
            ),
        )

        if nombre_cdi + nombre_cdd < 1:
            raise serializers.ValidationError(
                {
                    "nombre_cdi": (
                        "Indiquez au moins un poste "
                        "CDI ou CDD."
                    )
                }
            )

        motif = donnees.get(
            "motif",
            getattr(
                instance,
                "motif",
                None,
            ),
        )

        motif_remplacement = donnees.get(
            "motif_remplacement",
            getattr(
                instance,
                "motif_remplacement",
                "",
            ),
        )

        if (
            motif
            == DemandeRecrutement.Motif.REMPLACEMENT
            and not motif_remplacement
        ):
            raise serializers.ValidationError(
                {
                    "motif_remplacement": (
                        "SÃƒÆ’Ã‚Â©lectionnez le motif "
                        "du remplacement."
                    )
                }
            )

        if (
            motif
            != DemandeRecrutement.Motif.REMPLACEMENT
            and motif_remplacement
        ):
            raise serializers.ValidationError(
                {
                    "motif_remplacement": (
                        "Ce champ est uniquement "
                        "disponible pour un remplacement."
                    )
                }
            )

        factory = donnees.get(
            "factory",
            getattr(
                instance,
                "factory",
                None,
            ),
        )

        departement = donnees.get(
            "departement",
            getattr(
                instance,
                "departement",
                None,
            ),
        )

        if (
            factory
            and departement
            and departement.factory_id
            != factory.id
        ):
            raise serializers.ValidationError(
                {
                    "departement": (
                        "Ce dÃƒÆ’Ã‚Â©partement nÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢appartient "
                        "pas au site sÃƒÆ’Ã‚Â©lectionnÃƒÆ’Ã‚Â©."
                    )
                }
            )

        date_prevue = donnees.get(
            "date_prevue_recrutement"
        )

        if not instance and date_prevue:
            date_minimale = ajouter_jours_ouvres(
                timezone.localdate(),
                5,
            )

            if date_prevue < date_minimale:
                raise serializers.ValidationError(
                    {
                        "date_prevue_recrutement": (
                            "La date doit respecter "
                            "un dÃƒÆ’Ã‚Â©lai minimum de "
                            "5 jours ouvrÃƒÆ’Ã‚Â©s."
                        )
                    }
                )

        return donnees

    def obtenir_employe_connecte(
        self,
        profil,
    ):
        employes = (
            Employee.objects
            .select_related(
                "factory",
                "department",
                "job_title",
            )
            .filter(
                status=Employee.Status.ACTIVE,
            )
        )

        # Recherche prioritaire avec
        # lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢identifiant dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢authentification.
        employe = (
            employes
            .filter(
                auth_user_id=(
                    profil.auth_user_id
                )
            )
            .first()
        )

        # Recherche avec lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢adresse e-mail AD.
        if (
            not employe
            and profil.email
        ):
            employe = (
                employes
                .filter(
                    email__iexact=(
                        profil.email.strip()
                    )
                )
                .first()
            )

        # Le username peut parfois contenir
        # directement lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢adresse e-mail.
        if (
            not employe
            and profil.username
            and "@" in profil.username
        ):
            employe = (
                employes
                .filter(
                    email__iexact=(
                        profil.username.strip()
                    )
                )
                .first()
            )

        # Cas AD : username = "diamondra.r"
        # et Employee.email =
        # "diamondra.r@entreprise.com".
        if (
            not employe
            and profil.username
            and "@" not in profil.username
        ):
            debut_email = (
                f"{profil.username.strip()}@"
            )

            correspondances = (
                employes
                .filter(
                    email__istartswith=(
                        debut_email
                    )
                )
            )

            if correspondances.count() == 1:
                employe = (
                    correspondances.first()
                )

        if not employe:
            raise serializers.ValidationError(
                {
                    "demandeur": (
                        "Aucun employÃƒÆ’Ã‚Â© actif ne "
                        "correspond au compte connectÃƒÆ’Ã‚Â©. "
                        "VÃƒÆ’Ã‚Â©rifiez lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢adresse e-mail, "
                        "le statut et auth_user_id."
                    )
                }
            )

        return employe

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get(
            "request"
        )

        profil = (
            get_hr_profile(request)
            if request
            else None
        )

        if not profil:
            raise serializers.ValidationError(
                {
                    "demandeur": (
                        "Le profil de lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢utilisateur "
                        "connectÃƒÆ’Ã‚Â© est introuvable."
                    )
                }
            )

        employe = (
            self.obtenir_employe_connecte(
                profil
            )
        )

        nom_complet = " ".join(
            valeur.strip()
            for valeur in [
                employe.first_name or "",
                employe.last_name or "",
            ]
            if valeur and valeur.strip()
        )

        validated_data["demandeur"] = profil

        validated_data[
            "matricule_demandeur"
        ] = employe.employee_id

        validated_data[
            "nom_demandeur"
        ] = (
            nom_complet
            or profil.username
        )

        validated_data[
            "poste_demandeur"
        ] = (
            employe.job_title.name
            if employe.job_title
            else profil.job_title
            or "Non renseignÃƒÆ’Ã‚Â©"
        )

        validated_data[
            "departement_demandeur"
        ] = (
            employe.department.name
            if employe.department
            else (
                profil.department.name
                if profil.department
                else "Non renseignÃƒÆ’Ã‚Â©"
            )
        )

        return super().create(
            validated_data
        )

class CompteRenduEntretienCadreSerializer(
    serializers.ModelSerializer
):
    candidat_nom_complet = (
        serializers.CharField(
            source="candidat.nom_complet",
            read_only=True,
        )
    )

    candidat_nom = serializers.CharField(
        source="candidat.nom",
        read_only=True,
    )

    candidat_prenom = (
        serializers.CharField(
            source="candidat.prenom",
            read_only=True,
        )
    )

    candidat_email = (
        serializers.EmailField(
            source="candidat.email",
            read_only=True,
        )
    )

    candidat_telephone = (
        serializers.CharField(
            source="candidat.telephone",
            read_only=True,
        )
    )

    candidat_statut = (
        serializers.CharField(
            source="candidat.statut",
            read_only=True,
        )
    )

    processus_id = (
        serializers.IntegerField(
            source=(
                "candidat.processus_id"
            ),
            read_only=True,
        )
    )

    reference_processus = (
        serializers.CharField(
            source=(
                "candidat.processus"
                ".demande.reference"
            ),
            read_only=True,
        )
    )

    type_recrutement = (
        serializers.CharField(
            source=(
                "candidat.processus"
                ".demande.type_recrutement"
            ),
            read_only=True,
        )
    )

    statut_libelle = (
        serializers.CharField(
            source="get_statut_display",
            read_only=True,
        )
    )

    avis_rh_libelle = (
        serializers.CharField(
            source="get_avis_rh_display",
            read_only=True,
        )
    )

    avis_manager_libelle = (
        serializers.CharField(
            source=(
                "get_avis_manager_display"
            ),
            read_only=True,
        )
    )

    decision_finale_libelle = (
        serializers.CharField(
            source=(
                "get_decision_finale_display"
            ),
            read_only=True,
        )
    )

    cree_par_nom = (
        serializers.SerializerMethodField()
    )

    valide_par_nom = (
        serializers.SerializerMethodField()
    )

    peut_exporter_pdf = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = (
            CompteRenduEntretienCadre
        )

        fields = [
            "id",
            "reference",

            "candidat",
            "candidat_nom_complet",
            "candidat_nom",
            "candidat_prenom",
            "candidat_email",
            "candidat_telephone",
            "candidat_statut",

            "processus_id",
            "reference_processus",
            "type_recrutement",

            "date_entretien",
            "poste",

            "pretention_salariale",
            "devise",
            "disponibilite",
            "precision_disponibilite",
            "annees_experience",
            "diplome",
            "etablissement",

            "redacteur_rh",
            "redacteur_manager",

            "avis_rh",
            "avis_rh_libelle",
            "commentaire_rh",
            "nom_signataire_rh",
            "fonction_signataire_rh",
            "date_signature_rh",
            "signe_rh",

            "avis_manager",
            "avis_manager_libelle",
            "commentaire_manager",
            "nom_signataire_manager",
            "fonction_signataire_manager",
            "date_signature_manager",
            "signe_manager",

            "observation_generale",
            "decision_finale",
            "decision_finale_libelle",

            "statut",
            "statut_libelle",

            "cree_par",
            "cree_par_nom",
            "valide_par",
            "valide_par_nom",

            "date_validation",
            "date_envoi",
            "date_creation",
            "date_modification",

            "peut_exporter_pdf",
        ]

        read_only_fields = [
            "id",
            "reference",
            "poste",
            "statut",
            "cree_par",
            "valide_par",
            "date_validation",
            "date_envoi",
            "date_creation",
            "date_modification",
        ]

    def get_cree_par_nom(
        self,
        compte_rendu,
    ):
        profil = compte_rendu.cree_par

        if not profil:
            return ""

        return (
            getattr(
                profil,
                "nom_complet",
                "",
            )
            or getattr(
                profil,
                "full_name",
                "",
            )
            or getattr(
                profil,
                "username",
                "",
            )
        )

    def get_valide_par_nom(
        self,
        compte_rendu,
    ):
        profil = compte_rendu.valide_par

        if not profil:
            return ""

        return (
            getattr(
                profil,
                "nom_complet",
                "",
            )
            or getattr(
                profil,
                "full_name",
                "",
            )
            or getattr(
                profil,
                "username",
                "",
            )
        )

    def get_peut_exporter_pdf(
        self,
        compte_rendu,
    ):
        return bool(compte_rendu.pk)

    def validate_candidat(
        self,
        candidat,
    ):
        demande = (
            candidat
            .processus
            .demande
        )

        if (
            demande.type_recrutement
            !=
            DemandeRecrutement
            .TypeRecrutement.CADRE
        ):
            raise serializers.ValidationError(
                "Ce candidat appartient ÃƒÆ’  un "
                "recrutement dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ouvriers."
            )

        if (
            candidat.statut
            == Candidat.Statut.EMBAUCHE
        ):
            raise serializers.ValidationError(
                "Ce candidat a dÃƒÆ’Ã‚Â©jÃƒÆ’  ÃƒÆ’Ã‚Â©tÃƒÆ’Ã‚Â© embauchÃƒÆ’Ã‚Â©."
            )

        compte_rendu_existant = (
            CompteRenduEntretienCadre
            .objects
            .filter(candidat=candidat)
        )

        if self.instance:
            compte_rendu_existant = (
                compte_rendu_existant
                .exclude(
                    pk=self.instance.pk
                )
            )

        if compte_rendu_existant.exists():
            raise serializers.ValidationError(
                "Un compte rendu existe dÃƒÆ’Ã‚Â©jÃƒÆ’  "
                "pour ce candidat."
            )

        return candidat

    def validate(
        self,
        attrs,
    ):
        redacteur_rh = attrs.get(
            "redacteur_rh",
            getattr(
                self.instance,
                "redacteur_rh",
                False,
            ),
        )

        redacteur_manager = attrs.get(
            "redacteur_manager",
            getattr(
                self.instance,
                "redacteur_manager",
                False,
            ),
        )

        if (
            not redacteur_rh
            and not redacteur_manager
        ):
            raise serializers.ValidationError(
                {
                    "redacteur_rh": (
                        "SÃƒÆ’Ã‚Â©lectionnez au moins "
                        "un rÃƒÆ’Ã‚Â©dacteur : RH, "
                        "Manager ou les deux."
                    )
                }
            )

        pretention = attrs.get(
            "pretention_salariale",
            getattr(
                self.instance,
                "pretention_salariale",
                None,
            ),
        )

        if (
            pretention is not None
            and pretention < 0
        ):
            raise serializers.ValidationError(
                {
                    "pretention_salariale": (
                        "La prÃƒÆ’Ã‚Â©tention salariale "
                        "ne peut pas ÃƒÆ’Ã‚Âªtre nÃƒÆ’Ã‚Â©gative."
                    )
                }
            )

        annees_experience = attrs.get(
            "annees_experience",
            getattr(
                self.instance,
                "annees_experience",
                None,
            ),
        )

        if (
            annees_experience is not None
            and annees_experience < 0
        ):
            raise serializers.ValidationError(
                {
                    "annees_experience": (
                        "Le nombre dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢annÃƒÆ’Ã‚Â©es "
                        "dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢expÃƒÆ’Ã‚Â©rience ne peut "
                        "pas ÃƒÆ’Ã‚Âªtre nÃƒÆ’Ã‚Â©gatif."
                    )
                }
            )

        disponibilite = attrs.get(
            "disponibilite",
            getattr(
                self.instance,
                "disponibilite",
                "",
            ),
        )

        precision = attrs.get(
            "precision_disponibilite",
            getattr(
                self.instance,
                "precision_disponibilite",
                "",
            ),
        )

        if (
            disponibilite == "Autre"
            and not precision.strip()
        ):
            raise serializers.ValidationError(
                {
                    "precision_disponibilite": (
                        "PrÃƒÆ’Ã‚Â©cisez la disponibilitÃƒÆ’Ã‚Â© "
                        "du candidat."
                    )
                }
            )

        return attrs

    @transaction.atomic
    def create(
        self,
        validated_data,
    ):
        compte_rendu = (
            super().create(
                validated_data
            )
        )

        candidat = (
            compte_rendu.candidat
        )

        if (
            candidat.statut
            not in [
                Candidat.Statut.RETENU,
                Candidat.Statut.NON_RETENU,
                Candidat.Statut.EMBAUCHE,
            ]
        ):
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

        return compte_rendu

    @transaction.atomic
    def update(
        self,
        instance,
        validated_data,
    ):
        if (
            instance.statut
            ==
            CompteRenduEntretienCadre
            .Statut.ENVOYE
        ):
            raise serializers.ValidationError(
                {
                    "detail": (
                        "Un compte rendu dÃƒÆ’Ã‚Â©jÃƒÆ’  "
                        "envoyÃƒÆ’Ã‚Â© au DRH ne peut "
                        "plus ÃƒÆ’Ã‚Âªtre modifiÃƒÆ’Ã‚Â©."
                    )
                }
            )

        compte_rendu = (
            super().update(
                instance,
                validated_data,
            )
        )

        candidat = (
            compte_rendu.candidat
        )

        if (
            candidat.statut
            not in [
                Candidat.Statut.RETENU,
                Candidat.Statut.NON_RETENU,
                Candidat.Statut.EMBAUCHE,
            ]
        ):
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

        return compte_rendu
    
class OffreRecrutementSerializer(
    serializers.ModelSerializer
):
    fichier_url = serializers.SerializerMethodField(
        read_only=True
    )

    utilisee_dans = serializers.IntegerField(
        source="processus_recrutement.count",
        read_only=True,
    )

    class Meta:
        model = OffreRecrutement

        fields = [
            "id",
            "reference",
            "titre",
            "fichier",
            "fichier_url",
            "nom_fichier_original",
            "active",
            "utilisee_dans",
            "date_creation",
            "date_modification",
        ]

        read_only_fields = [
            "id",
            "reference",
            "nom_fichier_original",
            "fichier_url",
            "utilisee_dans",
            "date_creation",
            "date_modification",
        ]

        extra_kwargs = {
            "titre": {
                "required": False,
                "allow_blank": True,
            },
            "fichier": {
                "required": False,
                "allow_null": True,
            },
            "active": {
                "required": False,
            },
        }

    def get_fichier_url(self, offre):
        if not offre.fichier:
            return None

        request = self.context.get("request")

        url = offre.fichier.url

        if request:
            return request.build_absolute_uri(url)

        return url

    def validate_fichier(self, fichier):
        return valider_fichier(
            fichier,
            extensions_autorisees=(
                "pdf",
                "doc",
                "docx",
                "png",
                "jpeg",
                "jpg",
            ),
        )

    def validate(self, attrs):
        fichier = attrs.get("fichier")

        # Le fichier est obligatoire uniquement
        # pendant la crÃƒÆ’Ã‚Â©ation d'une nouvelle offre.
        if self.instance is None and not fichier:
            raise serializers.ValidationError(
                {
                    "fichier": (
                        "Le fichier de lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢offre "
                        "est obligatoire."
                    )
                }
            )

        return attrs


class PublicationOffreSerializer(
    serializers.ModelSerializer
):
    preuve_url = (
        serializers.SerializerMethodField(
            read_only=True
        )
    )

    processus_reference = (
        serializers.CharField(
            source=(
                "processus.demande.reference"
            ),
            read_only=True,
        )
    )

    offre_reference = (
        serializers.CharField(
            source=(
                "processus.offre.reference"
            ),
            read_only=True,
            allow_null=True,
        )
    )

    class Meta:
        model = PublicationOffre

        fields = [
            "id",
            "processus",
            "processus_reference",
            "offre_reference",
            "canal",
            "date_publication",
            "date_limite_candidature",
            "lien_ou_reference",
            "preuve",
            "preuve_url",
            "commentaire",
            "date_creation",
            "date_modification",
        ]

        read_only_fields = [
            "id",
            "processus_reference",
            "offre_reference",
            "preuve_url",
            "date_creation",
            "date_modification",
        ]

        extra_kwargs = {
            "processus": {
                "required": True,
            },
            "canal": {
                "required": True,
                "allow_blank": False,
            },
            "date_publication": {
                "required": True,
            },
            "date_limite_candidature": {
                "required": True,
                "allow_null": False,
            },
            "lien_ou_reference": {
                "required": False,
                "allow_blank": True,
            },
            "preuve": {
                "required": False,
                "allow_null": True,
            },
            "commentaire": {
                "required": False,
                "allow_blank": True,
            },
        }

    def get_preuve_url(
        self,
        publication,
    ):
        if not publication.preuve:
            return None

        request = self.context.get(
            "request"
        )

        url = publication.preuve.url

        if request:
            return request.build_absolute_uri(
                url
            )

        return url

    def validate_preuve(
        self,
        fichier,
    ):
        if not fichier:
            return fichier

        return valider_fichier(
            fichier,
            extensions_autorisees=(
                "pdf",
                "png",
                "jpg",
                "jpeg",
            ),
        )

    def validate(self, attrs):
        instance = self.instance

        processus = (
            attrs.get("processus")
            or getattr(
                instance,
                "processus",
                None,
            )
        )

        date_publication = (
            attrs.get(
                "date_publication"
            )
            or getattr(
                instance,
                "date_publication",
                None,
            )
        )

        date_limite = (
            attrs.get(
                "date_limite_candidature"
            )
            or getattr(
                instance,
                "date_limite_candidature",
                None,
            )
        )

        if not date_limite:
            raise serializers.ValidationError(
                {
                    "date_limite_candidature": (
                        "La date limite de "
                        "candidature est obligatoire."
                    )
                }
            )

        if (
            date_publication
            and date_limite
            and date_publication
            > date_limite
        ):
            raise serializers.ValidationError(
                {
                    "date_limite_candidature": (
                        "La date limite doit ÃƒÆ’Ã‚Âªtre "
                        "postÃƒÆ’Ã‚Â©rieure ou ÃƒÆ’Ã‚Â©gale ÃƒÆ’  la "
                        "date de publication."
                    )
                }
            )

        if processus:
            date_recrutement = (
                processus
                .demande
                .date_prevue_recrutement
            )

            if (
                date_recrutement
                and date_limite
                and date_limite
                >= date_recrutement
            ):
                raise serializers.ValidationError(
                    {
                        "date_limite_candidature": (
                            "La date limite de "
                            "candidature doit ÃƒÆ’Ã‚Âªtre "
                            "antÃƒÆ’Ã‚Â©rieure ÃƒÆ’  la date "
                            "prÃƒÆ’Ã‚Â©vue du recrutement."
                        )
                    }
                )

            publication_existante = (
                PublicationOffre.objects
                .filter(
                    processus=processus
                )
            )

            if instance:
                publication_existante = (
                    publication_existante
                    .exclude(pk=instance.pk)
                )

            if (
                publication_existante
                .exists()
            ):
                raise serializers.ValidationError(
                    {
                        "processus": (
                            "Une publication existe "
                            "dÃƒÆ’Ã‚Â©jÃƒÆ’  pour ce processus. "
                            "Modifiez la publication "
                            "existante."
                        )
                    }
                )

        return attrs


class FicheTransparenceSerializer(
    serializers.ModelSerializer
):
    fichier_url = (
        serializers.SerializerMethodField(
            read_only=True
        )
    )

    lieu_libelle = serializers.CharField(
        source="get_lieu_display",
        read_only=True,
    )

    processus_reference = (
        serializers.CharField(
            source=(
                "processus.demande.reference"
            ),
            read_only=True,
        )
    )

    class Meta:
        model = FicheTransparence

        fields = [
            "id",
            "processus",
            "processus_reference",
            "date_fiche",
            "lieu",
            "lieu_libelle",
            "fichier",
            "fichier_url",
            "observations",
            "original_signe",
            "date_upload",
            "date_modification",
        ]

        read_only_fields = [
            "id",
            "processus_reference",
            "lieu_libelle",
            "fichier_url",
            "date_upload",
            "date_modification",
        ]

        extra_kwargs = {
            "processus": {
                "required": True,
            },
            "date_fiche": {
                "required": True,
                "allow_null": False,
            },
            "lieu": {
                "required": True,
                "allow_blank": False,
            },
            "fichier": {
                "required": False,
                "allow_null": True,
            },
            "observations": {
                "required": False,
                "allow_blank": True,
            },
            "original_signe": {
                "required": True,
            },
        }

    def get_fichier_url(
        self,
        fiche,
    ):
        if not fiche.fichier:
            return None

        request = self.context.get(
            "request"
        )

        url = fiche.fichier.url

        if request:
            return request.build_absolute_uri(
                url
            )

        return url

    def validate_fichier(
        self,
        fichier,
    ):
        if not fichier:
            return fichier

        return valider_fichier(
            fichier,
            extensions_autorisees=(
                "pdf",
                "png",
                "jpg",
                "jpeg",
            ),
        )

    def validate_date_fiche(
        self,
        date_fiche,
    ):
        if date_fiche > timezone.localdate():
            raise serializers.ValidationError(
                "La date de la fiche ne peut "
                "pas ÃƒÆ’Ã‚Âªtre dans le futur."
            )

        return date_fiche

    def validate(self, attrs):
        instance = self.instance

        processus = (
            attrs.get("processus")
            or getattr(
                instance,
                "processus",
                None,
            )
        )

        date_fiche = (
            attrs.get("date_fiche")
            or getattr(
                instance,
                "date_fiche",
                None,
            )
        )

        lieu = (
            attrs.get("lieu")
            or getattr(
                instance,
                "lieu",
                "",
            )
        )

        fichier = (
            attrs.get("fichier")
            or getattr(
                instance,
                "fichier",
                None,
            )
        )

        original_signe = attrs.get(
            "original_signe",
            getattr(
                instance,
                "original_signe",
                False,
            ),
        )

        if not date_fiche:
            raise serializers.ValidationError(
                {
                    "date_fiche": (
                        "La date de la fiche "
                        "est obligatoire."
                    )
                }
            )

        if not lieu:
            raise serializers.ValidationError(
                {
                    "lieu": (
                        "Le lieu est obligatoire."
                    )
                }
            )

        if not fichier:
            raise serializers.ValidationError(
                {
                    "fichier": (
                        "Le fichier de la fiche "
                        "de transparence est "
                        "obligatoire."
                    )
                }
            )

        if not original_signe:
            raise serializers.ValidationError(
                {
                    "original_signe": (
                        "Vous devez confirmer que "
                        "la fiche originale est "
                        "remplie et signÃƒÆ’Ã‚Â©e."
                    )
                }
            )

        return attrs


class CandidatSerializer(
    serializers.ModelSerializer
):
    nom_complet = serializers.CharField(
        read_only=True,
    )

    statut_libelle = (
        serializers.CharField(
            source="get_statut_display",
            read_only=True,
        )
    )

    type_recrutement = (
        serializers.CharField(
            source=(
                "processus.demande"
                ".type_recrutement"
            ),
            read_only=True,
        )
    )

    type_recrutement_libelle = (
        serializers.CharField(
            source=(
                "processus.demande"
                ".get_type_recrutement_display"
            ),
            read_only=True,
        )
    )

    reference_processus = (
        serializers.CharField(
            source=(
                "processus.demande.reference"
            ),
            read_only=True,
        )
    )

    poste_nom = serializers.CharField(
        source=(
            "processus.demande.poste.name"
        ),
        read_only=True,
    )

    est_cadre = (
        serializers.SerializerMethodField()
    )

    est_ouvrier = (
        serializers.SerializerMethodField()
    )

    retenu = (
        serializers.SerializerMethodField()
    )

    entretien_planifie = (
        serializers.SerializerMethodField()
    )

    entretien_realise = (
        serializers.SerializerMethodField()
    )

    peut_planifier_entretien = (
        serializers.SerializerMethodField()
    )

    peut_terminer_entretien = (
        serializers.SerializerMethodField()
    )

    peut_rediger_compte_rendu = (
        serializers.SerializerMethodField()
    )

    compte_rendu_id = (
        serializers.SerializerMethodField()
    )

    compte_rendu_statut = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = Candidat

        fields = [
            "id",
            "processus",

            "nom",
            "prenom",
            "nom_complet",
            "telephone",
            "email",

            "date_candidature",
            "date_entretien_prevue",
            "date_entretien_realisee",

            "source",
            "fiche_test",

            "statut",
            "statut_libelle",

            "type_recrutement",
            "type_recrutement_libelle",
            "reference_processus",
            "poste_nom",

            "est_cadre",
            "est_ouvrier",
            "retenu",

            "entretien_planifie",
            "entretien_realise",
            "peut_planifier_entretien",
            "peut_terminer_entretien",
            "peut_rediger_compte_rendu",

            "compte_rendu_id",
            "compte_rendu_statut",

            "observations",
            "date_creation",
            "date_modification",
        ]

        read_only_fields = [
            "source",
            "statut",
            "date_entretien_prevue",
            "date_entretien_realisee",
            "date_creation",
            "date_modification",
        ]

    def get_est_cadre(
        self,
        candidat,
    ):
        return candidat.est_cadre

    def get_est_ouvrier(
        self,
        candidat,
    ):
        return candidat.est_ouvrier

    def get_retenu(
        self,
        candidat,
    ):
        if candidat.est_cadre:
            return (
                candidat.statut
                in [
                    Candidat.Statut.RETENU,
                    Candidat.Statut.EMBAUCHE,
                ]
            )

        return (
            candidat.statut
            in [
                Candidat.Statut.RECU,
                Candidat.Statut.EMBAUCHE,
            ]
        )

    def get_entretien_planifie(
        self,
        candidat,
    ):
        return (
            candidat.entretien_planifie
        )

    def get_entretien_realise(
        self,
        candidat,
    ):
        return (
            candidat.entretien_realise
        )

    def get_peut_planifier_entretien(
        self,
        candidat,
    ):
        if not candidat.est_cadre:
            return False

        return (
            candidat.statut
            in [
                Candidat.Statut.AJOUTE,
                Candidat.Statut
                .ENTRETIEN_PLANIFIE,
            ]
        )

    def get_peut_terminer_entretien(
        self,
        candidat,
    ):
        if not candidat.est_cadre:
            return False

        return (
            candidat.statut
            ==
            Candidat.Statut
            .ENTRETIEN_PLANIFIE
            and
            candidat.date_entretien_prevue
            is not None
        )

    def get_peut_rediger_compte_rendu(
        self,
        candidat,
    ):
        return (
            candidat
            .peut_rediger_compte_rendu
        )

    def get_compte_rendu_id(
        self,
        candidat,
    ):
        try:
            return (
                candidat
                .compte_rendu_cadre
                .id
            )
        except (
            CompteRenduEntretienCadre
            .DoesNotExist
        ):
            return None

    def get_compte_rendu_statut(
        self,
        candidat,
    ):
        try:
            return (
                candidat
                .compte_rendu_cadre
                .statut
            )
        except (
            CompteRenduEntretienCadre
            .DoesNotExist
        ):
            return None

    def validate_fiche_test(
        self,
        fichier,
    ):
        if fichier is None:
            return fichier

        processus = None

        if self.instance:
            processus = (
                self.instance.processus
            )
        else:
            processus_id = (
                self.initial_data.get(
                    "processus"
                )
            )

            if processus_id:
                from .models import (
                    ProcessusRecrutement,
                )

                try:
                    processus = (
                        ProcessusRecrutement
                        .objects
                        .select_related(
                            "demande"
                        )
                        .get(
                            pk=processus_id
                        )
                    )
                except (
                    ProcessusRecrutement
                    .DoesNotExist
                ):
                    processus = None

        if (
            processus
            and processus
            .demande
            .type_recrutement
            ==
            DemandeRecrutement
            .TypeRecrutement.CADRE
        ):
            raise serializers.ValidationError(
                "Une fiche de test ne peut "
                "pas ÃƒÆ’Ã‚Âªtre ajoutÃƒÆ’Ã‚Â©e ÃƒÆ’  un "
                "candidat cadre."
            )

        return valider_fichier(
            fichier
        )

    def validate(
        self,
        attrs,
    ):
        processus = attrs.get(
            "processus",
            getattr(
                self.instance,
                "processus",
                None,
            ),
        )

        fiche_test = attrs.get(
            "fiche_test",
            getattr(
                self.instance,
                "fiche_test",
                None,
            ),
        )

        if (
            processus
            and processus
            .demande
            .type_recrutement
            ==
            DemandeRecrutement
            .TypeRecrutement.CADRE
            and fiche_test
        ):
            raise serializers.ValidationError(
                {
                    "fiche_test": (
                        "La fiche de test ne "
                        "concerne pas les cadres."
                    )
                }
            )

        return attrs

class DocumentCandidatSerializer(
    serializers.ModelSerializer
):
    def validate(self, attrs):
        recu = attrs.get(
            "recu",
            getattr(self.instance, "recu", False),
        )

        remarque = attrs.get(
            "remarque",
            getattr(self.instance, "remarque", ""),
        )

        if not recu and not str(remarque).strip():
            raise serializers.ValidationError(
                {
                    "remarque": (
                        "Une remarque est obligatoire "
                        "lorsque la piÃ¨ce n'est pas reÃ§ue."
                    )
                }
            )

        return attrs

    class Meta:
        model = DocumentCandidat

        fields = [
            "id",
            "retour_rh",
            "libelle",
            "recu",
            "remarque",
        ]

        read_only_fields = [
            "id",
            "retour_rh",
            "libelle",
        ]


class RetourRHCandidatSerializer(
    serializers.ModelSerializer
):
    candidat_nom = serializers.CharField(
        source="candidat.nom_complet",
        read_only=True,
    )

    documents = DocumentCandidatSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = RetourRHCandidat
        fields = "__all__"

        read_only_fields = [
            "date_validation",
            "date_creation",
            "date_modification",
        ]

    def validate_candidat(self, candidat):
        if candidat.statut not in [
            Candidat.Statut.RECU,
            Candidat.Statut.EMBAUCHE,
        ]:
            raise serializers.ValidationError(
                "Seul un candidat reÃƒÆ’Ã‚Â§u peut "
                "passer au Retour RH."
            )

        return candidat

    @transaction.atomic
    def create(self, validated_data):
        retour_rh = super().create(
            validated_data
        )

        documents = [
            DocumentCandidat(
                retour_rh=retour_rh,
                libelle=libelle,
            )
            for libelle in (
                DOCUMENTS_RH_PAR_DEFAUT
            )
        ]

        DocumentCandidat.objects.bulk_create(
            documents
        )

        return retour_rh


class EmbaucheSerializer(
    serializers.ModelSerializer
):
    candidat_nom_complet = serializers.CharField(
        source="candidat.nom_complet",
        read_only=True,
    )

    candidat_email = serializers.EmailField(
        source="candidat.email",
        read_only=True,
    )

    candidat_telephone = serializers.CharField(
        source="candidat.telephone",
        read_only=True,
    )

    processus_id = serializers.IntegerField(
        source="candidat.processus_id",
        read_only=True,
    )

    reference_processus = serializers.CharField(
        source=(
            "candidat.processus.demande.reference"
        ),
        read_only=True,
    )

    documents = serializers.SerializerMethodField()

    confirmee = serializers.BooleanField(
        read_only=True,
    )

    est_cadre = serializers.BooleanField(
        read_only=True,
    )

    envoi_documents_cadre_requis = (
        serializers.BooleanField(read_only=True)
    )

    checklist_onboarding_complete = (
        serializers.BooleanField(read_only=True)
    )

    class Meta:
        model = Embauche

        fields = [
            "id",
            "candidat",
            "candidat_nom_complet",
            "candidat_email",
            "candidat_telephone",
            "processus_id",
            "reference_processus",
            "documents",
            "type_contrat",
            "date_verification",
            "verificateur",
            "date_debut_contrat",
            "signe_candidat",
            "signe_employeur",
            "remarque_generale",
            "dossier_embauche_complet",
            "contrat_travail_signe",
            "journee_integration_realisee",
            "reglement_interieur_communique",
            "code_societe_communique",
            "documents_cadre_email_envoyes",
            "date_envoi_documents_cadre",
            "destinataires_documents_cadre",
            "nombre_tentatives_envoi_documents_cadre",
            "erreur_envoi_documents_cadre",
            "est_cadre",
            "envoi_documents_cadre_requis",
            "checklist_onboarding_complete",
            "employe",
            "confirmee",
            "date_confirmation",
            "date_creation",
            "date_modification",
        ]

        read_only_fields = [
            "id",
            "employe",
            "date_confirmation",
            "documents_cadre_email_envoyes",
            "date_envoi_documents_cadre",
            "destinataires_documents_cadre",
            "nombre_tentatives_envoi_documents_cadre",
            "erreur_envoi_documents_cadre",
            "est_cadre",
            "envoi_documents_cadre_requis",
            "checklist_onboarding_complete",
            "date_creation",
            "date_modification",
        ]

    def get_documents(self, embauche):
        try:
            documents = (
                embauche
                .candidat
                .retour_rh
                .documents
                .all()
            )
        except RetourRHCandidat.DoesNotExist:
            return []

        return DocumentCandidatSerializer(
            documents,
            many=True,
        ).data

    def validate_candidat(self, candidat):
        demande = (
            candidat
            .processus
            .demande
        )

        est_cadre = (
            demande.type_recrutement
            ==
            DemandeRecrutement
            .TypeRecrutement.CADRE
        )

        if est_cadre:
            statuts_autorises = [
                Candidat.Statut.RETENU,
                Candidat.Statut.EMBAUCHE,
            ]

            if (
                candidat.statut
                not in statuts_autorises
            ):
                raise serializers.ValidationError(
                    "Seul un candidat cadre retenu "
                    "peut ÃƒÆ’Ã‚Âªtre traitÃƒÆ’Ã‚Â© pour lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢embauche."
                )

            # Aucun Retour RH pour les cadres.
            return candidat

        statuts_autorises = [
            Candidat.Statut.RECU,
            Candidat.Statut.EMBAUCHE,
        ]

        if (
            candidat.statut
            not in statuts_autorises
        ):
            raise serializers.ValidationError(
                "Seul un candidat ouvrier reÃƒÆ’Ã‚Â§u "
                "peut ÃƒÆ’Ã‚Âªtre traitÃƒÆ’Ã‚Â© pour lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢embauche."
            )

        try:
            retour_rh = candidat.retour_rh
        except RetourRHCandidat.DoesNotExist:
            raise serializers.ValidationError(
                "Le Retour RH de ce candidat "
                "nÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢a pas encore ÃƒÆ’Ã‚Â©tÃƒÆ’Ã‚Â© enregistrÃƒÆ’Ã‚Â©."
            )

        if not retour_rh.liste_remise:
            raise serializers.ValidationError(
                "La liste des documents nÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢a pas "
                "encore ÃƒÆ’Ã‚Â©tÃƒÆ’Ã‚Â© remise ÃƒÆ’  ce candidat."
            )

        return candidat

    def validate_verificateur(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Le nom du vÃƒÆ’Ã‚Â©rificateur est obligatoire."
            )

        return value

    def validate(self, attrs):
        candidat = attrs.get(
            "candidat",
            getattr(self.instance, "candidat", None),
        )

        type_contrat = attrs.get(
            "type_contrat",
            getattr(
                self.instance,
                "type_contrat",
                None,
            ),
        )

        if candidat and type_contrat:
            demande = (
                candidat
                .processus
                .demande
            )

            if (
                type_contrat
                == Embauche.TypeContrat.CDI
                and demande.nombre_cdi == 0
            ):
                raise serializers.ValidationError(
                    {
                        "type_contrat": (
                            "Aucun recrutement CDI "
                            "nÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢est prÃƒÆ’Ã‚Â©vu dans cette demande."
                        )
                    }
                )

            if (
                type_contrat
                == Embauche.TypeContrat.CDD
                and demande.nombre_cdd == 0
            ):
                raise serializers.ValidationError(
                    {
                        "type_contrat": (
                            "Aucun recrutement CDD "
                            "nÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢est prÃƒÆ’Ã‚Â©vu dans cette demande."
                        )
                    }
                )

        if candidat:
            est_cadre = (
                candidat.processus.demande.type_recrutement
                == DemandeRecrutement.TypeRecrutement.CADRE
            )

            champs_onboarding_cadre = [
                "dossier_embauche_complet",
                "contrat_travail_signe",
                "journee_integration_realisee",
                "reglement_interieur_communique",
                "code_societe_communique",
            ]

            if not est_cadre and any(
                champ in attrs
                for champ in champs_onboarding_cadre
            ):
                raise serializers.ValidationError(
                    {
                        "detail": (
                            "La checklist dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢onboarding cadre ne peut "
                            "pas ÃƒÆ’Ã‚Âªtre modifiÃƒÆ’Ã‚Â©e pour un recrutement ouvrier."
                        )
                    }
                )

        return attrs

class DesistementEmbaucheSerializer(
    serializers.ModelSerializer
):
    candidat_id = serializers.IntegerField(
        source="embauche.candidat_id",
        read_only=True,
    )

    candidat_nom_complet = serializers.CharField(
        source="embauche.candidat.nom_complet",
        read_only=True,
    )

    candidat_email = serializers.EmailField(
        source="embauche.candidat.email",
        read_only=True,
        allow_null=True,
    )

    processus_origine_id = serializers.IntegerField(
        source="embauche.candidat.processus_id",
        read_only=True,
    )

    reference_processus_origine = serializers.CharField(
        source=(
            "embauche.candidat.processus."
            "demande.reference"
        ),
        read_only=True,
    )

    poste = serializers.CharField(
        source=(
            "embauche.candidat.processus."
            "demande.poste.name"
        ),
        read_only=True,
    )

    enregistre_par_nom = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = DesistementEmbauche

        fields = [
            "id",
            "embauche",

            "candidat_id",
            "candidat_nom_complet",
            "candidat_email",

            "processus_origine_id",
            "reference_processus_origine",
            "poste",

            "date_desistement",
            "motif",
            "commentaire",

            "relancer_recrutement",
            "date_reprise_recrutement",

            "date_cloture_initiale",
            "date_nouvelle_cloture",

            "enregistre_par",
            "enregistre_par_nom",
            "date_enregistrement",
        ]

        read_only_fields = [
            "id",
            "enregistre_par",
            "date_enregistrement",
            "date_cloture_initiale",
            "date_nouvelle_cloture",
        ]

        extra_kwargs = {
            "motif": {
                "required": False,
                "allow_blank": True,
                "default": "",
            },

            "commentaire": {
                "required": False,
                "allow_blank": True,
                "default": "",
            },

            "relancer_recrutement": {
                "required": False,
                "default": True,
            },

            "date_reprise_recrutement": {
                "required": False,
                "allow_null": True,
            },
        }

    def get_enregistre_par_nom(
        self,
        desistement,
    ):
        profil = desistement.enregistre_par

        if not profil:
            return ""

        return (
            getattr(
                profil,
                "nom_complet",
                "",
            )
            or getattr(
                profil,
                "username",
                "",
            )
        )

    def validate_embauche(
        self,
        embauche,
    ):
        if not embauche.confirmee:
            raise serializers.ValidationError(
                "Seule une embauche confirmÃƒÆ’Ã‚Â©e peut "
                "faire lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢objet dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢un dÃƒÆ’Ã‚Â©sistement."
            )

        desistement_existant = (
            DesistementEmbauche.objects
            .filter(embauche=embauche)
        )

        if self.instance:
            desistement_existant = (
                desistement_existant.exclude(
                    pk=self.instance.pk
                )
            )

        if desistement_existant.exists():
            raise serializers.ValidationError(
                "Le dÃƒÆ’Ã‚Â©sistement de cette personne "
                "a dÃƒÆ’Ã‚Â©jÃƒÆ’  ÃƒÆ’Ã‚Â©tÃƒÆ’Ã‚Â© enregistrÃƒÆ’Ã‚Â©."
            )

        return embauche

    def validate_date_desistement(
        self,
        valeur,
    ):
        if valeur > timezone.localdate():
            raise serializers.ValidationError(
                "La date du dÃƒÆ’Ã‚Â©sistement ne peut "
                "pas ÃƒÆ’Ã‚Âªtre dans le futur."
            )

        return valeur

    def validate(self, attrs):
        instance = self.instance

        date_desistement = attrs.get(
            "date_desistement",
            getattr(
                instance,
                "date_desistement",
                None,
            ),
        )

        relancer_recrutement = attrs.get(
            "relancer_recrutement",
            getattr(
                instance,
                "relancer_recrutement",
                True,
            ),
        )

        date_reprise = attrs.get(
            "date_reprise_recrutement",
            getattr(
                instance,
                "date_reprise_recrutement",
                None,
            ),
        )

        motif = attrs.get(
            "motif",
            getattr(
                instance,
                "motif",
                "",
            ),
        )

        if relancer_recrutement:
            if not date_reprise:
                raise serializers.ValidationError({
                    "date_reprise_recrutement": (
                        "La date de reprise est obligatoire "
                        "lorsque le recrutement est repris."
                    )
                })

            if (
                date_desistement
                and date_reprise
                < date_desistement
            ):
                raise serializers.ValidationError({
                    "date_reprise_recrutement": (
                        "La date de reprise ne peut pas "
                        "etre anterieure a la date du "
                        "desistement."
                    )
                })

        else:
            attrs[
                "date_reprise_recrutement"
            ] = None

            if not (
                motif
                and motif.strip()
            ):
                raise serializers.ValidationError({
                    "motif": (
                        "Le motif est obligatoire lorsque "
                        "le recrutement n'est pas repris."
                    )
                })

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")

        profil = (
            get_hr_profile(request)
            if request
            else None
        )

        validated_data[
            "enregistre_par"
        ] = profil

        validated_data.setdefault(
            "motif",
            "",
        )

        validated_data.setdefault(
            "commentaire",
            "",
        )

        return super().create(
            validated_data
        )

class ProcessusRecrutementSerializer(
    serializers.ModelSerializer
):
    date_demande = serializers.DateTimeField(
        source="demande.date_creation",
        read_only=True,
    )

    date_cloture_initiale = (
        serializers.SerializerMethodField()
    )

    date_reprise_recrutement = (
        serializers.SerializerMethodField()
    )

    date_cloture_apres_desistement = (
        serializers.SerializerMethodField()
    )

    peut_etre_cloture = serializers.BooleanField(
        read_only=True,
    )

    cloture_par_nom = serializers.SerializerMethodField()
    demande_detail = (
        DemandeRecrutementSerializer(
            source="demande",
            read_only=True,
        )
    )

    offre = OffreRecrutementSerializer(
        read_only=True
    )

    offre_id = serializers.PrimaryKeyRelatedField(
        source="offre",
        queryset=OffreRecrutement.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

    publications = PublicationOffreSerializer(
        many=True,
        read_only=True,
    )

    fiches_transparence = (
        FicheTransparenceSerializer(
            many=True,
            read_only=True,
        )
    )

    # Compatibilite avec les ecrans qui attendent encore une seule
    # fiche : cette propriete renvoie toujours la plus recente.
    fiche_transparence = (
        serializers.SerializerMethodField()
    )

    candidats = CandidatSerializer(
        many=True,
        read_only=True,
    )

    nombre_candidats = (
        serializers.SerializerMethodField()
    )

    nombre_candidats_retenus = (
        serializers.SerializerMethodField()
    )

    nombre_candidats_embauches = (
        serializers.SerializerMethodField()
    )

    nombre_demande = (
        serializers.SerializerMethodField()
    )

    nombre_recrute = (
        serializers.SerializerMethodField()
    )

    besoin_restant = (
        serializers.SerializerMethodField()
    )

    nombre_cdi_recrute = (
        serializers.SerializerMethodField()
    )

    nombre_cdd_recrute = (
        serializers.SerializerMethodField()
    )

    besoin_cdi_restant = (
        serializers.SerializerMethodField()
    )

    besoin_cdd_restant = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = ProcessusRecrutement
        fields = "__all__"

        read_only_fields = [
            "statut",
            "etape_actuelle",
            "etapes_terminees",
            "date_cloture",
            "cloture_par",
            "peut_etre_cloture",
            "cloture_par_nom",
            "date_creation",
            "date_modification",
        ]

    def obtenir_desistements(
        self,
        processus,
    ):
        nom_cache = (
            "_desistements_processus_cache"
        )

        if hasattr(processus, nom_cache):
            return getattr(
                processus,
                nom_cache,
            )

        desistements = []

        for candidat in processus.candidats.all():
            try:
                desistement = (
                    candidat
                    .embauche
                    .desistement
                )
            except (
                Embauche.DoesNotExist,
                DesistementEmbauche.DoesNotExist,
            ):
                continue

            desistements.append(
                desistement
            )

        desistements.sort(
            key=lambda desistement: (
                desistement.date_enregistrement,
                desistement.pk,
            )
        )

        setattr(
            processus,
            nom_cache,
            desistements,
        )

        return desistements

    def get_date_cloture_initiale(
        self,
        processus,
    ):
        desistements = (
            self.obtenir_desistements(
                processus
            )
        )

        for desistement in desistements:
            if desistement.date_cloture_initiale:
                return (
                    desistement
                    .date_cloture_initiale
                )

        return processus.date_cloture

    def get_date_reprise_recrutement(
        self,
        processus,
    ):
        desistements = reversed(
            self.obtenir_desistements(
                processus
            )
        )

        for desistement in desistements:
            if (
                desistement.relancer_recrutement
                and desistement
                .date_reprise_recrutement
            ):
                return (
                    desistement
                    .date_reprise_recrutement
                )

        return None

    def get_date_cloture_apres_desistement(
        self,
        processus,
    ):
        desistements = reversed(
            self.obtenir_desistements(
                processus
            )
        )

        for desistement in desistements:
            if (
                desistement.relancer_recrutement
                and desistement
                .date_nouvelle_cloture
            ):
                return (
                    desistement
                    .date_nouvelle_cloture
                )

        return None

    def get_nombre_candidats(
        self,
        processus,
    ):
        return processus.candidats.count()

    def get_fiche_transparence(
        self,
        processus,
    ):
        fiche = (
            processus.fiches_transparence
            .order_by("-date_upload", "-id")
            .first()
        )

        if not fiche:
            return None

        return FicheTransparenceSerializer(
            fiche,
            context=self.context,
        ).data

    def get_nombre_candidats_retenus(
        self,
        processus,
    ):
        if (
            processus.type_recrutement
            == DemandeRecrutement.TypeRecrutement.CADRE
        ):
            statuts = [
                Candidat.Statut.RETENU,
                Candidat.Statut.EMBAUCHE,
            ]
        else:
            statuts = [
                Candidat.Statut.RECU,
                Candidat.Statut.EMBAUCHE,
            ]

        return processus.candidats.filter(
            statut__in=statuts
        ).count()

    def get_cloture_par_nom(self, processus):
        profil = processus.cloture_par

        if not profil:
            return ""

        nom_complet = getattr(
            profil,
            "nom_complet",
            "",
        )

        if nom_complet:
            return nom_complet

        return getattr(profil, "username", "")

    def get_nombre_demande(
    self,
    processus,
):
        return processus.demande.nombre_total


    def get_nombre_recrute(
        self,
        processus,
    ):
        return (
            processus.candidats
            .filter(
                statut=Candidat.Statut.EMBAUCHE
            )
            .count()
        )


    def get_besoin_restant(
        self,
        processus,
    ):
        nombre_demande = (
            processus.demande.nombre_total
        )

        nombre_recrute = (
            self.get_nombre_recrute(
                processus
            )
        )

        return max(
            nombre_demande - nombre_recrute,
            0,
        )


    def get_nombre_cdi_recrute(
        self,
        processus,
    ):
        return (
            Embauche.objects
            .filter(
                candidat__processus=processus,
                candidat__statut=(
                    Candidat.Statut.EMBAUCHE
                ),
                type_contrat=(
                    Embauche.TypeContrat.CDI
                ),
                date_confirmation__isnull=False,
            )
            .count()
        )


    def get_nombre_cdd_recrute(
        self,
        processus,
    ):
        return (
            Embauche.objects
            .filter(
                candidat__processus=processus,
                candidat__statut=(
                    Candidat.Statut.EMBAUCHE
                ),
                type_contrat=(
                    Embauche.TypeContrat.CDD
                ),
                date_confirmation__isnull=False,
            )
            .count()
        )


    def get_besoin_cdi_restant(
        self,
        processus,
    ):
        return max(
            processus.demande.nombre_cdi
            - self.get_nombre_cdi_recrute(
                processus
            ),
            0,
        )


    def get_besoin_cdd_restant(
        self,
        processus,
    ):
        return max(
            processus.demande.nombre_cdd
            - self.get_nombre_cdd_recrute(
                processus
            ),
            0,
        )

    def get_nombre_candidats_embauches(
        self,
        processus,
    ):
        return processus.candidats.filter(
            statut=Candidat.Statut.EMBAUCHE
        ).count()


def creer_employe_depuis_embauche(embauche):
    candidat = embauche.candidat
    demande = candidat.processus.demande

    base_matricule = (
        f"REC-{timezone.localdate().year}-"
        f"{candidat.pk:05d}"
    )

    matricule = base_matricule
    numero = 1

    while Employee.objects.filter(
        employee_id=matricule
    ).exists():
        numero += 1

        matricule = (
            f"{base_matricule}-{numero}"
        )

    employe = Employee.objects.create(
        employee_id=matricule,
        first_name=candidat.prenom,
        last_name=candidat.nom,
        email=candidat.email or None,
        phone=candidat.telephone,
        factory=demande.factory,
        department=demande.departement,
        job_title=demande.poste,
        contract_type=embauche.type_contrat,
        hire_date=embauche.date_debut_contrat,
        status=Employee.Status.ACTIVE,
    )

    return employe