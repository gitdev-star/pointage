from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id", "user_id", "username", "role", "action", "app_label", "model_name",
            "object_id", "object_repr", "changes", "timestamp", "ip_address",
        ]