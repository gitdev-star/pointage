# =====================================================
# PATH: pointage/django_hr/leaves/models.py
# =====================================================

from django.db import models
from employees.models import Employee



HOURS_PER_DAY = 8.0

PROTECTED_LEAVE_CODES = {
    "CD", "PAT", "PEF", "PRM", "REM", "ACT", "HP", "DPP", "DEM", "LIC", "INP",
}
AUTO_APPROVE_LEAVE_CODES = {
    "FCD", "ENC", "ADP", "MP", "AJT", "FON",
}


class LeaveType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    days_per_year = models.DecimalField(
        max_digits=5, decimal_places=1,
        help_text="Entitlement days per year. 0 = unlimited / managed manually."
    )
    is_paid = models.BooleanField(default=True)
    requires_document = models.BooleanField(default=False)
    color = models.CharField(max_length=7, default="#3B82F6", help_text="Hex color for calendar")
    is_active = models.BooleanField(default=True)
    is_protected = models.BooleanField(
        default=False,
        help_text="If True, this type cannot be deleted through the app (API or admin)."
    )
    
    def __str__(self):
        return f"{self.code} — {self.name}"


class LeaveBalance(models.Model):
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="leave_balances"
    )
    leave_type = models.ForeignKey(
        LeaveType, on_delete=models.PROTECT, related_name="balances"
    )
    year = models.PositiveIntegerField()
    entitled_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    used_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    pending_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    class Meta:
        unique_together = [("employee", "leave_type", "year")]
        ordering = ["-year", "employee"]

    @property
    def remaining_days(self):
        return self.entitled_days - self.used_days - self.pending_days

    @classmethod
    def get_or_create_for(cls, employee, leave_type, year):
        balance, _ = cls.objects.get_or_create(
            employee=employee,
            leave_type=leave_type,
            year=year,
            defaults={"entitled_days": leave_type.days_per_year or 0},
        )
        return balance


    def __str__(self):
        return f"{self.employee} / {self.leave_type.code} / {self.year}"


class LeaveRequest(models.Model):

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="leave_requests"
    )
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT)
    start_date = models.DateField()
    end_date = models.DateField()
    days_requested = models.DecimalField(max_digits=5, decimal_places=1)
    reason = models.TextField(blank=True)
    document = models.FileField(upload_to="leaves/documents/", null=True, blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    approved_by = models.IntegerField(
        null=True, blank=True, help_text="Auth user ID of approver"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    duration_hours = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True,
        help_text="Durée en heures, utilisé uniquement pour les permissions en heure (type PERH)."
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["employee", "status"]),
            models.Index(fields=["start_date", "end_date"]),
        ]

    def __str__(self):
        return (
            f"{self.employee} | {self.leave_type.code} | "
            f"{self.start_date} → {self.end_date} [{self.status}]"
        )


class MaternityLeave(models.Model):

    class Status(models.TextChoices):
        DECLARED   = "DECLARED",   "Déclarée"
        ON_LEAVE   = "ON_LEAVE",   "En congé"
        EXTENDED   = "EXTENDED",   "Prolongée"
        RETURNED   = "RETURNED",   "Reprise travail"
        CANCELLED  = "CANCELLED",  "Annulée"

    employee             = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="maternity_leaves")
    expected_birth_date  = models.DateField(help_text="Date prévue d'accouchement")
    actual_birth_date    = models.DateField(null=True, blank=True, help_text="Date réelle d'accouchement")
    leave_start_date     = models.DateField()
    leave_end_date       = models.DateField(help_text="Date fin légale (98 jours)")
    extended_end_date    = models.DateField(null=True, blank=True, help_text="Date fin si prolongation")
    actual_return_date   = models.DateField(null=True, blank=True, help_text="Date réelle de reprise")
    status               = models.CharField(max_length=20, choices=Status.choices, default=Status.DECLARED)
    medical_document     = models.FileField(upload_to="leaves/maternity/", null=True, blank=True)
    note                 = models.TextField(blank=True)

    # Alert tracking
    alert_birth_sent     = models.BooleanField(default=False)
    alert_end_sent       = models.BooleanField(default=False)
    alert_return_sent    = models.BooleanField(default=False)

    created_by           = models.IntegerField(help_text="Auth user ID")
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-leave_start_date"]

    def __str__(self):
        return f"{self.employee} — Maternité {self.leave_start_date}"

    @property
    def legal_duration_days(self):
        return 98  # Madagascar legal duration

    @property
    def effective_end_date(self):
        return self.extended_end_date or self.leave_end_date

    @property
    def days_remaining(self):
        from django.utils import timezone
        today = timezone.now().date()
        end   = self.effective_end_date
        if end >= today:
            return (end - today).days
        return 0
