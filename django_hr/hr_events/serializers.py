# =====================================================
# PATH: pointage/django_hr/hr_events/serializers.py
# =====================================================
from rest_framework import serializers
from .models import HREventType, HREvent


class HREventTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = HREventType
        fields = "__all__"
 

class HREventSerializer(serializers.ModelSerializer):
    employee_name   = serializers.CharField(source="employee.full_name",    read_only=True)
    employee_id_str = serializers.CharField(source="employee.employee_id",  read_only=True)
    event_type_name = serializers.CharField(source="event_type.name",       read_only=True)
    event_type_code = serializers.CharField(source="event_type.code",       read_only=True)
    event_category  = serializers.CharField(source="event_type.category",   read_only=True)
    event_color     = serializers.CharField(source="event_type.color",      read_only=True)

    class Meta:
        model  = HREvent
        fields = "__all__"
        read_only_fields = ["created_by", "created_at", "updated_at"] 

    def validate(self, data):
        # Resolve event_type for both create and update
        event_type = data.get("event_type") or (
            self.instance.event_type if self.instance else None
        )
        if event_type is None:
            return data

        code = event_type.code

        # Permission en heure: uses duration_hours, end_date must be blank
        if code == "PERM_HEURE":
            duration = data.get("duration_hours") or (
                self.instance.duration_hours if self.instance else None
            )
            if not duration:
                raise serializers.ValidationError(
                    {"duration_hours": "Requis pour une permission en heure."}
                )
            # force end_date to None — it's hour-based
            data["end_date"] = None

        # Permission en jour: end_date required
        elif code == "PERM_JOUR":
            end_date = data.get("end_date") or (
                self.instance.end_date if self.instance else None
            )
            if not end_date:
                raise serializers.ValidationError(
                    {"end_date": "Requis pour une permission en jour."}
                )

        # Departures: end_date required (termination date)
        elif event_type.category == "DEPARTURE":
            end_date = data.get("end_date") or (
                self.instance.end_date if self.instance else None
            )
            if not end_date:
                raise serializers.ValidationError(
                    {"end_date": "La date de fin est requise pour un départ."}
                )

        return data
