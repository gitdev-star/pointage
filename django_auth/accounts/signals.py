import os
import requests
import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import User


logger = logging.getLogger(__name__)
#SERVICE_TOKEN = "service-internal-token-changeme"
SERVICE_TOKEN = os.environ.get("SERVICE_INTERNAL_KEY", "")
if not SERVICE_TOKEN:
    logger.warning("SERVICE_INTERNAL_KEY not set — HRProfile sync will fail")


def get_django_hr_url():
    return "http://django-hr:8002"


@receiver(post_save, sender=User)
def sync_hr_profile(sender, instance, created, **kwargs):
    if instance.role not in ["HR", "ADMIN"]:
        return

    DJANGO_HR_URL = get_django_hr_url()
    payload = {
        "auth_user_id": instance.id,
        "username":     instance.username,
        "email":        instance.email or "",
        "is_director":  instance.role == "ADMIN",  # ✅ fixed from hr_role
        "is_active":    instance.is_active,
    }
    headers = {
        "Content-Type":  "application/json",
        "X-Service-Key": SERVICE_TOKEN,
    }

    try:
        res = requests.get(
            f"{DJANGO_HR_URL}/api/accounts/profiles/",
            params={"auth_user_id": instance.id},
            headers=headers,
            timeout=3,
        )
        profiles = res.json().get("results", res.json() if isinstance(res.json(), list) else [])
        existing = next((p for p in profiles if p["auth_user_id"] == instance.id), None)

        if existing:
            requests.patch(
                f"{DJANGO_HR_URL}/api/accounts/profiles/{existing['id']}/",
                json=payload, headers=headers, timeout=3,
            )
            logger.info(f"HRProfile updated for {instance.username}")
        else:
            requests.post(
                f"{DJANGO_HR_URL}/api/accounts/profiles/",
                json=payload, headers=headers, timeout=3,
            )
            logger.info(f"HRProfile created for {instance.username}")

    except Exception as e:
        logger.warning(f"Could not sync HRProfile for {instance.username}: {e}")


@receiver(post_delete, sender=User)
def delete_hr_profile(sender, instance, **kwargs):
    if instance.role not in ["HR", "ADMIN"]:
        return

    DJANGO_HR_URL = get_django_hr_url()
    headers = {
        "Content-Type":  "application/json",
        "X-Service-Key": SERVICE_TOKEN,
    }

    try:
        res = requests.get(
            f"{DJANGO_HR_URL}/api/accounts/profiles/",
            params={"auth_user_id": instance.id},
            headers=headers,
            timeout=3,
        )
        profiles = res.json().get("results", res.json() if isinstance(res.json(), list) else [])
        existing = next((p for p in profiles if p["auth_user_id"] == instance.id), None)

        if existing:
            requests.delete(
                f"{DJANGO_HR_URL}/api/accounts/profiles/{existing['id']}/",
                headers=headers,
                timeout=3,
            )
            logger.info(f"HRProfile deleted for {instance.username}")
        else:
            logger.info(f"No HRProfile found to delete for {instance.username}")

    except Exception as e:
        logger.warning(f"Could not delete HRProfile for {instance.username}: {e}")
