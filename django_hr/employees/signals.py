from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from .models import Factory, Department, Section

@receiver([post_save, post_delete], sender=Factory)
def clear_factory_cache(sender, **kwargs):
    cache.delete("factories_list")


@receiver([post_save, post_delete], sender=Department)
def clear_department_cache(sender, **kwargs):
    cache.delete("departments_list")


@receiver([post_save, post_delete], sender=Section)
def clear_section_cache(sender, **kwargs):
    cache.delete("departments_list")



from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Employee
from alerts.email_utils import notify_resiliation


@receiver(post_save, sender=Employee)
def employee_termination_signal(sender, instance, created, **kwargs):
    if created:
        return  # New employee → ignore

    # Only send if terminated AND motif exists
    if instance.status == "TERMINATED" and instance.motif_depart:
        print(f"[SIGNAL] Employee terminated: {instance}")
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
            print(f"[SIGNAL ERROR] {e}")
            traceback.print_exc()
