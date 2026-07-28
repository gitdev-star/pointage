# =====================================================
# PATH: pointage/django_hr/accounts/models.py
# =====================================================

from django.db import models


class HRProfile(models.Model):
    auth_user_id = models.IntegerField(unique=True, help_text="User ID from django_auth")
    username     = models.CharField(max_length=150)
    email        = models.EmailField(blank=True)
    job_title    = models.CharField(max_length=100, blank=True)
    is_director  = models.BooleanField(default=False)

    factory    = models.ForeignKey("employees.Factory",    on_delete=models.SET_NULL, null=True, blank=True, related_name="hr_managers")
    department = models.ForeignKey("employees.Department", on_delete=models.SET_NULL, null=True, blank=True, related_name="hr_managers")

    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    perm_employees_read    = models.BooleanField(default=False)
    perm_employees_write   = models.BooleanField(default=False)
    perm_employees_delete  = models.BooleanField(default=False)
    perm_payroll_read      = models.BooleanField(default=False)
    perm_payroll_write     = models.BooleanField(default=False)
    perm_payroll_validate  = models.BooleanField(default=False)
    perm_leaves_read       = models.BooleanField(default=False)
    perm_leaves_write      = models.BooleanField(default=False)
    perm_leaves_approve    = models.BooleanField(default=False)
    perm_reports_read      = models.BooleanField(default=False)
    perm_shifts_read       = models.BooleanField(default=False)
    perm_shifts_write      = models.BooleanField(default=False)
    perm_recruitment_read  = models.BooleanField(default=False)
    perm_recruitment_write = models.BooleanField(default=False)
    perm_contracts_read    = models.BooleanField(default=False)
    perm_contracts_write   = models.BooleanField(default=False)
    perm_contracts_delete  = models.BooleanField(default=False)
    perm_sanctions_read    = models.BooleanField(default=False)
    perm_sanctions_write   = models.BooleanField(default=False)
    perm_retraite_read     = models.BooleanField(default=False)
    perm_retraite_write    = models.BooleanField(default=False)
    perm_pay_events_read   = models.BooleanField(default=False)
    perm_pay_events_write  = models.BooleanField(default=False)
    perm_alerts_read       = models.BooleanField(default=False)
    perm_alerts_write      = models.BooleanField(default=False)
    perm_organisation_read  = models.BooleanField(default=False)
    perm_organisation_write = models.BooleanField(default=False)
    perm_hr_events_read    = models.BooleanField(default=False)
    perm_hr_events_write   = models.BooleanField(default=False)
    perm_hr_users_manage   = models.BooleanField(default=False)
    perm_transport_read    = models.BooleanField(default=False)
    perm_transport_write   = models.BooleanField(default=False)
    perm_cantine_read = models.BooleanField(default=False)
    perm_cantine_write = models.BooleanField(default=False)
    perm_horaire_read      = models.BooleanField(default=False)
    perm_horaire_write     = models.BooleanField(default=False)
    perm_audit_logs_read   = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True) 

    class Meta:
        ordering = ["username"]

    def __str__(self):
        role = "Directeur RH" if self.is_director else self.job_title or "HR"
        return f"{self.username} — {role}"

    def has_perm(self, perm_key):
        if self.is_director:
            return True
        return getattr(self, f"perm_{perm_key}", False)

    @property
    def all_permissions(self):
        if self.is_director:
            return {
                field.name.replace("perm_", ""): True
                for field in self._meta.get_fields()
                if hasattr(field, 'name') and field.name.startswith("perm_")
            }
        return {
            field.name.replace("perm_", ""): getattr(self, field.name)
            for field in self._meta.get_fields()
            if hasattr(field, 'name') and field.name.startswith("perm_")
        }

    @property
    def visible_modules(self):
        if self.is_director:
            return [
                "employees", "payroll", "leaves", "reports", "shifts",
                "recruitment", "contracts", "sanctions", "retraite",
                "pay_events", "alerts", "organisation", "hr_users",
                "transport", "horaire", "audit_logs",   # ✅ ajoutés
            ]
        modules = []
        if self.perm_employees_read:
            modules.append("employees")
        if self.perm_payroll_read:
            modules.append("payroll")
        if self.perm_leaves_read:
            modules.append("leaves")
        if self.perm_reports_read:
            modules.append("reports")
        if self.perm_shifts_read:
            modules.append("shifts")
        if self.perm_recruitment_read:
            modules.append("recruitment")
        if self.perm_contracts_read:
            modules.append("contracts")
        if self.perm_sanctions_read:
            modules.append("sanctions")
        if self.perm_retraite_read:
            modules.append("retraite")
        if self.perm_pay_events_read:
            modules.append("pay_events")
        if self.perm_alerts_read:
            modules.append("alerts")
        if self.perm_organisation_read:
            modules.append("organisation")
        if self.perm_hr_events_read:
            modules.append("hr_events")
        if self.perm_hr_users_manage:
            modules.append("hr_users")
        if self.perm_transport_read:
            modules.append("transport")   # ✅ ajouté
        if self.perm_horaire_read:
            modules.append("horaire")     # ✅ ajouté
        if self.perm_audit_logs_read:
            modules.append("audit_logs")  # ✅ ajouté
        return modules
