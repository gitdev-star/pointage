from django.db import models
from employees.models import Employee


class SanctionType(models.Model):
    name     = models.CharField(max_length=100, unique=True)
    code     = models.CharField(max_length=30, unique=True)
    level    = models.PositiveSmallIntegerField(default=1, help_text="1=mineur … 5=grave")
    color    = models.CharField(max_length=7, default="#F59E0B")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["level", "name"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class Sanction(models.Model):
    class Status(models.TextChoices):
        ACTIVE    = "ACTIVE",    "Active"
        CANCELLED = "CANCELLED", "Annulée"
        APPEALED  = "APPEALED",  "En appel"

    employee       = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="sanctions")
    sanction_type  = models.ForeignKey(SanctionType, on_delete=models.PROTECT, related_name="sanctions")
    date           = models.DateField()
    reason         = models.TextField()
    note           = models.TextField(blank=True)
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_by     = models.IntegerField(default=1)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.employee} | {self.sanction_type.code} | {self.date}"
