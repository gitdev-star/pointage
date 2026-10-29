"""
Email quotidien : employés dont le compte bancaire est encore « Ouverture ».
Envoyé aux mêmes destinataires que l'email de création d'employé
(EMPLOYEE_CREATED_NOTIFICATION_EMAILS).
"""
import csv
import io

from django.conf import settings
from django.utils import timezone

from alerts.email_utils import _base_html, _send


def bank_account_recipients() -> list:
    return list(dict.fromkeys(
        e.strip().lower()
        for e in getattr(settings, "EMPLOYEE_CREATED_NOTIFICATION_EMAILS", [])
        if e.strip()
    ))


def _texte_excel(valeur) -> str:
    """Garde la valeur en texte dans Excel (zéros des matricules, noms en « - »)."""
    return '="' + str(valeur).replace('"', '""') + '"'


def notify_bank_account_opening(rows: list, recipients: list) -> bool:
    """rows : liste de dicts {full_name, employee_id, factory, department,
    job_title, hire_date, status} — employés en « Ouverture »."""
    today = timezone.localdate().strftime("%d/%m/%Y")
    count = len(rows)
    subject = f"[RH] Comptes bancaires à ouvrir — {today} ({count})"

    # ── CSV joint ──────────────────────────────────────────────────────
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    buf.write("\ufeff")  # BOM pour qu'Excel lise correctement les accents
    writer.writerow([f"Comptes bancaires a ouvrir — {today}"])
    writer.writerow([f"Nombre d'employes : {count}"])
    writer.writerow([])
    writer.writerow(["Nom", "Matricule", "Usine", "Departement", "Poste", "Date d'embauche", "Statut"])
    for r in rows:
        writer.writerow([
            _texte_excel(r["full_name"]), _texte_excel(r["employee_id"]),
            r["factory"], r["department"], r["job_title"], r["hire_date"], r["status"],
        ])
    csv_content = buf.getvalue()

    # ── Corps du message : tableau complet ─────────────────────────────
    cell = "padding:6px;border-bottom:1px solid #eee;"
    lignes = "".join(
        "<tr>"
        f"<td style='{cell}'>{r['full_name']}</td>"
        f"<td style='{cell}'>{r['employee_id']}</td>"
        f"<td style='{cell}'>{r['factory']}</td>"
        f"<td style='{cell}'>{r['department']}</td>"
        f"<td style='{cell}'>{r['job_title']}</td>"
        f"<td style='{cell}'>{r['hire_date']}</td>"
        f"<td style='{cell}'>{r['status']}</td>"
        "</tr>"
        for r in rows
    )
    th = "padding:8px;text-align:left;"
    body_html = "".join([
        "<p>Bonjour,</p>",
        f"<p>Voici la liste des employés dont le compte bancaire est encore "
        f"<strong>en ouverture</strong> : <strong>{count}</strong> employé(s).</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr style='background:#1565c0;color:#fff;'>",
        f"<th style='{th}'>Nom</th><th style='{th}'>Matricule</th><th style='{th}'>Usine</th>",
        f"<th style='{th}'>Département</th><th style='{th}'>Poste</th>",
        f"<th style='{th}'>Embauche</th><th style='{th}'>Statut</th></tr>",
        lignes, "</table>",
        "<p>Une fois le compte ouvert, passez l'employé en <strong>RIB</strong> dans la "
        "colonne « Compte bancaire » de la liste des employés : il n'apparaîtra plus "
        "dans l'envoi du lendemain.</p>",
        "<p>La liste est aussi jointe en CSV, consultable avec Excel ou LibreOffice.</p>",
        "<p>Cordialement,<br>Systeme RH</p>",
    ])
    text = "\n".join(
        ["Bonjour,", "",
         f"Employes dont le compte bancaire est encore en ouverture : {count}", ""]
        + [f"- {r['full_name']} ({r['employee_id']}) — {r['factory']} / {r['department']}" for r in rows]
        + ["", "Une fois le compte ouvert, passez l'employe en RIB dans la liste des employes.",
           "", "Cordialement,", "Systeme RH"]
    )

    html = _base_html(f"Comptes bancaires à ouvrir — {today}", body_html)
    filename = f"comptes_bancaires_ouverture_{timezone.localdate():%Y%m%d}.csv"
    return _send(subject, html, text, recipients,
                 attachments=[(filename, csv_content, "text/csv")])