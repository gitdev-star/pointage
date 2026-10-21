from django.db import migrations


def fusionner_etapes(apps, schema_editor):
    """
    Les étapes 1 "Création de l'offre" et 2 "Publication de
    l'offre" deviennent une seule étape 1, pour les ouvriers
    comme pour les cadres. Les étapes suivantes reculent d'un
    numéro.
    """
    Processus = apps.get_model("recruitment", "ProcessusRecrutement")

    for processus in Processus.objects.all():
        anciennes_etapes = processus.etapes_terminees or []

        nouvelles_etapes = set()

        # L'étape fusionnée est terminée quand l'ancienne
        # étape 2 (publication) l'était.
        if 2 in anciennes_etapes:
            nouvelles_etapes.add(1)

        for numero in anciennes_etapes:
            if numero >= 3:
                nouvelles_etapes.add(numero - 1)

        nouvelles_etapes = sorted(nouvelles_etapes)

        nouvelle_etape_actuelle = (
            1
            if processus.etape_actuelle <= 2
            else processus.etape_actuelle - 1
        )

        if (
            nouvelles_etapes != anciennes_etapes
            or nouvelle_etape_actuelle != processus.etape_actuelle
        ):
            processus.etapes_terminees = nouvelles_etapes
            processus.etape_actuelle = nouvelle_etape_actuelle
            processus.save(
                update_fields=[
                    "etapes_terminees",
                    "etape_actuelle",
                ]
            )


class Migration(migrations.Migration):
    dependencies = [
        ("recruitment", "0021_candidat_fiche_test_recue_suppression_retour_rh"),
    ]

    operations = [
        migrations.RunPython(
            fusionner_etapes,
            migrations.RunPython.noop,
        ),
    ]
