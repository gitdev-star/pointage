#==================================
#django_hr/employees/models.py
#==================================

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
    code_departement  = models.CharField(max_length=20, unique=True, blank=True, null=True)
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
    """
    Defines a custom work schedule that can be assigned to:
      - A specific employee  (highest priority)
      - A section            (medium priority)
      - A department         (lower priority)

    If none match, the global constants in analysis_service.py are used.

    Use-cases:
      - Maternity / breastfeeding employees allowed to leave early
      - Night-shift or afternoon employees starting at 13:00
      - Part-time employees with a 4-hour day
    """

    class Meta:
        ordering = ["name"]
        verbose_name = "Work Schedule"
        verbose_name_plural = "Work Schedules"

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Human label, e.g. 'Maternity', 'Afternoon Shift', 'Part-Time'",
    )
    description = models.TextField(blank=True)

    # ── Who does this schedule apply to? (all optional — at least one recommended) ──
    employee = models.ForeignKey(
        "Employee",
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="work_schedules",
        help_text="Assign directly to a single employee.",
    )
    department = models.ForeignKey(
        "Department",
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="work_schedules",
        help_text="Applies to all employees in this department (unless overridden by section/employee).",
    )
    section = models.ForeignKey(
        "Section",
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="work_schedules",
        help_text="Applies to all employees in this section (unless overridden by employee).",
    )

    # ── Schedule times ────────────────────────────────────────────────────────
    standard_start = models.TimeField(
        help_text="Official start of the workday for hours calculation. e.g. 07:30",
    )
    standard_end = models.TimeField(
        help_text="Official end of the workday. e.g. 16:30",
    )
    early_leave_limit = models.TimeField(
        help_text="Employee is considered to have left EARLY if departure is before this. e.g. 16:27",
    )

    standard_work_hours = models.FloatField(
        default=8.0,
        help_text="Effective work hours per day after lunch deduction.",
    )
    overtime_threshold_hours = models.FloatField(
        default=8.5,
        help_text="Hours worked beyond this count as overtime.",
    )

    # ── Validity window (optional) ───────────────────────────────────────────
    valid_from = models.DateField(
        null=True, blank=True,
        help_text="Schedule is active from this date. Leave blank for no start limit.",
    )
    valid_until = models.DateField(
        null=True, blank=True,
        help_text="Schedule expires after this date. Leave blank for no end limit.",
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        target = (
            f"employee:{self.employee_id}"
            if self.employee_id
            else f"section:{self.section_id}"
            if self.section_id
            else f"dept:{self.department_id}"
            if self.department_id
            else "global-override"
        )
        return f"{self.name} [{target}]"
    
class TransportList(models.Model):
    transport_date = models.DateField()
    heure_fin      = models.CharField(max_length=20)
    created_by     = models.CharField(max_length=150, blank=True, null=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-transport_date", "-created_at"]

    def __str__(self):
        return f"Transport {self.transport_date} - {self.heure_fin}"


class TransportListItem(models.Model):
    transport_list = models.ForeignKey(TransportList, on_delete=models.CASCADE, related_name="items")
    employee       = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True)
    # Snapshot des infos au moment de la génération (si l'employé change d'adresse plus tard,
    # l'historique reste fidèle à ce qui a été généré ce jour-là)
    matricule = models.CharField(max_length=100)
    nom       = models.CharField(max_length=255, blank=True)
    prenom    = models.CharField(max_length=255, blank=True)
    fonction  = models.CharField(max_length=255, blank=True, null=True)
    adresse   = models.TextField(blank=True, null=True)

class CantineList(models.Model):
    cantine_date = models.DateField(unique=True)
    created_by   = models.CharField(max_length=150, blank=True, null=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-cantine_date"]

    def __str__(self):
        return f"Cantine {self.cantine_date}"


class CantineListItem(models.Model):
    cantine_list = models.ForeignKey(CantineList, on_delete=models.CASCADE, related_name="items")
    employee     = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True)
    matricule    = models.CharField(max_length=100, blank=True)
    nom          = models.CharField(max_length=255, blank=True)
    prenom       = models.CharField(max_length=255, blank=True)
    arrival      = models.DateTimeField(null=True, blank=True)
    added_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("cantine_list", "employee")]
        ordering = ["nom", "prenom"]

    def __str__(self):
        return f"{self.nom} {self.prenom} ({self.matricule})"