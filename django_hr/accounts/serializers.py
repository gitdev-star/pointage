from rest_framework import serializers
from .models import HRProfile


class HRProfileSerializer(serializers.ModelSerializer):
    all_permissions = serializers.DictField(read_only=True)
    visible_modules = serializers.ListField(read_only=True)
    factory_name    = serializers.CharField(source="factory.name",    read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model  = HRProfile
        fields = "__all__"
