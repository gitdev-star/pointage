# =====================================================
# PATH: pointage/django_hr/sanctions/serializers.py
# =====================================================
from rest_framework import serializers
from .models import SanctionType, Sanction


class SanctionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SanctionType
        fields = "__all__"


class SanctionSerializer(serializers.ModelSerializer):
    employee_name      = serializers.CharField(source="employee.full_name",    read_only=True)
    employee_id_str    = serializers.CharField(source="employee.employee_id",  read_only=True)
    sanction_type_name = serializers.CharField(source="sanction_type.name",    read_only=True)
    sanction_type_code = serializers.CharField(source="sanction_type.code",    read_only=True)
    sanction_color     = serializers.CharField(source="sanction_type.color",   read_only=True)
    sanction_level     = serializers.IntegerField(source="sanction_type.level", read_only=True)

    class Meta:
        model  = Sanction
        fields = "__all__"
        read_only_fields = ["created_by", "created_at"]

    def validate(self, data):
        sanction_type = data.get("sanction_type") or (
            self.instance.sanction_type if self.instance else None
        )
        if sanction_type is None:
            return data

        # Mises a pied: suspension dates required
        if sanction_type.code == "MISE_PIED":
            start = data.get("start_date") or (self.instance.start_date if self.instance else None)
            end   = data.get("end_date")   or (self.instance.end_date   if self.instance else None)
            if not start:
                raise serializers.ValidationError(
                    {"start_date": "Requis pour une mise a pied."}
                )
            if not end:
                raise serializers.ValidationError(
                    {"end_date": "Requis pour une mise a pied."}
                )
            if start and end and end <= start:
                raise serializers.ValidationError(
                    {"end_date": "La date de fin doit etre apres la date de debut."}
                )

        return data
