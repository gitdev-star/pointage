from django.db import models
from employees.models import Employee


class CDDAlert(models.Model):
    """Tracks CDD expiry alerts sent to HR."""

    class AlertStatus(models.TextChoices):
        PENDING  = "PENDING",  "En attente"
        SENT     = "SENT",     "Envoyé"
        RENEWED  = "RENEWED",  "Renouvelé"
        EXPIRED  = "EXPIRED",  "Expiré"
        IGNORED  = "IGNORED",  "Ignoré"

    employee         = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="cdd_alerts")
    termination_date = models.DateField()
    days_remaining   = models.IntegerField()
    alert_threshold  = models.IntegerField(help_text="Alert sent at X days before expiry")
    status           = models.CharField(max_length=20, choices=AlertStatus.choices, default=AlertStatus.PENDING)
    email_sent_to    = models.EmailField(blank=True)
    sent_at          = models.DateTimeField(null=True, blank=True)
    note             = models.TextField(blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["termination_date"]
        unique_together = [("employee", "alert_threshold")]

    def __str__(self):
        return f"{self.employee} — {self.termination_date} ({self.days_remaining}j)"


class CDDNotificationAssignment(models.Model):
    """
    The HR Director assigns which HR users receive CDD alerts
    for specific factories/departments.
    """
    auth_user_id = models.IntegerField(help_text="HR user ID from HRProfile")
    username     = models.CharField(max_length=150)
    email        = models.EmailField()

    # Scope — null means all
    factory    = models.ForeignKey(
        "employees.Factory", on_delete=models.CASCADE,
        null=True, blank=True, related_name="cdd_notified_users"
    )
    department = models.ForeignKey(
        "employees.Department", on_delete=models.CASCADE,
        null=True, blank=True, related_name="cdd_notified_users"
    )
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["username"]
        unique_together = [("auth_user_id", "factory", "department")]

    def __str__(self):
        scope = "Tous" if not self.factory else (
            f"{self.factory.name}/{self.department.name}" if self.department
            else self.factory.name
        )
        return f"{self.username} → {scope}"


class InAppNotification(models.Model):
    class Level(models.TextChoices):
        INFO    = "info",    "Info"
        WARNING = "warning", "Attention"
        ERROR   = "error",   "Erreur"
        SUCCESS = "success", "Succes"

    class Category(models.TextChoices):
        CDD       = "cdd",       "Alerte CDD"
        LEAVE     = "leave",     "Conge"
        MATERNITY = "maternity", "Maternite"
        EMPLOYEE  = "employee",  "Employe"
        SYSTEM    = "system",    "Systeme"

    auth_user_id = models.IntegerField(null=True, blank=True)
    title        = models.CharField(max_length=200)
    message      = models.TextField()
    level        = models.CharField(max_length=10, choices=Level.choices, default=Level.INFO)
    category     = models.CharField(max_length=20, choices=Category.choices, default=Category.SYSTEM)
    is_read      = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.category}] {self.title}"
