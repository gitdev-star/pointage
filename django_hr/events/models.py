# =====================================================
# PATH: pointage/django_hr/events/models.py
# =====================================================

from django.db import models
from employees.models import Factory, Department, Employee


class PublicHoliday(models.Model):
    name = models.CharField(max_length=150)
    date = models.DateField()
    year = models.PositiveIntegerField()
    is_recurring = models.BooleanField(default=False)

    class Meta:
        ordering = ["date"]
        unique_together = [("date", "name")]

    def __str__(self):
        return f"{self.date} — {self.name}"


class CompanyEvent(models.Model):

    class EventType(models.TextChoices):
        TRAINING = "TRAINING", "Training"
        MEETING = "MEETING", "Meeting"
        ANNOUNCEMENT = "ANNOUNCEMENT", "Announcement"
        PARTY = "PARTY", "Holiday / Party"
        OTHER = "OTHER", "Other"

    title = models.CharField(max_length=200)
    event_type = models.CharField(
        max_length=20, choices=EventType.choices, default=EventType.OTHER
    )
    description = models.TextField(blank=True)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    location = models.CharField(max_length=200, blank=True)

    # null = company-wide
    factory = models.ForeignKey(
        Factory, on_delete=models.SET_NULL, null=True, blank=True, related_name="events"
    )
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="events"
    )

    created_by = models.IntegerField(help_text="Auth user ID of creator")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["start_datetime"]

    def __str__(self):
        return f"{self.title} ({self.start_datetime.date()})"


class ShiftSchedule(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=60)
    color = models.CharField(max_length=7, default="#10B981")

    def __str__(self):
        return f"{self.code} — {self.name} ({self.start_time}→{self.end_time})"


class EmployeeShift(models.Model):
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="shifts"
    )
    shift = models.ForeignKey(ShiftSchedule, on_delete=models.PROTECT)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.employee} — {self.shift.code} from {self.start_date}"
