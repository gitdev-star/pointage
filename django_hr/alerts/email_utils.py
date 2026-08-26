# =====================================================
# PATH: pointage/django_hr/alerts/email_utils.py
# =====================================================
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.utils import timezone



HELPDESK_EMAIL = getattr(settings, "HELPDESK_EMAIL", "helpdesk@pb-industries.mg")


def _base_html(title: str, body_html: str) -> str:
    """Wraps content in a branded HTML email shell."""
    return f"""
    <html>
    <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
      <div style="max-width:700px;margin:auto;background:#fff;border-radius:8px;
                  box-shadow:0 2px 8px rgba(0,0,0,.1);overflow:hidden;">
        <div style="background:#1565C0;padding:16px 24px;">
          <h2 style="color:#fff;margin:0;">🏭 PB Industries — Système RH</h2>
          <p style="color:#bbdefb;margin:4px 0 0;">{title}</p>
        </div>
        <div style="padding:24px;">
          {body_html}
        </div>
        <div style="background:#f5f5f5;padding:12px 24px;font-size:12px;color:#888;
                    border-top:1px solid #eee;">
          Message automatique — {timezone.now().strftime('%d/%m/%Y %H:%M')} — Ne pas répondre à cet email.
        </div>
      </div>
    </body>
    </html>"""



def _send(subject: str, html: str, text: str, recipients: list[str], cc: list[str] = None):
    """Core send helper — never raises, logs errors instead."""
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=recipients,
            cc=cc or [],          # ← NEW
        )
        msg.attach_alternative(html, "text/html")
        msg.send()
    except Exception as exc:
        print(f"[EMAIL ERROR] {subject} → {recipients} (cc={cc}): {exc}")

# ─────────────────────────────────────────────────────────────
# CDD Alert notifications
# ─────────────────────────────────────────────────────────────

def notify_alert_sent(alert, sent_to_email: str, triggered_by: str = "Système"):
    """Fired after a single CDD alert email is sent."""
    emp = alert.employee
    today = timezone.now().date()
    days_left = (emp.termination_date - today).days

    subject = f"[RH] Alerte CDD envoyée — {emp.full_name}"
    text = (
        f"Action : Alerte CDD envoyée\n"
        f"Employé : {emp.full_name} ({emp.employee_id})\n"
        f"Fin contrat : {emp.termination_date} ({days_left} jours)\n"
        f"Email destinataire : {sent_to_email}\n"
        f"Déclenché par : {triggered_by}\n"
    )
    body_html = f"""
        <p>Une alerte CDD a été envoyée.</p>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;width:200px;">Employé</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">{emp.full_name} ({emp.employee_id})</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Poste</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">{emp.job_title}</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Usine / Dépt</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">{emp.factory.name} / {emp.department.name}</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Fin de contrat</td>
              <td style="padding:8px;border-bottom:1px solid #eee;color:#e53935;font-weight:bold;">
                {emp.termination_date} ({days_left} jours restants)</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Envoyé à</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">{sent_to_email}</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Déclenché par</td>
              <td style="padding:8px;">{triggered_by}</td></tr>
        </table>"""

    html = _base_html("Alerte CDD envoyée", body_html)
    _send(subject, html, text, [HELPDESK_EMAIL])
    _notify_inapp(subject, f"Employe: {emp.full_name} | Fin: {emp.termination_date} | {days_left}j", level="warning", category="cdd")


def notify_alert_renewed(alert, note: str, triggered_by: str = "Inconnu"):
    """Fired when an alert is marked RENEWED."""
    emp = alert.employee
    subject = f"[RH] Contrat renouvelé — {emp.full_name}"
    text = (
        f"Action : Contrat CDD marqué renouvelé\n"
        f"Employé : {emp.full_name} ({emp.employee_id})\n"
        f"Ancienne fin : {emp.termination_date}\n"
        f"Note : {note or '—'}\n"
        f"Par : {triggered_by}\n"
    )
    body_html = f"""
        <p>Un contrat CDD a été marqué comme <strong style="color:#2e7d32;">renouvelé</strong>.</p>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;width:200px;">Employé</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">{emp.full_name} ({emp.employee_id})</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Ancienne fin contrat</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">{emp.termination_date}</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Note</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">{note or '—'}</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Effectué par</td>
              <td style="padding:8px;">{triggered_by}</td></tr>
        </table>"""

    html = _base_html("Renouvellement de contrat CDD", body_html)
    _send(subject, html, text, [HELPDESK_EMAIL])
    _notify_inapp(subject, f"Employe: {emp.full_name} | Note: {note or chr(45)}", level="success", category="cdd")


def notify_alert_ignored(alert, triggered_by: str = "Inconnu"):
    """Fired when an alert is marked IGNORED."""
    emp = alert.employee
    subject = f"[RH] Alerte ignorée — {emp.full_name}"
    text = (
        f"Action : Alerte CDD ignorée\n"
        f"Employé : {emp.full_name} ({emp.employee_id})\n"
        f"Fin contrat : {emp.termination_date}\n"
        f"Par : {triggered_by}\n"
    )
    body_html = f"""
        <p>Une alerte CDD a été <strong style="color:#e65100;">ignorée</strong>.</p>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;width:200px;">Employé</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">{emp.full_name} ({emp.employee_id})</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Fin de contrat</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">{emp.termination_date}</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Ignoré par</td>
              <td style="padding:8px;">{triggered_by}</td></tr>
        </table>"""

    html = _base_html("Alerte CDD ignorée", body_html)
    _send(subject, html, text, [HELPDESK_EMAIL])
    _notify_inapp(subject, f"Employe: {emp.full_name} | Fin: {emp.termination_date}", level="info", category="cdd")


def notify_bulk_sent(sent_count: int, total_employees: int, days: int,
                     errors: list, triggered_by: str = "Système"):
    """Fired after SendBulkAlertsView completes."""
    subject = f"[RH] Envoi groupé CDD — {sent_count} email(s) envoyé(s)"
    error_html = ""
    if errors:
        error_rows = "".join(f"<li style='color:#c62828;'>{e}</li>" for e in errors)
        error_html = f"<p><strong>Erreurs ({len(errors)}) :</strong><ul>{error_rows}</ul></p>"

    text = (
        f"Envoi groupé d'alertes CDD\n"
        f"Emails envoyés : {sent_count}\n"
        f"Employés concernés : {total_employees}\n"
        f"Fenêtre : {days} jours\n"
        f"Déclenché par : {triggered_by}\n"
        f"Erreurs : {len(errors)}\n"
    )
    body_html = f"""
        <p>Un envoi groupé d'alertes CDD vient d'être effectué.</p>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;width:220px;">Emails envoyés</td>
              <td style="padding:8px;border-bottom:1px solid #eee;color:#1565c0;font-weight:bold;">{sent_count}</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Employés concernés</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">{total_employees}</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Fenêtre d'alerte</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">{days} jours</td></tr>
          <tr><td style="padding:8px;background:#f9f9f9;font-weight:bold;">Déclenché par</td>
              <td style="padding:8px;">{triggered_by}</td></tr>
        </table>
        {error_html}"""

    html = _base_html("Rapport d'envoi groupé CDD", body_html)
    _send(subject, html, text, [HELPDESK_EMAIL])


# ─────────────────────────────────────────────────────────────
# Employee lifecycle notifications
# ─────────────────────────────────────────────────────────────

def notify_resiliation(employee, motif: str = "", triggered_by: str = "Inconnu",
                       hr_manager_email: str = ""):
    """Fired when an employee status changes to TERMINATED."""
    emp = employee
    subject = f"[RH] Résiliation contrat — {emp.full_name}"
    text = "\n".join([
        "Action : Résiliation de contrat",
        f"Employé : {emp.full_name} ({emp.employee_id})",
        f"Poste : {emp.job_title}",
        f"Usine / Dept : {emp.factory.name} / {emp.department.name}",
        f"Motif : {motif or '—'}",
        f"Par : {triggered_by}",
    ])
    body_html = "".join([
        "<p>Un contrat employé a été <strong style='color:#c62828;'>résilié</strong>.</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;width:200px;'>Employé</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.full_name} ({emp.employee_id})</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Poste</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.job_title}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Usine / Dépt</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.factory.name} / {emp.department.name}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Date fin</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.termination_date or '—'}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Motif</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{motif or '—'}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Effectué par</td>",
        f"<td style='padding:8px;'>{triggered_by}</td></tr>",
        "</table>",
    ])
    # Notify helpdesk + all HR directors + the HR agent who triggered it
    from accounts.models import HRProfile
    directors = list(HRProfile.objects.filter(is_director=True).values_list("email", flat=True))
    recipients = list({HELPDESK_EMAIL} | {e for e in directors if e})
    if hr_manager_email and hr_manager_email not in recipients:
        recipients.append(hr_manager_email)
    html = _base_html("Résiliation de contrat", body_html)
    _send(subject, html, text, recipients)
    _notify_inapp(subject, f"Employe: {emp.full_name} | Motif: {motif or chr(45)}", level="error", category="employee")


def notify_employee_created(employee, triggered_by: str = "Inconnu"):
    """Fired when a new employee is created."""
    from accounts.models import HRProfile
    emp = employee
    subject = f"[RH] Nouvel employé créé — {emp.full_name}"
    text = "\n".join([
        "Action : Création d'un employé",
        f"Employé : {emp.full_name} ({emp.employee_id})",
        f"Poste : {emp.job_title}",
        f"Usine / Dept : {emp.factory.name} / {emp.department.name}",
        f"Contrat : {emp.contract_type}",
        f"Par : {triggered_by}",
    ])
    body_html = "".join([
        "<p>Un nouvel employé a été <strong style='color:#1565c0;'>créé</strong> dans le système.</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;width:200px;'>Employé</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.full_name} ({emp.employee_id})</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Poste</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.job_title}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Usine / Dépt</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.factory.name} / {emp.department.name}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Type contrat</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.contract_type}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Date embauche</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.hire_date}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Créé par</td>",
        f"<td style='padding:8px;'>{triggered_by}</td></tr>",
        "</table>",
    ])

    hr_emails = list(
        HRProfile.objects.filter(is_active=True)
        .exclude(email="")
        .filter(email__iendswith="@pb-industries.mg")  # exclude test/junk domains (test.com, blanks, etc.)
        .values_list("email", flat=True)
    )
    recipients = list({HELPDESK_EMAIL} | set(hr_emails))
    print(f"[EMAIL DEBUG] notify_employee_created recipients ({len(recipients)}): {recipients}")

    html = _base_html("Nouvel employé créé", body_html)
    _send(subject, html, text, recipients)
    _notify_inapp(subject, f"Employe: {emp.full_name} | Contrat: {emp.contract_type}", level="success", category="employee")
    
    
    
def notify_bulk_resiliation(employees: list, triggered_by: str = "Système"):
    """Fired after a CSV import that terminated one or more employees.
    employees is a list of dicts with keys:
    full_name, employee_id, factory, department, motif, termination_date
    """
    count = len(employees)
    subject = f"[RH] Import CSV — {count} résiliation(s) détectée(s)"
    rows = "".join([
        f"<tr>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{e['full_name']}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{e['employee_id']}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{e.get('factory', '—')} / {e.get('department', '—')}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{e.get('termination_date') or '—'}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{e.get('motif') or '—'}</td>"
        f"</tr>"
        for e in employees
    ])
    text = "\n".join([
        "Import CSV — résiliations détectées",
        f"Nombre : {count}",
        f"Déclenché par : {triggered_by}",
        f"Employés : {', '.join(e['full_name'] for e in employees)}",
    ])
    body_html = "".join([
        f"<p><strong>{count}</strong> employé(s) ont été "
        f"<strong style='color:#c62828;'>résiliés</strong> lors d'un import CSV.</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr style='background:#1565c0;color:#fff;'>",
        "<th style='padding:8px;text-align:left;'>Nom</th>",
        "<th style='padding:8px;text-align:left;'>Matricule</th>",
        "<th style='padding:8px;text-align:left;'>Usine / Dépt</th>",
        "<th style='padding:8px;text-align:left;'>Date fin</th>",
        "<th style='padding:8px;text-align:left;'>Motif</th></tr>",
        rows,
        "</table>",
        f"<p style='margin-top:12px;'>Déclenché par : <strong>{triggered_by}</strong></p>",
    ])
    html = _base_html("Résiliations import CSV", body_html)
    _send(subject, html, text, [HELPDESK_EMAIL])


# ─────────────────────────────────────────────────────────────
# Leave request notifications
# ─────────────────────────────────────────────────────────────

def notify_leave_created(leave, triggered_by: str = "Inconnu"):
    """Fired when a new leave request is created — notifies HR directors."""
    from accounts.models import HRProfile
    emp = leave.employee
    subject = f"[RH] Nouvelle demande de congé — {emp.full_name}"
    text = "\n".join([
        "Action : Nouvelle demande de congé",
        f"Employé : {emp.full_name} ({emp.employee_id})",
        f"Type : {leave.leave_type.name}",
        f"Du : {leave.start_date} au {leave.end_date}",
        f"Jours : {leave.days_requested}",
        f"Motif : {leave.reason or '—'}",
        f"Créé par : {triggered_by}",
    ])
    body_html = "".join([
        "<p>Une nouvelle demande de congé a été soumise et attend votre approbation.</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;width:200px;'>Employé</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.full_name} ({emp.employee_id})</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Type de congé</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{leave.leave_type.name}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Période</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{leave.start_date} → {leave.end_date} ({leave.days_requested} jours)</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Motif</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{leave.reason or '—'}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Soumis par</td>",
        f"<td style='padding:8px;'>{triggered_by}</td></tr>",
        "</table>",
        "<p style='margin-top:16px;'>Connectez-vous au système RH pour approuver ou rejeter cette demande.</p>",
    ])
    # Notify all HR directors
    directors = HRProfile.objects.filter(is_director=True).values_list("email", flat=True)
    recipients = [e for e in directors if e] or [HELPDESK_EMAIL]
    html = _base_html("Nouvelle demande de congé", body_html)
    _send(subject, html, text, recipients)
    _notify_inapp(subject, f"Employe: {emp.full_name} | {leave.leave_type.name} | {leave.start_date} -> {leave.end_date} ({leave.days_requested}j)", level="info", category="leave")


def notify_leave_approved(leave, approved_by: str = "Inconnu"):
    """Fired when a leave request is approved."""
    emp = leave.employee
    subject = f"[RH] Congé approuvé — {emp.full_name}"
    text = "\n".join([
        "Action : Demande de congé approuvée",
        f"Employé : {emp.full_name} ({emp.employee_id})",
        f"Type : {leave.leave_type.name}",
        f"Du : {leave.start_date} au {leave.end_date}",
        f"Jours : {leave.days_requested}",
        f"Approuvé par : {approved_by}",
    ])
    body_html = "".join([
        "<p>La demande de congé a été <strong style='color:#2e7d32;'>approuvée</strong>.</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;width:200px;'>Employé</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.full_name} ({emp.employee_id})</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Type de congé</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{leave.leave_type.name}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Période</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{leave.start_date} → {leave.end_date} ({leave.days_requested} jours)</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Approuvé par</td>",
        f"<td style='padding:8px;'>{approved_by}</td></tr>",
        "</table>",
    ])
    html = _base_html("Congé approuvé", body_html)
    from accounts.models import HRProfile
    directors = HRProfile.objects.filter(is_director=True).values_list("email", flat=True)
    recipients = [e for e in directors if e] or [HELPDESK_EMAIL]
    _send(subject, html, text, recipients)
    _notify_inapp(subject, f"Employe: {emp.full_name} | {leave.leave_type.name} | {leave.start_date} -> {leave.end_date}", level="success", category="leave")


def notify_leave_rejected(leave, rejected_by: str = "Inconnu", reason: str = ""):
    """Fired when a leave request is rejected."""
    emp = leave.employee
    subject = f"[RH] Congé rejeté — {emp.full_name}"
    text = "\n".join([
        "Action : Demande de congé rejetée",
        f"Employé : {emp.full_name} ({emp.employee_id})",
        f"Type : {leave.leave_type.name}",
        f"Du : {leave.start_date} au {leave.end_date}",
        f"Motif refus : {reason or '—'}",
        f"Rejeté par : {rejected_by}",
    ])
    body_html = "".join([
        "<p>La demande de congé a été <strong style='color:#c62828;'>rejetée</strong>.</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;width:200px;'>Employé</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.full_name} ({emp.employee_id})</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Type de congé</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{leave.leave_type.name}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Période</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{leave.start_date} → {leave.end_date} ({leave.days_requested} jours)</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Motif du refus</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;color:#c62828;'>{reason or '—'}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Rejeté par</td>",
        f"<td style='padding:8px;'>{rejected_by}</td></tr>",
        "</table>",
    ])
    html = _base_html("Congé rejeté", body_html)
    from accounts.models import HRProfile
    directors = HRProfile.objects.filter(is_director=True).values_list("email", flat=True)
    recipients = [e for e in directors if e] or [HELPDESK_EMAIL]
    _send(subject, html, text, recipients)
    _notify_inapp(subject, f"Employe: {emp.full_name} | {leave.leave_type.name} | Motif: {reason or chr(45)}", level="warning", category="leave")


# ─────────────────────────────────────────────────────────────
# Maternity leave notifications
# ─────────────────────────────────────────────────────────────

def notify_maternity_created(maternity, triggered_by: str = "Inconnu"):
    """Fired when a maternity leave is created — notifies ALL active HR users."""
    from accounts.models import HRProfile
    emp = maternity.employee
    subject = f"[RH] Congé maternité enregistré — {emp.full_name}"
    text = "\n".join([
        "Action : Congé maternité enregistré",
        f"Employée : {emp.full_name} ({emp.employee_id})",
        f"Début : {maternity.leave_start_date}",
        f"Fin prévue : {maternity.leave_end_date}",
        f"Enregistré par : {triggered_by}",
    ])
    body_html = "".join([
        "<p>Un congé maternité a été enregistré dans le système.</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;width:200px;'>Employée</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.full_name} ({emp.employee_id})</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Département</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.factory.name} / {emp.department.name}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Date de début</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{maternity.leave_start_date}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Fin prévue (98j)</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{maternity.leave_end_date}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Enregistré par</td>",
        f"<td style='padding:8px;'>{triggered_by}</td></tr>",
        "</table>",
    ])
    recipients = list(HRProfile.objects.filter(is_active=True).exclude(email="").values_list("email", flat=True)) or [HELPDESK_EMAIL]
    html = _base_html("Congé maternité enregistré", body_html)
    _send(subject, html, text, recipients)
    _notify_inapp(subject, f"Employe: {emp.full_name} | Debut: {maternity.leave_start_date} | Fin: {maternity.leave_end_date} | Par: {triggered_by}", level="info", category="maternity")


def notify_maternity_ending_soon(maternity, days_remaining: int):
    """Fired when a maternity leave is ending in <= 7 days."""
    from accounts.models import HRProfile
    emp = maternity.employee
    subject = f"[RH] Fin de congé maternité dans {days_remaining}j — {emp.full_name}"
    text = "\n".join([
        f"Alerte : Congé maternité se termine dans {days_remaining} jour(s)",
        f"Employée : {emp.full_name} ({emp.employee_id})",
        f"Fin prévue : {maternity.leave_end_date}",
    ])
    body_html = "".join([
        f"<p>Le congé maternité de <strong>{emp.full_name}</strong> se termine dans "
        f"<strong style='color:#e65100;'>{days_remaining} jour(s)</strong>.</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;width:200px;'>Employée</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.full_name} ({emp.employee_id})</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Département</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.factory.name} / {emp.department.name}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Fin prévue</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;color:#e65100;font-weight:bold;'>{maternity.leave_end_date}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Jours restants</td>",
        f"<td style='padding:8px;color:#c62828;font-weight:bold;'>{days_remaining}</td></tr>",
        "</table>",
        "<p style='margin-top:16px;'>Pensez à préparer le retour de l'employée.</p>",
    ])
    recipients = list(HRProfile.objects.filter(is_active=True).exclude(email="").values_list("email", flat=True)) or [HELPDESK_EMAIL]
    html = _base_html(f"Fin de congé maternité dans {days_remaining}j", body_html)
    _send(subject, html, text, recipients)
    _notify_inapp(subject, f"Employe: {emp.full_name} | Fin: {maternity.leave_end_date} | {days_remaining}j restants", level="warning", category="maternity")


# ─────────────────────────────────────────────────────────────
# In-app notification helper
# ─────────────────────────────────────────────────────────────

def _notify_inapp(title, message, level="info", category="system"):
    try:
        from alerts.models import InAppNotification
        from accounts.models import HRProfile
        user_ids = list(HRProfile.objects.values_list("auth_user_id", flat=True))
        if not user_ids:
            # Fallback: single broadcast if no HR profiles found
            InAppNotification.objects.create(
                auth_user_id=None,
                title=title,
                message=message,
                level=level,
                category=category,
            )
        else:
            for uid in user_ids:
                InAppNotification.objects.create(
                    auth_user_id=uid,
                    title=title,
                    message=message,
                    level=level,
                    category=category,
                )
    except Exception as exc:
        print(f"[INAPP ERROR] {title}: {exc}")


def notify_maternity_returned(maternity, triggered_by: str = "Inconnu"):
    """Fired when mark_returned is called."""
    from accounts.models import HRProfile
    emp = maternity.employee
    subject = f"[RH] Reprise travail maternité — {emp.full_name}"
    text = f"Reprise travail\nEmployée: {emp.full_name} ({emp.employee_id})\nDate retour: {maternity.actual_return_date}\nPar: {triggered_by}"
    body_html = "".join([
        f"<p><strong>{emp.full_name}</strong> a repris le travail après son congé maternité.</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;width:200px;'>Employée</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.full_name} ({emp.employee_id})</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Département</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.factory.name} / {emp.department.name}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Date de retour</td>",
        f"<td style='padding:8px;color:#2e7d32;font-weight:bold;'>{maternity.actual_return_date}</td></tr>",
        "</table>",
    ])
    recipients = list(HRProfile.objects.filter(is_active=True).exclude(email="").values_list("email", flat=True)) or [HELPDESK_EMAIL]
    html = _base_html("Reprise travail après maternité", body_html)
    _send(subject, html, text, recipients)
    _notify_inapp(subject, f"Employe: {emp.full_name} | Retour: {maternity.actual_return_date}", level="success", category="maternity")


def notify_maternity_extended(maternity, triggered_by: str = "Inconnu"):
    """Fired when extend is called."""
    from accounts.models import HRProfile
    emp = maternity.employee
    subject = f"[RH] Prolongation maternité — {emp.full_name}"
    text = f"Prolongation congé maternité\nEmployée: {emp.full_name} ({emp.employee_id})\nNouvelle fin: {maternity.extended_end_date}\nPar: {triggered_by}"
    body_html = "".join([
        f"<p>Le congé maternité de <strong>{emp.full_name}</strong> a été <strong style='color:#7b1fa2;'>prolongé</strong>.</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;width:200px;'>Employée</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{emp.full_name} ({emp.employee_id})</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Fin légale initiale</td>",
        f"<td style='padding:8px;border-bottom:1px solid #eee;'>{maternity.leave_end_date}</td></tr>",
        "<tr><td style='padding:8px;background:#f9f9f9;font-weight:bold;'>Nouvelle fin</td>",
        f"<td style='padding:8px;color:#7b1fa2;font-weight:bold;'>{maternity.extended_end_date}</td></tr>",
        "</table>",
    ])
    recipients = list(HRProfile.objects.filter(is_active=True).exclude(email="").values_list("email", flat=True)) or [HELPDESK_EMAIL]
    html = _base_html("Prolongation congé maternité", body_html)
    _send(subject, html, text, recipients)
    _notify_inapp(subject, f"Employe: {emp.full_name} | Nouvelle fin: {maternity.extended_end_date}", level="warning", category="maternity")




def notify_late_employees(factory, late_employees: list, recipients: list, cc: list = None):
    """late_employees: list of dicts {full_name, employee_id, department, job_title, arrival_time, minutes_late}
    recipients: list of email addresses — all get the SAME email (multiple 'To')."""
    count = len(late_employees)
    subject = f"[RH] Retards du jour — {factory.name} ({count})"

    rows = "".join(
        "<tr>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{e['full_name']}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{e['employee_id']}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{e.get('department','—')}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{e.get('job_title','—')}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;color:#c62828;font-weight:bold;'>{e.get('arrival_time','—')}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;'>{e.get('minutes_late','—')} min</td>"
        "</tr>"
        for e in late_employees
    )
    text = "\n".join([f"Retards du jour — {factory.name}", f"Nombre : {count}"] + [
        f"- {e['full_name']} ({e['employee_id']}) [{e.get('department','—')}] : {e.get('minutes_late','?')} min de retard"
        for e in late_employees
    ])
    body_html = "".join([
        f"<p><strong>{count}</strong> employé(s) en retard aujourd'hui pour <strong>{factory.name}</strong>.</p>",
        "<table style='border-collapse:collapse;width:100%;'>",
        "<tr style='background:#1565c0;color:#fff;'>",
        "<th style='padding:8px;text-align:left;'>Nom</th><th style='padding:8px;text-align:left;'>Matricule</th>",
        "<th style='padding:8px;text-align:left;'>Département</th><th style='padding:8px;text-align:left;'>Poste</th>",
        "<th style='padding:8px;text-align:left;'>Heure pointage</th>",
        "<th style='padding:8px;text-align:left;'>Retard</th></tr>",
        rows, "</table>",
    ])
    html = _base_html(f"Retards du jour — {factory.name}", body_html)
    _send(subject, html, text, recipients, cc=cc)   # ← was: _send(subject, html, text, recipients)
    _notify_inapp(subject, f"{factory.name} | {count} retard(s)", level="warning", category="attendance")