from django.db import migrations

HR_EVENT_TYPES = [
    {"name": "Absence sans motif",    "code": "ABS",   "category": "ABSENCE",    "is_paid": False, "affects_status": False, "target_status": "", "color": "#EF4444"},
    {"name": "Abandon de poste",      "code": "ABND",  "category": "ABSENCE",    "is_paid": False, "affects_status": True,  "target_status": "TERMINATED", "color": "#DC2626"},
    {"name": "Congé",                 "code": "CONG",  "category": "LEAVE",      "is_paid": True,  "affects_status": False, "target_status": "", "color": "#3B82F6"},
    {"name": "Congé de maternité",    "code": "MAT",   "category": "LEAVE",      "is_paid": True,  "affects_status": False, "target_status": "", "color": "#EC4899"},
    {"name": "Disponibilité",         "code": "DISPO", "category": "LEAVE",      "is_paid": False, "affects_status": False, "target_status": "", "color": "#8B5CF6"},
    {"name": "Présence maternelle",   "code": "PMAT",  "category": "LEAVE",      "is_paid": True,  "affects_status": False, "target_status": "", "color": "#F472B6"},
    {"name": "Permission en heure",   "code": "PERH",  "category": "PERMISSION", "is_paid": True,  "affects_status": False, "target_status": "", "color": "#F59E0B"},
    {"name": "Permission en jour",    "code": "PERJ",  "category": "PERMISSION", "is_paid": True,  "affects_status": False, "target_status": "", "color": "#FBBF24"},
    {"name": "Hospitalisation",       "code": "HOSP",  "category": "MEDICAL",    "is_paid": True,  "affects_status": False, "target_status": "", "color": "#06B6D4"},
    {"name": "Repos médical",         "code": "REPM",  "category": "MEDICAL",    "is_paid": True,  "affects_status": False, "target_status": "", "color": "#0EA5E9"},
    {"name": "Inapte",                "code": "INAPT", "category": "MEDICAL",    "is_paid": False, "affects_status": True,  "target_status": "INACTIVE",   "color": "#64748B"},
    {"name": "Démission",             "code": "DEM",   "category": "DEPARTURE",  "is_paid": False, "affects_status": True,  "target_status": "TERMINATED", "color": "#F97316"},
    {"name": "Licenciement",          "code": "LIC",   "category": "DEPARTURE",  "is_paid": False, "affects_status": True,  "target_status": "TERMINATED", "color": "#EF4444"},
    {"name": "Fin CDD",               "code": "FCDD",  "category": "DEPARTURE",  "is_paid": False, "affects_status": True,  "target_status": "TERMINATED", "color": "#6B7280"},
    {"name": "Droit de préavis",      "code": "PREA",  "category": "DEPARTURE",  "is_paid": True,  "affects_status": False, "target_status": "", "color": "#F59E0B"},
    {"name": "Essai non Concluant",   "code": "ESSAI", "category": "DEPARTURE",  "is_paid": False, "affects_status": True,  "target_status": "TERMINATED", "color": "#DC2626"},
    {"name": "Mises à pied",          "code": "MAP",   "category": "OTHER",      "is_paid": False, "affects_status": False, "target_status": "", "color": "#7C3AED"},
    {"name": "Education",             "code": "EDU",   "category": "OTHER",      "is_paid": True,  "affects_status": False, "target_status": "", "color": "#10B981"},
    {"name": "Fonction",              "code": "FONC",  "category": "OTHER",      "is_paid": True,  "affects_status": False, "target_status": "", "color": "#6366F1"},
]

def seed(apps, schema_editor):
    HREventType = apps.get_model("hr_events", "HREventType")
    for data in HR_EVENT_TYPES:
        HREventType.objects.get_or_create(code=data["code"], defaults=data)

def unseed(apps, schema_editor):
    HREventType = apps.get_model("hr_events", "HREventType")
    HREventType.objects.filter(code__in=[d["code"] for d in HR_EVENT_TYPES]).delete()

class Migration(migrations.Migration):
    dependencies = [("hr_events", "0001_initial")]
    operations = [migrations.RunPython(seed, reverse_code=unseed)]
