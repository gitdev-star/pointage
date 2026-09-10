# django_hr/employees/signals.py
import os
import requests
from django.conf import settings
from django.core.cache import cache
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver

from .models import Factory, Department, Section, Employee
from alerts.email_utils import notify_resiliation

ATTENDANCE_SERVICE_URL = getattr(settings, "ATTENDANCE_SERVICE_URL", "http://localhost:8000")


# --------------------------------------------------
# Cache invalidation (unchanged)
# --------------------------------------------------
@receiver([post_save, post_delete], sender=Factory)
def clear_factory_cache(sender, **kwargs):
    cache.delete("factories_list")


@receiver([post_save, post_delete], sender=Department)
def clear_department_cache(sender, **kwargs):
    cache.delete("departments_list")


@receiver([post_save, post_delete], sender=Section)
def clear_section_cache(sender, **kwargs):
    cache.delete("departments_list")


# --------------------------------------------------
# Employee termination handling
# --------------------------------------------------
@receiver(pre_save, sender=Employee)
def stash_old_status(sender, instance, **kwargs):
    if instance.pk:
        instance._old_status = (
            Employee.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
        )
    else:
        instance._old_status = None


@receiver(post_save, sender=Employee)
def employee_termination_signal(sender, instance, created, **kwargs):
    if created:
        return  # New employee → ignore

    old_status = getattr(instance, "_old_status", None)
    became_terminated = old_status != "TERMINATED" and instance.status == "TERMINATED"

    if not became_terminated:
        return  # not a fresh transition to TERMINATED → skip (avoids re-firing on every save)

    print(f"[SIGNAL] Employee terminated: {instance}")

    if instance.motif_depart:
        print(f"[SIGNAL] Motif: {instance.motif_depart}")
        try:
            notify_resiliation(
                instance,
                motif=instance.motif_depart,
                triggered_by="System (signal)",
                hr_manager_email="",
            )
            print(f"[SIGNAL] Email sent for {instance}")
        except Exception as e:
            import traceback
            import sentry_sdk
            sentry_sdk.capture_exception(e)
            print(f"[SIGNAL ERROR] {e}")
            traceback.print_exc()

    if instance.device_user_id:
        try:
            resp = requests.delete(
                f"{ATTENDANCE_SERVICE_URL}/devices/users/{instance.device_user_id}",
                headers={"X-Service-Key": os.getenv("SERVICE_INTERNAL_KEY")},
                timeout=60,  # safety net; real fix: parallelize device calls in FastAPI (device_admin.py)
            )
            print(f"[SIGNAL] Device deletion for user_id={instance.device_user_id}: {resp.status_code} {resp.json()}")
            instance._device_delete_result = {"ok": resp.status_code == 200, "detail": resp.json()}
        except Exception as e:
            import sentry_sdk
            sentry_sdk.capture_exception(e)
            print(f"[SIGNAL ERROR] Device deletion failed for user_id={instance.device_user_id}: {e!r}")
            instance._device_delete_result = {"ok": False, "detail": str(e)}
    else:
        instance._device_delete_result = {"ok": False, "detail": "no device_user_id on record"}