# =====================================================
# PATH: pointage/django_hr/documents/views.py
# Fills real .docx templates with employee data
# =====================================================
import os, re, io, random
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from employees.models import Employee
from accounts.permissions import IsHRUser

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")

# ── helpers ───────────────────────────────────────────────────────────────────

MONTHS_FR = ["","janvier","f\u00e9vrier","mars","avril","mai","juin",
             "juillet","ao\u00fbt","septembre","octobre","novembre","d\u00e9cembre"]

def fmt_date(value):
    if not value: return "\u2014"
    if isinstance(value, str):
        try: value = datetime.strptime(value[:10], "%Y-%m-%d").date()
        except: return value
    return f"{value.day:02d} {MONTHS_FR[value.month]} {value.year}"

def add_months(date_val, n):
    if isinstance(date_val, str):
        date_val = datetime.strptime(date_val[:10], "%Y-%m-%d").date()
    return fmt_date(date_val + relativedelta(months=n))

def civilite(emp):
    return "Madame" if (getattr(emp,"sexe","") or "").upper().startswith("F") else "Monsieur"

def today_fr():
    return fmt_date(date.today())

def ref_rh():
    return f"RH-{date.today().year}/{random.randint(1,99999):05d}"

def get_classif(emp):
    return getattr(emp,"classification",None) or getattr(emp,"category",None) or "\u2014"

# ── core replace (handles split runs) ────────────────────────────────────────

def replace_in_paragraph(para, reps):
    full = "".join(r.text for r in para.runs)
    new  = full
    for old, val in reps.items():
        new = new.replace(old, str(val) if val is not None else "\u2014")
    if new == full: return
    if para.runs:
        para.runs[0].text = new
        for r in para.runs[1:]: r.text = ""

def fill_template(tpl_path, reps):
    from docx import Document
    doc = Document(tpl_path)
    for p in doc.paragraphs: replace_in_paragraph(p, reps)
    for tbl in doc.tables:
        for row in tbl.rows:
            for cell in row.cells:
                for p in cell.paragraphs: replace_in_paragraph(p, reps)
    for sec in doc.sections:
        for p in sec.header.paragraphs: replace_in_paragraph(p, reps)
        for p in sec.footer.paragraphs: replace_in_paragraph(p, reps)
    buf = io.BytesIO(); doc.save(buf); buf.seek(0)
    return buf.read()

# ── builders ──────────────────────────────────────────────────────────────────

def build_attestation(emp, extra):
    usage        = extra.get("usage") or "Pr\u00eat bancaire BOA Tanjombato"
    ref          = extra.get("ref")   or ref_rh()
    today        = today_fr()
    hire         = fmt_date(emp.hire_date)
    civ          = civilite(emp)
    name         = f"{emp.last_name} {emp.first_name}"
    classif      = get_classif(emp)
    factory      = emp.factory.name if emp.factory else "\u2014"
    contrat_txt  = "ind\u00e9termin\u00e9e" if (emp.contract_type or "") == "CDI" else "d\u00e9termin\u00e9e"
    return fill_template(os.path.join(TEMPLATES_DIR,"BASE_ATTESTATION.docx"), {
        "Date demande attestation"                                    : today,
        "HR-2026/00418"                                               : ref,
        "Pr\u00eat bancaire Boa Tanjombato"                          : usage,
        "Civilit\u00e9"                                              : civ,
        "Nom et Pr\u00e9nom"                                         : name,
        "Fonction"                                                    : emp.job_title or "\u2014",
        "Classification"                                              : classif,
        "Matricule"                                                   : emp.employee_id or "\u2014",
        "Date d\u2019embauhce"                                       : hire,
        "D\u00e9termin\u00e9e / ind\u00e9termin\u00e9e (rayer la mention inutile)" : contrat_txt,
        "Date de demande d\u2019attestation"                         : today,
        "Lieu de travail"                                             : factory,
    })

def build_certificat(emp, extra):
    ref      = extra.get("ref")      or ref_rh()
    date_fin = fmt_date(extra.get("date_fin") or date.today())
    hire     = fmt_date(emp.hire_date)
    civ      = civilite(emp)
    name     = f"{emp.last_name} {emp.first_name}"
    classif  = get_classif(emp)
    return fill_template(os.path.join(TEMPLATES_DIR,"Certificat de travail - Copie.docx"), {
        "R\u00e9f\u00e9rence RH"  : ref,
        "Civilit\u00e9\xa0"       : civ + "\xa0",
        "Civilit\u00e9"            : civ,
        "Nom et Pr\u00e9nom"       : name,
        "Emploie occup\u00e9"      : emp.job_title or "\u2014",
        "Cat\u00e9gorie pro"       : classif,
        "Matricule"                 : emp.employee_id or "\u2014",
        "Date d\u2019embauhce"     : hire,
        "Date du d\u00e9bauche"    : date_fin,
    })

def build_contrat_cdd(emp, extra):
    salaire  = extra.get("salaire") or "\u2014"
    raw      = extra.get("date_embauche") or str(emp.hire_date or date.today())
    emb_fr   = fmt_date(raw)
    fin6     = add_months(raw, 6)
    essai3   = add_months(raw, 3)
    civ      = civilite(emp)
    name     = f"{emp.last_name} {emp.first_name}"
    classif  = get_classif(emp)
    b_date   = fmt_date(getattr(emp,"birth_date",None))
    b_place  = getattr(emp,"birth_place",None) or "\u2014"
    addr     = getattr(emp,"address",None)     or "\u2014"
    cin      = getattr(emp,"cin",None)         or "\u2014"
    cin_date = fmt_date(getattr(emp,"cin_date",None))
    cin_plc  = getattr(emp,"cin_place",None)   or "\u2014"
    # order matters: longer keys first to avoid partial replacement
    return fill_template(os.path.join(TEMPLATES_DIR,"CONTRAT DE TRAVAIL OUVRIERS CDD 06 MOIS 2025.docx"), {
        "Madame/Monsieur"                   : civ,
        "Nom et Pr\u00e9nom"               : name,
        "Date de naissance"                 : b_date,
        "Date de naissace"                  : b_date,   # typo in Malagasy section
        "Lieu de naissance"                 : b_place,
        "Adresse"                           : addr,
        "Num\u00e9ro CIN"                  : cin,
        "Date CIN"                          : cin_date,
        "Lieu CIN"                          : cin_plc,
        "Emploie occup\u00e9"              : emp.job_title or "\u2014",
        "Num\u00e9ro Matricule"            : emp.employee_id or "\u2014",
        "Montant"                           : salaire,
        "Classification"                    : classif,
        # Article 3 typo variants (longer first)
        "Date d\u2019embacuhe  + mois"     : fin6,
        "Date d\u2019embauche + 6 mois"    : fin6,
        "Date d\u2019embauche + 3 mois"    : essai3,
        "Date d\u2019embauhce + 3 mois"    : essai3,
        "Date d\u2019embauhce"             : emb_fr,
        "Date d\u2019embauche"             : emb_fr,
        # Malagasy section
        "Fonction"                          : emp.job_title or "\u2014",
        "Matricule"                         : emp.employee_id or "\u2014",
    })

def build_evaluation_cdd(emp, extra):
    dept     = emp.department.name if emp.department else "\u2014"
    section  = extra.get("section") or dept
    factory  = emp.factory.name if emp.factory else "\u2014"
    hire     = fmt_date(emp.hire_date)
    d_debut  = fmt_date(extra.get("date_debut") or str(emp.hire_date or date.today()))
    d_fin    = fmt_date(extra.get("date_fin_eval")) if extra.get("date_fin_eval") else "\u2014"
    name     = f"{emp.last_name} {emp.first_name}"
    civ      = civilite(emp)
    today    = today_fr()
    return fill_template(os.path.join(TEMPLATES_DIR,"EVALUATION et RENOUVELLEMENT CDD .docx"), {
        # Header block
        "NOM ET PRENOMS\xa0: "                          : f"NOM ET PRENOMS\xa0: {name}",
        "MATRICULE\xa0: "                               : f"MATRICULE\xa0: {emp.employee_id or chr(8212)}",
        "FONCTION\xa0:\t"                              : f"FONCTION\xa0: {emp.job_title or chr(8212)}",
        "SECTION\xa0:\t\t\t\t\t\tSite\xa0: "    : f"SECTION\xa0: {section}      Site\xa0: {factory}",
        "Date d\u2019embauche\xa0: "                   : f"Date d\u2019embauche\xa0: {hire}",
        "Date de d\u00e9but :\t\t\tDate fin : "      : f"Date de d\u00e9but : {d_debut}      Date fin : {d_fin}",
        # Signature block 1
        "Antananarivo le xxxxxxxxx"                      : f"Antananarivo le {today}",
        "Antananarivo le "                               : f"Antananarivo le {today}",
        "Mr / Mme\xa0:  "                               : f"Mr / Mme\xa0: {civ} {name}",
        "Fonction\xa0: "                                : f"Fonction\xa0: {emp.job_title or chr(8212)}",
        "Matricule\xa0: "                               : f"Matricule\xa0: {emp.employee_id or chr(8212)}",
        "Section\xa0:\t\t\t\t\t\tSite\xa0: "     : f"Section\xa0: {section}      Site\xa0: {factory}",
        # Renewal letter date placeholders (copy 1)
        "allant du xxxxx au xxxxx"                       : f"allant du {d_debut} au {d_fin}",
        "manomboka ny xxxxxx  hatramin\u2019ny xxxxx"   : f"manomboka ny {d_debut} hatramin\u2019ny {d_fin}",
        # Renewal letter date placeholders (copy 2)
        "allant du xxxxxx au xxxxxxxxxxxxx"              : f"allant du {d_debut} au {d_fin}",
        "manomboka ny xxxxxxxxx  hatramin\u2019ny xxxxxxxxxxxxxxx" : f"manomboka ny {d_debut} hatramin\u2019ny {d_fin}",
    })

# ── API ───────────────────────────────────────────────────────────────────────

BUILDERS = {
    "attestation"   : (build_attestation,    "Attestation_emploi"),
    "certificat"    : (build_certificat,     "Certificat_travail"),
    "contrat_cdd"   : (build_contrat_cdd,    "Contrat_CDD"),
    "evaluation_cdd": (build_evaluation_cdd, "Evaluation_CDD"),
}

@api_view(["POST"])
@permission_classes([IsHRUser])
def generate_document(request, employee_id, doc_type):
    if doc_type not in BUILDERS:
        return Response({"detail": f"Type inconnu: {doc_type}"}, status=400)
    try:
        emp = Employee.objects.select_related("factory","department").get(pk=employee_id)
    except Employee.DoesNotExist:
        return Response({"detail": "Employ\u00e9 introuvable."}, status=404)
    fn, prefix = BUILDERS[doc_type]
    try:
        doc_bytes = fn(emp, request.data or {})
    except FileNotFoundError as e:
        return Response({"detail": f"Template manquant: {e}"}, status=500)
    except Exception as e:
        import traceback
        return Response({"detail": str(e), "trace": traceback.format_exc()}, status=500)
    safe = re.sub(r"[^\w\-.]","_",f"{prefix}_{emp.last_name}_{emp.first_name}.docx")
    resp = HttpResponse(doc_bytes,
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    resp["Content-Disposition"] = f'attachment; filename="{safe}"'
    return resp

@api_view(["GET"])
@permission_classes([IsHRUser])
def list_templates(request):
    return Response({"templates":[
        {"id":"attestation",    "title":"Attestation d\u2019emploi"},
        {"id":"certificat",     "title":"Certificat de travail"},
        {"id":"contrat_cdd",    "title":"Contrat CDD 6 mois"},
        {"id":"evaluation_cdd", "title":"\u00c9valuation & Renouvellement CDD"},
    ]})
