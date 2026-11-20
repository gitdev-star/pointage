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
    """Un mail avec le détail en CSV joint.
    rows : [{full_name, employee_id, factory, department, overtime_hours}]
    La règle affichée vient des settings (40h + 20h tolérées), pas de --limit."""
    import csv
    import io
    import logging
    import re
    from django.conf import settings
    from django.core.mail import EmailMultiAlternatives

    normal_h = float(settings.OVERTIME_NORMAL_HOURS)
    limit_h = float(settings.OVERTIME_LIMIT_HOURS)
    tolerated_h = limit_h - normal_h
    count = len(rows)
    sfx = f" — {scope}" if scope else ""
    subject = f"[RH] Plafond d'heures supplémentaires atteint — {periode_label}{sfx} ({count})"

    def dec(v):
        return f"{v:.2f}".replace(".", ",")

    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["Nom", "Matricule", "Groupe de pointeuses", "Département",
                "HS cumulées (heures)", "HS cumulées (h min)",
                f"Normales (jusqu'à {normal_h:g}h)", f"Tolérées ({tolerated_h:g}h max)",
                f"Au-delà de {limit_h:g}h", "Statut"])
    for r in sorted(rows, key=lambda r: -r["overtime_hours"]):
        h = float(r["overtime_hours"])
        statut = ("Dépassé" if h > limit_h else "Atteint" if h >= limit_h
                  else "Sous le plafond (test)")
        w.writerow([r["full_name"], r["employee_id"], r["factory"], r["department"],
                    dec(h), format_heures(h),
                    dec(min(h, normal_h)),
                    dec(min(max(h - normal_h, 0.0), tolerated_h)),
                    dec(max(h - limit_h, 0.0)), statut])

    slug = re.sub(r"[^A-Za-z0-9]+", "_", f"{periode_label}_{scope}").strip("_")
    filename = f"heures_sup_{slug}.csv"

    body_html = (
        "<p>Bonjour,</p>"
        f"<p><strong>{count}</strong> employé(s) ont atteint le plafond d'heures "
        f"supplémentaires pour <strong>{periode_label}</strong>{sfx}.</p>"
        f"<p>Règle : <strong>{normal_h:g}h normales</strong> + "
        f"<strong>{tolerated_h:g}h tolérées</strong> (plafond {limit_h:g}h d'heures "
        "supplémentaires cumulées sur le mois).</p>"
        "<p>Le détail par employé est dans le fichier CSV joint (ouvrable dans Excel).</p>"
        "<p style='margin-top:12px;'>Cordialement,<br>Systeme RH</p>"
    )
    text = (f"{count} employé(s) ont atteint le plafond d'heures supplémentaires "
            f"({normal_h:g}h normales + {tolerated_h:g}h tolérées = {limit_h:g}h) "
            f"pour {periode_label}{sfx}. Détail en pièce jointe (CSV).")
    html = _base_html(f"Plafond heures supplémentaires — {periode_label}", body_html)

    try:
        msg = EmailMultiAlternatives(subject, text, None, list(recipients))
        msg.attach_alternative(html, "text/html")
        msg.attach(filename, buf.getvalue().encode("utf-8-sig"), "text/csv")
        msg.send(fail_silently=False)
        return True
    except Exception:
        logging.getLogger(__name__).exception("Echec envoi alerte plafond HS")
        return False
