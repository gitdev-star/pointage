from django.db import transaction

from recruitment.models import (
    Candidat,
    DemandeRecrutement,
    TachePreparationEmbauche,
    TACHES_PREPARATION_CADRE,
)


@transaction.atomic
def creer_taches_preparation_cadre(
    candidat,
    cree_par=None,
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
        raise ValueError(
            "Les tâches de préparation "
            "concernent uniquement les cadres."
        )

    if (
        candidat.statut
        not in [
            Candidat.Statut.RETENU,
            Candidat.Statut.EMBAUCHE,
        ]
    ):
        raise ValueError(
            "Le candidat doit être retenu "
            "avant la création des tâches."
        )

    taches = []

    for definition in (
        TACHES_PREPARATION_CADRE
    ):
        type_tache = (
            definition["type_tache"]
        )

        service = (
            definition["service"]
        )

        libelle = (
            TachePreparationEmbauche
            .TypeTache(type_tache)
            .label
        )

        tache, _ = (
            TachePreparationEmbauche
            .objects
            .get_or_create(
                candidat=candidat,
                type_tache=type_tache,
                defaults={
                    "service": service,
                    "libelle": libelle,
                    "cree_par": cree_par,
                },
            )
        )

        taches.append(tache)

    return taches


@transaction.atomic
def supprimer_taches_si_non_retenu(
    candidat,
):
    if (
        candidat.statut
        != Candidat.Statut.NON_RETENU
    ):
        return 0

    resultat = (
        candidat
        .taches_preparation_embauche
        .exclude(
            statut=(
                TachePreparationEmbauche
                .Statut.TERMINEE
            )
        )
        .delete()
    )

    return resultat[0]


def verifier_taches_terminees(
    candidat,
):
    nombre_attendu = len(
        TACHES_PREPARATION_CADRE
    )

    taches = (
        candidat
        .taches_preparation_embauche
        .all()
    )

    if (
        taches.count()
        < nombre_attendu
    ):
        return False

    return not (
        taches
        .exclude(
            statut=(
                TachePreparationEmbauche
                .Statut.TERMINEE
            )
        )
        .exists()
    )