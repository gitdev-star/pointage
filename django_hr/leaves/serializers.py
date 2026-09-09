# =====================================================
# PATH: pointage/django_hr/leaves/serializers.py
# =====================================================

from datetime import datetime
from decimal import Decimal

from rest_framework import serializers
from .models import LeaveType, LeaveBalance, LeaveRequest, MaternityLeave


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = "__all__"

    def validate_code(self, value):
        if self.instance and self.instance.is_protected and value != self.instance.code:
            raise serializers.ValidationError(
                f"Le code « {self.instance.code} » est protégé et ne peut pas être modifié — "
                "il est référencé directement dans le code applicatif."
            )
        return value


class LeaveBalanceSerializer(serializers.ModelSerializer):
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    leave_type_code = serializers.CharField(source="leave_type.code", read_only=True)
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
    duration_formatted = serializers.SerializerMethodField()
    last_action     = serializers.CharField(read_only=True, allow_null=True)
    last_action_at  = serializers.DateTimeField(read_only=True, allow_null=True)
    last_action_by  = serializers.CharField(read_only=True, allow_null=True)
    
    class Meta:
        model = LeaveRequest
        fields = "__all__"
        read_only_fields = ["duration_hours"]

    def get_duration_formatted(self, obj):
        if obj.start_time and obj.end_time:
            reference_date = datetime.today().date()

            start_datetime = datetime.combine(
                reference_date,
                obj.start_time
            )
            end_datetime = datetime.combine(
                reference_date,
                obj.end_time
            )

            total_minutes = int(
                (end_datetime - start_datetime).total_seconds() // 60
            )

            hours, minutes = divmod(total_minutes, 60)

            return f"{hours:02d} h {minutes:02d} min"

        return None

    def validate(self, data):
        start_date = data.get(
            "start_date",
            getattr(self.instance, "start_date", None)
        )
        end_date = data.get(
            "end_date",
            getattr(self.instance, "end_date", None)
        )
        leave_type = data.get(
            "leave_type",
            getattr(self.instance, "leave_type", None)
        )
        start_time = data.get(
            "start_time",
            getattr(self.instance, "start_time", None)
        )
        end_time = data.get(
            "end_time",
            getattr(self.instance, "end_time", None)
        )

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({
                "end_date": (
                    "La date de fin doit être après "
                    "la date de début."
                )
            })

        if leave_type and leave_type.code == "PM":
            errors = {}

            if not start_time:
                errors["start_time"] = (
                    "L’heure de début est requise."
                )

            if not end_time:
                errors["end_time"] = (
                    "L’heure de fin est requise."
                )

            if (
                start_time and
                end_time and
                end_time <= start_time
            ):
                errors["end_time"] = (
                    "L’heure de fin doit être après "
                    "l’heure de début."
                )

            if errors:
                raise serializers.ValidationError(errors)

            if start_date:
                data["end_date"] = start_date

            data["days_requested"] = Decimal("1.0")

        else:
            data["start_time"] = None
            data["end_time"] = None
            data["duration_hours"] = None

        return data

    def calculate_duration(self, validated_data):
        leave_type = validated_data.get(
            "leave_type",
            getattr(self.instance, "leave_type", None)
        )

        if not leave_type or leave_type.code != "PM":
            return None

        start_time = validated_data.get(
            "start_time",
            getattr(self.instance, "start_time", None)
        )
        end_time = validated_data.get(
            "end_time",
            getattr(self.instance, "end_time", None)
        )

        if not start_time or not end_time:
            return None

        reference_date = datetime.today().date()

        start_datetime = datetime.combine(
            reference_date,
            start_time
        )
        end_datetime = datetime.combine(
            reference_date,
            end_time
        )

        total_minutes = Decimal(
            str(
                (end_datetime - start_datetime)
                .total_seconds() / 60
            )
        )

        return (
            total_minutes / Decimal("60")
        ).quantize(Decimal("0.01"))

    def create(self, validated_data):
        validated_data["duration_hours"] = (
            self.calculate_duration(validated_data)
        )

        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data["duration_hours"] = (
            self.calculate_duration(validated_data)
        )

        return super().update(instance, validated_data)



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
        extra_kwargs = {
            "leave_end_date": {"required": False},
        }

    def validate(self, data):
        start = data.get("leave_start_date")
        end   = data.get("leave_end_date")
        if start and end and end < start:
            raise serializers.ValidationError("La date de fin doit être après la date de début.")
        return data

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user.id
        # Auto-calculate end date if not provided
        if "leave_start_date" in validated_data and "leave_end_date" not in validated_data:
            from datetime import timedelta
            validated_data["leave_end_date"] = validated_data["leave_start_date"] + timedelta(days=98)
        return super().create(validated_data)
