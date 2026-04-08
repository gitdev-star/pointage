# devices/models.py
from django.db import models
from django.utils import timezone

class ClockerGroup(models.Model):
    """Groups for organizing clockers (e.g., F1, F2, Factory, Warehouse)"""
    name = models.CharField(max_length=50, unique=True, help_text="Group name (e.g., 'F1', 'Factory', 'Warehouse')")
    description = models.TextField(blank=True, help_text="Optional description of this group")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = "devices_clocker_group"
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Clocker(models.Model):
    group = models.ForeignKey(
        ClockerGroup, 
        on_delete=models.PROTECT,
        null=True,  # ← Allow null temporarily for migration
        blank=True,
        help_text="Select the group for this clocker"
    )
    specific_name = models.CharField(
        max_length=90,
        blank=True,  # ← Allow blank temporarily
        default='',
        help_text="Specific name (e.g., 'transit', 'entrance', 'exit')"
    )
    name = models.CharField(max_length=100, editable=False, blank=True)
    ip_address = models.GenericIPAddressField(unique=True)
    port = models.IntegerField(default=4370)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)  # ← Use default instead of auto_now_add
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "devices_clocker"
        ordering = ['name']

    def save(self, *args, **kwargs):
        # Auto-generate full name only if group exists
        if self.group and self.specific_name:
            self.name = f"{self.group.name}_{self.specific_name}"
        elif not self.name:
            self.name = f"Device_{self.ip_address}"  # Fallback
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
