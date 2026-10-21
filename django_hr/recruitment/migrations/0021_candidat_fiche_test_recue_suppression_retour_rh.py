from django.db import migrations, models


def migrer_donnees(apps, schema_editor):
    Candidat = apps.get_model("recruitment", "Candidat")
    Processus = apps.get_model("recruitment", "ProcessusRecrutement")

    # Une fiche de test déjà téléversée vaut "fiche reçue".
    (
        Candidat.objects
        .exclude(fiche_test__isnull=True)
        .exclude(fiche_test="")
        .update(fiche_test_recue=True)
    )

    # Parcours ouvrier : l'étape 5 "Retour RH" est supprimée,
    # l'ancienne étape 6 "Embauche" devient l'étape 5.
    processus_ouvriers = Processus.objects.filter(
        demande__type_recrutement="OUVRIER"
    )

    for processus in processus_ouvriers:
        anciennes_etapes = processus.etapes_terminees or []

        nouvelles_etapes = sorted(
            {
                numero if numero < 5 else numero - 1
                for numero in anciennes_etapes
                if numero != 5
            }
        )

        nouvelle_etape_actuelle = (
            5
            if processus.etape_actuelle >= 5
            else processus.etape_actuelle
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
        ("recruitment", "0020_statuts_processus_recrutement"),
    ]

    operations = [
        migrations.AddField(
            model_name="candidat",
            name="fiche_test_recue",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(
            migrer_donnees,
            migrations.RunPython.noop,
        ),
    ]
