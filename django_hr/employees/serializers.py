from rest_framework import serializers
from .models import CantineList, CantineListItem, Classification, Poste, Factory, Department, Employee, Section, TransportList, TransportListItem, WorkSchedule


class ClassificationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Classification
        fields = ["id_classification", "classe", "salaire"]


class PosteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Poste
        fields = ["id", "name", "description", "is_active", "created_at"]


class FactorySerializer(serializers.ModelSerializer):
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model  = Factory
        fields = "__all__"

    def get_employee_count(self, obj):
        return obj.employees.filter(status="ACTIVE").count()


class DepartmentSerializer(serializers.ModelSerializer):
    factory_name   = serializers.CharField(source="factory.name", read_only=True)
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model  = Department
        fields = "__all__"

    def get_employee_count(self, obj):
        return obj.employees.filter(status="ACTIVE").count()


class SectionSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name",         read_only=True)
    factory_name    = serializers.CharField(source="department.factory.name", read_only=True)

    class Meta:
        model  = Section
        fields = "__all__"


class EmployeeListSerializer(serializers.ModelSerializer):
    full_name       = serializers.CharField(read_only=True)
    factory_name    = serializers.CharField(source="factory.name",    read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    job_title_name  = serializers.CharField(source="job_title.name",  read_only=True, default=None)
    classification_name  = serializers.CharField(source="classification.classe", read_only=True, default=None)
    section_name    = serializers.CharField(source="section.name",    read_only=True, default=None)
    last_action = serializers.CharField(read_only=True, allow_null=True)
    last_action_at = serializers.DateTimeField(read_only=True, allow_null=True)
    last_action_by = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model  = Employee
        fields = [
            "id", "employee_id", "first_name", "last_name", "full_name",
            "photo", "job_title", "job_title_name",
            "factory", "factory_name",
            "department", "department_name",
            "classification", "classification_name",
            "section", "section_name",
            "status", "device_user_id", "sexe", "contract_type", "hire_date",
            "last_action", "last_action_at", "last_action_by",
        ]

    def get_last_action_by(self, obj):
        first = getattr(obj, "last_action_by_first", None)
        last = getattr(obj, "last_action_by_last", None)
        if not first and not last:
            return None
        return f"{first or ''} {last or ''}".strip()


class EmployeeDetailSerializer(serializers.ModelSerializer):
    full_name           = serializers.CharField(read_only=True)
    factory_name        = serializers.CharField(source="factory.name",         read_only=True)
    department_name     = serializers.CharField(source="department.name",      read_only=True)
    job_title_name      = serializers.CharField(source="job_title.name",       read_only=True, default=None)
    classification_name = serializers.CharField(source="classification.classe", read_only=True, default=None)
    classification = serializers.PrimaryKeyRelatedField(
        queryset=Classification.objects.all(),
        pk_field=serializers.IntegerField(),
        allow_null=True, required=False
    )
    employee_id = serializers.CharField(read_only=True)

    class Meta:
        model  = Employee
        fields = [
            "id", "employee_id", "first_name", "last_name", "full_name",
            "photo", "email", "phone",
            "factory", "factory_name",
            "department", "department_name",
            "section",
            "job_title", "job_title_name",
            "contract_type", "hire_date", "termination_date",
            "status", "device_user_id", "auth_user_id",
            "cin", "cin_date", "cin_place", "cnaps",
            "sexe", "address", "birth_date", "birth_place", "nbre_enfants",
            "matricule_paie", "affectation", "hk_ou_pbi", "n_rh",
            "motif_depart", "salaire",
            "classification", "classification_name",
            "created_at", "updated_at",
        ]

    def validate(self, data):
        factory    = data.get("factory")    or (self.instance and self.instance.factory)
        department = data.get("department") or (self.instance and self.instance.department)
        if factory and department and department.factory != factory:
            raise serializers.ValidationError(
                {"department": "This department does not belong to the selected factory."}
            )
        # CIN unique check
        cin = data.get("cin")
        if cin:
            qs = Employee.objects.filter(cin=cin)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                existing = qs.first()
                raise serializers.ValidationError(
                    {"cin": f"Ce CIN est déjà utilisé par l'employé {existing.employee_id} - {existing.last_name} {existing.first_name}."}
                )
        return data


class WorkScheduleSerializer(serializers.ModelSerializer):
    employee_name   = serializers.SerializerMethodField()
    employee_matricule  = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    section_name    = serializers.SerializerMethodField()
    target_label    = serializers.SerializerMethodField()

    class Meta:
        model  = WorkSchedule
        fields = [
            "id", "name", "description",
            "employee", "employee_name",
            "department", "department_name", "employee_matricule",
            "section", "section_name",
            "target_label",
            "standard_start", "standard_end", "early_leave_limit",
            "standard_work_hours", "overtime_threshold_hours",
            "valid_from", "valid_until",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_employee_name(self, obj):
        return f"{obj.employee.last_name} {obj.employee.first_name}" if obj.employee else None

    def get_employee_matricule(self, obj):
        return obj.employee.employee_id if obj.employee else None

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None

    def get_section_name(self, obj):
        return obj.section.name if obj.section else None

    def get_target_label(self, obj):
        if obj.employee_id:
            return f"Employé : {obj.employee.last_name} {obj.employee.first_name}"
        if obj.section_id:
            return f"Section : {obj.section.name}"
        if obj.department_id:
            return f"Département : {obj.department.name}"
        return "Global"

    def validate(self, data):
        employee   = data.get("employee")   or (self.instance and self.instance.employee)
        department = data.get("department") or (self.instance and self.instance.department)
        section    = data.get("section")    or (self.instance and self.instance.section)
        if not employee and not department and not section:
            raise serializers.ValidationError(
                "Vous devez assigner cet horaire à au moins un employé, une section ou un département."
            )
        return data


class WorkScheduleAssignSerializer(serializers.Serializer):
    """Assignation en masse : crée un WorkSchedule individuel par employé sélectionné."""
    employee_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    name                      = serializers.CharField(max_length=100)
    description               = serializers.CharField(required=False, allow_blank=True)
    standard_start            = serializers.TimeField()
    standard_end              = serializers.TimeField()
    early_leave_limit         = serializers.TimeField()
    standard_work_hours       = serializers.FloatField(default=8.0)
    overtime_threshold_hours  = serializers.FloatField(default=8.5)
    valid_from                = serializers.DateField(required=False, allow_null=True)
    valid_until               = serializers.DateField(required=False, allow_null=True)

    def create(self, validated_data):
        employee_ids = validated_data.pop("employee_ids")
        employees = Employee.objects.filter(id__in=employee_ids)
        schedules = [
            WorkSchedule(
                employee=emp,
                name=f'{validated_data["name"]} - {emp.employee_id}',
                description=validated_data.get("description", ""),
                standard_start=validated_data["standard_start"],
                standard_end=validated_data["standard_end"],
                early_leave_limit=validated_data["early_leave_limit"],
                standard_work_hours=validated_data["standard_work_hours"],
                overtime_threshold_hours=validated_data["overtime_threshold_hours"],
                valid_from=validated_data.get("valid_from"),
                valid_until=validated_data.get("valid_until"),
            )
            for emp in employees
        ]
        return WorkSchedule.objects.bulk_create(schedules)

class EmployeeTransportSerializer(serializers.ModelSerializer):
    full_name      = serializers.CharField(read_only=True)
    job_title_name = serializers.CharField(source="job_title.name", read_only=True, default=None)

    class Meta:
        model  = Employee
        fields = ["id", "employee_id", "first_name", "last_name", "full_name", "job_title_name", "address"]


class TransportListItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = TransportListItem
        fields = ["id", "matricule", "nom", "prenom", "fonction", "adresse"]


class TransportListSerializer(serializers.ModelSerializer):
    items = TransportListItemSerializer(many=True, read_only=True)

    class Meta:
        model  = TransportList
        fields = ["id", "transport_date", "heure_fin", "created_by", "created_at", "items"]


class TransportListCreateSerializer(serializers.Serializer):
    transport_date = serializers.DateField()
    heure_fin      = serializers.CharField(max_length=20)
    employee_ids   = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)

    def create(self, validated_data):
        employees = Employee.objects.filter(
            id__in=validated_data["employee_ids"]
        ).select_related("job_title")

        transport_list = TransportList.objects.create(
            transport_date=validated_data["transport_date"],
            heure_fin=validated_data["heure_fin"],
            created_by=self.context.get("created_by"),
        )

        items = [
            TransportListItem(
                transport_list=transport_list,
                employee=emp,
                matricule=emp.employee_id,
                nom=emp.last_name or "",
                prenom=emp.first_name or "",
                fonction=emp.job_title.name if emp.job_title else "",
                adresse=emp.address or "",
            )
            for emp in employees
        ]
        TransportListItem.objects.bulk_create(items)
        return transport_list
    
class CantineListItemSerializer(serializers.ModelSerializer):
    factory_name = serializers.CharField(source="employee.factory.name", read_only=True, default=None)
    
    class Meta:
        model  = CantineListItem
        fields = ["id", "employee", "matricule", "nom", "prenom", "arrival", "factory_name", "added_at"]


class CantineListSerializer(serializers.ModelSerializer):
    items = CantineListItemSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()

    class Meta:
        model  = CantineList
        fields = ["id", "cantine_date", "created_by", "created_at", "items", "total"]

    def get_total(self, obj):
        return obj.items.count()