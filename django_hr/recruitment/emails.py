import logging
import mimetypes
from pathlib import Path

from django.conf import settings
from django.core.mail import (
    EmailMultiAlternatives,
)
from django.utils.html import escape

from django.utils import timezone

from django.db import models

from accounts.models import HRProfile

from .models import (
    CompteRenduEntretienCadre,
    Embauche,
    TachePreparationEmbauche,
)

from .services.compte_rendu_pdf import (
    generer_pdf_compte_rendu,
)


logger = logging.getLogger(__name__)


MESSAGE_TEST = (
    "CECI EST UN TEST MAIL POUR "
    "LE SYSTÈME DE RECRUTEMENT"
)


def nettoyer_destinataires(
    destinataires,
):
    """
    Supprime les adresses vides et les doublons.
    """

    if not destinataires:
        return []

    return sorted(
        {
            str(email).strip()
            for email in destinataires
            if email and str(email).strip()
        }
    )


def ajouter_bandeau_test_html(
    contenu_html,
):
    """
    Ajoute un grand bandeau rouge après
    l'ouverture de la balise body.
    """

    bandeau = f"""
    <div style="
        margin: 0 0 24px 0;
        padding: 22px;
        background-color: #fef2f2;
        border: 3px solid #dc2626;
        border-radius: 10px;
        color: #b91c1c;
        font-family: Arial, sans-serif;
        font-size: 22px;
        font-weight: 800;
        line-height: 1.4;
        text-align: center;
        text-transform: uppercase;
    ">
        {escape(MESSAGE_TEST)}
    </div>
    """

    position_body = contenu_html.find(
        "<body"
    )

    if position_body == -1:
        return bandeau + contenu_html

    position_fin_body = contenu_html.find(
        ">",
        position_body,
    )

    if position_fin_body == -1:
        return bandeau + contenu_html

    return (
        contenu_html[
            :position_fin_body + 1
        ]
        + bandeau
        + contenu_html[
            position_fin_body + 1:
        ]
    )


def envoyer_email(
    sujet,
    contenu_texte,
    contenu_html,
    destinataires,
    pieces_jointes=None,
):
    """
    Fonction commune pour tous les e-mails
    du recrutement.

    pieces_jointes doit contenir des tuples :
    (
        nom_fichier,
        contenu,
        type_mime,
    )
    """

    destinataires_valides = (
        nettoyer_destinataires(
            destinataires
        )
    )

    if not destinataires_valides:
        logger.warning(
            (
                "Aucun destinataire pour "
                "l’e-mail : %s"
            ),
            sujet,
        )

        return False

    sujet_test = f"[TEST] {sujet}"

    contenu_texte_test = (
        f"{'=' * 70}\n"
        f"{MESSAGE_TEST}\n"
        f"{'=' * 70}\n\n"
        f"{contenu_texte}"
    )

    contenu_html_test = (
        ajouter_bandeau_test_html(
            contenu_html
        )
    )

    try:
        message = EmailMultiAlternatives(
            subject=sujet_test,
            body=contenu_texte_test,
            from_email=(
                settings.DEFAULT_FROM_EMAIL
            ),
            to=destinataires_valides,
        )

        message.attach_alternative(
            contenu_html_test,
            "text/html",
        )

        for piece_jointe in (
            pieces_jointes or []
        ):
            nom_fichier = piece_jointe[0]
            contenu = piece_jointe[1]
            type_mime = piece_jointe[2]

            message.attach(
                nom_fichier,
                contenu,
                type_mime,
            )

        message.send(
            fail_silently=False
        )

        logger.info(
            "E-mail envoyé à %s : %s",
            ", ".join(
                destinataires_valides
            ),
            sujet_test,
        )

        return True

    except Exception:
        logger.exception(
            (
                "Erreur pendant l’envoi "
                "de l’e-mail : %s"
            ),
            sujet_test,
        )

        return False


def emails_directeurs_rh():
    """Adresses des DRH responsables de l'approbation finale."""

    return list(
        HRProfile.objects
        .filter(
            is_director=True,
            is_active=True,
        )
        .exclude(email="")
        .exclude(
            email__iexact=(
                "Aya-ennour.Ely@pb-industries.mg"
            )
        )
        .values_list(
            "email",
            flat=True,
        )
    )


def emails_directeurs_recrutement():
    """Adresses des directeurs chargés de la première validation."""

    return list(
        HRProfile.objects
        .filter(
            perm_recruitment_validate=True,
            is_active=True,
        )
        .exclude(email="")
        .values_list(
            "email",
            flat=True,
        )
    )


def notifier_nouvelle_demande(
    demande,
):
    """
    Informe les directeurs qu'une nouvelle
    demande attend leur validation.
    """

    destinataires = (
        emails_directeurs_recrutement()
    )

    motif = (
        demande.get_motif_display()
    )

    if demande.motif_remplacement:
        motif_remplacement = (
            demande
            .get_motif_remplacement_display()
        )
    else:
        motif_remplacement = "—"

    poste = (
        demande.poste.name
        if demande.poste
        else "Non renseigné"
    )

    departement = (
        demande.departement.name
        if demande.departement
        else "Non renseigné"
    )

    site = (
        demande.factory.name
        if demande.factory
        else "Non renseigné"
    )

    url_validation = (
        f"{settings.FRONTEND_URL.rstrip('/')}"
        f"/hr/recrutement/demandes/"
        f"{demande.id}/validation"
    )

    sujet = (
        "[Recrutement] Nouvelle demande "
        f"{demande.reference}"
    )

    contenu_texte = (
        "Une nouvelle demande de recrutement "
        "attend votre validation.\n\n"
        f"Référence : {demande.reference}\n"
        f"Demandeur : {demande.nom_demandeur}\n"
        "Matricule : "
        f"{demande.matricule_demandeur}\n"
        f"Poste demandé : {poste}\n"
        f"Département : {departement}\n"
        f"Site : {site}\n"
        f"Nombre CDI : {demande.nombre_cdi}\n"
        f"Nombre CDD : {demande.nombre_cdd}\n"
        f"Nombre total : {demande.nombre_total}\n"
        f"Motif : {motif}\n"
        "Motif du remplacement : "
        f"{motif_remplacement}\n"
        "Date prévue : "
        f"{demande.date_prevue_recrutement}\n"
        "\nPour consulter et traiter "
        "la demande :\n"
        f"{url_validation}\n"
    )

    contenu_html = f"""
    <html>
      <body style="
        margin: 0;
        padding: 24px;
        background: #f1f5f9;
        font-family: Arial, sans-serif;
      ">
        <div style="
          max-width: 700px;
          margin: auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        ">
          <div style="
            padding: 20px 24px;
            background: #2563eb;
            color: white;
          ">
            <h2 style="margin: 0;">
              Nouvelle demande de recrutement
            </h2>

            <p style="
              margin: 8px 0 0;
              opacity: 0.9;
            ">
              {escape(demande.reference)}
            </p>
          </div>

          <div style="padding: 24px;">
            <p>
              Une nouvelle demande attend
              votre validation.
            </p>

            <table style="
              width: 100%;
              border-collapse: collapse;
            ">
              <tr>
                <td style="{style_label()}">
                  Demandeur
                </td>
                <td style="{style_value()}">
                  {escape(
                      demande.nom_demandeur
                      or "Non renseigné"
                  )}
                </td>
              </tr>

              <tr>
                <td style="{style_label()}">
                  Matricule
                </td>
                <td style="{style_value()}">
                  {escape(
                      demande.matricule_demandeur
                      or "Non renseigné"
                  )}
                </td>
              </tr>

              <tr>
                <td style="{style_label()}">
                  Poste demandé
                </td>
                <td style="{style_value()}">
                  {escape(poste)}
                </td>
              </tr>

              <tr>
                <td style="{style_label()}">
                  Département
                </td>
                <td style="{style_value()}">
                  {escape(departement)}
                </td>
              </tr>

              <tr>
                <td style="{style_label()}">
                  Site
                </td>
                <td style="{style_value()}">
                  {escape(site)}
                </td>
              </tr>

              <tr>
                <td style="{style_label()}">
                  Répartition
                </td>
                <td style="{style_value()}">
                  {demande.nombre_cdi} CDI /
                  {demande.nombre_cdd} CDD
                </td>
              </tr>

              <tr>
                <td style="{style_label()}">
                  Nombre total
                </td>
                <td style="{style_value()}">
                  {demande.nombre_total}
                </td>
              </tr>

              <tr>
                <td style="{style_label()}">
                  Motif
                </td>
                <td style="{style_value()}">
                  {escape(motif)}
                </td>
              </tr>

              <tr>
                <td style="{style_label()}">
                  Motif du remplacement
                </td>
                <td style="{style_value()}">
                  {escape(motif_remplacement)}
                </td>
              </tr>

              <tr>
                <td style="{style_label()}">
                  Date prévue
                </td>
                <td style="{style_value()}">
                  {demande.date_prevue_recrutement}
                </td>
              </tr>
            </table>

            <div style="
              margin-top: 24px;
              text-align: center;
            ">
              <a href="{escape(url_validation)}" style="
                display: inline-block;
                padding: 12px 20px;
                border-radius: 8px;
                background: #2563eb;
                color: white;
                text-decoration: none;
                font-weight: bold;
              ">
                Examiner et valider la demande
              </a>
            </div>

            <p style="
              margin-top: 18px;
              color: #64748b;
              font-size: 12px;
              word-break: break-all;
            ">
              Si le bouton ne fonctionne pas, copiez ce lien :<br>
              {escape(url_validation)}
            </p>
          </div>
        </div>
      </body>
    </html>
    """

    return envoyer_email(
        sujet=sujet,
        contenu_texte=contenu_texte,
        contenu_html=contenu_html,
        destinataires=destinataires,
    )


def notifier_validation_directeur_au_drh(
    demande,
):
    """
    Informe le DRH que le directeur a validé la demande
    et que l'approbation finale est maintenant attendue.
    """

    destinataires = emails_directeurs_rh()

    if not destinataires:
        logger.warning(
            "Aucun DRH actif avec une adresse e-mail "
            "pour la demande %s.",
            demande.reference,
        )
        return False

    poste = (
        demande.poste.name
        if demande.poste
        else "Non renseigné"
    )

    departement = (
        demande.departement.name
        if demande.departement
        else "Non renseigné"
    )

    site = (
        demande.factory.name
        if demande.factory
        else "Non renseigné"
    )

    validateur = ""

    if demande.decide_par:
        validateur = (
            getattr(
                demande.decide_par,
                "nom_complet",
                "",
            )
            or demande.decide_par.username
            or demande.decide_par.email
        )

    validateur = validateur or "Directeur non renseigné"

    url_approbation = (
        f"{settings.FRONTEND_URL.rstrip('/')}"
        f"/hr/recrutement/demandes/"
        f"{demande.id}/approbation-drh"
    )

    sujet = (
        "[Recrutement] Approbation DRH requise — "
        f"{demande.reference}"
    )

    contenu_texte = (
        "Le directeur a validé une demande de recrutement.\n"
        "Votre approbation finale est maintenant requise.\n\n"
        f"Référence : {demande.reference}\n"
        f"Demandeur : {demande.nom_demandeur}\n"
        f"Poste demandé : {poste}\n"
        f"Département : {departement}\n"
        f"Site : {site}\n"
        f"Nombre total : {demande.nombre_total}\n"
        f"Validée par : {validateur}\n"
        "Commentaire du directeur : "
        f"{demande.motif_decision or '—'}\n\n"
        "Pour approuver ou refuser la demande :\n"
        f"{url_approbation}\n"
    )

    contenu_html = f"""
    <html>
      <body style="
        margin: 0;
        padding: 24px;
        background: #f1f5f9;
        font-family: Arial, sans-serif;
      ">
        <div style="
          max-width: 700px;
          margin: auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        ">
          <div style="
            padding: 20px 24px;
            background: #7c3aed;
            color: white;
          ">
            <h2 style="margin: 0;">
              Approbation du DRH requise
            </h2>
            <p style="margin: 8px 0 0; opacity: 0.9;">
              {escape(demande.reference)}
            </p>
          </div>

          <div style="padding: 24px;">
            <p>
              Le directeur a validé cette demande.
              Elle attend maintenant votre approbation finale.
            </p>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="{style_label()}">Demandeur</td>
                <td style="{style_value()}">
                  {escape(demande.nom_demandeur or "Non renseigné")}
                </td>
              </tr>
              <tr>
                <td style="{style_label()}">Poste demandé</td>
                <td style="{style_value()}">{escape(poste)}</td>
              </tr>
              <tr>
                <td style="{style_label()}">Département</td>
                <td style="{style_value()}">{escape(departement)}</td>
              </tr>
              <tr>
                <td style="{style_label()}">Site</td>
                <td style="{style_value()}">{escape(site)}</td>
              </tr>
              <tr>
                <td style="{style_label()}">Nombre total</td>
                <td style="{style_value()}">{demande.nombre_total}</td>
              </tr>
              <tr>
                <td style="{style_label()}">Validée par</td>
                <td style="{style_value()}">{escape(validateur)}</td>
              </tr>
              <tr>
                <td style="{style_label()}">Commentaire</td>
                <td style="{style_value()}">
                  {escape(demande.motif_decision or "—")}
                </td>
              </tr>
            </table>

            <div style="margin-top: 24px; text-align: center;">
              <a href="{escape(url_approbation)}" style="
                display: inline-block;
                padding: 12px 20px;
                border-radius: 8px;
                background: #7c3aed;
                color: white;
                text-decoration: none;
                font-weight: bold;
              ">
                Examiner la demande
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
    """

    return envoyer_email(
        sujet=sujet,
        contenu_texte=contenu_texte,
        contenu_html=contenu_html,
        destinataires=destinataires,
    )


def notifier_decision_demande(
    demande,
):
    """
    Informe le demandeur de la décision prise
    concernant sa demande.
    """

    if (
        not demande.demandeur
        or not demande.demandeur.email
    ):
        logger.warning(
            (
                "Aucun e-mail pour le demandeur "
                "de la demande %s."
            ),
            demande.reference,
        )

        return False

    destinataires = [
        demande.demandeur.email
    ]

    statut = (
        demande.get_statut_display()
    )

    poste = (
        demande.poste.name
        if demande.poste
        else "Non renseigné"
    )

    sujet = (
        "[Recrutement] Décision concernant "
        f"{demande.reference}"
    )

    observation = (
        demande.commentaire_drh
        or demande.motif_decision
        or "—"
    )

    contenu_texte = (
        "Une décision a été prise concernant "
        "votre demande de recrutement.\n\n"
        f"Référence : {demande.reference}\n"
        f"Poste : {poste}\n"
        f"Décision : {statut}\n"
        "Observation : "
        f"{observation}\n"
    )

    couleur = (
        "#16a34a"
        if demande.statut
        == demande.Statut.VALIDEE
        else "#dc2626"
    )

    contenu_html = f"""
    <html>
      <body style="
        margin: 0;
        padding: 24px;
        background: #f1f5f9;
        font-family: Arial, sans-serif;
      ">
        <div style="
          max-width: 650px;
          margin: auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        ">
          <div style="
            padding: 20px 24px;
            background: {couleur};
            color: white;
          ">
            <h2 style="margin: 0;">
              Décision de recrutement
            </h2>

            <p style="
              margin: 8px 0 0;
              opacity: 0.9;
            ">
              {escape(demande.reference)}
            </p>
          </div>

          <div style="padding: 24px;">
            <p>
              Bonjour
              {escape(
                  demande.nom_demandeur
                  or ""
              )},
            </p>

            <p>
              Votre demande pour le poste
              <strong>{escape(poste)}</strong>
              a reçu la décision suivante :
            </p>

            <p style="
              padding: 12px;
              border-radius: 8px;
              background: #f8fafc;
              color: {couleur};
              font-weight: bold;
            ">
              {escape(statut)}
            </p>

            <p>
              <strong>Observation :</strong>
              {escape(
                  observation
              )}
            </p>
          </div>
        </div>
      </body>
    </html>
    """

    return envoyer_email(
        sujet=sujet,
        contenu_texte=contenu_texte,
        contenu_html=contenu_html,
        destinataires=destinataires,
    )


def envoyer_compte_rendu_cadre(
    compte_rendu,
):
    """
    Envoie le compte rendu d'entretien cadre
    au DRH avec le PDF en pièce jointe.
    """

    destinataires = nettoyer_destinataires(
        getattr(
            settings,
            "DRH_EMAILS",
            [],
        )
    )

    if not destinataires:
        logger.warning(
            (
                "Aucune adresse DRH configurée "
                "pour le compte rendu %s."
            ),
            compte_rendu.pk,
        )

        return False

    candidat = compte_rendu.candidat
    processus = candidat.processus
    demande = processus.demande

    poste = (
        demande.poste.name
        if demande.poste
        else "Non renseigné"
    )

    decision = (
        compte_rendu
        .get_decision_finale_display()
        if compte_rendu.decision_finale
        else "Non renseignée"
    )

    reference = (
        compte_rendu.reference
        or f"CR-{compte_rendu.pk}"
    )

    sujet = (
        "[Recrutement cadre] Compte rendu "
        f"{reference}"
    )

    contenu_texte = (
        "Un compte rendu d’entretien cadre "
        "est disponible.\n\n"
        f"Référence : {reference}\n"
        f"Candidat : {candidat.nom_complet}\n"
        f"Poste : {poste}\n"
        f"Décision : {decision}\n\n"
        "Le compte rendu complet est joint "
        "à cet e-mail au format PDF."
    )

    contenu_html = f"""
    <html>
      <body style="
        margin: 0;
        padding: 24px;
        background: #f1f5f9;
        font-family: Arial, sans-serif;
      ">
        <div style="
          max-width: 650px;
          margin: auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        ">
          <div style="
            padding: 20px 24px;
            background: #7c3aed;
            color: white;
          ">
            <h2 style="margin: 0;">
              Compte rendu d’entretien cadre
            </h2>

            <p style="
              margin: 8px 0 0;
              opacity: 0.9;
            ">
              {escape(reference)}
            </p>
          </div>

          <div style="padding: 24px;">
            <p>
              Un nouveau compte rendu
              d’entretien a été validé.
            </p>

            <table style="
              width: 100%;
              border-collapse: collapse;
            ">
              <tr>
                <td style="{style_label()}">
                  Candidat
                </td>
                <td style="{style_value()}">
                  {escape(candidat.nom_complet)}
                </td>
              </tr>

              <tr>
                <td style="{style_label()}">
                  Poste
                </td>
                <td style="{style_value()}">
                  {escape(poste)}
                </td>
              </tr>

              <tr>
                <td style="{style_label()}">
                  Décision
                </td>
                <td style="{style_value()}">
                  <strong>
                    {escape(decision)}
                  </strong>
                </td>
              </tr>
            </table>

            <p style="margin-top: 20px;">
              Le compte rendu complet est joint
              à cet e-mail au format PDF.
            </p>
          </div>
        </div>
      </body>
    </html>
    """

    try:
        contenu_pdf = (
            generer_pdf_compte_rendu(
                compte_rendu
            )
        )
    except Exception:
        logger.exception(
            (
                "Impossible de générer le PDF "
                "du compte rendu %s."
            ),
            compte_rendu.pk,
        )

        return False

    nom_pdf = f"{reference}.pdf"

    return envoyer_email(
        sujet=sujet,
        contenu_texte=contenu_texte,
        contenu_html=contenu_html,
        destinataires=destinataires,
        pieces_jointes=[
            (
                nom_pdf,
                contenu_pdf,
                "application/pdf",
            )
        ],
    )


def notifier_services_preparation_cadre(
    candidat,
    taches,
):
    """
    Envoie un e-mail distinct aux services :
    IT, Comptabilité et Responsable RH.
    """

    taches = list(taches)

    if not taches:
        logger.warning(
            (
                "Aucune tâche de préparation "
                "pour le candidat %s."
            ),
            candidat.pk,
        )

        return {}

    configuration_services = {
        TachePreparationEmbauche.Service.IT: {
            "nom": "Service IT",
            "destinataires": getattr(
                settings,
                "RECRUTEMENT_IT_EMAILS",
                [],
            ),
        },
        (
            TachePreparationEmbauche
            .Service.COMPTABILITE
        ): {
            "nom": "Service Comptabilité",
            "destinataires": getattr(
                settings,
                (
                    "RECRUTEMENT_"
                    "COMPTABILITE_EMAILS"
                ),
                [],
            ),
        },
        TachePreparationEmbauche.Service.RH: {
            "nom": "Responsable RH",
            "destinataires": getattr(
                settings,
                "RECRUTEMENT_RRH_EMAILS",
                [],
            ),
        },
    }

    processus = candidat.processus
    demande = processus.demande

    poste = (
        demande.poste.name
        if demande.poste
        else "Non renseigné"
    )

    site = (
        demande.factory.name
        if demande.factory
        else "Non renseigné"
    )

    resultats = {}

    for service, configuration in (
        configuration_services.items()
    ):
        nom_service = configuration["nom"]

        destinataires = (
            nettoyer_destinataires(
                configuration[
                    "destinataires"
                ]
            )
        )

        taches_service = [
            tache
            for tache in taches
            if tache.service == service
        ]

        if not taches_service:
            continue

        if not destinataires:
          message_erreur = (
              "Aucun destinataire configuré "
              f"pour {nom_service}."
          )

          logger.warning(
              "%s Candidat : %s.",
              message_erreur,
              candidat.nom_complet,
          )

          identifiants_taches = [
              tache.pk
              for tache in taches_service
          ]

          TachePreparationEmbauche.objects.filter(
              pk__in=identifiants_taches
          ).update(
              notification_email_envoyee=False,
              destinataires_notification=[],
              erreur_notification=(
                  message_erreur
              ),
              nombre_tentatives_notification=(
                  models.F(
                      "nombre_tentatives_notification"
                  )
                  + 1
              ),
          )

          resultats[service] = {
              "envoye": False,
              "destinataires": [],
              "erreur": message_erreur,
          }

          continue

        liste_taches_texte = "\n".join(
            (
                f"- {tache.libelle}"
                for tache in taches_service
            )
        )

        liste_taches_html = "".join(
            (
                "<li style='margin-bottom: 8px;'>"
                f"{escape(tache.libelle)}"
                "</li>"
                for tache in taches_service
            )
        )

        sujet = (
            "[Recrutement] Préparation de "
            f"l’embauche de "
            f"{candidat.nom_complet}"
        )

        contenu_texte = (
            f"Bonjour,\n\n"
            f"Le candidat "
            f"{candidat.nom_complet} "
            f"a été retenu pour le poste "
            f"de {poste}.\n\n"
            f"Référence : "
            f"{demande.reference}\n"
            f"Site : {site}\n\n"
            f"Tâches attribuées au "
            f"{nom_service} :\n"
            f"{liste_taches_texte}\n\n"
            f"Merci de réaliser ces "
            f"préparations avant la date "
            f"de prise de poste.\n\n"
            f"Cordialement,\n"
            f"Système RH"
        )

        contenu_html = f"""
        <html>
          <body style="
            margin: 0;
            padding: 24px;
            background: #f1f5f9;
            font-family: Arial, sans-serif;
          ">
            <div style="
              max-width: 700px;
              margin: auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              border: 1px solid #e2e8f0;
            ">
              <div style="
                padding: 20px 24px;
                background: #0f766e;
                color: white;
              ">
                <h2 style="margin: 0;">
                  Préparation d’une embauche
                </h2>

                <p style="
                  margin: 8px 0 0;
                  opacity: 0.9;
                ">
                  {escape(nom_service)}
                </p>
              </div>

              <div style="padding: 24px;">
                <p>Bonjour,</p>

                <p>
                  Le candidat
                  <strong>
                    {escape(
                        candidat.nom_complet
                    )}
                  </strong>
                  a été retenu pour le poste de
                  <strong>
                    {escape(poste)}
                  </strong>.
                </p>

                <table style="
                  width: 100%;
                  border-collapse: collapse;
                  margin: 20px 0;
                ">
                  <tr>
                    <td style="{style_label()}">
                      Référence
                    </td>
                    <td style="{style_value()}">
                      {escape(
                          demande.reference
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td style="{style_label()}">
                      Candidat
                    </td>
                    <td style="{style_value()}">
                      {escape(
                          candidat.nom_complet
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td style="{style_label()}">
                      Poste
                    </td>
                    <td style="{style_value()}">
                      {escape(poste)}
                    </td>
                  </tr>

                  <tr>
                    <td style="{style_label()}">
                      Site
                    </td>
                    <td style="{style_value()}">
                      {escape(site)}
                    </td>
                  </tr>
                </table>

                <h3>
                  Tâches destinées au
                  {escape(nom_service)}
                </h3>

                <ul>
                  {liste_taches_html}
                </ul>

                <p>
                  Merci de réaliser ces
                  préparations avant la date
                  de prise de poste.
                </p>

                <p>
                  Cordialement,<br>
                  <strong>Système RH</strong>
                </p>
              </div>
            </div>
          </body>
        </html>
        """

        envoye = envoyer_email(
            sujet=sujet,
            contenu_texte=contenu_texte,
            contenu_html=contenu_html,
            destinataires=destinataires,
        )

        message_erreur = (
            ""
            if envoye
            else (
                "L’envoi de la notification "
                "a échoué. Consultez les logs "
                "du serveur pour obtenir le détail."
            )
        )

        identifiants_taches = [
            tache.pk
            for tache in taches_service
        ]

        valeurs_mise_a_jour = {
            "notification_email_envoyee": (
                envoye
            ),
            "destinataires_notification": (
                destinataires
            ),
            "erreur_notification": (
                message_erreur
            ),
        }

        if envoye:
            valeurs_mise_a_jour[
                "date_notification_email"
            ] = timezone.now()

        TachePreparationEmbauche.objects.filter(
            pk__in=identifiants_taches
        ).update(
            nombre_tentatives_notification=(
                models.F(
                    "nombre_tentatives_notification"
                )
                + 1
            ),
            **valeurs_mise_a_jour,
        )

        resultats[service] = {
            "envoye": envoye,
            "destinataires": destinataires,
            "erreur": message_erreur,
        }

    return resultats


def _charger_document_onboarding(
    chemin_configure,
    nom_par_defaut,
):
    """Charge un document à joindre à l'e-mail d'onboarding."""
    if not chemin_configure:
        raise FileNotFoundError(
            f"Le chemin du document « {nom_par_defaut} » "
            "n’est pas configuré."
        )

    chemin = Path(chemin_configure)

    if not chemin.is_file():
        raise FileNotFoundError(
            f"Le document « {nom_par_defaut} » est introuvable : "
            f"{chemin}."
        )

    type_mime = (
        mimetypes.guess_type(chemin.name)[0]
        or "application/octet-stream"
    )

    return (
        chemin.name or nom_par_defaut,
        chemin.read_bytes(),
        type_mime,
    )


def envoyer_documents_onboarding_cadre(embauche):
    """
    Envoie le règlement intérieur et le Code de la société au
    candidat cadre, puis conserve une trace complète de la tentative.

    Réglages attendus dans settings.py :
        RECRUTEMENT_RI_PATH
        RECRUTEMENT_CODE_SOCIETE_PATH
    """
    candidat = embauche.candidat
    processus = candidat.processus
    demande = processus.demande
    destinataires = nettoyer_destinataires([candidat.email])

    # Évite un double envoi lors d'un double clic ou d'une nouvelle
    # tentative de confirmation de la même embauche.
    if embauche.documents_cadre_email_envoyes:
        return {
            "envoye": True,
            "deja_envoye": True,
            "destinataires": (
                embauche.destinataires_documents_cadre
                or destinataires
            ),
            "erreur": "",
        }

    # La tentative est comptabilisée même si la configuration est invalide.
    Embauche.objects.filter(pk=embauche.pk).update(
        nombre_tentatives_envoi_documents_cadre=(
            models.F("nombre_tentatives_envoi_documents_cadre") + 1
        )
    )
    embauche.nombre_tentatives_envoi_documents_cadre += 1

    def enregistrer_echec(message):
        Embauche.objects.filter(pk=embauche.pk).update(
            documents_cadre_email_envoyes=False,
            date_envoi_documents_cadre=None,
            destinataires_documents_cadre=destinataires,
            erreur_envoi_documents_cadre=message,
        )

        embauche.documents_cadre_email_envoyes = False
        embauche.date_envoi_documents_cadre = None
        embauche.destinataires_documents_cadre = destinataires
        embauche.erreur_envoi_documents_cadre = message

        logger.warning(
            "Documents d’onboarding non envoyés pour l’embauche %s : %s",
            embauche.pk,
            message,
        )

        return {
            "envoye": False,
            "destinataires": destinataires,
            "erreur": message,
        }

    if not embauche.est_cadre:
        return enregistrer_echec(
            "L’envoi du RI et du Code société est réservé aux cadres."
        )

    if not destinataires:
        return enregistrer_echec(
            "Le candidat cadre ne possède aucune adresse e-mail."
        )

    try:
        pieces_jointes = [
            _charger_document_onboarding(
                getattr(settings, "RECRUTEMENT_RI_PATH", ""),
                "reglement-interieur.pdf",
            ),
            _charger_document_onboarding(
                getattr(
                    settings,
                    "RECRUTEMENT_CODE_SOCIETE_PATH",
                    "",
                ),
                "code-societe.pdf",
            ),
        ]
    except (OSError, ValueError) as erreur:
        return enregistrer_echec(str(erreur))

    poste = (
        demande.poste.name
        if demande.poste
        else "Non renseigné"
    )

    sujet = (
        "[Recrutement] Documents d’intégration — "
        f"{demande.reference}"
    )

    contenu_texte = (
        f"Bonjour {candidat.nom_complet},\n\n"
        "Votre embauche a été validée. Vous trouverez en pièces "
        "jointes le règlement intérieur et le Code de la société.\n\n"
        f"Référence : {demande.reference}\n"
        f"Poste : {poste}\n"
        f"Date de prise de poste : {embauche.date_debut_contrat}\n\n"
        "Cordialement,\nSystème RH"
    )

    contenu_html = f"""
    <html>
      <body style="margin:0;padding:24px;background:#f1f5f9;
                   font-family:Arial,sans-serif;">
        <div style="max-width:700px;margin:auto;background:white;
                    border:1px solid #e2e8f0;border-radius:12px;
                    overflow:hidden;">
          <div style="padding:20px 24px;background:#2563eb;color:white;">
            <h2 style="margin:0;">Documents d’intégration</h2>
            <p style="margin:8px 0 0;">{escape(demande.reference)}</p>
          </div>
          <div style="padding:24px;">
            <p>Bonjour <strong>{escape(candidat.nom_complet)}</strong>,</p>
            <p>
              Votre embauche a été validée pour le poste de
              <strong>{escape(poste)}</strong>.
            </p>
            <p>
              Vous trouverez en pièces jointes le règlement intérieur
              et le Code de la société.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
              <tr>
                <td style="{style_label()}">Date de prise de poste</td>
                <td style="{style_value()}">
                  {escape(str(embauche.date_debut_contrat))}
                </td>
              </tr>
            </table>
            <p>Cordialement,<br><strong>Système RH</strong></p>
          </div>
        </div>
      </body>
    </html>
    """

    envoye = envoyer_email(
        sujet=sujet,
        contenu_texte=contenu_texte,
        contenu_html=contenu_html,
        destinataires=destinataires,
        pieces_jointes=pieces_jointes,
    )

    if not envoye:
        return enregistrer_echec(
            "L’envoi de l’e-mail d’onboarding a échoué. "
            "Consultez les logs du serveur."
        )

    date_envoi = timezone.now()

    Embauche.objects.filter(pk=embauche.pk).update(
        documents_cadre_email_envoyes=True,
        date_envoi_documents_cadre=date_envoi,
        destinataires_documents_cadre=destinataires,
        erreur_envoi_documents_cadre="",
        reglement_interieur_communique=True,
        code_societe_communique=True,
    )

    embauche.documents_cadre_email_envoyes = True
    embauche.date_envoi_documents_cadre = date_envoi
    embauche.destinataires_documents_cadre = destinataires
    embauche.erreur_envoi_documents_cadre = ""
    embauche.reglement_interieur_communique = True
    embauche.code_societe_communique = True

    return {
        "envoye": True,
        "destinataires": destinataires,
        "erreur": "",
    }


def style_label():
    """
    Style des cellules de titre dans
    les tableaux HTML des e-mails.
    """

    return (
        "padding: 10px;"
        "border: 1px solid #e2e8f0;"
        "background: #f8fafc;"
        "font-weight: bold;"
        "width: 38%;"
    )


def style_value():
    """
    Style des cellules contenant les valeurs.
    """

    return (
        "padding: 10px;"
        "border: 1px solid #e2e8f0;"
    )
