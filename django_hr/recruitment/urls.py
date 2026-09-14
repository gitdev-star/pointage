from django.urls import (
    include,
    path,
)

from rest_framework.routers import (
    DefaultRouter,
)

from .views import (
    DemandeRecrutementViewSet,
    ProcessusRecrutementViewSet,
    OffreRecrutementViewSet,
    PublicationOffreViewSet,
    FicheTransparenceViewSet,
    CandidatViewSet,
    RetourRHCandidatViewSet,
    DocumentCandidatViewSet,
    EmbaucheViewSet,
    CompteRenduEntretienCadreViewSet,
    TachePreparationEmbaucheViewSet,
    DesistementEmbaucheViewSet,
)


router = DefaultRouter()

router.register(
    r"demandes",
    DemandeRecrutementViewSet,
    basename="demande-recrutement",
)

router.register(
    r"processus",
    ProcessusRecrutementViewSet,
    basename="processus-recrutement",
)

router.register(
    r"offres",
    OffreRecrutementViewSet,
    basename="offre-recrutement",
)

router.register(
    r"publications",
    PublicationOffreViewSet,
    basename="publication-recrutement",
)

router.register(
    r"fiches-transparence",
    FicheTransparenceViewSet,
    basename="fiche-transparence",
)

router.register(
    r"candidats",
    CandidatViewSet,
    basename="candidat-recrutement",
)

router.register(
    r"retours-rh",
    RetourRHCandidatViewSet,
    basename="retour-rh",
)

router.register(
    r"documents-candidats",
    DocumentCandidatViewSet,
    basename="document-candidat",
)

router.register(
    r"embauches",
    EmbaucheViewSet,
    basename="embauche",
)

router.register(
    r"comptes-rendus-cadres",
    CompteRenduEntretienCadreViewSet,
    basename="compte-rendu-cadre",
)

router.register(
    r"taches-preparation",
    TachePreparationEmbaucheViewSet,
    basename="tache-preparation",
)

router.register(
    r"desistements",
    DesistementEmbaucheViewSet,
    basename="desistement-embauche",
)


urlpatterns = [
    path(
        "",
        include(router.urls),
    ),
]