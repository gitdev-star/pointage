# django_hr/accounts/management/commands/seed_e2e_data.py

import os
from django.core.management.base import BaseCommand, CommandError
from accounts.models import HRProfile


class Command(BaseCommand):
    help = "Crée ou met à jour le HRProfile nécessaire aux tests e2e Playwright. Idempotent."

    E2E_AUTH_USER_ID = 101
    E2E_USERNAME = "e2e_test_user"

    def handle(self, *args, **options):
        # Garde-fou : refuse de tourner si on n'est pas explicitement en environnement de test/dev
        env = os.environ.get("DJANGO_ENV", "")
        if env not in ("test", "development", "ci"):
            raise CommandError(
                f"seed_e2e_data refusé : DJANGO_ENV='{env}' n'est pas un environnement de test/dev/ci. "
                "Cette commande ne doit jamais tourner en production."
            )

        profile, created = HRProfile.objects.update_or_create(
            auth_user_id=self.E2E_AUTH_USER_ID,
            defaults={
                "username": self.E2E_USERNAME,
                "is_active": True,
                "perm_employees_read": True,
                "perm_alerts_read": True,
                # ajoute ici d'autres perm_* si de nouveaux specs e2e en ont besoin
            },
        )

        action = "créé" if created else "déjà présent, mis à jour"
        self.stdout.write(self.style.SUCCESS(
            f"HRProfile e2e_test_user (auth_user_id={self.E2E_AUTH_USER_ID}) : {action}."
        ))