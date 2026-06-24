# =====================================================
# PATH: pointage/django_hr/employees/serializers.py
# =====================================================

from rest_framework import serializers
from .models import Classification, Poste, Factory, Department, Employee, Section, WorkSchedule




class ClassificationSerializer(serializers.ModelSerializer):
    id   = serializers.IntegerField(source="id_classification", read_only=True)
    name = serializers.CharField(source="classe", read_only=True)

    class Meta:
        model  = Classification
        fields = ["id", "name", "salaire"]

class PosteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Poste
        fields = ["id", "name", "description", "is_active", "created_at"]

class FactorySerializer(serializers.ModelSerializer):
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model = Factory
        fields = "__all__"

    def get_employee_count(self, obj):
        return obj.employees.filter(status="ACTIVE").count()


class DepartmentSerializer(serializers.ModelSerializer):
    factory_name = serializers.CharField(source="factory.name", read_only=True)
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = "__all__"

    def get_employee_count(self, obj):
        return obj.employees.filter(status="ACTIVE").count()


class EmployeeListSerializer(serializers.ModelSerializer):
    """Lightweight — used for list views."""
    full_name       = serializers.CharField(read_only=True)
    factory_name    = serializers.CharField(source="factory.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    section_name    = serializers.CharField(source="section.name", read_only=True)
    job_title_name  = serializers.CharField(source="job_title.name", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id", "employee_id", "first_name", "last_name", "full_name",
            "photo", "job_title", "job_title_name",
            "factory", "factory_name",
            "department", "department_name",
            "section", "section_name",
            "sexe", "contract_type", "hire_date",
            "status", "device_user_id",
            "cin", "cnaps", "matricule_paie", "n_rh",
        ]


class EmployeeDetailSerializer(serializers.ModelSerializer):
    """Full — used for create / update / detail."""
    full_name       = serializers.CharField(read_only=True)
    factory_name    = serializers.CharField(source="factory.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    section_name    = serializers.CharField(source="section.name", read_only=True)
    job_title_name  = serializers.CharField(source="job_title.name", read_only=True)

    class Meta:
        model = Employee
        fields = "__all__"

    def validate(self, data):
        factory = data.get("factory") or (self.instance and self.instance.factory)
        department = data.get("department") or (self.instance and self.instance.department)
        if factory and department and department.factory != factory:
            raise serializers.ValidationError(
                {"department": "This department does not belong to the selected factory."}
            )
        return data


class SectionSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    factory_name    = serializers.CharField(source="department.factory.name", read_only=True)

    class Meta:
        model  = Section
        fields = "__all__"


class WorkScheduleSerializer(serializers.ModelSerializer):
    employee_name   = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    section_name    = serializers.SerializerMethodField()

    class Meta:
        model  = WorkSchedule
        fields = [
            "id", "name", "description",
            "employee", "employee_name",
            "department", "department_name",
            "section", "section_name",
            "work_start", "early_leave_limit",
            "standard_start", "standard_end",
            "lunch_start", "lunch_end",
            "standard_work_hours", "overtime_threshold_hours",
            "valid_from", "valid_until",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at",
                            "employee_name", "department_name", "section_name"]

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.last_name} {obj.employee.first_name}"
        return None

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None

    def get_section_name(self, obj):
        return obj.section.name if obj.section else None
