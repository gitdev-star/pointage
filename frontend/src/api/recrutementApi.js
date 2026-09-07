import hrClient from "./hrClient";

const DEMANDES_URL = "recruitment/demandes/";

function extraireListe(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.results || [];
}

function extraireErreur(error) {
  const data = error.response?.data;

  if (!data) {
    return (
      error?.message ||
      "Impossible de communiquer avec le serveur."
    );
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.detail) {
    return Array.isArray(data.detail)
      ? data.detail.join(" ")
      : data.detail;
  }

  const premierChamp =
    Object.keys(data)[0];

  const premiereErreur =
    data[premierChamp];

  if (Array.isArray(premiereErreur)) {
    return premiereErreur[0];
  }

  if (
    typeof premiereErreur === "string"
  ) {
    return premiereErreur;
  }

  return "Une erreur est survenue.";
}

const recrutementApi = {
  // ===================================================
  // CANDIDATS
  // ===================================================

  async obtenirCandidats(params = {}) {
    const response = await hrClient.get(
      "recruitment/candidats/",
      { params }
    );

    const candidats = extraireListe(
      response.data
    );

    return {
      candidats,
      count:
        response.data?.count ??
        candidats.length,
    };
  },

  async creerCandidat({
    processusId,
    nom,
    prenom,
    telephone = "",
    email = "",
    dateCandidature,
    observations = "",
  }) {
    const response = await hrClient.post(
      "recruitment/candidats/",
      {
        processus: processusId,
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone.trim(),
        email: email.trim(),
        date_candidature:
          dateCandidature,
        observations:
          observations.trim(),
      }
    );

    return response.data;
  },

  async modifierCandidat(
    candidatId,
    payload
  ) {
    const donnees = {};

    if (payload.nom !== undefined) {
      donnees.nom =
        payload.nom.trim();
    }

    if (payload.prenom !== undefined) {
      donnees.prenom =
        payload.prenom.trim();
    }

    if (
      payload.telephone !== undefined
    ) {
      donnees.telephone =
        payload.telephone.trim();
    }

    if (payload.email !== undefined) {
      donnees.email =
        payload.email.trim();
    }

    if (
      payload.dateCandidature !==
      undefined
    ) {
      donnees.date_candidature =
        payload.dateCandidature;
    }

    if (
      payload.observations !== undefined
    ) {
      donnees.observations =
        payload.observations.trim();
    }

    const response =
      await hrClient.patch(
        `recruitment/candidats/${candidatId}/`,
        donnees
      );

    return response.data;
  },

  async supprimerCandidat(candidatId) {
    await hrClient.delete(
      `recruitment/candidats/${candidatId}/`
    );
  },

  async ajouterFicheTest(
    candidatId,
    fichier
  ) {
    if (!(fichier instanceof File)) {
      throw new Error(
        "La fiche de test sélectionnée est invalide."
      );
    }

    const formData = new FormData();

    formData.append(
      "fiche_test",
      fichier,
      fichier.name
    );

    const response =
      await hrClient.patch(
        `recruitment/candidats/${candidatId}/`,
        formData
      );

    return response.data;
  },

  async supprimerFicheTest(
    candidatId
  ) {
    const response =
      await hrClient.delete(
        `recruitment/candidats/${candidatId}/fiche-test/`
      );

    return (
      response.data?.candidat ||
      response.data
    );
  },

  async confirmerSuiviCandidatures({
    processusId,
    observations = "",
  }) {
    const response =
      await hrClient.patch(
        `recruitment/processus/${processusId}/`,
        {
          liste_candidats_confirmee:
            true,
          observations_suivi:
            observations.trim(),
        }
      );

    return response.data;
  },

  // ===================================================
  // ENTRETIENS DES CADRES
  // ===================================================

  async planifierEntretienCadre(
    candidatId,
    dateEntretienPrevue
  ) {
    const response =
      await hrClient.post(
        `recruitment/candidats/${candidatId}/planifier-entretien/`,
        {
          date_entretien_prevue:
            dateEntretienPrevue,
        }
      );

    return response.data;
  },

  async terminerEntretienCadre(
    candidatId,
    dateEntretienRealisee = null
  ) {
    const payload = {};

    if (dateEntretienRealisee) {
      payload.date_entretien_realisee =
        dateEntretienRealisee;
    }

    const response =
      await hrClient.post(
        `recruitment/candidats/${candidatId}/terminer-entretien/`,
        payload
      );

    return response.data;
  },

  // ===================================================
  // FICHES DE TRANSPARENCE
  // ===================================================

  async obtenirFichesTransparence(
    params = {}
  ) {
    const response = await hrClient.get(
      "recruitment/fiches-transparence/",
      { params }
    );

    const fiches = extraireListe(
      response.data
    );

    return {
      fiches,
      count:
        response.data?.count ??
        fiches.length,
    };
  },

  async enregistrerFicheTransparence({
    ficheId = null,
    processusId,
    dateFiche,
    lieu,
    fichier = null,
    observations = "",
    originalSigne = false,
  }) {
    const formData = new FormData();

    formData.append(
      "processus",
      String(processusId)
    );

    formData.append(
      "date_fiche",
      dateFiche
    );

    formData.append("lieu", lieu);

    formData.append(
      "observations",
      observations || ""
    );

    formData.append(
      "original_signe",
      originalSigne
        ? "true"
        : "false"
    );

    if (fichier instanceof File) {
      formData.append(
        "fichier",
        fichier,
        fichier.name
      );
    }

    if (ficheId) {
      const response =
        await hrClient.patch(
          `recruitment/fiches-transparence/${ficheId}/`,
          formData
        );

      return response.data;
    }

    if (!(fichier instanceof File)) {
      throw new Error(
        "Le fichier de la fiche de transparence est obligatoire."
      );
    }

    const response =
      await hrClient.post(
        "recruitment/fiches-transparence/",
        formData
      );

    return response.data;
  },

  // ===================================================
  // PUBLICATIONS
  // ===================================================

  async obtenirPublications(
    params = {}
  ) {
    const response = await hrClient.get(
      "recruitment/publications/",
      { params }
    );

    const publications =
      extraireListe(response.data);

    return {
      publications,
      count:
        response.data?.count ??
        publications.length,
    };
  },

  async enregistrerPublication({
    publicationId = null,
    processusId,
    canal,
    datePublication,
    dateLimiteCandidature,
    lienOuReference = "",
    commentaire = "",
    preuve = null,
  }) {
    const formData = new FormData();

    formData.append(
      "processus",
      String(processusId)
    );

    formData.append("canal", canal);

    formData.append(
      "date_publication",
      datePublication
    );

    formData.append(
      "date_limite_candidature",
      dateLimiteCandidature
    );

    formData.append(
      "lien_ou_reference",
      lienOuReference || ""
    );

    formData.append(
      "commentaire",
      commentaire || ""
    );

    if (preuve instanceof File) {
      formData.append(
        "preuve",
        preuve,
        preuve.name
      );
    }

    if (publicationId) {
      const response =
        await hrClient.patch(
          `recruitment/publications/${publicationId}/`,
          formData
        );

      return response.data;
    }

    const response =
      await hrClient.post(
        "recruitment/publications/",
        formData
      );

    return response.data;
  },

  // ===================================================
  // OFFRES
  // ===================================================

  async obtenirOffres(params = {}) {
    const response = await hrClient.get(
      "recruitment/offres/",
      {
        params: {
          active: true,
          ...params,
        },
      }
    );

    const offres = extraireListe(
      response.data
    );

    return {
      offres,
      count:
        response.data?.count ??
        offres.length,
    };
  },

  async creerOffre({ fichier }) {
    if (!(fichier instanceof File)) {
      throw new Error(
        "Le fichier sélectionné est invalide."
      );
    }

    const formData = new FormData();

    formData.append(
      "fichier",
      fichier,
      fichier.name
    );

    formData.append("active", "true");

    const response =
      await hrClient.post(
        "recruitment/offres/",
        formData
      );

    return response.data;
  },

  async associerOffreAuProcessus(
    processusId,
    offreId
  ) {
    const response =
      await hrClient.patch(
        `recruitment/processus/${processusId}/`,
        {
          offre_id: offreId,
        }
      );

    return response.data;
  },

  // ===================================================
  // PROFIL ET RÉFÉRENTIELS
  // ===================================================

  async obtenirMonProfil() {
    const response = await hrClient.get(
      "accounts/me/"
    );

    return response.data;
  },

  async obtenirSites() {
    const response = await hrClient.get(
      "employees/factories/"
    );

    return extraireListe(response.data);
  },

  async obtenirDepartements() {
    const response = await hrClient.get(
      "employees/departments/"
    );

    return extraireListe(response.data);
  },

async obtenirPostes(params = {}) {
  const response = await hrClient.get(
    "employees/postes/",
    {
      params: {
        page_size: 200,
        ...params,
      },
    }
  );

  return extraireListe(response.data);
},

  // ===================================================
  // DEMANDES
  // ===================================================

  async creerDemande(payload) {
    const response = await hrClient.post(
      DEMANDES_URL,
      payload
    );

    return response.data;
  },

  async obtenirDemandes(params = {}) {
    const response = await hrClient.get(
      DEMANDES_URL,
      { params }
    );

    const demandes = extraireListe(
      response.data
    );

    return {
      demandes,
      count:
        response.data?.count ??
        demandes.length,
    };
  },

  async obtenirMesDemandes(
    params = {}
  ) {
    const response = await hrClient.get(
      `${DEMANDES_URL}mes-demandes/`,
      { params }
    );

    const demandes = extraireListe(
      response.data
    );

    return {
      demandes,
      count:
        response.data?.count ??
        demandes.length,
    };
  },

  async obtenirDemande(id) {
    const response = await hrClient.get(
      `${DEMANDES_URL}${id}/`
    );

    return response.data;
  },

  async modifierDemande(
    id,
    payload
  ) {
    const response =
      await hrClient.patch(
        `${DEMANDES_URL}${id}/`,
        payload
      );

    return response.data;
  },

  async supprimerDemande(id) {
    await hrClient.delete(
      `${DEMANDES_URL}${id}/`
    );
  },

  // Première validation : directeur
  async validerDemande(
    id,
    motifDecision = ""
  ) {
    const response =
      await hrClient.post(
        `${DEMANDES_URL}${id}/valider/`,
        {
          motif_decision:
            motifDecision,
        }
      );

    return response.data;
  },

  async refuserDemande(
    id,
    motifDecision
  ) {
    const response =
      await hrClient.post(
        `${DEMANDES_URL}${id}/refuser/`,
        {
          motif_decision:
            motifDecision,
        }
      );

    return response.data;
  },

  // Deuxième validation : DRH
  async approuverDemandeDRH(
    id,
    commentaireDRH = ""
  ) {
    const response =
      await hrClient.post(
        `${DEMANDES_URL}${id}/approuver-drh/`,
        {
          commentaire_drh:
            commentaireDRH,
        }
      );

    return response.data;
  },

  async refuserDemandeDRH(
    id,
    commentaireDRH
  ) {
    const response =
      await hrClient.post(
        `${DEMANDES_URL}${id}/refuser-drh/`,
        {
          commentaire_drh:
            commentaireDRH,
        }
      );

    return response.data;
  },

  // ===================================================
  // PROCESSUS
  // ===================================================

  async obtenirProcessus(params = {}) {
    const response = await hrClient.get(
      "recruitment/processus/",
      { params }
    );

    const processus = extraireListe(
      response.data
    );

    return {
      processus,
      count:
        response.data?.count ??
        processus.length,
    };
  },

  async obtenirProcessusParId(id) {
    const response = await hrClient.get(
      `recruitment/processus/${id}/`
    );

    return response.data;
  },

  async terminerEtapeProcessus(
    processusId,
    numeroEtape
  ) {
    const response =
      await hrClient.post(
        `recruitment/processus/${processusId}/terminer-etape/`,
        {
          numero_etape: numeroEtape,
        }
      );

    return response.data;
  },

  async obtenirFichierSuiviExcel(
    processusId
  ) {
    return hrClient.get(
      `recruitment/processus/${processusId}/fichier-suivi-excel/`,
      {
        responseType: "blob",
      }
    );
  },

  // ===================================================
  // RETOUR RH DES OUVRIERS
  // ===================================================

  async obtenirRetoursRH(
    params = {}
  ) {
    const response = await hrClient.get(
      "recruitment/retours-rh/",
      { params }
    );

    const retours = extraireListe(
      response.data
    );

    return {
      retours,
      count:
        response.data?.count ??
        retours.length,
    };
  },

  async enregistrerRetourRH({
    retourId = null,
    candidatId,
    responsableRH,
    dateRemiseListe,
    listeImprimee = false,
    listeRemise = false,
    remarque = "",
  }) {
    const payload = {
      candidat: candidatId,
      responsable_rh:
        responsableRH,
      date_remise_liste:
        dateRemiseListe,
      liste_imprimee:
        listeImprimee,
      liste_remise:
        listeRemise,
      remarque: remarque || "",
    };

    if (retourId) {
      const response =
        await hrClient.patch(
          `recruitment/retours-rh/${retourId}/`,
          payload
        );

      return response.data;
    }

    const response =
      await hrClient.post(
        "recruitment/retours-rh/",
        payload
      );

    return response.data;
  },

  async obtenirCandidatsRecus(
    processusId
  ) {
    const response = await hrClient.get(
      "recruitment/candidats/",
      {
        params: {
          processus: processusId,
          statut: "RECU",
        },
      }
    );

    const candidats = extraireListe(
      response.data
    );

    return {
      candidats,
      count:
        response.data?.count ??
        candidats.length,
    };
  },

  // ===================================================
  // EMBAUCHES
  // ===================================================

  async obtenirCandidatsPourEmbauche(
    processusId
  ) {
    const response = await hrClient.get(
      "recruitment/candidats/",
      {
        params: {
          processus: processusId,
        },
      }
    );

    const tousLesCandidats =
      extraireListe(response.data);

    const candidats =
      tousLesCandidats.filter(
        (candidat) =>
          candidat.statut === "RECU" ||
          candidat.statut === "RETENU" ||
          candidat.statut ===
            "EMBAUCHE"
      );

    return {
      candidats,
      count: candidats.length,
    };
  },

  async obtenirEmbauches(
    params = {}
  ) {
    const response = await hrClient.get(
      "recruitment/embauches/",
      { params }
    );

    const embauches = extraireListe(
      response.data
    );

    return {
      embauches,
      count:
        response.data?.count ??
        embauches.length,
    };
  },

  async obtenirEmbauche(id) {
    const response = await hrClient.get(
      `recruitment/embauches/${id}/`
    );

    return response.data;
  },

async enregistrerEmbauche({
  embaucheId = null,
  candidatId,
  typeContrat,
  dateVerification,
  verificateur,
  dateDebutContrat,
  signeCandidat = false,
  signeEmployeur = false,
  remarqueGenerale = "",

  // Checklist propre aux cadres
  dossierEmbaucheComplet,
  contratTravailSigne,
  journeeIntegrationRealisee,
  reglementInterieurCommunique,
  codeSocieteCommunique,
}) {
  const payload = {
    candidat: candidatId,
    type_contrat: typeContrat,
    date_verification: dateVerification,
    verificateur: (verificateur || "").trim(),
    date_debut_contrat: dateDebutContrat,
    signe_candidat: signeCandidat,
    signe_employeur: signeEmployeur,
    remarque_generale: remarqueGenerale || "",
  };

  /*
   * On ajoute les champs cadres uniquement lorsqu’ils sont fournis.
   * Cela préserve le fonctionnement du recrutement ouvrier.
   */

  if (dossierEmbaucheComplet !== undefined) {
    payload.dossier_embauche_complet = Boolean(
      dossierEmbaucheComplet
    );
  }

  if (contratTravailSigne !== undefined) {
    payload.contrat_travail_signe = Boolean(
      contratTravailSigne
    );
  }

  if (journeeIntegrationRealisee !== undefined) {
    payload.journee_integration_realisee = Boolean(
      journeeIntegrationRealisee
    );
  }

  if (reglementInterieurCommunique !== undefined) {
    payload.reglement_interieur_communique = Boolean(
      reglementInterieurCommunique
    );
  }

  if (codeSocieteCommunique !== undefined) {
    payload.code_societe_communique = Boolean(
      codeSocieteCommunique
    );
  }

  if (embaucheId) {
    const response = await hrClient.patch(
      `recruitment/embauches/${embaucheId}/`,
      payload
    );

    return response.data;
  }

  const response = await hrClient.post(
    "recruitment/embauches/",
    payload
  );

  return response.data;
},

async confirmerEmbauche(embaucheId) {
  const response = await hrClient.post(
    `recruitment/embauches/${embaucheId}/confirmer/`,
    {}
  );

  return response.data;
},

  async modifierDocumentCandidat(
    documentId,
    {
      recu,
      remarque = "",
    }
  ) {
    const response =
      await hrClient.patch(
        `recruitment/documents-candidats/${documentId}/`,
        {
          recu,
          remarque:
            remarque || "",
        }
      );

    return response.data;
  },

  // ===================================================
  // PRÉPARATION DE L’EMBAUCHE
  // ===================================================

  async obtenirTachesPreparation(
    processusId
  ) {
    const response = await hrClient.get(
      "recruitment/taches-preparation/",
      {
        params: {
          candidat__processus:
            processusId,
        },
      }
    );

    const taches = extraireListe(
      response.data
    );

    return {
      taches,
      count:
        response.data?.count ??
        taches.length,
    };
  },

  async modifierTachePreparation(
    tacheId,
    payload
  ) {
    const response =
      await hrClient.patch(
        `recruitment/taches-preparation/${tacheId}/`,
        payload
      );

    return response.data;
  },

  async renvoyerNotificationPreparation(
    tacheId
  ) {
    const response =
      await hrClient.post(
        `recruitment/taches-preparation/${tacheId}/renvoyer-notification/`
      );

    return response.data;
  },

  // ===================================================
  // COMPTES RENDUS DES CADRES
  // ===================================================

  async obtenirComptesRendusCadres(
    params = {}
  ) {
    const response = await hrClient.get(
      "recruitment/comptes-rendus-cadres/",
      { params }
    );

    const comptesRendus =
      extraireListe(response.data);

    return {
      comptesRendus,
      count:
        response.data?.count ??
        comptesRendus.length,
    };
  },

  async obtenirCompteRenduCandidat(
    candidatId
  ) {
    const resultat =
      await this.obtenirComptesRendusCadres(
        {
          candidat: candidatId,
        }
      );

    return (
      resultat.comptesRendus[0] ||
      null
    );
  },

  async creerCompteRenduCadre(
    payload
  ) {
    const response =
      await hrClient.post(
        "recruitment/comptes-rendus-cadres/",
        payload
      );

    return response.data;
  },

  async modifierCompteRenduCadre(
    id,
    payload
  ) {
    const response =
      await hrClient.patch(
        `recruitment/comptes-rendus-cadres/${id}/`,
        payload
      );

    return response.data;
  },

async validerEtEnvoyerCompteRenduCadre(
  id
) {
  const response =
    await hrClient.post(
      `recruitment/comptes-rendus-cadres/${id}/valider-envoyer/`,
      {}
    );

  return response.data;
},

  async supprimerCompteRenduCadre(
    compteRenduId
  ) {
    await hrClient.delete(
      `recruitment/comptes-rendus-cadres/${compteRenduId}/`
    );
  },

  async telechargerCompteRenduCadre(
    compteRenduId,
    nomFichier = "compte-rendu.pdf"
  ) {
    const response = await hrClient.get(
      `recruitment/comptes-rendus-cadres/${compteRenduId}/pdf/`,
      {
        responseType: "blob",
      }
    );

    const fichier = new Blob(
      [response.data],
      {
        type: "application/pdf",
      }
    );

    const url =
      window.URL.createObjectURL(
        fichier
      );

    const lien =
      document.createElement("a");

    lien.href = url;
    lien.download = nomFichier;

    document.body.appendChild(lien);
    lien.click();
    lien.remove();

    window.URL.revokeObjectURL(url);

    return response;
  },

  extraireErreur,
};

export default recrutementApi;