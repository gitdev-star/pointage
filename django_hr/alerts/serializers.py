from rest_framework import serializers
from .models import CDDAlert, CDDNotificationAssignment, InAppNotification
from .models import LateAlertAssignment



class CDDAlertSerializer(serializers.ModelSerializer):
    employee_name   = serializers.CharField(source="employee.full_name",       read_only=True)
    employee_id     = serializers.CharField(source="employee.employee_id",     read_only=True)
    factory_name    = serializers.CharField(source="employee.factory.name",    read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True)
    job_title       = serializers.CharField(source="employee.job_title",       read_only=True)
    employee_email  = serializers.CharField(source="employee.email",           read_only=True)

    class Meta:
        model  = CDDAlert
        fields = "__all__"


class CDDNotificationAssignmentSerializer(serializers.ModelSerializer):
    factory_name    = serializers.CharField(source="factory.name",    read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model  = CDDNotificationAssignment
        fields = "__all__"


class InAppNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = InAppNotification
        fields = ["id", "title", "message", "level", "category", "is_read", "created_at"]



class LateAlertAssignmentSerializer(serializers.ModelSerializer):
    factory_name = serializers.CharField(source="factory.name", read_only=True)
    class Meta:
        model  = LateAlertAssignment
        fields = "__all__"