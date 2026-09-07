from django.contrib import admin

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
)


class PublicationOffreInline(
    admin.TabularInline
):
    model = PublicationOffre
    extra = 0

    fields = [
        "canal",
        "date_publication",
        "lien",
    ]


class CandidatInline(
    admin.TabularInline
):
    model = Candidat
    extra = 0

    fields = [
        "nom",
        "prenom",
        "email",
        "telephone",
        "date_candidature",
        "source",
        "fiche_test",
        "statut",
    ]

    readonly_fields = [
        "source",
        "statut",
    ]


class DocumentCandidatInline(
    admin.TabularInline
):
    model = DocumentCandidat
    extra = 0

    fields = [
        "libelle",
        "recu",
        "fichier",
        "remarque",
    ]


@admin.register(DemandeRecrutement)
class DemandeRecrutementAdmin(
    admin.ModelAdmin
):
    list_display = [
        "reference",
        "poste",
        "departement",
        "nom_demandeur",
        "afficher_nombre_total",
        "motif",
        "statut",
        "date_prevue_recrutement",
        "date_creation",
    ]

    list_filter = [
        "statut",
        "motif",
        "motif_remplacement",
        "factory",
        "departement",
        "date_creation",
    ]

    search_fields = [
        "reference",
        "nom_demandeur",
        "matricule_demandeur",
        "poste__name",
        "departement__name",
    ]

    readonly_fields = [
        "reference",
        "statut",
        "decide_par",
        "date_decision",
        "date_creation",
        "date_modification",
        "afficher_nombre_total",
    ]

    fieldsets = [
        (
            "Référence et statut",
            {
                "fields": [
                    "reference",
                    "statut",
                ]
            },
        ),
        (
            "Informations du demandeur",
            {
                "fields": [
                    "demandeur",
                    "matricule_demandeur",
                    "nom_demandeur",
                    "poste_demandeur",
                    "departement_demandeur",
                ]
            },
        ),
        (
            "Besoin de recrutement",
            {
                "fields": [
                    "factory",
                    "departement",
                    "poste",
                    "nombre_cdi",
                    "nombre_cdd",
                    "afficher_nombre_total",
                    "date_prevue_recrutement",
                    "motif",
                    "motif_remplacement",
                ]
            },
        ),
        (
            "Profil recherché",
            {
                "fields": [
                    "designation_taches",
                    "profil_diplome",
                    "experience_professionnelle",
                    "competences_techniques",
                    "savoir_faire",
                    "savoir_etre",
                ]
            },
        ),
        (
            "Décision",
            {
                "fields": [
                    "motif_decision",
                    "decide_par",
                    "date_decision",
                ]
            },
        ),
        (
            "Traçabilité",
            {
                "fields": [
                    "date_creation",
                    "date_modification",
                ]
            },
        ),
    ]

    ordering = [
        "-date_creation",
    ]

    @admin.display(
        description="Nombre total"
    )
    def afficher_nombre_total(self, objet):
        return objet.nombre_total


@admin.register(ProcessusRecrutement)
class ProcessusRecrutementAdmin(
    admin.ModelAdmin
):
    list_display = [
        "demande",
        "etape_actuelle",
        "statut",
        "liste_candidats_confirmee",
        "date_modification",
    ]

    list_filter = [
        "statut",
        "etape_actuelle",
        "liste_candidats_confirmee",
    ]

    search_fields = [
        "demande__reference",
        "demande__poste__name",
        "demande__departement__name",
    ]

    readonly_fields = [
        "date_creation",
        "date_modification",
    ]

    inlines = [
        PublicationOffreInline,
        CandidatInline,
    ]


@admin.register(OffreRecrutement)
class OffreRecrutementAdmin(admin.ModelAdmin):
    list_display = [
        "reference",
        "titre",
        "nom_fichier_original",
        "nombre_processus",
        "active",
        "date_creation",
    ]

    list_filter = [
        "active",
        "date_creation",
    ]

    search_fields = [
        "reference",
        "titre",
        "nom_fichier_original",
    ]

    readonly_fields = [
        "reference",
        "nom_fichier_original",
        "date_creation",
        "date_modification",
    ]

    ordering = [
        "-date_creation",
    ]

    list_select_related = []

    fieldsets = [
        (
            "Informations de l’offre",
            {
                "fields": [
                    "reference",
                    "titre",
                    "fichier",
                    "nom_fichier_original",
                    "active",
                ],
            },
        ),
        (
            "Dates",
            {
                "fields": [
                    "date_creation",
                    "date_modification",
                ],
            },
        ),
    ]

    @admin.display(
        description="Processus associés",
        ordering=None,
    )
    def nombre_processus(self, obj):
        return (
            obj.processus_recrutement.count()
        )

@admin.register(PublicationOffre)
class PublicationOffreAdmin(
    admin.ModelAdmin
):
    list_display = [
        "processus",
        "canal",
        "date_publication",
        "date_limite_candidature",
        "lien_ou_reference",
        "preuve_disponible",
        "date_creation",
    ]

    list_filter = [
        "canal",
        "date_publication",
        "date_limite_candidature",
        "date_creation",
    ]

    search_fields = [
        "processus__demande__reference",
        "processus__demande__poste__name",
        "canal",
        "lien_ou_reference",
        "commentaire",
    ]

    readonly_fields = [
        "date_creation",
        "date_modification",
    ]

    ordering = [
        "-date_publication",
    ]

    list_select_related = [
        "processus",
        "processus__demande",
        "processus__demande__poste",
    ]

    fieldsets = [
        (
            "Publication",
            {
                "fields": [
                    "processus",
                    "canal",
                    "date_publication",
                    "date_limite_candidature",
                    "lien_ou_reference",
                    "preuve",
                    "commentaire",
                ],
            },
        ),
        (
            "Dates système",
            {
                "fields": [
                    "date_creation",
                    "date_modification",
                ],
            },
        ),
    ]

    @admin.display(
        description="Preuve",
        boolean=True,
    )
    def preuve_disponible(
        self,
        publication,
    ):
        return bool(publication.preuve)
    
@admin.register(FicheTransparence)
class FicheTransparenceAdmin(
    admin.ModelAdmin
):
    list_display = [
        "processus",
        "fichier",
        "date_upload",
    ]

    search_fields = [
        "processus__demande__reference",
        "processus__demande__poste__name",
    ]

    readonly_fields = [
        "date_upload",
    ]


@admin.register(Candidat)
class CandidatAdmin(
    admin.ModelAdmin
):
    list_display = [
        "nom_complet",
        "processus",
        "date_candidature",
        "source",
        "statut",
        "afficher_fiche_test",
    ]

    list_filter = [
        "statut",
        "source",
        "date_candidature",
    ]

    search_fields = [
        "nom",
        "prenom",
        "email",
        "telephone",
        "processus__demande__reference",
    ]

    readonly_fields = [
        "source",
        "statut",
        "date_creation",
        "date_modification",
    ]

    ordering = [
        "nom",
        "prenom",
    ]

    @admin.display(
        boolean=True,
        description="Fiche de test",
    )
    def afficher_fiche_test(self, objet):
        return bool(objet.fiche_test)


@admin.register(RetourRHCandidat)
class RetourRHCandidatAdmin(
    admin.ModelAdmin
):
    list_display = [
        "candidat",
        "responsable_rh",
        "date_remise_liste",
        "liste_imprimee",
        "liste_remise",
        "date_validation",
    ]

    list_filter = [
        "liste_imprimee",
        "liste_remise",
        "date_remise_liste",
    ]

    search_fields = [
        "candidat__nom",
        "candidat__prenom",
        "candidat__email",
        "responsable_rh",
    ]

    readonly_fields = [
        "date_validation",
        "date_creation",
        "date_modification",
    ]

    inlines = [
        DocumentCandidatInline,
    ]


@admin.register(DocumentCandidat)
class DocumentCandidatAdmin(
    admin.ModelAdmin
):
    list_display = [
        "libelle",
        "retour_rh",
        "recu",
        "afficher_fichier",
    ]

    list_filter = [
        "recu",
    ]

    search_fields = [
        "libelle",
        "retour_rh__candidat__nom",
        "retour_rh__candidat__prenom",
    ]

    @admin.display(
        boolean=True,
        description="Fichier",
    )
    def afficher_fichier(self, objet):
        return bool(objet.fichier)


@admin.register(Embauche)
class EmbaucheAdmin(
    admin.ModelAdmin
):
    list_display = [
        "candidat",
        "type_contrat",
        "date_debut_contrat",
        "employe",
        "date_confirmation",
    ]

    list_filter = [
        "type_contrat",
        "date_debut_contrat",
        "date_confirmation",
    ]

    search_fields = [
        "candidat__nom",
        "candidat__prenom",
        "candidat__email",
        "employe__employee_id",
    ]

    readonly_fields = [
        "employe",
        "date_confirmation",
        "date_creation",
        "date_modification",
    ]