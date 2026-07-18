# =====================================================
# PATH: pointage/django_hr/leaves/serializers.py
# =====================================================

from rest_framework import serializers
from .models import LeaveType, LeaveBalance, LeaveRequest, MaternityLeave


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = "__all__"


class LeaveBalanceSerializer(serializers.ModelSerializer):
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    remaining_days = serializers.DecimalField(max_digits=5, decimal_places=1, read_only=True)

    class Meta:
        model = LeaveBalance
        fields = "__all__"


# leaves/serializers.py
class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name   = serializers.CharField(source="employee.full_name", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.name",    read_only=True)
    leave_type_code = serializers.CharField(source="leave_type.code",    read_only=True)
    factory_name    = serializers.CharField(source="employee.factory.name", read_only=True, default=None)
    last_action     = serializers.CharField(read_only=True, allow_null=True)
    last_action_at  = serializers.DateTimeField(read_only=True, allow_null=True)
    last_action_by  = serializers.CharField(read_only=True, allow_null=True)
    
    class Meta:
        model = LeaveRequest
        fields = "__all__"
        read_only_fields = ["status", "approved_by", "approved_at", "rejection_reason"]

    def validate(self, data):
        start = data.get("start_date")
        end   = data.get("end_date")
        if start and end and end < start:
            raise serializers.ValidationError("La date de fin doit être après la date de début.")

        leave_type = data.get("leave_type") or (self.instance and self.instance.leave_type)
        if leave_type and leave_type.code == "PM" and not data.get("duration_hours"):  # <-- "PM"
            raise serializers.ValidationError(
                {"duration_hours": "La durée en heures est requise pour une permission en heure."}
            )
        return data


class LeaveApprovalSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)


class MaternityLeaveSerializer(serializers.ModelSerializer):
    employee_name   = serializers.CharField(source="employee.full_name",       read_only=True)
    employee_id_str = serializers.CharField(source="employee.employee_id",     read_only=True)
    factory_name    = serializers.CharField(source="employee.factory.name",    read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True)
    days_remaining  = serializers.IntegerField(read_only=True)
    effective_end_date = serializers.DateField(read_only=True)

    class Meta:
        model  = MaternityLeave
        fields = "__all__"
        read_only_fields = ["created_by", "created_at", "updated_at",
                            "alert_birth_sent", "alert_end_sent", "alert_return_sent"]

    def validate(self, data):
        start = data.get("leave_start_date")
        end   = data.get("leave_end_date")
        if start and end and end < start:
            raise serializers.ValidationError("La date de fin doit être après la date de début.")
        return data

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].hr_user_id or 0
        # Auto-calculate end date if not provided
        if "leave_start_date" in validated_data and "leave_end_date" not in validated_data:
            from datetime import timedelta
            validated_data["leave_end_date"] = validated_data["leave_start_date"] + timedelta(days=98)
        return super().create(validated_data)
