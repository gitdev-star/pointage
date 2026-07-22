import csv
import io
import re

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from django.core.exceptions import ValidationError
from django.core.cache import cache

from audit_log.utils import diff_dict, log_action, snapshot
from .models import (
    Classification, Poste, Factory, Department, Employee, Section, TransportList, WorkSchedule,
)
from django.db.models import OuterRef, Subquery, CharField
from django.db.models.functions import Cast
from audit_log.models import AuditLog
from .serializers import (
    EmployeeTransportSerializer,
    SectionSerializer,
    FactorySerializer,
    DepartmentSerializer,
    EmployeeListSerializer,
    EmployeeDetailSerializer,
    TransportListCreateSerializer,
    TransportListSerializer,
    WorkScheduleAssignSerializer,
    WorkScheduleSerializer,
    ClassificationSerializer,
    PosteSerializer,
)
from alerts.email_utils import (
    notify_resiliation,
    notify_employee_created,
    notify_bulk_resiliation,
)
from accounts.permissions import get_hr_profile

REQUIRED_COLUMNS = [
    "employee_id", "first_name", "last_name",
    "factory_name",
    "department_name",
    "job_title", "contract_type", "hire_date",
]

EXCEL_COLUMN_MAP = {
    "Matricule":                    "employee_id",
    "Prénoms":                      "first_name",
    "Nom":                          "last_name",
    "Emploi occupé":                "job_title",
    "N° TEL":                       "phone",
    "Date d'entrée poste":          "hire_date",
    "Date de départ société":       "termination_date",
    "Intitulé établissement":       "factory_name",
    "SECTION":                      "section_name",
    "CIN":                          "cin",
    "Date CIN":                     "cin_date",
    "Lieu CIN":                     "cin_place",
    "CNAPS":                        "cnaps",
    "SEXE":                         "sexe",
    "Adresse":                      "address",
    "Date de naissance":            "birth_date",
    "Lieu de naissance":            "birth_place",
    "NBRE ENFANTS":                 "nbre_enfants",
    "Période de Paie embauche":     "matricule_paie",
    "Période de Paie":              "matricule_paie",
    "Site":                         "factory_name",
    "Type de Contrat":              "contract_type",
    "Salaire":                      "salaire",
    "Classification":               "classification",
    "Prénom":                       "first_name",
    "DATE DEBUT CONTRAT":           "hire_date",
    "DATE FIN CONTRA":              "termination_date",
    "CATEGORIE":                    "contract_type",
    "Fonction":                     "job_title",
    "Date_emb":                     "hire_date",
    "Anc.matr":                     "matricule_paie",
    "Affectation":                  "affectation",
    "HK ou PBI":                    "hk_ou_pbi",
    "N° RH : '0320535316 ":         "n_rh",
    "N° RH : '0320535316":          "n_rh",
    "Intitulé du motif de départ":  "motif_depart",
    "user_id":                      "device_user_id",
    "Période":                      "matricule_paie",
    "Etablissement":                "factory_name",
    "Département":               "department_name",
}

VALID_CONTRACT_TYPES = {"CDI", "CDD", "INTERN", "PART", "SEASONAL"}
VALID_STATUSES       = {"ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"}


def _normalize_row(row):
    normalized = {}
    for key, value in row.items():
        mapped_key = EXCEL_COLUMN_MAP.get(key, key)
        normalized[mapped_key] = value
    return normalized


def _slugify_code(name):
    code = re.sub(r"[^A-Za-z0-9 ]", "", name).strip().upper()
    code = re.sub(r"\s+", "_", code)
    return code[:20] if code else "UNKNOWN"


def _safe_date(value):
    from datetime import datetime, date as date_type
    if not value:
        return None
    if isinstance(value, (datetime, date_type)):
        try:
            return value.strftime("%Y-%m-%d")
        except Exception:
            return None
    v = str(value).strip()
    if not v or v.lower() in ("none", "nat", "nan", "null", ""):
        return None
    if " " in v:
        v = v.split(" ")[0]
    if "T" in v:
        v = v.split("T")[0]
    if not re.match(r"^\d{2,4}[-/]\d{2}[-/]\d{2,4}$", v):
        return None
    if re.match(r"^\d{2}/\d{2}/\d{4}$", v):
        parts = v.split("/")
        v = f"{parts[2]}-{parts[1]}-{parts[0]}"
    try:
        datetime.strptime(v, "%Y-%m-%d")
    except ValueError:
        return None
    return v




def _safe_int(value):
    if not value:
        return None
    v = str(value).strip()
    if not v or v.lower() in ("none", "nan", "null", ""):
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None

def _get_factory(name):
    return Factory.objects.filter(name=name).first()


def _get_section(name, department):
    if not name:
        return None
    return Section.objects.filter(name=name, department=department).first()


def _get_department(name, factory):
    return Department.objects.filter(name=name, factory=factory).first()


def _parse_row(row, row_num):
    row = _normalize_row(row)
    errors = []

    employee_id   = row.get("employee_id", "").strip()
    first_name    = row.get("first_name", "").strip()
    last_name     = row.get("last_name", "").strip()
    job_title     = row.get("job_title", "").strip()
    hire_date     = _safe_date(row.get("hire_date", ""))
    status_val    = row.get("status", "ACTIVE").strip().upper() or "ACTIVE"

    factory_name  = row.get("factory_name", "").strip()
    dept_name     = row.get("department_name", "").strip() or None
    section_name  = row.get("section_name", "").strip()

    contract_type = row.get("contract_type", "").strip().upper()
    if not contract_type:
        contract_type = "CDI"

    if not employee_id:
        errors.append("employee_id is required")
    if not first_name:
        first_name = last_name
    if not last_name:
        last_name = first_name
    if not factory_name:
        factory_name = None
    if not dept_name:
        errors.append("'Département' column is missing or empty (should be placed after 'Etablissement' in your Excel file)")
    if not job_title:
        job_title = ""
    if contract_type not in VALID_CONTRACT_TYPES:
        contract_type = "CDI"
    if not hire_date:
        hire_date = None
    if status_val not in VALID_STATUSES:
        status_val = "ACTIVE"

    if errors:
        return None, "; ".join(errors)

    nbre_enfants_raw = str(row.get("nbre_enfants", "")).strip()
    nbre_enfants = int(nbre_enfants_raw) if nbre_enfants_raw.isdigit() else None

    motif = row.get("motif_depart", "").strip().lower()
    termination_date_val = _safe_date(row.get("termination_date"))
    if motif or termination_date_val:
        status_val = "TERMINATED"

    salaire_raw = str(row.get("salaire", "")).strip()
    salaire_val = salaire_raw if salaire_raw and salaire_raw.lower() not in ("none", "nan", "") else None

    classification_val = row.get("classification", "").strip() or None

    return {
        "employee_id":      employee_id,
        "first_name":       first_name,
        "last_name":        last_name,
        "factory_name":     factory_name,
        "factory_location": row.get("factory_location", "").strip(),
        "department_name":  dept_name,
        "job_title":        job_title,
        "contract_type":    contract_type,
        "hire_date":        hire_date,
        "status":           status_val,
        "email":            row.get("email", "").strip() or None,
        "phone":            row.get("phone", "").strip(),
        "device_user_id":   _safe_int(row.get("device_user_id")),
        "auth_user_id":     _safe_int(row.get("auth_user_id")),
        "cin":              row.get("cin", "").strip() or None,
        "cin_date":         _safe_date(row.get("cin_date")),
        "cin_place":        row.get("cin_place", "").strip() or None,
        "cnaps":            row.get("cnaps", "").strip() or None,
        "sexe":             row.get("sexe", "").strip() or None,
        "address":          row.get("address", "").strip() or None,
        "birth_date":       _safe_date(row.get("birth_date")),
        "birth_place":      row.get("birth_place", "").strip() or None,
        "nbre_enfants":     nbre_enfants,
        "matricule_paie":   row.get("matricule_paie", "").strip() or None,
        "affectation":      row.get("affectation", "").strip() or None,
        "hk_ou_pbi":        row.get("hk_ou_pbi", "").strip() or None,
        "n_rh":             row.get("n_rh", "").strip() or None,
        "motif_depart":     row.get("motif_depart", "").strip() or None,
        "termination_date": _safe_date(row.get("termination_date")),
        "section_name":     section_name,
        "salaire":          salaire_val,
        "classification_name":   classification_val,
    }, None


# ── ViewSets ───────────────────────────────────────────────────────────────

class FactoryViewSet(viewsets.ModelViewSet):
    queryset = Factory.objects.only(
        "id", "name", "location", "is_active", "created_at"
    )
    serializer_class = FactorySerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "location"]

    @action(detail=True, methods=["get"])
    def departments(self, request, pk=None):
        factory = self.get_object()
        depts = factory.departments.filter(is_active=True).only("id", "name", "is_active")
        return Response(DepartmentSerializer(depts, many=True).data)

    @action(detail=True, methods=["get"])
    def employees(self, request, pk=None):
        factory = self.get_object()
        emps = (
            factory.employees.filter(status="ACTIVE")
            .select_related("department")
            .only(
                "id", "employee_id", "first_name", "last_name",
                "photo", "job_title__id", "job_title__name", "status", "device_user_id",
                "factory_id", "department__id", "department__name",
            )
        )
        return Response(EmployeeListSerializer(emps, many=True).data)


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.select_related("factory", "manager").only(
        "id", "name", "is_active", "created_at",
        "factory__id", "factory__name",
        "manager__id", "manager__first_name", "manager__last_name",
    )
    serializer_class = DepartmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["factory", "is_active"]
    search_fields = ["name"]

    @action(detail=True, methods=["get"])
    def employees(self, request, pk=None):
        dept = self.get_object()
        emps = (
            dept.employees.filter(status="ACTIVE")
            .select_related("factory")
            .only(
                "id", "employee_id", "first_name", "last_name",
                "photo", "job_title__id", "job_title__name", "status", "device_user_id",
                "factory_id", "factory__name", "department_id",
            )
        )
        return Response(EmployeeListSerializer(emps, many=True).data)


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = (
        Employee.objects
        .select_related("factory", "department", "job_title", "classification")
        .only(
            "id", "employee_id", "first_name", "last_name", "photo",
            "email", "phone", "job_title__id", "job_title__name", "contract_type",
            "hire_date", "termination_date", "status",
            "device_user_id", "auth_user_id",
            "created_at", "updated_at",
            "factory__id", "factory__name",
            "department__id", "department__name",
            "classification__id_classification", "classification__classe",
        )
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["factory", "department", "status", "contract_type"]
    search_fields = ["first_name", "last_name", "employee_id", "email", "job_title__name", "cin", "cnaps", "matricule_paie"]
    ordering_fields = ["last_name", "hire_date", "employee_id"]

    def get_queryset(self):
        qs = super().get_queryset()

        sexe = self.request.query_params.get("sexe")
        if sexe:
            if sexe.upper() == "F":
                qs = qs.filter(sexe__iregex=r"^f[eé]minin$")
            else:
                qs = qs.filter(sexe__icontains="masc")

        ref_month = self.request.query_params.get("ref_month")
        anciennete_months = self.request.query_params.get("anciennete_months")

        if ref_month and anciennete_months:
            try:
                ref_year, ref_m = map(int, ref_month.split("-"))
                months = int(anciennete_months)
            except (ValueError, TypeError):
                raise ValidationError({"anciennete_months": "Doit être un entier (3, 6, 12 ou 18)."})

            total = ref_year * 12 + (ref_m - 1) - months
            target_year = total // 12
            target_month = total % 12 + 1

            qs = qs.filter(
                hire_date__year=target_year,
                hire_date__month=target_month,
            )

        # ── Annotation audit log : toujours appliquée, indépendamment des filtres ci-dessus ──
        latest_log = AuditLog.objects.filter(
            model_name="employee",
            object_id=Cast(OuterRef("pk"), output_field=CharField()),
        ).order_by("-timestamp")
        qs = qs.annotate(
            last_action=Subquery(latest_log.values("action")[:1]),
            last_action_at=Subquery(latest_log.values("timestamp")[:1]),
            last_action_by=Subquery(latest_log.values("username")[:1]),
        )

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return EmployeeListSerializer
        return EmployeeDetailSerializer

    def perform_create(self, serializer):
        employee = serializer.save()
        employee.refresh_from_db(fields=["employee_id"])  # récupère le matricule généré par le trigger

        profile = get_hr_profile(self.request)
        triggered_by = profile.username if profile else "Système"
        notify_employee_created(employee, triggered_by=triggered_by)

        log_action(self.request, serializer.instance, "CREATE")

    def perform_update(self, serializer):
        old_data = snapshot(serializer.instance)
        old_status = serializer.instance.status

        employee = serializer.save()

        new_data = snapshot(employee)
        changes = diff_dict(old_data, new_data)
        if changes:
            log_action(self.request, employee, "UPDATE", changes)

        if old_status != "TERMINATED" and employee.status == "TERMINATED":
            try:
                profile = get_hr_profile(self.request)
                triggered_by = profile.username if profile else "Inconnu"
                hr_manager_email = profile.email if profile else ""
                notify_resiliation(
                    employee,
                    motif=employee.motif_depart or "",
                    triggered_by=triggered_by,
                    hr_manager_email=hr_manager_email,
                )
            except Exception:
                import traceback
                traceback.print_exc()

    def perform_destroy(self, instance):
        log_action(self.request, instance, "DELETE")
        super().perform_destroy(instance)

        

    @action(detail=False, methods=["get"], url_path="by-device/(?P<device_user_id>[0-9]+)")
    def by_device(self, request, device_user_id=None):
        try:
            emp = Employee.objects.select_related("factory", "department").get(device_user_id=device_user_id)
            return Response(EmployeeDetailSerializer(emp).data)
        except Employee.DoesNotExist:
            return Response(
                {"detail": f"No employee linked to device_user_id {device_user_id}."},
                status=404,
            )

    @action(detail=False, methods=["get"])
    def active(self, request):
        emps = self.filter_queryset(
            Employee.objects.filter(status="ACTIVE")
            .select_related("factory", "department")
            .only(
                "id", "employee_id", "first_name", "last_name",
                "photo", "job_title__id", "job_title__name", "status", "device_user_id",
                "factory__id", "factory__name",
                "department__id", "department__name",
            )
        )
        page = self.paginate_queryset(emps)
        if page is not None:
            return self.get_paginated_response(EmployeeListSerializer(page, many=True).data)
        return Response(EmployeeListSerializer(emps, many=True).data)

    @action(detail=False, methods=["post"], url_path="import", url_name="import", parser_classes=[MultiPartParser])
    def import_csv(self, request):
        import traceback as _tb
        try:
            return self._import_csv_inner(request)
        except Exception as _e:
            _tb.print_exc()
            from rest_framework.response import Response as _R
            from rest_framework import status as _s
            return _R({"detail": f"Unhandled exception: {_e}", "trace": _tb.format_exc()}, status=_s.HTTP_500_INTERNAL_SERVER_ERROR)

    def _import_csv_inner(self, request):
        csv_file = request.FILES.get("file")
        if not csv_file:
            return Response(
                {"detail": "No file provided. Send a CSV or XLSX as form field 'file'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        filename = csv_file.name.lower()
        if not filename.endswith(".csv") and not filename.endswith(".xlsx"):
            return Response(
                {"detail": "Only .csv or .xlsx files are accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if filename.endswith(".xlsx"):
            try:
                import openpyxl
                wb = openpyxl.load_workbook(csv_file, read_only=True, data_only=True)
                ws = wb.active
                rows = list(ws.iter_rows(values_only=True))
                if not rows:
                    return Response({"detail": "The Excel file is empty."}, status=status.HTTP_400_BAD_REQUEST)
                headers = [str(h).strip() if h is not None else "" for h in rows[0]]
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(headers)
                for row in rows[1:]:
                    writer.writerow([str(cell).strip() if cell is not None else "" for cell in row])
                output.seek(0)
                reader = csv.DictReader(output)
            except Exception as e:
                return Response({"detail": f"Could not read Excel file: {e}"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                decoded = csv_file.read().decode("utf-8-sig")
            except UnicodeDecodeError:
                return Response({"detail": "Could not decode file. Please use UTF-8 encoding."}, status=status.HTTP_400_BAD_REQUEST)
            reader = csv.DictReader(io.StringIO(decoded))

        fieldnames = reader.fieldnames or []
        is_excel_format = "Matricule" in fieldnames or "Prénoms" in fieldnames

        if not is_excel_format:
            missing_cols = [c for c in REQUIRED_COLUMNS if c not in fieldnames]
            if missing_cols:
                return Response({"detail": f"CSV is missing required columns: {missing_cols}"}, status=status.HTTP_400_BAD_REQUEST)

        existing_ids = set(Employee.objects.values_list("employee_id", flat=True))
        existing_cins = {
            cin: eid for cin, eid in
            Employee.objects.exclude(cin=None).exclude(cin="").values_list("cin", "employee_id")
        }
        existing_device_ids = set(
            Employee.objects.exclude(device_user_id=None).values_list("device_user_id", flat=True)
        )

        results = []
        to_create = []
        skipped = 0
        errors = 0
        factory_cache = {}
        department_cache = {}
        seen_device_ids = set()

        for row_num, row in enumerate(reader, start=2):
            normalized = _normalize_row(row)
            employee_id = normalized.get("employee_id", "").strip()

            payload, error = _parse_row(row, row_num)
            if error:
                results.append({"row": row_num, "employee_id": employee_id, "status": "error", "detail": error})
                errors += 1
                continue

            if payload["employee_id"] in existing_ids:
                results.append({"row": row_num, "employee_id": employee_id, "status": "skipped", "detail": "Employee with this ID already exists."})
                skipped += 1
                continue

            if payload["device_user_id"] and payload["device_user_id"] in existing_device_ids:
                results.append({"row": row_num, "employee_id": employee_id, "status": "skipped", "detail": f"device_user_id {payload['device_user_id']} already assigned."})
                skipped += 1
                continue

            cin_val = payload.get("cin")
            if cin_val and cin_val in existing_cins:
                results.append({"row": row_num, "employee_id": employee_id, "status": "skipped", "detail": f"CIN '{cin_val}' déjà utilisé par l'employé {existing_cins[cin_val]}."})
                skipped += 1
                continue

            if payload["device_user_id"] and payload["device_user_id"] in seen_device_ids:
                results.append({"row": row_num, "employee_id": employee_id, "status": "skipped", "detail": f"device_user_id {payload['device_user_id']} duplicated in this file."})
                skipped += 1
                continue

            fac_name = payload["factory_name"] or ""
            if fac_name not in factory_cache:
                factory = _get_factory(payload["factory_name"])
                if not factory:
                    results.append({"row": row_num, "employee_id": employee_id, "status": "error", "detail": f"Factory '{payload['factory_name']}' not found. Please create it in the DB first."})
                    errors += 1
                    continue
                factory_cache[fac_name] = factory
            factory = factory_cache[fac_name]

            dept_key = f"{payload['department_name']}_{fac_name}"
            if dept_key not in department_cache:
                department = _get_department(payload["department_name"], factory)
                if not department:
                    results.append({"row": row_num, "employee_id": employee_id, "status": "error", "detail": f"Department '{payload['department_name']}' not found in factory '{payload['factory_name']}'. Please create it in the DB first."})
                    errors += 1
                    continue
                department_cache[dept_key] = department
            department = department_cache[dept_key]

            section = None
            if payload["section_name"]:
                sect_key = f"{payload['section_name']}_{dept_key}"
                if sect_key not in department_cache:
                    section = _get_section(payload["section_name"], department)
                    if not section:
                        results.append({"row": row_num, "employee_id": employee_id, "status": "error", "detail": f"Section '{payload['section_name']}' not found in department '{payload['department_name']}'. Please create it in the DB first."})
                        errors += 1
                        continue
                    department_cache[sect_key] = section
                else:
                    section = department_cache[sect_key]

            classification_obj = None
            if payload["classification_name"]:
                classification_obj = Classification.objects.filter(
                    classe__iexact=payload["classification_name"]
                ).first()

            poste_obj = None
            if payload["job_title"]:
                poste_obj = Poste.objects.filter(name__iexact=payload["job_title"]).first()

            to_create.append(Employee(
                employee_id=payload["employee_id"],
                first_name=payload["first_name"],
                last_name=payload["last_name"],
                email=payload["email"],
                phone=payload["phone"],
                factory=factory,
                department=department,
                job_title=poste_obj,
                contract_type=payload["contract_type"],
                hire_date=payload["hire_date"],
                status=payload["status"],
                device_user_id=payload["device_user_id"],
                auth_user_id=payload["auth_user_id"],
                termination_date=payload["termination_date"],
                cin=payload["cin"],
                cin_date=payload["cin_date"],
                cin_place=payload["cin_place"],
                cnaps=payload["cnaps"],
                sexe=payload["sexe"],
                address=payload["address"],
                birth_date=payload["birth_date"],
                birth_place=payload["birth_place"],
                nbre_enfants=payload["nbre_enfants"],
                matricule_paie=payload["matricule_paie"],
                affectation=payload["affectation"],
                hk_ou_pbi=payload["hk_ou_pbi"],
                n_rh=payload["n_rh"],
                motif_depart=payload["motif_depart"],
                section=section,
                salaire=payload["salaire"],
                classification=classification_obj,
            ))
            existing_ids.add(payload["employee_id"])
            if payload["device_user_id"]:
                existing_device_ids.add(payload["device_user_id"])
                seen_device_ids.add(payload["device_user_id"])
            results.append({"row": row_num, "employee_id": employee_id, "status": "queued", "detail": "Queued for bulk insert."})

        created = 0
        if to_create:
            try:
                Employee.objects.bulk_create(to_create, batch_size=500, ignore_conflicts=True)
                created = len(to_create)
                for r in results:
                    if r["status"] == "queued":
                        r["status"] = "created"
                        r["detail"] = "Created successfully."
            except Exception as e:
                errors += len(to_create)
                for r in results:
                    if r["status"] == "queued":
                        r["status"] = "error"
                        r["detail"] = f"Bulk insert failed: {e}"

        terminated_in_import = [
            {
                "full_name":        e.first_name + " " + e.last_name,
                "employee_id":      e.employee_id,
                "factory":          e.factory.name,
                "department":       e.department.name,
                "motif":            e.motif_depart,
                "termination_date": str(e.termination_date) if e.termination_date else None,
            }
            for e in to_create if e.status == "TERMINATED"
        ]
        if terminated_in_import:
            notify_bulk_resiliation(terminated_in_import, triggered_by="Import CSV")

        return Response({
            "summary": {
                "total_rows":              created + skipped + errors,
                "created":                 created,
                "skipped":                 skipped,
                "errors":                  errors,

            },
            "rows": results,
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=["get"], url_path="transport-search")
    
    def transport_search(self, request):
        """Recherche légère pour la sélection transport : ne renvoie rien tant
        que l'utilisateur n'a pas tapé au moins 2 caractères, et limite à 20 résultats."""
        search = (request.query_params.get("search") or "").strip()
        if len(search) < 2:
            return Response([])

        from django.db.models import Q
        qs = (
            Employee.objects
            .filter(status="ACTIVE")
            .select_related("job_title")
            .filter(
                Q(employee_id__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
            .only("id", "employee_id", "first_name", "last_name", "address", "job_title__name")[:20]
        )
        return Response(EmployeeTransportSerializer(qs, many=True).data)


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.select_related("department", "department__factory").only(
        "id", "name", "is_active", "created_at",
        "department__id", "department__name",
        "department__factory__id", "department__factory__name",
    )
    serializer_class = SectionSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["department", "is_active"]
    search_fields    = ["name"]


class WorkScheduleViewSet(viewsets.ModelViewSet):
    queryset = WorkSchedule.objects.select_related("employee", "department", "section").all()
    serializer_class = WorkScheduleSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if employee_id := params.get("employee"):
            qs = qs.filter(employee_id=employee_id)
        if department_id := params.get("department"):
            qs = qs.filter(department_id=department_id)
        if section_id := params.get("section"):
            qs = qs.filter(section_id=section_id)
        if (is_active := params.get("is_active")) is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        return qs

    @action(detail=False, methods=["post"])
    def assign(self, request):
        serializer = WorkScheduleAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = serializer.save()
        return Response(
            {
                "created_count": len(created),
                "schedules": WorkScheduleSerializer(created, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class PosteViewSet(viewsets.ModelViewSet):
    queryset = Poste.objects.all().order_by("name")
    serializer_class = PosteSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    filterset_fields = ["is_active"]
    search_fields = ["name"]

# ── Function-based views ───────────────────────────────────────────────────

@api_view(["GET"])
def cached_factories(request):
    data = cache.get("factories_list")
    if not data:
        qs   = Factory.objects.filter(is_active=True).only("id", "name", "location")
        data = FactorySerializer(qs, many=True).data
        cache.set("factories_list", data, 60 * 30)
    return Response(data)


@api_view(["GET"])
def cached_departments(request):
    data = cache.get("departments_list")
    if not data:
        qs   = Department.objects.filter(is_active=True).select_related("factory").only(
            "id", "name", "factory__id", "factory__name"
        )
        data = DepartmentSerializer(qs, many=True).data
        cache.set("departments_list", data, 60 * 30)
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def employee_export(request):
    qs = Employee.objects.select_related("factory", "department", "section").all()
    status_param  = request.query_params.get("status")
    factory       = request.query_params.get("factory")
    department    = request.query_params.get("department")
    contract_type = request.query_params.get("contract_type")
    search        = request.query_params.get("search")
    sexe          = request.query_params.get("sexe")

    if status_param:
        qs = qs.filter(status=status_param)
    if factory:
        qs = qs.filter(factory_id=factory)
    if department:
        qs = qs.filter(department_id=department)
    if contract_type:
        qs = qs.filter(contract_type=contract_type)
    if sexe:
        qs = qs.filter(sexe__iregex=r"^f[eé]minin$") if sexe.upper() == "F" else qs.filter(sexe__icontains="masc")
    if search:
        from django.db.models import Q
        qs = qs.filter(
            Q(first_name__icontains=search) | Q(last_name__icontains=search) |
            Q(employee_id__icontains=search) | Q(cin__icontains=search)
        )

    data = EmployeeDetailSerializer(qs, many=True).data
    return Response({"count": len(data), "results": data})


class ClassificationViewSet(viewsets.ModelViewSet):
    queryset = Classification.objects.all().order_by("classe")
    serializer_class = ClassificationSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["classe"]


@api_view(["GET"])
def cached_classifications(request):
    data = cache.get("classifications_list")
    if not data:
        qs   = Classification.objects.all().order_by("classe")
        data = ClassificationSerializer(qs, many=True).data
        cache.set("classifications_list", data, 60 * 30)
    return Response(data)

class TransportListViewSet(viewsets.ModelViewSet):
    queryset = TransportList.objects.prefetch_related("items").all()
    serializer_class = TransportListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        date_param = self.request.query_params.get("date")
        if date_param:
            qs = qs.filter(transport_date=date_param)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = TransportListCreateSerializer(
            data=request.data,
            context={"created_by": getattr(request.user, "username", None)},
        )
        serializer.is_valid(raise_exception=True)
        transport_list = serializer.save()
        return Response(TransportListSerializer(transport_list).data, status=status.HTTP_201_CREATED)