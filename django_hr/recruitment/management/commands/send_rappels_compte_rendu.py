# django_hr/recruitment/management/commands/send_rappels_compte_rendu.py
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from recruitment.emails import notifier_compte_rendu_a_faire
from recruitment.models import Candidat, DemandeRecrutement

DELAI_MAIL = timedelta(hours=1)
DELAI_RELANCE = timedelta(minutes=30)


class Command(BaseCommand):
    help = ("Entretiens cadres : 1 h après l'heure prévue, demande le compte rendu "
            "aux participants, puis les relance 30 min plus tard s'il n'est pas fait. "
            "Prévu toutes les 5 minutes.")

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Affiche les mails à envoyer sans les envoyer",
        )

    def handle(self, *args, **options):
        maintenant = timezone.now()

        # Entretien passé, compte rendu pas encore commencé
        en_attente = (
            Candidat.objects
            .filter(
                processus__demande__type_recrutement=DemandeRecrutement.TypeRecrutement.CADRE,
                statut__in=[Candidat.Statut.ENTRETIEN_PLANIFIE, Candidat.Statut.ENTRETIEN_REALISE],
                date_entretien_prevue__isnull=False,
                compte_rendu_cadre__isnull=True,
            )
            .exclude(emails_participants_entretien=[])
            .select_related("processus__demande__poste")
        )

        # Les relances d'abord : un mail envoyé pendant ce passage
        # ne peut pas être relancé dans la foulée.
        relances = en_attente.filter(
            date_mail_compte_rendu__lte=maintenant - DELAI_RELANCE,
            date_relance_compte_rendu__isnull=True,
        )
        mails = en_attente.filter(
            date_entretien_prevue__lte=maintenant - DELAI_MAIL,
            date_mail_compte_rendu__isnull=True,
        )

        for envoi, candidats, champ in (
            ("Relance", list(relances), "date_relance_compte_rendu"),
            ("Mail", list(mails), "date_mail_compte_rendu"),
        ):
            for candidat in candidats:
                emails = ", ".join(candidat.emails_participants_entretien)
                self.stdout.write(f"{envoi} : {candidat.nom_complet} (#{candidat.pk}) -> {emails}")

                if options["dry_run"]:
                    continue

                # Marqué envoyé seulement si l'envoi réussit : sinon,
                # nouvel essai au passage suivant.
                if notifier_compte_rendu_a_faire(candidat, relance=(envoi == "Relance")):
                    Candidat.objects.filter(pk=candidat.pk).update(**{champ: maintenant})
                else:
                    self.stderr.write(self.style.ERROR(f"Echec de l'envoi pour #{candidat.pk}."))

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("Dry-run : aucun email envoye."))