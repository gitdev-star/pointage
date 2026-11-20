# =====================================================
# PATH: pointage/django_hr/alerts/overtime_email.py
# =====================================================
"""
Email de synthèse des heures supplémentaires (HS) par site.
Même présentation que le rapport mensuel des retards : message court,
détail par employé et par jour (arrivée, sortie, heures effectuées) dans le CSV joint.
"""
import csv
import io
from datetime import date

from alerts.email_utils import _base_html, _send, format_heures

JOURS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]


def _csv_decimal(heures: float) -> str:
    """Virgule décimale pour un Excel en français."""
    return f"{heures:.2f}".replace(".", ",")


def _texte_excel(valeur) -> str:
    """Force Excel à garder la valeur en texte : zéros des matricules,
    noms commençant par « - » (sinon lus comme une formule → #NOM?)."""
    return '="' + str(valeur).replace('"', '""') + '"'


def notify_overtime_report(factory, periode_label: str, slug: str, rows: list,
                           recipients: list, cc: list = None) -> bool:
    """rows : liste de dicts {full_name, employee_id, department, job_title,
    overtime_hours, overtime_days, days} — employés non HC du site ayant fait des HS.
    days : [{date, arrival, departure, hours_done, overtime_hours}] (jours avec HS)."""
    total = round(sum(r["overtime_hours"] for r in rows), 2)
    count = len(rows)
    subject = f"[RH] Heures supplémentaires — {periode_label} — {factory.name} ({format_heures(total)})"

    # ── CSV joint : détail par employé ─────────────────────────────────
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    buf.write("\ufeff")  # BOM pour qu'Excel lise correctement les accents
    writer.writerow([f"Heures supplementaires (hors HC) — {factory.name} — {periode_label}"])
    writer.writerow([f"Total HS : {format_heures(total)}", f"Nombre d'employes : {count}"])
    writer.writerow([])
    writer.writerow([
        "Nom", "Matricule", "Departement", "Poste", "Nombre de jours avec HS", "Total HS (h)", "Total HS",
        "Date", "Jour", "Heure arrivee", "Heure sortie", "Heures effectuees", "HS du jour",
    ])
    for r in sorted(rows, key=lambda r: r["full_name"]):
        employe = [
            _texte_excel(r["full_name"]), _texte_excel(r["employee_id"]),
            r.get("department") or "—", r.get("job_title") or "—",
            r["overtime_days"], _csv_decimal(r["overtime_hours"]), format_heures(r["overtime_hours"]),
        ]
        for i, d in enumerate(r.get("days") or [{}]):
            jour = date.fromisoformat(d["date"]) if d.get("date") else None
            writer.writerow((employe if i == 0 else [""] * len(employe)) + [
                jour.strftime("%d/%m/%Y") if jour else "",
                JOURS_FR[jour.weekday()] if jour else "",
                d.get("arrival") or "—",
                d.get("departure") or "—",
                format_heures(d.get("hours_done")) or "—",
                format_heures(d.get("overtime_hours")),
            ])
    csv_content = buf.getvalue()

    # ── Message court — le détail par employé est dans le CSV ─────────
    body_html = (
        f"<p>Bonjour,</p>"
        f"<p>Veuillez trouver ci-joint la synthèse des heures supplémentaires des employés "
        f"non HC de <strong>{factory.name}</strong> pour la <strong>{periode_label}</strong>.</p>"
        f"<p>Nombre d'employés concernés : <strong>{count}</strong>.<br>"
        f"Total des heures supplémentaires : <strong>{format_heures(total)}</strong>.</p>"
        f"<p>Le détail par employé est disponible dans le fichier CSV joint, "
        f"consultable avec Excel ou LibreOffice.</p>"
        f"<p>Cordialement,<br>Systeme RH</p>"
    )
    text = (
        f"Bonjour,\n\n"
        f"Veuillez trouver ci-joint la synthese des heures supplementaires des employes "
        f"non HC de {factory.name} pour la {periode_label}.\n\n"
        f"Nombre d'employes concernes : {count}.\n"
        f"Total des heures supplementaires : {format_heures(total)}.\n\n"
        f"Le detail par employe est disponible dans le fichier CSV joint, "
        f"consultable avec Excel ou LibreOffice.\n\n"
        f"Cordialement,\nSysteme RH"
    )

    html = _base_html(f"Heures supplémentaires — {factory.name} — {periode_label}", body_html)
    filename = f"heures_sup_{factory.name.replace(' ', '_')}_{slug}.csv"
    return _send(subject, html, text, recipients, cc=cc,
                 attachments=[(filename, csv_content, "text/csv")])

def notify_overtime_limit_exceeded(periode_label: str, normal: float, limit: float,
                                   rows: list, recipients: list, scope: str = "") -> bool:
    """rows : [{full_name, employee_id, factory, department, overtime_hours}]"""
    count = len(rows)
    subject = (f"[RH] Plafond d'heures supplémentaires atteint — {periode_label}"
               f"{' — ' + scope if scope else ''} ({count})")

    tr = "".join(
        "<tr>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{r['full_name']}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{r['employee_id']}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{r['factory']} / {r['department']}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;color:#c62828;font-weight:bold;'>"
        f"{format_heures(r['overtime_hours'])}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>"
        f"{'Dépassé' if r['overtime_hours'] > limit else 'Atteint'}</td>"
        "</tr>"
        for r in sorted(rows, key=lambda r: -r["overtime_hours"])
    )
    body_html = (
        f"<p>Bonjour,</p>"
        f"<p><strong>{count}</strong> employé(s) ont atteint le plafond de "
        f"<strong>{format_heures(limit)}</strong> d'heures supplémentaires pour <strong>{periode_label}</strong> "
        f"({format_heures(normal)} normales, tolérance jusqu'à {format_heures(limit)}).</p>"
        "<table style='border-collapse:collapse;width:100%;'>"
        "<tr style='background:#1565c0;color:#fff;'>"
        "<th style='padding:8px;text-align:left;'>Nom</th>"
        "<th style='padding:8px;text-align:left;'>Matricule</th>"
        "<th style='padding:8px;text-align:left;'>Usine / Dépt</th>"
        "<th style='padding:8px;text-align:left;'>HS cumulées</th>"
        "<th style='padding:8px;text-align:left;'>Statut</th></tr>"
        f"{tr}</table>"
        "<p style='margin-top:12px;'>Cordialement,<br>Systeme RH</p>"
    )
    text = "\n".join(
        [f"Plafond HS ({format_heures(limit)}) atteint — {periode_label}"]
        + [f"- {r['full_name']} ({r['employee_id']}) : {format_heures(r['overtime_hours'])}" for r in rows]
    )
    html = _base_html(f"Plafond heures supplémentaires — {periode_label}", body_html)
    return _send(subject, html, text, recipients)
