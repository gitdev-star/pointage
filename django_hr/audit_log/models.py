from django.db import models


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ("CREATE", "Création"),
        ("UPDATE", "Modification"),
        ("DELETE", "Suppression"),
        ("APPROVE", "Approbation"),
        ("REJECT", "Rejet"),
        ("VALIDATE", "Validation"),
        ("APPROVE_DRH", "Approbation DRH"),
        ("REJECT_DRH", "Rejet DRH"),
        ("STEP_DONE", "Étape terminée"),
        ("CR_CREATE", "Compte rendu créé"),
        ("CR_UPDATE", "Compte rendu modifié"),
        ("CR_DELETE", "Compte rendu supprimé"),
        ("CR_PDF", "Compte rendu téléchargé"),
        ("CR_SEND", "Compte rendu envoyé"),
        ("INT_PLAN", "Entretien planifié"),
        ("INT_DONE", "Entretien réalisé"),
        ("TEST_DEL", "Fiche de test supprimée"),
        ("MAIL_RETRY", "Notification renvoyée"),
    ]

    user_id = models.IntegerField(null=True, blank=True)
    username = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=20, blank=True)
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    app_label = models.CharField(max_length=50)
    model_name = models.CharField(max_length=50)
    object_id = models.CharField(max_length=50)
    object_repr = models.CharField(max_length=255)
    changes = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["model_name", "object_id"]),
            models.Index(fields=["-timestamp"]),
        ]

    def __str__(self):
        return f"{self.get_action_display()} · {self.model_name} #{self.object_id}"