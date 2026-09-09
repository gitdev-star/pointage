from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
import os
import uuid

def generer_reference_compte_rendu():
    annee = timezone.localdate().year

    identifiant = (
        uuid.uuid4()
        .hex[:8]
        .upper()
    )

    return (
        f"CR-CADRE-{annee}-{identifiant}"
    )

def ajouter_jours_ouvres(date_depart, nombre_jours):
    """
    Ajoute des jours ouvrés à une date.
    Le samedi et le dimanche ne sont pas comptés.
    """

    date_calculee = date_depart
    jours_ajoutes = 0

    while jours_ajoutes < nombre_jours:
        date_calculee += timedelta(days=1)

        if date_calculee.weekday() < 5:
            jours_ajoutes += 1

    return date_calculee


class DemandeRecrutement(models.Model):
    class Statut(models.TextChoices):
        BROUILLON = "BROUILLON", "Brouillon"
        EN_ATTENTE = (
            "EN_ATTENTE",
            "En attente de validation du directeur",
        )
        EN_ATTENTE_DRH = (
            "EN_ATTENTE_DRH",
            "En attente d’approbation du DRH",
        )
        VALIDEE = (
            "VALIDEE",
            "Approuvée par le DRH",
        )
        REFUSEE = (
            "REFUSEE",
            "Refusée (ancien statut)",
        )
        REFUSEE_DIRECTEUR = (
            "REFUSEE_DIRECTEUR",
            "Refusée par le directeur",
        )
        REFUSEE_DRH = (
            "REFUSEE_DRH",
            "Refusée par le DRH",
        )
        TERMINEE = "TERMINEE", "Terminée"

    class TypeRecrutement(models.TextChoices):
        OUVRIER = "OUVRIER", "Ouvrier"
        CADRE = "CADRE", "Cadre"

    class Motif(models.TextChoices):
        RAJOUT = (
            "RAJOUT",
            "Rajout d’effectif",
        )

        CREATION = (
            "CREATION",
            "Création de poste",
        )

        REMPLACEMENT = (
            "REMPLACEMENT",
            "Remplacement",
        )

    class MotifRemplacement(models.TextChoices):
        FIN_PERIODE_ESSAI = (
            "FIN",
            "Fin de période d’essai",
        )

        DEMISSION = (
            "DEMISSION",
            "Démission",
        )

        ABANDON_POSTE = (
            "ABANDON",
            "Abandon de poste",
        )

        LICENCIEMENT = (
            "LICENCIEMENT",
            "Licenciement",
        )

        INAPTITUDE = (
            "INAPTITUDE",
            "Inaptitude",
        )

        RETRAITE = (
            "RETRAITE",
            "Départ à la retraite",
        )

        FIN_CDD = (
            "FIN_CDD",
            "Fin de CDD / non-renouvellement de CDD",
        )

        RUPTURE = (
            "RUPTURE",
            "Rupture conventionnelle",
        )

        MUTATION = (
            "MUTATION",
            "Mutation / mobilité interne",
        )

        PROMOTION = (
            "PROMOTION",
            "Promotion ou changement de poste",
        )

        MATERNITE = (
            "MATERNITE",
            "Congé maternité",
        )

        DECES = (
            "DECES",
            "Décès",
        )

    reference = models.CharField(
        max_length=30,
        unique=True,
        blank=True,
    )

    type_recrutement = models.CharField(
        max_length=20,
        choices=TypeRecrutement.choices,
        default=TypeRecrutement.OUVRIER,
        db_index=True,
    )

    demandeur = models.ForeignKey(
        "accounts.HRProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="demandes_recrutement",
    )

    # Informations du demandeur conservées
    # même si son profil change plus tard.
    matricule_demandeur = models.CharField(
        max_length=100
    )

    nom_demandeur = models.CharField(
        max_length=255
    )

    poste_demandeur = models.CharField(
        max_length=150
    )

    departement_demandeur = models.CharField(
        max_length=150
    )

    factory = models.ForeignKey(
        "employees.Factory",
        on_delete=models.PROTECT,
        related_name="demandes_recrutement",
    )

    departement = models.ForeignKey(
        "employees.Department",
        on_delete=models.PROTECT,
        related_name="demandes_recrutement",
    )

    poste = models.ForeignKey(
        "employees.Poste",
        on_delete=models.PROTECT,
        related_name="demandes_recrutement",
    )

    nombre_cdi = models.PositiveIntegerField(
        default=0
    )

    nombre_cdd = models.PositiveIntegerField(
        default=0
    )

    date_prevue_recrutement = models.DateField()

    motif = models.CharField(
        max_length=20,
        choices=Motif.choices,
    )

    motif_remplacement = models.CharField(
        max_length=20,
        choices=MotifRemplacement.choices,
        blank=True,
        default="",
    )

    designation_taches = models.TextField(
        blank=True
    )

    profil_diplome = models.TextField(
        blank=True
    )

    experience_professionnelle = models.TextField()

    competences_techniques = models.TextField()

    savoir_faire = models.TextField()

    savoir_etre = models.TextField()

    statut = models.CharField(
        max_length=30,
        choices=Statut.choices,
        default=Statut.EN_ATTENTE,
    )

    # Décision du directeur. Ces noms sont
    # conservés pour rester compatibles avec
    # les demandes et le frontend existants.
    motif_decision = models.TextField(
        blank=True,
        default="",
    )

    decide_par = models.ForeignKey(
        "accounts.HRProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="decisions_recrutement",
    )

    date_decision = models.DateTimeField(
        null=True,
        blank=True,
    )

    # Approbation finale du DRH.
    approuve_par_drh = models.ForeignKey(
        "accounts.HRProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "demandes_recrutement_"
            "approuvees_drh"
        ),
    )

    date_approbation_drh = (
        models.DateTimeField(
            null=True,
            blank=True,
        )
    )

    commentaire_drh = models.TextField(
        blank=True,
        default="",
    )

    date_creation = models.DateTimeField(
        auto_now_add=True
    )

    date_modification = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-date_creation"]

        indexes = [
            models.Index(
                fields=["statut"],
                name="recrutement_statut_idx",
            ),
            models.Index(
                fields=[
                    "departement",
                    "statut",
                ],
                name="recrutement_dept_statut_idx",
            ),
        ]

    @property
    def nombre_total(self):
        return self.nombre_cdi + self.nombre_cdd

    @property
    def validation_directeur_effectuee(self):
        return bool(
            self.decide_par_id
            and self.date_decision
        )

    @property
    def approbation_drh_effectuee(self):
        return bool(
            self.approuve_par_drh_id
            and self.date_approbation_drh
            and self.statut
            in [
                self.Statut.VALIDEE,
                self.Statut.TERMINEE,
            ]
        )

    def clean(self):
        erreurs = {}

        if (
            self.factory_id
            and self.departement_id
            and self.departement.factory_id
            != self.factory_id
        ):
            erreurs["departement"] = (
                "Ce département n’appartient pas "
                "au site sélectionné."
            )

        if self.nombre_total < 1:
            erreurs["nombre_cdi"] = (
                "Vous devez demander au moins "
                "un poste CDI ou CDD."
            )

        if (
            self.motif == self.Motif.REMPLACEMENT
            and not self.motif_remplacement
        ):
            erreurs["motif_remplacement"] = (
                "Sélectionnez le motif "
                "du remplacement."
            )

        if (
            self.motif != self.Motif.REMPLACEMENT
            and self.motif_remplacement
        ):
            erreurs["motif_remplacement"] = (
                "Ce champ est uniquement disponible "
                "lorsque le motif est Remplacement."
            )

        if (
            not self.pk
            and self.date_prevue_recrutement
        ):
            date_minimale = ajouter_jours_ouvres(
                timezone.localdate(),
                5,
            )

            if (
                self.date_prevue_recrutement
                < date_minimale
            ):
                erreurs["date_prevue_recrutement"] = (
                    "La date doit respecter un délai "
                    "minimum de 5 jours ouvrés."
                )

        if erreurs:
            raise ValidationError(erreurs)

    def generer_reference(self):
        annee = timezone.localdate().year

        derniere_demande = (
            DemandeRecrutement.objects
            .filter(
                reference__startswith=(
                    f"REC-{annee}-"
                )
            )
            .order_by("reference")
            .last()
        )

        if derniere_demande:
            dernier_numero = int(
                derniere_demande.reference
                .rsplit("-", 1)[-1]
            )

            sequence = dernier_numero + 1

        else:
            sequence = 1

        return (
            f"REC-{annee}-{sequence:04d}"
        )

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = (
                self.generer_reference()
            )

        self.full_clean()

        return super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.reference} — {self.poste}"
        )


class ProcessusRecrutement(models.Model):
    class Statut(models.TextChoices):
        EN_COURS = "EN_COURS", "En cours"
        TERMINE = "TERMINE", "Terminé"

    ETAPES_OUVRIER = {
        1: "Création de l’offre",
        2: "Publication de l’offre",
        3: "Fiche de transparence",
        4: "Suivi des candidatures",
        5: "Retour RH",
        6: "Embauche",
    }

    ETAPES_CADRE = {
        1: "Création de l’offre",

        2: "Publication de l’offre",

        3: (
            "Suivi des candidatures, "
            "entretiens et comptes rendus"
        ),

        4: (
            "Préparation de l’embauche"
        ),

        5: (
            "Embauche, onboarding "
            "et clôture"
        ),
    }

    demande = models.OneToOneField(
        DemandeRecrutement,
        on_delete=models.CASCADE,
        related_name="processus",
    )

    offre = models.ForeignKey(
        "OffreRecrutement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="processus_recrutement",
    )

    etape_actuelle = (
        models.PositiveSmallIntegerField(
            default=1
        )
    )

    etapes_terminees = models.JSONField(
        default=list,
        blank=True,
    )

    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.EN_COURS,
    )

    fichier_suivi = models.FileField(
        upload_to="recrutement/suivi/",
        null=True,
        blank=True,
    )

    liste_candidats_confirmee = (
        models.BooleanField(default=False)
    )

    observations_suivi = models.TextField(
        blank=True
    )

    # Traçabilité de la clôture complète du recrutement.
    date_cloture = models.DateTimeField(
        null=True,
        blank=True,
    )

    cloture_par = models.ForeignKey(
        "accounts.HRProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="processus_recrutement_clotures",
    )

    date_creation = models.DateTimeField(
        auto_now_add=True
    )

    date_modification = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-date_creation"]

    @property
    def type_recrutement(self):
        return (
            self.demande.type_recrutement
        )

    @property
    def etapes_disponibles(self):
        if (
            self.demande.type_recrutement
            == DemandeRecrutement
            .TypeRecrutement.CADRE
        ):
            return self.ETAPES_CADRE.copy()

        return self.ETAPES_OUVRIER.copy()

    @property
    def nombre_etapes(self):
        return len(
            self.etapes_disponibles
        )

    @property
    def libelle_etape_actuelle(self):
        return self.etapes_disponibles.get(
            self.etape_actuelle,
            "Étape inconnue",
        )

    @property
    def peut_etre_cloture(self):
        """
        Un processus cadre peut être clôturé lorsque tous les
        candidats retenus possèdent une embauche dont la checklist
        d'onboarding est complète.
        """
        if (
            self.type_recrutement
            != DemandeRecrutement.TypeRecrutement.CADRE
        ):
            return False

        candidats_retenus = self.candidats.filter(
            statut__in=[
                Candidat.Statut.RETENU,
                Candidat.Statut.EMBAUCHE,
            ]
        )

        if not candidats_retenus.exists():
            return False

        for candidat in candidats_retenus:
            try:
                embauche = candidat.embauche
            except Embauche.DoesNotExist:
                return False

            if not embauche.checklist_onboarding_complete:
                return False

        return True

    def terminer_etape(
        self,
        numero_etape,
    ):
        nombre_etapes = (
            self.nombre_etapes
        )

        if numero_etape not in range(
            1,
            nombre_etapes + 1,
        ):
            raise ValidationError(
                (
                    "Le numéro d’étape doit être "
                    f"compris entre 1 et "
                    f"{nombre_etapes}."
                )
            )

        if (
            numero_etape
            in self.etapes_terminees
        ):
            return

        if (
            numero_etape
            != self.etape_actuelle
        ):
            raise ValidationError(
                (
                    "L’étape attendue est "
                    f"l’étape "
                    f"{self.etape_actuelle}."
                )
            )

        self.etapes_terminees = sorted(
            set(
                [
                    *self.etapes_terminees,
                    numero_etape,
                ]
            )
        )

        if numero_etape == nombre_etapes:
            self.etape_actuelle = (
                nombre_etapes
            )

            self.statut = (
                self.Statut.TERMINE
            )

            self.demande.statut = (
                DemandeRecrutement
                .Statut.TERMINEE
            )

            self.demande.save(
                update_fields=[
                    "statut",
                    "date_modification",
                ]
            )
        else:
            self.etape_actuelle = (
                numero_etape + 1
            )

        self.save(
            update_fields=[
                "etapes_terminees",
                "etape_actuelle",
                "statut",
                "date_modification",
            ]
        )

    def __str__(self):
        return (
            f"Processus "
            f"{self.demande.reference} — "
            f"{self.demande.get_type_recrutement_display()}"
        )


def chemin_fichier_offre(instance, filename):
    extension = os.path.splitext(filename)[1]

    annee = timezone.localdate().year

    nom_fichier = (
        f"offre-{annee}-"
        f"{timezone.now().strftime('%Y%m%d%H%M%S%f')}"
        f"{extension.lower()}"
    )

    return f"recruitment/offres/{annee}/{nom_fichier}"


class OffreRecrutement(models.Model):
    reference = models.CharField(
        max_length=30,
        unique=True,
        blank=True,
    )

    titre = models.CharField(
        max_length=255,
        blank=True,
    )

    fichier = models.FileField(
        upload_to=chemin_fichier_offre,
        null=True,
        blank=True,
    )

    nom_fichier_original = models.CharField(
        max_length=255,
        blank=True,
    )

    active = models.BooleanField(
        default=True,
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
    )

    date_modification = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-date_creation",
        ]

    def generer_reference(self):
        annee = timezone.localdate().year

        derniere_offre = (
            OffreRecrutement.objects
            .filter(
                reference__startswith=(
                    f"OFF-{annee}-"
                )
            )
            .order_by("-id")
            .first()
        )

        numero = 1

        if derniere_offre:
            try:
                numero = (
                    int(
                        derniere_offre.reference.split(
                            "-"
                        )[-1]
                    )
                    + 1
                )
            except (ValueError, IndexError):
                numero = (
                    derniere_offre.id + 1
                )

        return f"OFF-{annee}-{numero:04d}"

    def save(self, *args, **kwargs):
        if self.fichier and not self.nom_fichier_original:
            self.nom_fichier_original = os.path.basename(
                self.fichier.name
            )

        if not self.titre and self.fichier:
            self.titre = os.path.splitext(
                self.nom_fichier_original
            )[0]

        if not self.reference:
            self.reference = (
                self.generer_reference()
            )

        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.reference} - {self.titre}"
        )

class PublicationOffre(models.Model):
    processus = models.ForeignKey(
        ProcessusRecrutement,
        on_delete=models.CASCADE,
        related_name="publications",
    )

    canal = models.CharField(
        max_length=150,
    )

    date_publication = models.DateField()

    date_limite_candidature = models.DateField(
        null=True,
        blank=True,
    )

    lien_ou_reference = models.CharField(
        max_length=500,
        blank=True,
    )

    preuve = models.FileField(
        upload_to="recruitment/publications/",
        null=True,
        blank=True,
    )

    commentaire = models.TextField(
        blank=True,
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
    )

    date_modification = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "date_publication",
            "id",
        ]

        # Un seul canal/publication par processus.
        constraints = [
            models.UniqueConstraint(
                fields=["processus"],
                name=(
                    "unique_publication_par_processus"
                ),
            ),
        ]

    def clean(self):
        super().clean()

        if (
            self.date_publication
            and self.date_limite_candidature
            and self.date_publication
            > self.date_limite_candidature
        ):
            raise ValidationError(
                {
                    "date_limite_candidature": (
                        "La date limite doit être "
                        "postérieure ou égale à la "
                        "date de publication."
                    )
                }
            )

        date_recrutement = (
            self.processus
            .demande
            .date_prevue_recrutement
        )

        if (
            date_recrutement
            and self.date_limite_candidature
            and self.date_limite_candidature
            >= date_recrutement
        ):
            raise ValidationError(
                {
                    "date_limite_candidature": (
                        "La date limite de candidature "
                        "doit être antérieure à la date "
                        "prévue du recrutement."
                    )
                }
            )

    def save(self, *args, **kwargs):
        self.full_clean()

        return super().save(
            *args,
            **kwargs
        )

    def __str__(self):
        return (
            f"{self.processus.demande.reference}"
            f" — {self.canal}"
        )
    
class FicheTransparence(models.Model):
    class Lieu(models.TextChoices):
        SITE_1 = "SITE_1", "PBI 1"
        SITE_2 = "SITE_2", "PBI 2"
        SITE_3 = "SITE_3", "PBI 3"

    processus = models.OneToOneField(
        ProcessusRecrutement,
        on_delete=models.CASCADE,
        related_name="fiche_transparence",
    )

    date_fiche = models.DateField(
        null=True,
        blank=True,
    )

    lieu = models.CharField(
        max_length=20,
        choices=Lieu.choices,
        blank=True,
    )

    fichier = models.FileField(
        upload_to=(
            "recruitment/transparence/"
        ),
    )

    observations = models.TextField(
        blank=True,
    )

    original_signe = models.BooleanField(
        default=False,
    )

    date_upload = models.DateTimeField(
        auto_now_add=True,
    )

    date_modification = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-date_upload",
        ]

    def __str__(self):
        return (
            "Fiche de transparence — "
            f"{self.processus.demande.reference}"
        )

class Candidat(models.Model):
    class Statut(models.TextChoices):
        # Parcours cadre
        AJOUTE = (
            "AJOUTE",
            "Ajouté",
        )

        ENTRETIEN_PLANIFIE = (
            "ENTRETIEN_PLANIFIE",
            "Entretien planifié",
        )

        ENTRETIEN_REALISE = (
            "ENTRETIEN_REALISE",
            "Entretien réalisé",
        )

        COMPTE_RENDU_BROUILLON = (
            "COMPTE_RENDU_BROUILLON",
            "Compte rendu en brouillon",
        )

        COMPTE_RENDU_ENVOYE = (
            "COMPTE_RENDU_ENVOYE",
            "Compte rendu envoyé",
        )

        RETENU = (
            "RETENU",
            "Retenu",
        )

        NON_RETENU = (
            "NON_RETENU",
            "Non retenu",
        )

        # Parcours ouvrier
        NON_RECU = (
            "NON_RECU",
            "Non reçu",
        )

        RECU = (
            "RECU",
            "Reçu",
        )

        # Commun aux deux parcours
        EMBAUCHE = (
            "EMBAUCHE",
            "Embauché",
        )

    processus = models.ForeignKey(
        ProcessusRecrutement,
        on_delete=models.CASCADE,
        related_name="candidats",
    )

    nom = models.CharField(
        max_length=150
    )

    prenom = models.CharField(
        max_length=150
    )

    telephone = models.CharField(
        max_length=100,
        blank=True,
    )

    email = models.EmailField(
        blank=True
    )

    date_candidature = models.DateField(
        default=timezone.localdate
    )

    # Utilisé uniquement pour les cadres.
    date_entretien_prevue = (
        models.DateTimeField(
            null=True,
            blank=True,
        )
    )

    date_entretien_realisee = (
        models.DateTimeField(
            null=True,
            blank=True,
        )
    )

    source = models.CharField(
        max_length=200,
        blank=True,
    )

    # Utilisée seulement pour les ouvriers.
    fiche_test = models.FileField(
        upload_to=(
            "recrutement/fiches-test/"
        ),
        null=True,
        blank=True,
    )

    statut = models.CharField(
        max_length=30,
        choices=Statut.choices,
        default=Statut.AJOUTE,
    )

    observations = models.TextField(
        blank=True
    )

    date_creation = models.DateTimeField(
        auto_now_add=True
    )

    date_modification = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = [
            "nom",
            "prenom",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "processus",
                    "email",
                ],
                condition=~models.Q(
                    email=""
                ),
                name=(
                    "unique_email_"
                    "candidat_processus"
                ),
            ),
        ]

    @property
    def nom_complet(self):
        return (
            f"{self.prenom} "
            f"{self.nom}"
        ).strip()

    @property
    def est_cadre(self):
        return (
            self.processus
            .demande
            .type_recrutement
            ==
            DemandeRecrutement
            .TypeRecrutement.CADRE
        )

    @property
    def est_ouvrier(self):
        return not self.est_cadre

    def clean(self):
        erreurs = {}

        if not self.processus_id:
            return

        if (
            self.est_cadre
            and self.fiche_test
        ):
            erreurs["fiche_test"] = (
                "La fiche de test ne concerne "
                "pas le recrutement des cadres."
            )

        if (
            self.est_ouvrier
            and (
                self.date_entretien_prevue
                or self.date_entretien_realisee
            )
        ):
            erreurs[
                "date_entretien_prevue"
            ] = (
                "La gestion des entretiens "
                "concerne uniquement les cadres."
            )

        if (
            self.date_entretien_realisee
            and not self.date_entretien_prevue
        ):
            erreurs[
                "date_entretien_prevue"
            ] = (
                "La date prévue de l’entretien "
                "doit être renseignée."
            )

            if (
                self.date_entretien_prevue
                and self.date_entretien_realisee
                and (
                    self.date_entretien_realisee.date()
                    <
                    self.date_entretien_prevue.date()
                )
            ):
                erreurs[
                    "date_entretien_realisee"
                ] = (
                    "La réalisation de l’entretien "
                    "ne peut pas être enregistrée "
                    "avant la date prévue."
                )

        if erreurs:
            raise ValidationError(erreurs)

    def save(self, *args, **kwargs):
        if (
            not self.source
            and self.processus_id
        ):
            publication = (
                self.processus
                .publications
                .order_by(
                    "date_publication",
                    "id",
                )
                .first()
            )

            self.source = (
                publication.canal
                if publication
                else "Offre publiée"
            )

        if (
            self.statut
            != self.Statut.EMBAUCHE
            and self.processus_id
            and self.est_ouvrier
        ):
            self.statut = (
                self.Statut.RECU
                if self.fiche_test
                else self.Statut.NON_RECU
            )

        self.full_clean()

        return super().save(
            *args,
            **kwargs,
        )

    def __str__(self):
        return (
            f"{self.nom_complet} — "
            f"{self.processus.demande.reference}"
        )

    @property
    def entretien_planifie(self):
        return bool(
            self.date_entretien_prevue
        )


    @property
    def entretien_realise(self):
        return bool(
            self.date_entretien_realisee
        )


    @property
    def peut_rediger_compte_rendu(self):
        if not self.est_cadre:
            return False

        return (
            self.statut
            in [
                self.Statut
                .ENTRETIEN_REALISE,

                self.Statut
                .COMPTE_RENDU_BROUILLON,

                self.Statut
                .COMPTE_RENDU_ENVOYE,

                self.Statut.RETENU,

                self.Statut
                .NON_RETENU,
            ]
        )

class NotificationChargeRHSite(
    models.Model
):
    class Statut(models.TextChoices):
        EN_ATTENTE = (
            "EN_ATTENTE",
            "En attente",
        )

        ENVOYEE = (
            "ENVOYEE",
            "Envoyée",
        )

        ECHEC = (
            "ECHEC",
            "Échec",
        )

    processus = models.ForeignKey(
        ProcessusRecrutement,
        on_delete=models.CASCADE,
        related_name=(
            "notifications_charge_rh"
        ),
    )

    factory = models.ForeignKey(
        "employees.Factory",
        on_delete=models.PROTECT,
        related_name=(
            "notifications_recrutement"
        ),
    )

    candidats = models.ManyToManyField(
        Candidat,
        related_name=(
            "notifications_charge_rh"
        ),
        blank=True,
    )

    destinataires = models.JSONField(
        default=list,
        blank=True,
    )

    sujet = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    message = models.TextField(
        blank=True,
        default="",
    )

    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.EN_ATTENTE,
        db_index=True,
    )

    erreur_envoi = models.TextField(
        blank=True,
        default="",
    )

    envoye_par = models.ForeignKey(
        "accounts.HRProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "notifications_recrutement_envoyees"
        ),
    )

    date_envoi = models.DateTimeField(
        null=True,
        blank=True,
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-date_creation",
        ]

        indexes = [
            models.Index(
                fields=[
                    "processus",
                    "statut",
                ],
                name=(
                    "notif_rh_process_statut_idx"
                ),
            ),
        ]

    @property
    def est_envoyee(self):
        return (
            self.statut
            == self.Statut.ENVOYEE
        )

    def clean(self):
        erreurs = {}

        if (
            self.processus_id
            and self.processus
            .demande
            .type_recrutement
            !=
            DemandeRecrutement
            .TypeRecrutement.OUVRIER
        ):
            erreurs["processus"] = (
                "La notification au Chargé RH "
                "du site concerne uniquement "
                "les recrutements d’ouvriers."
            )

        if (
            self.processus_id
            and self.factory_id
            and self.processus
            .demande
            .factory_id
            != self.factory_id
        ):
            erreurs["factory"] = (
                "Le site de la notification "
                "ne correspond pas au site "
                "de la demande."
            )

        if erreurs:
            raise ValidationError(erreurs)

    def save(self, *args, **kwargs):
        self.full_clean()

        return super().save(
            *args,
            **kwargs,
        )

    def __str__(self):
        return (
            "Notification Chargé RH — "
            f"{self.processus.demande.reference}"
        )
    
class CompteRenduEntretienCadre(
    models.Model
):
    class Statut(models.TextChoices):
        BROUILLON = (
            "BROUILLON",
            "Brouillon",
        )

        VALIDE = (
            "VALIDE",
            "Validé",
        )

        ENVOYE = (
            "ENVOYE",
            "Envoyé au DRH",
        )

    class Avis(models.TextChoices):
        FAVORABLE = (
            "FAVORABLE",
            "Favorable",
        )

        FAVORABLE_RESERVE = (
            "FAVORABLE_RESERVE",
            "Favorable avec réserve",
        )

        DEFAVORABLE = (
            "DEFAVORABLE",
            "Défavorable",
        )

        A_REVOIR = (
            "A_REVOIR",
            "À revoir",
        )

    class DecisionFinale(
    models.TextChoices
    ):
        RETENU = (
            "RETENU",
            "Retenu",
        )

        NON_RETENU = (
            "NON_RETENU",
            "Non retenu",
        )

    class Devise(models.TextChoices):
        MGA = "MGA", "MGA"
        EUR = "EUR", "EUR"
        USD = "USD", "USD"

    reference = models.CharField(
        max_length=40,
        unique=True,
        default=(
            generer_reference_compte_rendu
        ),
        editable=False,
    )

    candidat = models.OneToOneField(
        Candidat,
        on_delete=models.CASCADE,
        related_name=(
            "compte_rendu_cadre"
        ),
    )

    # Informations sur l’entretien
    date_entretien = models.DateField(
        null=True,
        blank=True,
    )

    poste = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    # Profil professionnel
    pretention_salariale = (
        models.DecimalField(
            max_digits=15,
            decimal_places=2,
            null=True,
            blank=True,
        )
    )

    devise = models.CharField(
        max_length=10,
        choices=Devise.choices,
        default=Devise.MGA,
    )

    disponibilite = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    precision_disponibilite = (
        models.CharField(
            max_length=255,
            blank=True,
            default="",
        )
    )

    annees_experience = (
        models.PositiveSmallIntegerField(
            null=True,
            blank=True,
        )
    )

    diplome = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    etablissement = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    # Personnes qui remplissent
    # le compte rendu
    redacteur_rh = models.BooleanField(
        default=False,
    )

    redacteur_manager = (
        models.BooleanField(
            default=False,
        )
    )

    # Avis RH
    avis_rh = models.CharField(
        max_length=30,
        choices=Avis.choices,
        blank=True,
        default="",
    )

    commentaire_rh = models.TextField(
        blank=True,
        default="",
    )

    nom_signataire_rh = (
        models.CharField(
            max_length=255,
            blank=True,
            default="",
        )
    )

    fonction_signataire_rh = (
        models.CharField(
            max_length=255,
            blank=True,
            default=(
                "Responsable recrutement"
            ),
        )
    )

    date_signature_rh = models.DateField(
        null=True,
        blank=True,
    )

    signe_rh = models.BooleanField(
        default=False,
    )

    # Avis Manager
    avis_manager = models.CharField(
        max_length=30,
        choices=Avis.choices,
        blank=True,
        default="",
    )

    commentaire_manager = (
        models.TextField(
            blank=True,
            default="",
        )
    )

    nom_signataire_manager = (
        models.CharField(
            max_length=255,
            blank=True,
            default="",
        )
    )

    fonction_signataire_manager = (
        models.CharField(
            max_length=255,
            blank=True,
            default="Manager",
        )
    )

    date_signature_manager = (
        models.DateField(
            null=True,
            blank=True,
        )
    )

    signe_manager = (
        models.BooleanField(
            default=False,
        )
    )

    observation_generale = (
        models.TextField(
            blank=True,
            default="",
        )
    )

    decision_finale = models.CharField(
        max_length=20,
        choices=DecisionFinale.choices,
        blank=True,
        default="",
    )

    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.BROUILLON,
        db_index=True,
    )

    cree_par = models.ForeignKey(
        "accounts.HRProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "comptes_rendus_cadres_crees"
        ),
    )

    valide_par = models.ForeignKey(
        "accounts.HRProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "comptes_rendus_cadres_valides"
        ),
    )

    date_validation = (
        models.DateTimeField(
            null=True,
            blank=True,
        )
    )

    date_envoi = models.DateTimeField(
        null=True,
        blank=True,
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
    )

    date_modification = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-date_creation",
        ]

        indexes = [
            models.Index(
                fields=["statut"],
                name="cr_cadre_statut_idx",
            ),
            models.Index(
                fields=["date_entretien"],
                name=(
                    "cr_cadre_entretien_idx"
                ),
            ),
        ]

    @property
    def est_brouillon(self):
        return (
            self.statut
            == self.Statut.BROUILLON
        )

    @property
    def est_envoye(self):
        return (
            self.statut
            == self.Statut.ENVOYE
        )

    def verifier_avis_rh(self):
        erreurs = {}

        if not self.redacteur_rh:
            return erreurs

        if not self.avis_rh:
            erreurs["avis_rh"] = (
                "L’avis RH est obligatoire."
            )

        if not self.commentaire_rh.strip():
            erreurs["commentaire_rh"] = (
                "Le commentaire RH "
                "est obligatoire."
            )

        if (
            not self
            .nom_signataire_rh
            .strip()
        ):
            erreurs["nom_signataire_rh"] = (
                "Le nom du signataire RH "
                "est obligatoire."
            )

        if (
            not self
            .fonction_signataire_rh
            .strip()
        ):
            erreurs[
                "fonction_signataire_rh"
            ] = (
                "La fonction du signataire RH "
                "est obligatoire."
            )

        if not self.date_signature_rh:
            erreurs["date_signature_rh"] = (
                "La date de signature RH "
                "est obligatoire."
            )

        if not self.signe_rh:
            erreurs["signe_rh"] = (
                "L’avis RH doit être signé."
            )

        return erreurs

    def verifier_avis_manager(self):
        erreurs = {}

        if not self.redacteur_manager:
            return erreurs

        if not self.avis_manager:
            erreurs["avis_manager"] = (
                "L’avis Manager "
                "est obligatoire."
            )

        if (
            not self
            .commentaire_manager
            .strip()
        ):
            erreurs[
                "commentaire_manager"
            ] = (
                "Le commentaire Manager "
                "est obligatoire."
            )

        if (
            not self
            .nom_signataire_manager
            .strip()
        ):
            erreurs[
                "nom_signataire_manager"
            ] = (
                "Le nom du signataire "
                "Manager est obligatoire."
            )

        if (
            not self
            .fonction_signataire_manager
            .strip()
        ):
            erreurs[
                "fonction_signataire_manager"
            ] = (
                "La fonction du signataire "
                "Manager est obligatoire."
            )

        if (
            not self
            .date_signature_manager
        ):
            erreurs[
                "date_signature_manager"
            ] = (
                "La date de signature "
                "Manager est obligatoire."
            )

        if not self.signe_manager:
            erreurs["signe_manager"] = (
                "L’avis Manager "
                "doit être signé."
            )

        return erreurs

    def clean(self):
        erreurs = {}

        if self.candidat_id:
            demande = (
                self.candidat
                .processus
                .demande
            )

            if (
                demande.type_recrutement
                !=
                DemandeRecrutement
                .TypeRecrutement.CADRE
            ):
                erreurs["candidat"] = (
                    "Un compte rendu cadre "
                    "ne peut être créé que pour "
                    "un recrutement de cadre."
                )

            statuts_autorises = [
                Candidat.Statut
                .ENTRETIEN_REALISE,

                Candidat.Statut
                .COMPTE_RENDU_BROUILLON,

                Candidat.Statut
                .COMPTE_RENDU_ENVOYE,

                Candidat.Statut.RETENU,

                Candidat.Statut
                .NON_RETENU,
            ]

            if (
                self.candidat.statut
                not in statuts_autorises
            ):
                erreurs["candidat"] = (
                    "Le compte rendu peut être "
                    "rédigé uniquement après "
                    "la réalisation de l’entretien."
                )

        if (
            not self.redacteur_rh
            and not self.redacteur_manager
        ):
            erreurs["redacteur_rh"] = (
                "Sélectionnez au moins "
                "un rédacteur."
            )

        # Un brouillon peut rester
        # partiellement rempli.
        if (
            self.statut
            != self.Statut.BROUILLON
        ):
            if not self.date_entretien:
                erreurs["date_entretien"] = (
                    "La date de l’entretien "
                    "est obligatoire."
                )

            if (
                self.pretention_salariale
                is None
            ):
                erreurs[
                    "pretention_salariale"
                ] = (
                    "La prétention salariale "
                    "est obligatoire."
                )

            if (
                not self
                .disponibilite
                .strip()
            ):
                erreurs["disponibilite"] = (
                    "La disponibilité "
                    "est obligatoire."
                )

            if (
                self.annees_experience
                is None
            ):
                erreurs[
                    "annees_experience"
                ] = (
                    "Le nombre d’années "
                    "d’expérience est obligatoire."
                )

            if not self.diplome.strip():
                erreurs["diplome"] = (
                    "Le diplôme "
                    "est obligatoire."
                )

            if not self.decision_finale:
                erreurs["decision_finale"] = (
                    "La décision finale "
                    "est obligatoire."
                )

            erreurs.update(
                self.verifier_avis_rh()
            )

            erreurs.update(
                self.verifier_avis_manager()
            )

        if erreurs:
            raise ValidationError(erreurs)

    def save(self, *args, **kwargs):
        if (
            not self.poste
            and self.candidat_id
        ):
            self.poste = str(
                self.candidat
                .processus
                .demande
                .poste
            )

        self.full_clean()

        return super().save(
            *args,
            **kwargs,
        )

    def __str__(self):
        return (
            f"{self.reference} — "
            f"{self.candidat.nom_complet}"
        )

class TachePreparationEmbauche(
    models.Model
):
    class Service(models.TextChoices):
        IT = (
            "IT",
            "Informatique",
        )

        COMPTABILITE = (
            "COMPTABILITE",
            "Comptabilité",
        )

        RH = (
            "RH",
            "Ressources humaines",
        )

    class TypeTache(models.TextChoices):
        CREATION_EMAIL = (
            "CREATION_EMAIL",
            "Création de l’adresse e-mail",
        )

        PREPARATION_MATERIEL = (
            "PREPARATION_MATERIEL",
            "Préparation du matériel",
        )

        CREATION_ACCES = (
            "CREATION_ACCES",
            "Création des accès et outils",
        )

        PREPARATION_BUREAU = (
            "PREPARATION_BUREAU",
            "Préparation du bureau",
        )

        COMMANDE_EQUIPEMENTS = (
            "COMMANDE_EQUIPEMENTS",
            "Commande des équipements",
        )

        PREPARATION_CONTRAT = (
            "PREPARATION_CONTRAT",
            "Préparation du contrat",
        )

        PREPARATION_INTEGRATION = (
            "PREPARATION_INTEGRATION",
            "Préparation de l’intégration",
        )

    class Statut(models.TextChoices):
        A_FAIRE = (
            "A_FAIRE",
            "À faire",
        )

        EN_COURS = (
            "EN_COURS",
            "En cours",
        )

        TERMINEE = (
            "TERMINEE",
            "Terminée",
        )

        ANNULEE = (
            "ANNULEE",
            "Annulée",
        )

    candidat = models.ForeignKey(
        Candidat,
        on_delete=models.CASCADE,
        related_name=(
            "taches_preparation_embauche"
        ),
    )

    service = models.CharField(
        max_length=30,
        choices=Service.choices,
    )

    type_tache = models.CharField(
        max_length=40,
        choices=TypeTache.choices,
    )

    libelle = models.CharField(
        max_length=255,
    )

    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.A_FAIRE,
        db_index=True,
    )

    assignee_a = models.ForeignKey(
        "accounts.HRProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "taches_preparation_embauche"
        ),
    )

    cree_par = models.ForeignKey(
        "accounts.HRProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "taches_preparation_creees"
        ),
    )

    terminee_par = models.ForeignKey(
        "accounts.HRProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "taches_preparation_terminees"
        ),
    )

    commentaire = models.TextField(
        blank=True,
        default="",
    )

    date_debut = models.DateTimeField(
        null=True,
        blank=True,
    )

    date_fin = models.DateTimeField(
        null=True,
        blank=True,
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
    )

    date_modification = models.DateTimeField(
        auto_now=True,
    )

    notification_email_envoyee = (
        models.BooleanField(
            default=False,
            verbose_name=(
                "Notification e-mail envoyée"
            ),
        )
    )

    date_notification_email = (
        models.DateTimeField(
            null=True,
            blank=True,
            verbose_name=(
                "Date de notification"
            ),
        )
    )

    destinataires_notification = (
        models.JSONField(
            default=list,
            blank=True,
            verbose_name=(
                "Destinataires de la notification"
            ),
        )
    )

    erreur_notification = (
        models.TextField(
            blank=True,
            default="",
            verbose_name=(
                "Erreur de notification"
            ),
        )
    )

    nombre_tentatives_notification = (
        models.PositiveIntegerField(
            default=0,
            verbose_name=(
                "Nombre de tentatives "
                "de notification"
            ),
        )
    )

    class Meta:
        ordering = [
            "service",
            "type_tache",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "candidat",
                    "type_tache",
                ],
                name=(
                    "unique_tache_preparation"
                    "_par_candidat"
                ),
            ),
        ]

        indexes = [
            models.Index(
                fields=[
                    "service",
                    "statut",
                ],
                name=(
                    "tache_prep_service_statut_idx"
                ),
            ),
            models.Index(
                fields=[
                    "candidat",
                    "statut",
                ],
                name=(
                    "tache_prep_candidat_statut_idx"
                ),
            ),
        ]

    @property
    def est_terminee(self):
        return (
            self.statut
            == self.Statut.TERMINEE
        )

    def clean(self):
        erreurs = {}

        if not self.candidat_id:
            return

        demande = (
            self.candidat
            .processus
            .demande
        )

        if (
            demande.type_recrutement
            !=
            DemandeRecrutement
            .TypeRecrutement.CADRE
        ):
            erreurs["candidat"] = (
                "Les tâches de préparation "
                "IT, Comptabilité et RH "
                "concernent uniquement les cadres."
            )

        if (
            self.candidat.statut
            not in [
                Candidat.Statut.RETENU,
                Candidat.Statut.EMBAUCHE,
            ]
        ):
            erreurs["candidat"] = (
                "Les tâches peuvent être créées "
                "uniquement pour un candidat "
                "cadre retenu."
            )

        if (
            self.statut
            == self.Statut.TERMINEE
            and not self.date_fin
        ):
            erreurs["date_fin"] = (
                "La date de fin est obligatoire "
                "pour une tâche terminée."
            )

        if erreurs:
            raise ValidationError(erreurs)

    def save(self, *args, **kwargs):
        if not self.libelle:
            self.libelle = (
                self.get_type_tache_display()
            )

        if (
            self.statut
            == self.Statut.EN_COURS
            and not self.date_debut
        ):
            self.date_debut = (
                timezone.now()
            )

        if (
            self.statut
            == self.Statut.TERMINEE
            and not self.date_fin
        ):
            self.date_fin = (
                timezone.now()
            )

        self.full_clean()

        return super().save(
            *args,
            **kwargs,
        )

    def __str__(self):
        return (
            f"{self.get_service_display()} — "
            f"{self.libelle} — "
            f"{self.candidat.nom_complet}"
        )
    
TACHES_PREPARATION_CADRE = [
{
    "service": (
        TachePreparationEmbauche
        .Service.IT
    ),
    "type_tache": (
        TachePreparationEmbauche
        .TypeTache.CREATION_EMAIL
    ),
},
{
    "service": (
        TachePreparationEmbauche
        .Service.IT
    ),
    "type_tache": (
        TachePreparationEmbauche
        .TypeTache
        .PREPARATION_MATERIEL
    ),
},
{
    "service": (
        TachePreparationEmbauche
        .Service.IT
    ),
    "type_tache": (
        TachePreparationEmbauche
        .TypeTache.CREATION_ACCES
    ),
},
{
    "service": (
        TachePreparationEmbauche
        .Service.COMPTABILITE
    ),
    "type_tache": (
        TachePreparationEmbauche
        .TypeTache.PREPARATION_BUREAU
    ),
},
{
    "service": (
        TachePreparationEmbauche
        .Service.COMPTABILITE
    ),
    "type_tache": (
        TachePreparationEmbauche
        .TypeTache
        .COMMANDE_EQUIPEMENTS
    ),
},
{
    "service": (
        TachePreparationEmbauche
        .Service.RH
    ),
    "type_tache": (
        TachePreparationEmbauche
        .TypeTache.PREPARATION_CONTRAT
    ),
},
{
    "service": (
        TachePreparationEmbauche
        .Service.RH
    ),
    "type_tache": (
        TachePreparationEmbauche
        .TypeTache
        .PREPARATION_INTEGRATION
    ),
},
]
    
class RetourRHCandidat(models.Model):
    candidat = models.OneToOneField(
        Candidat,
        on_delete=models.CASCADE,
        related_name="retour_rh",
    )

    responsable_rh = models.CharField(
        max_length=255
    )

    date_remise_liste = models.DateField(
        default=timezone.localdate
    )

    liste_imprimee = models.BooleanField(
        default=False
    )

    liste_remise = models.BooleanField(
        default=False
    )

    remarque = models.TextField(blank=True)

    date_validation = models.DateTimeField(
        null=True,
        blank=True,
    )

    date_creation = models.DateTimeField(
        auto_now_add=True
    )

    date_modification = models.DateTimeField(
        auto_now=True
    )

    def clean(self):
        erreurs = {}

        if not self.candidat_id:
            return

        if (
            self.candidat
            .processus
            .demande
            .type_recrutement
            ==
            DemandeRecrutement
            .TypeRecrutement.CADRE
        ):
            erreurs["candidat"] = (
                "Le recrutement des cadres "
                "ne comporte pas de Retour RH."
            )

        elif (
            self.candidat.statut
            not in [
                Candidat.Statut.RECU,
                Candidat.Statut.EMBAUCHE,
            ]
        ):
            erreurs["candidat"] = (
                "Seul un candidat reçu peut "
                "passer au Retour RH."
            )

        if erreurs:
            raise ValidationError(erreurs)

    def save(self, *args, **kwargs):
        self.full_clean()

        if (
            self.liste_remise
            and not self.date_validation
        ):
            self.date_validation = timezone.now()

        return super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"Retour RH — "
            f"{self.candidat.nom_complet}"
        )


class DocumentCandidat(models.Model):
    retour_rh = models.ForeignKey(
        RetourRHCandidat,
        on_delete=models.CASCADE,
        related_name="documents",
    )

    libelle = models.CharField(max_length=255)

    recu = models.BooleanField(default=False)

    fichier = models.FileField(
        upload_to=(
            "recrutement/documents-candidats/"
        ),
        null=True,
        blank=True,
    )

    remarque = models.TextField(blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.libelle


class Embauche(models.Model):
    class TypeContrat(models.TextChoices):
        CDI = "CDI", "CDI"
        CDD = "CDD", "CDD"

    candidat = models.OneToOneField(
        Candidat,
        on_delete=models.CASCADE,
        related_name="embauche",
    )

    # Vérification du dossier
    date_verification = models.DateField(
        default=timezone.localdate,
    )

    verificateur = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    # Contrat
    type_contrat = models.CharField(
        max_length=20,
        choices=TypeContrat.choices,
    )

    date_debut_contrat = models.DateField()

    signe_candidat = models.BooleanField(
        default=False,
    )

    signe_employeur = models.BooleanField(
        default=False,
    )

    remarque_generale = models.TextField(
        blank=True,
        default="",
    )

    # Checklist obligatoire d'embauche et d'onboarding.
    # date_debut_contrat représente la date de prise de poste.
    dossier_embauche_complet = models.BooleanField(
        default=False,
    )

    contrat_travail_signe = models.BooleanField(
        default=False,
    )

    journee_integration_realisee = models.BooleanField(
        default=False,
    )

    reglement_interieur_communique = models.BooleanField(
        default=False,
    )

    code_societe_communique = models.BooleanField(
        default=False,
    )

    # Trace de l'envoi automatique du RI et du code société
    # au candidat cadre.
    documents_cadre_email_envoyes = models.BooleanField(
        default=False,
        editable=False,
    )

    date_envoi_documents_cadre = models.DateTimeField(
        null=True,
        blank=True,
        editable=False,
    )

    destinataires_documents_cadre = models.JSONField(
        default=list,
        blank=True,
    )

    nombre_tentatives_envoi_documents_cadre = (
        models.PositiveIntegerField(default=0)
    )

    erreur_envoi_documents_cadre = models.TextField(
        blank=True,
        default="",
    )

    # Fiche employé associée ultérieurement
    employe = models.OneToOneField(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="embauche_recrutement",
    )

    date_confirmation = models.DateTimeField(
        null=True,
        blank=True,
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
    )

    date_modification = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-date_creation"]

    @property
    def confirmee(self):
        return self.date_confirmation is not None

    @property
    def est_cadre(self):
        return (
            self.candidat.processus.demande.type_recrutement
            == DemandeRecrutement.TypeRecrutement.CADRE
        )

    @property
    def envoi_documents_cadre_requis(self):
        """
        L'envoi automatique est obligatoire si le candidat cadre
        possède une adresse e-mail exploitable.
        """
        return bool(
            self.est_cadre
            and (self.candidat.email or "").strip()
        )

    @property
    def checklist_onboarding_complete(self):
        checklist_complete = bool(
            self.date_debut_contrat
            and self.dossier_embauche_complet
            and self.contrat_travail_signe
            and self.journee_integration_realisee
            and self.reglement_interieur_communique
            and self.code_societe_communique
        )

        if not checklist_complete:
            return False

        if self.envoi_documents_cadre_requis:
            return self.documents_cadre_email_envoyes

        return True

    def clean(self):
        erreurs = {}

        if not self.candidat_id:
            return

        demande = (
            self.candidat
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
            if (
                self.candidat.statut
                not in [
                    Candidat.Statut.RETENU,
                    Candidat.Statut.EMBAUCHE,
                ]
            ):
                erreurs["candidat"] = (
                    "Seul un candidat cadre "
                    "retenu peut être embauché."
                )

        else:
            if (
                self.candidat.statut
                not in [
                    Candidat.Statut.RECU,
                    Candidat.Statut.EMBAUCHE,
                ]
            ):
                erreurs["candidat"] = (
                    "Ce candidat ouvrier "
                    "n’a pas été retenu."
                )

            try:
                retour_rh = (
                    self.candidat
                    .retour_rh
                )
            except RetourRHCandidat.DoesNotExist:
                erreurs["candidat"] = (
                    "Le Retour RH du candidat "
                    "n’a pas encore été enregistré."
                )
            else:
                if not retour_rh.liste_remise:
                    erreurs["candidat"] = (
                        "La liste des documents "
                        "n’a pas encore été remise "
                        "au candidat."
                    )

        if erreurs:
            raise ValidationError(erreurs)

    def save(self, *args, **kwargs):
        self.full_clean()

        return super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"Embauche — "
            f"{self.candidat.nom_complet}"
        )


class DesistementEmbauche(models.Model):
    """Withdrawal/desistement record for a hire (Embauche) — recruitment restart tracking."""

    embauche = models.OneToOneField(
        "recruitment.Embauche", on_delete=models.PROTECT, related_name="desistement"
    )
    date_desistement = models.DateField()
    motif = models.TextField(blank=True, default="")
    commentaire = models.TextField(blank=True, default="")
    relancer_recrutement = models.BooleanField(default=True)
    date_reprise_recrutement = models.DateField(blank=True, null=True)
    date_cloture_initiale = models.DateTimeField(blank=True, null=True, editable=False)
    date_nouvelle_cloture = models.DateTimeField(blank=True, null=True, editable=False)
    date_enregistrement = models.DateTimeField(auto_now_add=True)
    enregistre_par = models.ForeignKey(
        "accounts.HRProfile", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="desistements_enregistres",
    )

    class Meta:
        ordering = ["-date_enregistrement"]

    def __str__(self):
        return f"Desistement — {self.embauche} ({self.date_desistement})"
