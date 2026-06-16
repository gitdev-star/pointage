from django.db import models


class Classification(models.Model):
    id_classification = models.AutoField(primary_key=True)
    classe = models.CharField(max_length=50, unique=True)
    salaire = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "classification"
        managed = False

    def __str__(self):
        return self.classe


class Poste(models.Model):
    name        = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "poste"
        managed  = False

    def __str__(self):
        return self.name


class Factory(models.Model):
    name       = models.CharField(max_length=100, unique=True)
    location   = models.CharField(max_length=200, blank=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Factories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Department(models.Model):
    name    = models.CharField(max_length=100)
    factory = models.ForeignKey(Factory, on_delete=models.PROTECT, related_name="departments")
    manager = models.ForeignKey(
        "Employee", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="managed_departments",
    )
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["factory", "name"]
        unique_together = [("name", "factory")]

    def __str__(self):
        return f"{self.factory.name} / {self.name}"


class Section(models.Model):
    name       = models.CharField(max_length=100)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="sections")
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["department", "name"]
        unique_together = [("name", "department")]

    def __str__(self):
        return f"{self.department.name} / {self.name}"


class Employee(models.Model):

    class ContractType(models.TextChoices):
        PERMANENT  = "CDI",      "Permanent (CDI)"
        FIXED_TERM = "CDD",      "Fixed Term (CDD)"
        INTERN     = "INTERN",   "Internship"
        PART_TIME  = "PART",     "Part Time"
        SEASONAL   = "SEASONAL", "Seasonal"

    class Status(models.TextChoices):
        ACTIVE     = "ACTIVE",     "Active"
        INACTIVE   = "INACTIVE",   "Inactive"
        ON_LEAVE   = "ON_LEAVE",   "On Leave"
        TERMINATED = "TERMINATED", "Terminated"

    employee_id      = models.CharField(max_length=100, unique=True)
    first_name       = models.CharField(max_length=255, blank=True, null=True)
    last_name        = models.CharField(max_length=255, blank=True, null=True)
    photo            = models.ImageField(upload_to="employees/photos/", null=True, blank=True)
    email            = models.EmailField(unique=True, blank=True, null=True)
    phone            = models.CharField(max_length=100, blank=True)
    factory          = models.ForeignKey(Factory,    on_delete=models.PROTECT, related_name="employees", null=True, blank=True)
    department       = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="employees", null=True, blank=True)
    job_title        = models.ForeignKey("Poste",    on_delete=models.PROTECT, related_name="employees", null=True, blank=True)
    contract_type    = models.CharField(max_length=20, choices=ContractType.choices, default=ContractType.PERMANENT, blank=True, null=True)
    hire_date        = models.DateField(null=True, blank=True)
    termination_date = models.DateField(null=True, blank=True)
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, blank=True, null=True)
    device_user_id   = models.IntegerField(unique=True, null=True, blank=True)
    auth_user_id     = models.IntegerField(null=True, blank=True)
    section          = models.ForeignKey("Section", on_delete=models.SET_NULL, null=True, blank=True, related_name="employees")
    cin              = models.CharField(max_length=100, blank=True, null=True, unique=True)
    cin_date         = models.DateField(null=True, blank=True)
    cin_place        = models.CharField(max_length=255, blank=True, null=True)
    cnaps            = models.CharField(max_length=100, blank=True, null=True)
    sexe             = models.CharField(max_length=10, blank=True, null=True)
    address          = models.TextField(blank=True, null=True)
    birth_date       = models.DateField(null=True, blank=True)
    birth_place      = models.CharField(max_length=255, blank=True, null=True)
    nbre_enfants     = models.IntegerField(null=True, blank=True)
    matricule_paie   = models.CharField(max_length=100, blank=True, null=True)
    affectation      = models.CharField(max_length=255, blank=True, null=True)
    hk_ou_pbi        = models.CharField(max_length=100, blank=True, null=True)
    n_rh             = models.CharField(max_length=100, blank=True, null=True)
    motif_depart     = models.CharField(max_length=500, blank=True, null=True)
    salaire          = models.CharField(max_length=50, blank=True, null=True)
    classification   = models.ForeignKey(Classification, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees")
    created_at       = models.DateTimeField(auto_now_add=True, null=True)
    updated_at       = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        indexes = [
            models.Index(fields=["device_user_id"]),
            models.Index(fields=["employee_id"]),
            models.Index(fields=["factory", "department"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.employee_id} - {self.last_name} {self.first_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class WorkSchedule(models.Model):
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    employee    = models.ForeignKey("Employee",   on_delete=models.CASCADE, null=True, blank=True, related_name="work_schedules")
    department  = models.ForeignKey("Department", on_delete=models.CASCADE, null=True, blank=True, related_name="work_schedules")
    section     = models.ForeignKey("Section",    on_delete=models.CASCADE, null=True, blank=True, related_name="work_schedules")
    work_start               = models.TimeField()
    standard_start           = models.TimeField()
    standard_end             = models.TimeField()
    early_leave_limit        = models.TimeField()
    lunch_start              = models.TimeField(default="12:00")
    lunch_end                = models.TimeField(default="13:00")
    standard_work_hours      = models.FloatField(default=8.0)
    overtime_threshold_hours = models.FloatField(default=8.5)
    valid_from  = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
