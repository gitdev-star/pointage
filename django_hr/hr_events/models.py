# =====================================================
# PATH: pointage/django_hr/hr_events/models.py
# =====================================================

from django.db import models
from employees.models import Employee


class HREventType(models.Model):
    """Configurable list of HR event types."""

    class Category(models.TextChoices):
        ABSENCE     = "ABSENCE",    "Absence"
        LEAVE       = "LEAVE",      "Congé"
        PERMISSION  = "PERMISSION", "Permission"
        MEDICAL     = "MEDICAL",    "Médical"
        DEPARTURE   = "DEPARTURE",  "Départ"
        OTHER       = "OTHER",      "Autre"

    name        = models.CharField(max_length=100, unique=True)
    code        = models.CharField(max_length=30, unique=True)
    category    = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    is_paid     = models.BooleanField(default=True)
    affects_status = models.BooleanField(
        default=False,
        help_text="If True, changes employee status when event is active"
    )
    target_status = models.CharField(
        max_length=20, blank=True,
        help_text="Employee status to set when event is active (e.g. TERMINATED)"
    )
    color       = models.CharField(max_length=7, default="#6B7280")
    is_active   = models.BooleanField(default=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class HREvent(models.Model):
    """An HR event affecting a specific employee."""

    class Status(models.TextChoices):
        ACTIVE    = "ACTIVE",    "Actif"
        CLOSED    = "CLOSED",    "Clôturé"
        CANCELLED = "CANCELLED", "Annulé"

    employee    = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="hr_events")
    event_type  = models.ForeignKey(HREventType, on_delete=models.PROTECT, related_name="events")
    start_date  = models.DateField()
    end_date    = models.DateField(null=True, blank=True)
    duration_hours = models.DecimalField(
        max_digits=6, decimal_places=1, null=True, blank=True,
        help_text="For hour-based permissions"
    )
    reason      = models.TextField(blank=True)
    document    = models.FileField(upload_to="hr_events/documents/", null=True, blank=True)
    status      = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    note        = models.TextField(blank=True)
    created_by  = models.IntegerField(help_text="Auth user ID")
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]
        indexes  = [
            models.Index(fields=["employee", "status"]),
            models.Index(fields=["start_date", "end_date"]),
            models.Index(fields=["event_type"]),
        ]

    def __str__(self):
        return f"{self.employee} | {self.event_type.code} | {self.start_date}"
