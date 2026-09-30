from django.db import migrations


LIBELLE = "Fiche de renseignements"


def ajouter_fiche_renseignements(apps, schema_editor):
    RetourRHCandidat = apps.get_model(
        "recruitment",
        "RetourRHCandidat",
    )
    DocumentCandidat = apps.get_model(
        "recruitment",
        "DocumentCandidat",
    )

    documents_existants = set(
        DocumentCandidat.objects.filter(
            libelle=LIBELLE,
        ).values_list("retour_rh_id", flat=True)
    )

    DocumentCandidat.objects.bulk_create(
        [
            DocumentCandidat(
                retour_rh_id=retour_id,
                libelle=LIBELLE,
            )
            for retour_id in RetourRHCandidat.objects.values_list(
                "id",
                flat=True,
            )
            if retour_id not in documents_existants
        ]
    )


def retirer_fiche_renseignements(apps, schema_editor):
    DocumentCandidat = apps.get_model(
        "recruitment",
        "DocumentCandidat",
    )
    DocumentCandidat.objects.filter(libelle=LIBELLE).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("recruitment", "0017_alter_candidat_statut"),
    ]

    operations = [
        migrations.RunPython(
            ajouter_fiche_renseignements,
            retirer_fiche_renseignements,
        ),
    ]
