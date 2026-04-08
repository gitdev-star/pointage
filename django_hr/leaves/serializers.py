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


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)

    class Meta:
        model = LeaveRequest
        fields = "__all__"
        read_only_fields = ["status", "approved_by", "approved_at", "rejection_reason"]

    def validate(self, data):
        if data["start_date"] > data["end_date"]:
            raise serializers.ValidationError("start_date must be before end_date.")
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
