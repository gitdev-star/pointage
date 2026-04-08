# =====================================================
# PATH: pointage/django_hr/events/serializers.py
# =====================================================

from rest_framework import serializers
from .models import PublicHoliday, CompanyEvent, ShiftSchedule, EmployeeShift


class PublicHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicHoliday
        fields = "__all__"


class CompanyEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyEvent
        fields = "__all__"
        read_only_fields = ["created_by", "created_at"]

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user.id
        return super().create(validated_data)


class ShiftScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShiftSchedule
        fields = "__all__"


class EmployeeShiftSerializer(serializers.ModelSerializer):
    shift_name = serializers.CharField(source="shift.name", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = EmployeeShift
        fields = "__all__"
