from io import BytesIO
from xml.sax.saxutils import escape

from django.utils.formats import (
    date_format,
)

from reportlab.lib import colors
from reportlab.lib.enums import (
    TA_CENTER,
)
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import (
    ParagraphStyle,
    getSampleStyleSheet,
)
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def formater_date(value):
    if not value:
        return "—"

    return date_format(
        value,
        format="d F Y",
        use_l10n=True,
    )


def formater_texte(value):
    if value in [None, ""]:
        return "—"

    return escape(
        str(value)
    ).replace(
        "\n",
        "<br/>",
    )


def formater_salaire(
    montant,
    devise,
):
    if montant is None:
        return "—"

    montant_formate = (
        f"{montant:,.2f}"
        .replace(",", " ")
        .replace(".", ",")
    )

    return (
        f"{montant_formate} "
        f"{devise or 'MGA'}"
    )


def ajouter_entete_pied_page(
    canvas,
    document,
    compte_rendu,
):
    canvas.saveState()

    largeur, hauteur = A4

    canvas.setFont(
        "Helvetica",
        8,
    )

    canvas.setFillColor(
        colors.HexColor("#64748B")
    )

    canvas.drawString(
        18 * mm,
        hauteur - 12 * mm,
        (
            "Compte rendu "
            "d’entretien cadre"
        ),
    )

    canvas.drawRightString(
        largeur - 18 * mm,
        hauteur - 12 * mm,
        compte_rendu.reference,
    )

    canvas.setStrokeColor(
        colors.HexColor("#CBD5E1")
    )

    canvas.line(
        18 * mm,
        hauteur - 15 * mm,
        largeur - 18 * mm,
        hauteur - 15 * mm,
    )

    canvas.line(
        18 * mm,
        15 * mm,
        largeur - 18 * mm,
        15 * mm,
    )

    canvas.drawString(
        18 * mm,
        10 * mm,
        (
            "Document confidentiel — "
            "Direction des Ressources Humaines"
        ),
    )

    canvas.drawRightString(
        largeur - 18 * mm,
        10 * mm,
        f"Page {document.page}",
    )

    if compte_rendu.est_brouillon:
        canvas.saveState()

        canvas.setFillColorRGB(
            0.8,
            0.1,
            0.1,
            alpha=0.12,
        )

        canvas.setFont(
            "Helvetica-Bold",
            62,
        )

        canvas.translate(
            largeur / 2,
            hauteur / 2,
        )

        canvas.rotate(38)

        canvas.drawCentredString(
            0,
            0,
            "BROUILLON",
        )

        canvas.restoreState()

    canvas.restoreState()


def construire_styles():
    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="TitreCompteRendu",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=25,
            alignment=TA_CENTER,
            textColor=colors.HexColor(
                "#0F172A"
            ),
            spaceAfter=5 * mm,
        )
    )

    styles.add(
        ParagraphStyle(
            name="SousTitreCompteRendu",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor(
                "#64748B"
            ),
            spaceAfter=8 * mm,
        )
    )

    styles.add(
        ParagraphStyle(
            name="TitreSectionCompteRendu",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=colors.HexColor(
                "#1D4ED8"
            ),
            spaceBefore=4 * mm,
            spaceAfter=3 * mm,
        )
    )

    styles.add(
        ParagraphStyle(
            name="LibelleCompteRendu",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor(
                "#64748B"
            ),
        )
    )

    styles.add(
        ParagraphStyle(
            name="ValeurCompteRendu",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor(
                "#0F172A"
            ),
        )
    )

    styles.add(
        ParagraphStyle(
            name="DecisionCompteRendu",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            alignment=TA_CENTER,
            textColor=colors.HexColor(
                "#065F46"
            ),
        )
    )

    return styles


def cellule_information(
    libelle,
    valeur,
    styles,
):
    return [
        Paragraph(
            formater_texte(libelle),
            styles[
                "LibelleCompteRendu"
            ],
        ),
        Spacer(1, 1.2 * mm),
        Paragraph(
            formater_texte(valeur),
            styles[
                "ValeurCompteRendu"
            ],
        ),
    ]


def creer_table_informations(
    lignes,
    styles,
):
    donnees = []

    for gauche, droite in lignes:
        donnees.append(
            [
                cellule_information(
                    gauche[0],
                    gauche[1],
                    styles,
                ),
                cellule_information(
                    droite[0],
                    droite[1],
                    styles,
                ),
            ]
        )

    table = Table(
        donnees,
        colWidths=[
            82 * mm,
            82 * mm,
        ],
        hAlign="LEFT",
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.HexColor(
                        "#CBD5E1"
                    ),
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.HexColor(
                        "#E2E8F0"
                    ),
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    colors.white,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
            ]
               )
    )

    return table


def creer_bloc_avis(
    titre,
    decision,
    commentaire,
    nom_signataire,
    fonction_signataire,
    date_signature,
    signe,
    styles,
):
    decision_affiche = (
        decision or "—"
    )

    statut_signature = (
        "Signé"
        if signe
        else "Non signé"
    )

    contenu = [
        [
            Paragraph(
                formater_texte(titre),
                styles[
                    "TitreSectionCompteRendu"
                ],
            )
        ],
        [
            Paragraph(
                (
                    "<b>Avis :</b> "
                    f"{formater_texte(decision_affiche)}"
                ),
                styles[
                    "ValeurCompteRendu"
                ],
            )
        ],
        [
            Paragraph(
                (
                    "<b>Commentaire :</b><br/>"
                    f"{formater_texte(commentaire)}"
                ),
                styles[
                    "ValeurCompteRendu"
                ],
            )
        ],
        [
            Paragraph(
                (
                    "<b>Signataire :</b> "
                    f"{formater_texte(nom_signataire)}"
                    "<br/>"
                    f"{formater_texte(fonction_signataire)}"
                    "<br/>"
                    "<b>Date :</b> "
                    f"{formater_date(date_signature)}"
                    "<br/>"
                    "<b>Signature :</b> "
                    f"{statut_signature}"
                ),
                styles[
                    "ValeurCompteRendu"
                ],
            )
        ],
    ]

    table = Table(
        contenu,
        colWidths=[164 * mm],
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.7,
                    colors.HexColor(
                        "#93C5FD"
                    ),
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.4,
                    colors.HexColor(
                        "#DBEAFE"
                    ),
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor(
                        "#EFF6FF"
                    ),
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    3 * mm,
                ),
            ]
        )
    )

    return table


def generer_pdf_compte_rendu(
    compte_rendu,
):
    buffer = BytesIO()

    styles = construire_styles()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=22 * mm,
        bottomMargin=22 * mm,
        title=(
            "Compte rendu "
            f"{compte_rendu.reference}"
        ),
        author="Système RH",
    )

    candidat = compte_rendu.candidat
    processus = candidat.processus
    demande = processus.demande

    elements = [
        Paragraph(
            "Compte rendu d’entretien",
            styles[
                "TitreCompteRendu"
            ],
        ),
        Paragraph(
            (
                "Recrutement cadre — "
                f"{formater_texte(compte_rendu.reference)}"
            ),
            styles[
                "SousTitreCompteRendu"
            ],
        ),
        Paragraph(
            "Informations sur l’entretien",
            styles[
                "TitreSectionCompteRendu"
            ],
        ),
        creer_table_informations(
            [
                (
                    (
                        "Date de l’entretien",
                        formater_date(
                            compte_rendu
                            .date_entretien
                        ),
                    ),
                    (
                        "Poste",
                        compte_rendu.poste,
                    ),
                ),
                (
                    (
                        "Référence du recrutement",
                        demande.reference,
                    ),
                    (
                        "Département",
                        str(
                            demande.departement
                        ),
                    ),
                ),
            ],
            styles,
        ),
        Spacer(1, 5 * mm),
        Paragraph(
            "Informations sur le candidat",
            styles[
                "TitreSectionCompteRendu"
            ],
        ),
        creer_table_informations(
            [
                (
                    (
                        "Nom et prénom",
                        candidat.nom_complet,
                    ),
                    (
                        "Téléphone",
                        candidat.telephone,
                    ),
                ),
                (
                    (
                        "Adresse e-mail",
                        candidat.email,
                    ),
                    (
                        "Années d’expérience",
                        (
                            f"{compte_rendu.annees_experience} an(s)"
                            if compte_rendu.annees_experience
                            is not None
                            else "—"
                        ),
                    ),
                ),
                (
                    (
                        "Diplôme",
                        compte_rendu.diplome,
                    ),
                    (
                        "Établissement",
                        compte_rendu.etablissement,
                    ),
                ),
                (
                    (
                        "Prétention salariale",
                        formater_salaire(
                            compte_rendu
                            .pretention_salariale,
                            compte_rendu.devise,
                        ),
                    ),
                    (
                        "Disponibilité",
                        (
                            compte_rendu
                            .precision_disponibilite
                            if (
                                compte_rendu
                                .disponibilite
                                == "Autre"
                            )
                            else compte_rendu
                            .disponibilite
                        ),
                    ),
                ),
            ],
            styles,
        ),
        Spacer(1, 5 * mm),
        Paragraph(
            "Avis et recommandations",
            styles[
                "TitreSectionCompteRendu"
            ],
        ),
    ]

    if compte_rendu.redacteur_rh:
        elements.extend(
            [
                creer_bloc_avis(
                    titre="Avis RH",
                    decision=(
                        compte_rendu
                        .get_avis_rh_display()
                        if compte_rendu.avis_rh
                        else "—"
                    ),
                    commentaire=(
                        compte_rendu
                        .commentaire_rh
                    ),
                    nom_signataire=(
                        compte_rendu
                        .nom_signataire_rh
                    ),
                    fonction_signataire=(
                        compte_rendu
                        .fonction_signataire_rh
                    ),
                    date_signature=(
                        compte_rendu
                        .date_signature_rh
                    ),
                    signe=(
                        compte_rendu
                        .signe_rh
                    ),
                    styles=styles,
                ),
                Spacer(1, 4 * mm),
            ]
        )

    if compte_rendu.redacteur_manager:
        elements.extend(
            [
                creer_bloc_avis(
                    titre="Avis Manager",
                    decision=(
                        compte_rendu
                        .get_avis_manager_display()
                        if compte_rendu
                        .avis_manager
                        else "—"
                    ),
                    commentaire=(
                        compte_rendu
                        .commentaire_manager
                    ),
                    nom_signataire=(
                        compte_rendu
                        .nom_signataire_manager
                    ),
                    fonction_signataire=(
                        compte_rendu
                        .fonction_signataire_manager
                    ),
                    date_signature=(
                        compte_rendu
                        .date_signature_manager
                    ),
                    signe=(
                        compte_rendu
                        .signe_manager
                    ),
                    styles=styles,
                ),
                Spacer(1, 4 * mm),
            ]
        )

    if compte_rendu.observation_generale:
        elements.extend(
            [
                Paragraph(
                    "Observation générale",
                    styles[
                        "TitreSectionCompteRendu"
                    ],
                ),
                Paragraph(
                    formater_texte(
                        compte_rendu
                        .observation_generale
                    ),
                    styles[
                        "ValeurCompteRendu"
                    ],
                ),
                Spacer(1, 5 * mm),
            ]
        )

    decision = (
        compte_rendu
        .get_decision_finale_display()
        if compte_rendu.decision_finale
        else "Non renseignée"
    )

    tableau_decision = Table(
        [
            [
                Paragraph(
                    (
                        "Décision finale : "
                        f"{formater_texte(decision)}"
                    ),
                    styles[
                        "DecisionCompteRendu"
                    ],
                )
            ]
        ],
        colWidths=[164 * mm],
    )

    tableau_decision.setStyle(
        TableStyle(
            [
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    1,
                    colors.HexColor(
                        "#6EE7B7"
                    ),
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    colors.HexColor(
                        "#ECFDF5"
                    ),
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    4 * mm,
                ),
            ]
        )
    )

    elements.append(
        tableau_decision
    )

    document.build(
        elements,
        onFirstPage=lambda canvas, doc: (
            ajouter_entete_pied_page(
                canvas,
                doc,
                compte_rendu,
            )
        ),
        onLaterPages=lambda canvas, doc: (
            ajouter_entete_pied_page(
                canvas,
                doc,
                compte_rendu,
            )
        ),
    )

    contenu = buffer.getvalue()
    buffer.close()

    return contenu