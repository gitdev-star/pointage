# django_auth/accounts/management/commands/seed_e2e_data.py
import os
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Crée ou met à jour l'utilisateur local nécessaire aux tests e2e Playwright. Idempotent."

    E2E_USER_ID = 101
    E2E_USERNAME = "e2e_test_user"

    def handle(self, *args, **options):
        env = os.environ.get("DJANGO_ENV", "")
        if env not in ("test", "development", "ci"):
            raise CommandError(
                f"seed_e2e_data refusé : DJANGO_ENV='{env}' n'est pas un environnement de test/dev/ci. "
                "Cette commande ne doit jamais tourner en production."
            )

        password = os.environ.get("E2E_PASSWORD")
        if not password:
            raise CommandError("E2E_PASSWORD environment variable is not set.")

        user, created = User.objects.update_or_create(
            id=self.E2E_USER_ID,
            defaults={
                "username": self.E2E_USERNAME,
                "role": "HR",
                "is_active": True,
            },
        )
        user.set_password(password)
        user.save()

        action = "créé" if created else "déjà présent, mis à jour"
        self.stdout.write(self.style.SUCCESS(
            f"Utilisateur e2e_test_user (id={self.E2E_USER_ID}) : {action}."
        ))
