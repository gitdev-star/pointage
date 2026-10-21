import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  FileCheck2,
  Loader2,
  Save,
  Search,
  UserCheck,
  Users,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";

function dateDuJour() {
  return new Date()
    .toISOString()
    .split("T")[0];
}

function obtenirNomCandidat(candidat) {
  if (candidat.nom_complet) {
    return candidat.nom_complet;
  }

  return [
    candidat.prenom,
    candidat.nom,
  ]
    .filter(Boolean)
    .join(" ");
}

// Texte sans accents ni majuscules, pour la recherche par nom.
function normaliserTexte(texte) {
  return (texte || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function obtenirDemande(recrutement) {
  return (
    recrutement?.demande_details ||
    recrutement?.demande_detail ||
    recrutement?.demande ||
    recrutement ||
    {}
  );
}

function obtenirPoste(recrutement) {
  const demande =
    obtenirDemande(recrutement);

  return (
    demande.poste_nom ||
    demande.poste?.name ||
    recrutement?.poste_nom ||
    recrutement?.poste ||
    "-"
  );
}

function choisirTypeContrat(
  index,
  recrutement
) {
  const demande =
    obtenirDemande(recrutement);

  const nombreCDI = Number(
    demande.nombre_cdi ??
      recrutement?.nombre_cdi ??
      0
  );

  return index < nombreCDI
    ? "CDI"
    : "CDD";
}

function creerEmbauche({
  candidat,
  index,
  recrutement,
  embaucheExistante,
  retourRH,
  verificateur,
}) {
  const documents =
    embaucheExistante?.documents ||
    retourRH?.documents ||
    [];

  return {
    id:
      embaucheExistante?.id ||
      null,

    candidatId: candidat.id,

    documents: documents.map(
      (document) => ({
        id: document.id,

        libelle:
          document.libelle,

        recu: Boolean(
          document.recu
        ),

        remarque:
          document.remarque || "",
      })
    ),

    dateVerification:
      embaucheExistante
        ?.date_verification ||
      dateDuJour(),

    verificateur:
      embaucheExistante
        ?.verificateur ||
      retourRH?.responsable_rh ||
      verificateur ||
      "",

    typeContrat:
      embaucheExistante
        ?.type_contrat ||
      choisirTypeContrat(
        index,
        recrutement
      ),

    dateDebutContrat:
      embaucheExistante
        ?.date_debut_contrat ||
      "",

    signeCandidat:
      Boolean(
        embaucheExistante
          ?.signe_candidat
      ),

    signeEmployeur:
      Boolean(
        embaucheExistante
          ?.signe_employeur
      ),

    dossierEmbaucheComplet: Boolean(
      embaucheExistante?.dossier_embauche_complet
    ),

    contratTravailSigne: Boolean(
      embaucheExistante?.contrat_travail_signe
    ),

    journeeIntegrationRealisee: Boolean(
      embaucheExistante?.journee_integration_realisee
    ),

    reglementInterieurCommunique: Boolean(
      embaucheExistante?.reglement_interieur_communique
    ),

    codeSocieteCommunique: Boolean(
      embaucheExistante?.code_societe_communique
    ),

    documentsCadreEmailEnvoyes: Boolean(
      embaucheExistante?.documents_cadre_email_envoyes
    ),

    dateEnvoiDocumentsCadre:
      embaucheExistante?.date_envoi_documents_cadre || null,

    erreurEnvoiDocumentsCadre:
      embaucheExistante?.erreur_envoi_documents_cadre || "",

    checklistOnboardingComplete: Boolean(
      embaucheExistante?.checklist_onboarding_complete
    ),

    remarqueGenerale:
      embaucheExistante
        ?.remarque_generale ||
      "",

    confirmee:
      Boolean(
        embaucheExistante
          ?.date_confirmation
      ),

    dateConfirmation:
      embaucheExistante
        ?.date_confirmation ||
      null,
  };
}

export default function EtapeEmbauche({
  recrutement,
  onComplete,
  onEmbaucheConfirmee,
}) {
  const processusId =
    recrutement?.id ||
    recrutement?.processus_id;

  const demande =
    obtenirDemande(recrutement);

  const estCadre =
    String(
      demande.type_recrutement ||
        recrutement?.typeRecrutement ||
        recrutement?.type_recrutement ||
        "OUVRIER"
    ).toUpperCase() === "CADRE";

  // Ouvriers et cadres : l'embauche est l'étape 4.
  const numeroEtapeEmbauche = 4;

  const [candidats, setCandidats] =
    useState([]);

  const [embauches, setEmbauches] =
    useState({});

  const [chargement, setChargement] =
    useState(true);

  const [
    candidatEnCours,
    setCandidatEnCours,
  ] = useState(null);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [erreur, setErreur] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [confirmationGroupee, setConfirmationGroupee] =
    useState(false);

  // Ouvriers : date d'embauche commune, indépendante des dates
  // modifiées ligne par ligne (exceptions).
  const [dateCommune, setDateCommune] =
    useState("");

  // Ouvriers : recherche d'un candidat par nom dans le récapitulatif.
  const [recherche, setRecherche] =
    useState("");

  useEffect(() => {
    let composantActif = true;

    async function chargerDonnees() {
      if (!processusId) {
        setErreur(
          "L'identifiant du processus est introuvable."
        );

        setChargement(false);
        return;
      }

      setChargement(true);
      setErreur("");

      try {
        const [
          resultatCandidats,
          resultatEmbauches,
          resultatRetours,
          profil,
        ] = await Promise.all([
          recrutementApi
            .obtenirCandidatsPourEmbauche(
              processusId
            ),

          recrutementApi
            .obtenirEmbauches({
              candidat__processus:
                processusId,
            }),

          estCadre
            ? Promise.resolve({
                retours: [],
              })
            : recrutementApi
                .obtenirRetoursRH({
                  candidat__processus:
                    processusId,
                }),

          recrutementApi
            .obtenirMonProfil()
            .catch(() => null),
        ]);

        if (!composantActif) {
          return;
        }

        const candidatsRetournes =
          resultatCandidats?.candidats || [];

        const candidatsDuProcessus =
          Array.isArray(recrutement?.candidats)
            ? recrutement.candidats
            : [];

        const sourceCandidats =
          candidatsRetournes.length > 0
            ? candidatsRetournes
            : candidatsDuProcessus;

        const candidatsAPI =
          sourceCandidats.filter((candidat) => {
            if (candidat.statut === "EMBAUCHE") {
              return true;
            }

            return estCadre
              ? candidat.statut === "RETENU"
              : candidat.statut === "RECU";
          });

        const embauchesAPI =
          resultatEmbauches?.embauches || [];

        const retoursAPI =
          resultatRetours?.retours || [];

        const nomUtilisateur =
          profil?.nom_complet ||
          profil?.full_name ||
          [
            profil?.first_name,
            profil?.last_name,
          ]
            .filter(Boolean)
            .join(" ") ||
          profil?.username ||
          "";

        const embauchesParCandidat =
          candidatsAPI.reduce(
            (
              resultat,
              candidat,
              index
            ) => {
              const embaucheExistante =
                embauchesAPI.find(
                  (embauche) =>
                    Number(
                      embauche.candidat
                    ) ===
                    Number(candidat.id)
                );

              const retourRH =
                retoursAPI.find(
                  (retour) =>
                    Number(
                      retour.candidat
                    ) ===
                    Number(candidat.id)
                );

              resultat[candidat.id] =
                creerEmbauche({
                  candidat,
                  index,
                  recrutement,
                  embaucheExistante,
                  retourRH,
                  verificateur:
                    nomUtilisateur,
                });

              return resultat;
            },
            {}
          );

        // Ouvriers : par défaut, une même date d'embauche pour
        // tous les candidats encore à confirmer.
        if (!estCadre) {
          const aConfirmer = Object.values(embauchesParCandidat)
            .filter((embauche) => !embauche.confirmee);

          const dateCommune = aConfirmer.find(
            (embauche) => embauche.dateDebutContrat
          )?.dateDebutContrat;

          if (dateCommune) {
            aConfirmer.forEach((embauche) => {
              if (!embauche.dateDebutContrat) {
                embauche.dateDebutContrat = dateCommune;
              }
            });
          }

          setDateCommune(dateCommune || "");
        }

        setCandidats(candidatsAPI);

        setEmbauches(
          embauchesParCandidat
        );
      } catch (error) {
        console.error(error);

        if (composantActif) {
          setErreur(
            recrutementApi
              .extraireErreur(error)
          );
        }
      } finally {
        if (composantActif) {
          setChargement(false);
        }
      }
    }

    chargerDonnees();

    return () => {
      composantActif = false;
    };
  }, [processusId, recrutement, estCadre]);

  const modifierEmbauche = (
    candidatId,
    champ,
    valeur
  ) => {
    setEmbauches((previous) => ({
      ...previous,

      [candidatId]: {
        ...previous[candidatId],
        [champ]: valeur,
      },
    }));

    setErreur("");
    setMessage("");
  };

  const resteAConfirmer = candidats.some(
    (candidat) =>
      embauches[candidat.id] &&
      !embauches[candidat.id].confirmee
  );

  // Change la date commune : les candidats qui suivaient l'ancienne
  // date commune (ou sans date) passent à la nouvelle ; ceux dont la
  // date a été modifiée à la main (exception) la gardent.
  const modifierDateCommune = (valeur) => {
    const ancienne = dateCommune;

    setDateCommune(valeur);

    setEmbauches((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([id, embauche]) => [
          id,
          !embauche.confirmee &&
          (!embauche.dateDebutContrat ||
            embauche.dateDebutContrat === ancienne)
            ? { ...embauche, dateDebutContrat: valeur }
            : embauche,
        ])
      )
    );

    setErreur("");
    setMessage("");
  };

  const modifierContratSigne = (
    candidatId,
    valeur
  ) => {
    setEmbauches((previous) => ({
      ...previous,

      [candidatId]: {
        ...previous[candidatId],
        signeCandidat: valeur,
        signeEmployeur: valeur,
      },
    }));

    setErreur("");
    setMessage("");
  };

  const statistiques = useMemo(() => {
    const valeurs =
      Object.values(embauches);

    const confirmees =
      valeurs.filter(
        (embauche) =>
          embauche.confirmee
      ).length;

    return {
      total: candidats.length,
      confirmees,

      restantes: Math.max(
        candidats.length -
          confirmees,
        0
      ),
    };
  }, [candidats.length, embauches]);

  const toutesLesEmbauchesConfirmees =
    candidats.length > 0 &&
    candidats.every(
      (candidat) =>
        embauches[candidat.id]
          ?.confirmee
    );

  const toutesLesChecklistsCompletes =
    toutesLesEmbauchesConfirmees &&
    (!estCadre ||
      candidats.every(
        (candidat) =>
          embauches[candidat.id]
            ?.checklistOnboardingComplete
      ));

  const verifierEmbauche = (
    candidat
  ) => {
    const embauche =
      embauches[candidat.id];

    const nom =
      obtenirNomCandidat(candidat);

    if (!embauche) {
      setErreur(
        `Les informations de ${nom} sont introuvables.`
      );

      return false;
    }

    // La date de vérification et le vérificateur ne sont plus
    // saisis : ils sont remplis automatiquement.

    if (
      !embauche.typeContrat
    ) {
      setErreur(
        `Sélectionnez le type de contrat de ${nom}.`
      );

      return false;
    }

    if (
      !embauche
        .dateDebutContrat
    ) {
      setErreur(
        `La date de début du contrat de ${nom} est obligatoire.`
      );

      return false;
    }

    if (estCadre) {
      if (!embauche.dossierEmbaucheComplet) {
        setErreur(
          `Le dossier d'embauche de ${nom} doit être complet.`
        );
        return false;
      }

      if (!embauche.contratTravailSigne) {
        setErreur(
          `Le contrat de travail de ${nom} doit être signé.`
        );
        return false;
      }
    } else {
      if (
        !embauche.signeCandidat ||
        !embauche.signeEmployeur
      ) {
        setErreur(
          `Le contrat de ${nom} doit être signé.`
        );
        return false;
      }
    }

    return true;
  };

  // « rapport » (facultatif) reçoit le motif d'échec, pour le bilan
  // de la confirmation groupée des ouvriers.
  const confirmerEmbaucheCandidat =
    async (candidat, rapport = null) => {
      setErreur("");
      setMessage("");

      if (
        !verifierEmbauche(candidat)
      ) {
        return false;
      }

      const embauche =
        embauches[candidat.id];

      setCandidatEnCours(
        candidat.id
      );

      try {
        const embaucheEnregistree =
          await recrutementApi
            .enregistrerEmbauche({
              embaucheId:
                embauche.id,

              candidatId:
                candidat.id,

              typeContrat:
                embauche
                  .typeContrat,

              dateVerification:
                embauche
                  .dateVerification,

              verificateur:
                embauche
                  .verificateur,

              dateDebutContrat:
                embauche
                  .dateDebutContrat,

              signeCandidat:
                embauche
                  .signeCandidat,

              signeEmployeur:
                embauche
                  .signeEmployeur,

              ...(estCadre
                ? {
                    dossierEmbaucheComplet:
                      embauche.dossierEmbaucheComplet,
                    contratTravailSigne:
                      embauche.contratTravailSigne,
                    journeeIntegrationRealisee:
                      embauche.journeeIntegrationRealisee,
                    reglementInterieurCommunique:
                      embauche.reglementInterieurCommunique,
                    codeSocieteCommunique:
                      embauche.codeSocieteCommunique,
                  }
                : {}),

              remarqueGenerale:
                embauche
                  .remarqueGenerale,
            });

        const confirmation =
          await recrutementApi
            .confirmerEmbauche(
              embaucheEnregistree.id
            );

        setEmbauches(
          (previous) => ({
            ...previous,

            [candidat.id]: {
              ...previous[
                candidat.id
              ],

              id:
                confirmation.id,

              confirmee: true,

              dateConfirmation:
                confirmation
                  .date_confirmation,

              documents:
                confirmation
                  .documents ||
                previous[
                  candidat.id
                ].documents,

              dossierEmbaucheComplet: Boolean(
                confirmation.dossier_embauche_complet
              ),

              contratTravailSigne: Boolean(
                confirmation.contrat_travail_signe
              ),

              journeeIntegrationRealisee: Boolean(
                confirmation.journee_integration_realisee
              ),

              reglementInterieurCommunique: Boolean(
                confirmation.reglement_interieur_communique
              ),

              codeSocieteCommunique: Boolean(
                confirmation.code_societe_communique
              ),

              documentsCadreEmailEnvoyes: Boolean(
                confirmation.documents_cadre_email_envoyes
              ),

              dateEnvoiDocumentsCadre:
                confirmation.date_envoi_documents_cadre || null,

              erreurEnvoiDocumentsCadre:
                confirmation.erreur_envoi_documents_cadre || "",

              checklistOnboardingComplete: Boolean(
                confirmation.checklist_onboarding_complete
              ),
            },
          })
        );

        setMessage(
          `L'embauche de ${obtenirNomCandidat(
            candidat
          )} a été confirmée.`
        );

        // Met à jour « Suivi après embauche » sur la page du processus.
        onEmbaucheConfirmee?.();

        return true;
      } catch (error) {
        console.error(error);

        const motif =
          recrutementApi
            .extraireErreur(error);

        if (rapport) {
          rapport.erreur = motif;
        }

        setErreur(motif);

        return false;
      } finally {
        setCandidatEnCours(null);
      }
    };

  // Ouvriers : ce qu'il manque sur une ligne avant de pouvoir la confirmer.
  const elementsManquants = (candidat) => {
    const embauche = embauches[candidat.id] || {};
    const manquants = [];

    if (!embauche.typeContrat) manquants.push("contrat");
    if (!embauche.dateDebutContrat) manquants.push("date d'embauche");
    if (!(embauche.signeCandidat && embauche.signeEmployeur)) {
      manquants.push("contrat signé");
    }

    return manquants;
  };

  // Ouvriers : la ligne est-elle prête à être confirmée ?
  // (contrat choisi, date d'embauche et contrat signé)
  const ligneComplete = (candidat) =>
    Boolean(embauches[candidat.id]) &&
    elementsManquants(candidat).length === 0;

  // Ouvriers : le candidat correspond-il à la recherche par nom ?
  const correspondRecherche = (candidat) => {
    const texte = normaliserTexte(recherche);

    if (!texte) {
      return true;
    }

    return normaliserTexte(
      `${obtenirNomCandidat(candidat)} ${candidat.nom || ""} ${candidat.prenom || ""}`
    ).includes(texte);
  };

  // Ouvriers : confirme les lignes complètes (parmi celles affichées)
  // et passe les lignes incomplètes, sans attendre les autres candidats.
  const confirmerToutesLesEmbauches = async () => {
    const restants = candidats.filter(
      (candidat) =>
        embauches[candidat.id] &&
        !embauches[candidat.id].confirmee &&
        correspondRecherche(candidat)
    );

    const completes = restants.filter(ligneComplete);
    const incompletes = restants.filter(
      (candidat) => !ligneComplete(candidat)
    );

    if (completes.length === 0) {
      setMessage("");
      setErreur(
        "Aucune ligne complète à confirmer : choisissez le contrat, " +
          "la date d'embauche et cochez « Contrat signé »."
      );
      return;
    }

    setConfirmationGroupee(true);

    const confirmes = [];
    const echecs = [];

    try {
      for (const candidat of completes) {
        const rapport = {};
        // eslint-disable-next-line no-await-in-loop
        const ok = await confirmerEmbaucheCandidat(candidat, rapport);

        if (ok) {
          confirmes.push(obtenirNomCandidat(candidat));
        } else {
          echecs.push(
            `${obtenirNomCandidat(candidat)}` +
              (rapport.erreur ? ` (${rapport.erreur})` : "")
          );
        }
      }
    } finally {
      setConfirmationGroupee(false);
    }

    const bilan = [
      `${confirmes.length} embauche(s) confirmée(s).`,
    ];

    if (incompletes.length > 0) {
      bilan.push(
        `${incompletes.length} candidat(s) à compléter : ` +
          incompletes.map(obtenirNomCandidat).join(", ") +
          "."
      );
    }

    setMessage(bilan.join(" "));

    setErreur(
      echecs.length > 0
        ? `Confirmation impossible pour : ${echecs.join(" ; ")}.`
        : ""
    );
  };

  const telechargerFichePoste = async (
    candidat
  ) => {
    const embauche = embauches[candidat.id];

    if (!embauche?.id || !embauche.confirmee) {
      setErreur(
        "Confirmez d’abord l’embauche avant de télécharger la fiche de poste."
      );
      return;
    }

    setCandidatEnCours(candidat.id);
    setErreur("");

    try {
      await recrutementApi.telechargerFichePoste(
        embauche.id,
        obtenirNomCandidat(candidat)
      );
    } catch (error) {
      console.error(error);
      setErreur(
        recrutementApi.extraireErreur(error)
      );
    } finally {
      setCandidatEnCours(null);
    }
  };

  const enregistrerChecklistCadre = async (
    candidat
  ) => {
    const embauche = embauches[candidat.id];

    if (!embauche?.id) {
      setErreur(
        "Confirmez d'abord l'embauche avant d'enregistrer la suite de l'onboarding."
      );
      return;
    }

    setCandidatEnCours(candidat.id);
    setErreur("");
    setMessage("");

    try {
      const resultat =
        await recrutementApi.enregistrerEmbauche({
          embaucheId: embauche.id,
          candidatId: candidat.id,
          typeContrat: embauche.typeContrat,
          dateVerification: embauche.dateVerification,
          verificateur: embauche.verificateur,
          dateDebutContrat: embauche.dateDebutContrat,
          remarqueGenerale: embauche.remarqueGenerale,
          dossierEmbaucheComplet:
            embauche.dossierEmbaucheComplet,
          contratTravailSigne:
            embauche.contratTravailSigne,
          journeeIntegrationRealisee:
            embauche.journeeIntegrationRealisee,
          reglementInterieurCommunique:
            embauche.reglementInterieurCommunique,
          codeSocieteCommunique:
            embauche.codeSocieteCommunique,
        });

      setEmbauches((previous) => ({
        ...previous,
        [candidat.id]: {
          ...previous[candidat.id],
          dossierEmbaucheComplet: Boolean(
            resultat.dossier_embauche_complet
          ),
          contratTravailSigne: Boolean(
            resultat.contrat_travail_signe
          ),
          journeeIntegrationRealisee: Boolean(
            resultat.journee_integration_realisee
          ),
          reglementInterieurCommunique: Boolean(
            resultat.reglement_interieur_communique
          ),
          codeSocieteCommunique: Boolean(
            resultat.code_societe_communique
          ),
          documentsCadreEmailEnvoyes: Boolean(
            resultat.documents_cadre_email_envoyes
          ),
          dateEnvoiDocumentsCadre:
            resultat.date_envoi_documents_cadre || null,
          erreurEnvoiDocumentsCadre:
            resultat.erreur_envoi_documents_cadre || "",
          checklistOnboardingComplete: Boolean(
            resultat.checklist_onboarding_complete
          ),
        },
      }));

      setMessage(
        `La checklist de ${obtenirNomCandidat(candidat)} a été enregistrée.`
      );
    } catch (error) {
      console.error(error);
      setErreur(recrutementApi.extraireErreur(error));
    } finally {
      setCandidatEnCours(null);
    }
  };

  const terminerProcessus =
    async (event) => {
      event.preventDefault();

      setErreur("");
      setMessage("");

      if (
        !toutesLesChecklistsCompletes
      ) {
        setErreur(
          estCadre
            ? "Toutes les checklists d'onboarding doivent être complètes avant la clôture."
            : "Toutes les embauches doivent être confirmées avant la clôture."
        );

        return;
      }

      setIsSubmitting(true);

      try {
        let processusMisAJour;

        /*
         * Si le composant parent gère
         * terminer-etape, on utilise
         * uniquement onComplete.
         *
         * Sinon, le composant appelle
         * directement l'API.
         */
        if (onComplete) {
          processusMisAJour =
            await onComplete({
              etape:
                numeroEtapeEmbauche,

              embauche: {
                processusId,

                candidats:
                  Object.values(
                    embauches
                  ),

                nombreEmbauche:
                  statistiques
                    .confirmees,

                dateCloture:
                  new Date()
                    .toISOString(),
              },
            });
        } else {
          processusMisAJour =
            await recrutementApi
              .terminerEtapeProcessus(
                processusId,
                numeroEtapeEmbauche
              );
        }

        setMessage(
          "Le processus de recrutement est terminé."
        );

        console.log(
          "Processus terminé :",
          processusMisAJour
        );
      } catch (error) {
        console.error(error);

        setErreur(
          recrutementApi
            .extraireErreur(error)
        );
      } finally {
        setIsSubmitting(false);
      }
    };

  if (chargement) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2
            size={20}
            className="animate-spin text-blue-600"
          />

          Chargement des candidats...
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={terminerProcessus}
      className="min-w-0 max-w-full space-y-4 px-0 sm:px-1"
    >
      {message && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0"
          />

          {message}
        </div>
      )}

      {erreur && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          {erreur}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 sm:px-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700">
              <BriefcaseBusiness
                size={21}
              />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                Embauche des collaborateurs
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {demande.reference ||
                  recrutement?.reference ||
                  "-"}{" "}
                ·{" "}
                {obtenirPoste(
                  recrutement
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Users size={17} />

            {candidats.length} candidat(s)
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">
            Candidats
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {statistiques.total}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">
            Embauches confirmées
          </p>

          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {statistiques.confirmees}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">
            Dossiers restants
          </p>

          <p className="mt-2 text-2xl font-bold text-amber-900">
            {statistiques.restantes}
          </p>
        </div>
      </section>

      {estCadre && candidats.length > 0 && (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-3 py-3 sm:px-4">
            <h3 className="font-semibold text-slate-900">
              Checklist d'embauche et d'onboarding des cadres
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Une ligne correspond à  un candidat. Le RI et le Code société
              sont validés automatiquement après leur envoi par e-mail.
            </p>
            <p className="mt-1 text-[11px] font-medium text-blue-600 lg:hidden">
              Faites défiler horizontalement pour voir toutes les colonnes.
            </p>
          </div>

          <div
            className="block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1"
            tabIndex={0}
            role="region"
            aria-label="Checklist d'embauche scrollable horizontalement"
          >
            <table className="w-full min-w-[1050px] border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="sticky left-0 z-10 min-w-[180px] border-r border-slate-200 bg-slate-100 px-2.5 py-2.5">
                    Candidat
                  </th>
                  <th className="min-w-[110px] px-2 py-2.5">Contrat</th>
                  <th className="min-w-[145px] px-2 py-2.5">Prise de poste</th>
                  <th className="min-w-[110px] px-2 py-2.5 text-center">Dossier complet</th>
                  <th className="min-w-[105px] px-2 py-2.5 text-center">Contrat signé</th>
                  <th className="min-w-[115px] px-2 py-2.5 text-center">Intégration</th>
                  <th className="min-w-[100px] px-2 py-2.5 text-center">RI</th>
                  <th className="min-w-[115px] px-2 py-2.5 text-center">Code société</th>
                  <th className="min-w-[175px] px-2 py-2.5">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {candidats.map((candidat) => {
                  const embauche = embauches[candidat.id];

                  if (!embauche) return null;

                  const traitement = candidatEnCours === candidat.id;
                  const nom = obtenirNomCandidat(candidat);

                  return (
                    <tr
                      key={candidat.id}
                      className={
                        embauche.checklistOnboardingComplete
                          ? "bg-emerald-50/40"
                          : "hover:bg-slate-50"
                      }
                    >
                      <td className="sticky left-0 z-10 border-r border-slate-200 bg-inherit px-2.5 py-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {nom}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {candidat.email || "Aucun e-mail"}
                        </p>
                        <span
                          className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                            embauche.confirmee
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {embauche.confirmee
                            ? "Embauche confirmée"
                            : "A confirmer"}
                        </span>
                      </td>

                      <td className="px-2 py-3">
                        <select
                          value={embauche.typeContrat}
                          disabled={embauche.confirmee || traitement}
                          onChange={(event) =>
                            modifierEmbauche(
                              candidat.id,
                              "typeContrat",
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100"
                        >
                          <option value="">Choisir</option>
                          {Number(demande.nombre_cdi ?? recrutement?.nombre_cdi ?? 0) > 0 && (
                            <option value="CDI">CDI</option>
                          )}
                          {Number(demande.nombre_cdd ?? recrutement?.nombre_cdd ?? 0) > 0 && (
                            <option value="CDD">CDD</option>
                          )}
                        </select>
                      </td>

                      <td className="px-2 py-3">
                        <input
                          type="date"
                          value={embauche.dateDebutContrat}
                          disabled={embauche.confirmee || traitement}
                          onChange={(event) =>
                            modifierEmbauche(
                              candidat.id,
                              "dateDebutContrat",
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100"
                        />
                      </td>

                      {[
                        ["dossierEmbaucheComplet", embauche.confirmee],
                        ["contratTravailSigne", embauche.confirmee],
                        ["journeeIntegrationRealisee", false],
                      ].map(([champ, verrouille]) => (
                        <td key={champ} className="px-2 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(embauche[champ])}
                            disabled={Boolean(verrouille) || traitement}
                            onChange={(event) =>
                              modifierEmbauche(
                                candidat.id,
                                champ,
                                event.target.checked
                              )
                            }
                            className="h-5 w-5 rounded border-slate-300 text-blue-600"
                          />
                        </td>
                      ))}

                      <td className="px-2 py-3 text-center text-xs">
                        <span className={embauche.reglementInterieurCommunique ? "text-emerald-600" : "text-slate-400"}>
                          {embauche.reglementInterieurCommunique ? "✓ Communiqué" : "- En attente"}
                        </span>
                      </td>

                      <td className="px-2 py-3 text-center text-xs">
                        <span className={embauche.codeSocieteCommunique ? "text-emerald-600" : "text-slate-400"}>
                          {embauche.codeSocieteCommunique ? "✓ Communiqué" : "- En attente"}
                        </span>
                      </td>

                      <td className="px-2 py-3">
                        {!embauche.confirmee ? (
                          <button
                            type="button"
                            disabled={traitement}
                            onClick={() => confirmerEmbaucheCandidat(candidat)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {traitement ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
                            Confirmer l'embauche
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <button
                              type="button"
                              disabled={traitement}
                              onClick={() => enregistrerChecklistCadre(candidat)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {traitement ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                              Enregistrer
                            </button>

                            <button
                              type="button"
                              disabled={traitement}
                              onClick={() => telechargerFichePoste(candidat)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                              <Download size={15} />
                              Fiche de poste
                            </button>

                            {!embauche.documentsCadreEmailEnvoyes && (
                              <button
                                type="button"
                                disabled={traitement}
                                onClick={() => confirmerEmbaucheCandidat(candidat)}
                                className="w-full rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                              >
                                Réessayer l'e-mail
                              </button>
                            )}

                            {embauche.checklistOnboardingComplete && (
                              <p className="flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 size={14} /> Prêt à  clôturer
                              </p>
                            )}

                            {embauche.erreurEnvoiDocumentsCadre && (
                              <p className="text-xs text-red-600">
                                {embauche.erreurEnvoiDocumentsCadre}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {estCadre && candidats.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center text-sm text-amber-700">
          Aucun candidat cadre retenu n'est disponible pour l'embauche.
        </div>
      )}

      {!estCadre && candidats.length > 0 && (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <FileCheck2 size={18} className="text-blue-600" />
              Récapitulatif des dossiers d'embauche
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Une ligne par candidat. Indiquez dans « Remarques » les documents manquants ou les anomalies éventuelles.
            </p>
          </div>

          {/* Date commune et recherche */}
          <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Rechercher un candidat
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={recherche}
                  onChange={(event) => setRecherche(event.target.value)}
                  placeholder="Nom ou prénom…"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
              {recherche.trim() && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {candidats.filter(correspondRecherche).length} candidat(s) affiché(s) sur {candidats.length}.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Date d'embauche commune
                <span className="ml-1 text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dateCommune}
                disabled={!resteAConfirmer}
                onChange={(event) =>
                  modifierDateCommune(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Appliquée à tous les candidats. Une date changée sur une ligne (exception) est conservée.
              </p>
            </div>
          </div>

          <div
            className="block max-h-[60vh] w-full min-w-0 max-w-full overflow-auto overscroll-contain pb-1"
            tabIndex={0}
            role="region"
            aria-label="Récapitulatif des dossiers d'embauche"
          >
            <table className="w-full min-w-[1050px] border-collapse text-sm">
              {/* En-tête figé en haut pendant le défilement vertical. */}
              <thead className="sticky top-0 z-30 bg-slate-100 shadow-[0_1px_0_0_#e2e8f0]">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="sticky left-0 z-20 min-w-[200px] border-r border-slate-200 bg-slate-100 px-3 py-3">
                    Candidat
                  </th>
                  <th className="min-w-[110px] px-3 py-3">Contrat</th>
                  <th className="min-w-[150px] px-3 py-3">Date d'embauche</th>
                  <th className="min-w-[100px] px-3 py-3 text-center">Contrat signé</th>
                  <th className="min-w-[240px] px-3 py-3">Remarques</th>
                  <th className="min-w-[180px] px-3 py-3">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {candidats.map((candidat) => {
                  const embauche = embauches[candidat.id];

                  if (!embauche || !correspondRecherche(candidat)) return null;

                  const traitement = candidatEnCours === candidat.id;
                  const verrouille = embauche.confirmee || traitement;

                  return (
                    <React.Fragment key={candidat.id}>
                      <tr className={`align-top ${embauche.confirmee ? "bg-emerald-50/40" : "hover:bg-slate-50"}`}>
                        <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-3">
                          <p className="font-semibold text-slate-900">
                            {obtenirNomCandidat(candidat)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {[candidat.telephone, candidat.email].filter(Boolean).join(" · ") || "Aucun contact"}
                          </p>
                          <span
                            className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              embauche.confirmee
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {embauche.confirmee ? "Embauché" : "À confirmer"}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <select
                            value={embauche.typeContrat}
                            disabled={verrouille}
                            onChange={(event) =>
                              modifierEmbauche(candidat.id, "typeContrat", event.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100"
                          >
                            <option value="">Choisir</option>
                            {Number(demande.nombre_cdi ?? recrutement?.nombre_cdi ?? 0) > 0 && (
                              <option value="CDI">CDI</option>
                            )}
                            {Number(demande.nombre_cdd ?? recrutement?.nombre_cdd ?? 0) > 0 && (
                              <option value="CDD">CDD</option>
                            )}
                          </select>
                        </td>

                        <td className="px-3 py-3">
                          <input
                            type="date"
                            value={embauche.dateDebutContrat}
                            disabled={verrouille}
                            onChange={(event) =>
                              modifierEmbauche(candidat.id, "dateDebutContrat", event.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100"
                          />
                          {!embauche.confirmee &&
                            dateCommune &&
                            embauche.dateDebutContrat &&
                            embauche.dateDebutContrat !== dateCommune && (
                              <button
                                type="button"
                                onClick={() =>
                                  modifierEmbauche(candidat.id, "dateDebutContrat", dateCommune)
                                }
                                className="mt-1 text-[10px] font-semibold text-amber-700 hover:underline"
                                title="Remettre la date d'embauche commune"
                              >
                                Exception · remettre la date commune
                              </button>
                            )}
                        </td>

                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            title="Signatures du candidat et de l'employeur vérifiées"
                            checked={embauche.signeCandidat && embauche.signeEmployeur}
                            disabled={verrouille}
                            onChange={(event) =>
                              modifierContratSigne(candidat.id, event.target.checked)
                            }
                            className="h-5 w-5 rounded border-slate-300 text-blue-600"
                          />
                        </td>

                        <td className="px-3 py-3">
                          <textarea
                            rows={2}
                            value={embauche.remarqueGenerale}
                            disabled={traitement}
                            onChange={(event) =>
                              modifierEmbauche(candidat.id, "remarqueGenerale", event.target.value)
                            }
                            placeholder="Documents manquants, anomalies, régularisations…"
                            className="w-full resize-none rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500 disabled:bg-slate-100"
                          />
                        </td>

                        <td className="px-3 py-3">
                          {!embauche.confirmee ? (
                            traitement ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                                <Loader2 size={14} className="animate-spin" />
                                Confirmation…
                              </span>
                            ) : ligneComplete(candidat) ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 size={14} />
                                Prêt à confirmer
                              </span>
                            ) : (
                              <span className="inline-flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                                <AlertCircle size={14} className="mt-px shrink-0" />
                                <span>
                                  <span className="font-semibold">À compléter :</span>{" "}
                                  {elementsManquants(candidat).join(", ")}
                                </span>
                              </span>
                            )
                          ) : (
                            <button
                              type="button"
                              disabled={traitement}
                              onClick={() => telechargerFichePoste(candidat)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                              <Download size={15} />
                              Fiche de poste
                            </button>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {resteAConfirmer && (() => {
            const nombrePrets = candidats.filter(
              (candidat) =>
                embauches[candidat.id] &&
                !embauches[candidat.id].confirmee &&
                correspondRecherche(candidat) &&
                ligneComplete(candidat)
            ).length;

            return (
              <div className="flex flex-col items-end gap-1 border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  disabled={confirmationGroupee || candidatEnCours !== null || nombrePrets === 0}
                  onClick={confirmerToutesLesEmbauches}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmationGroupee ? <Loader2 size={17} className="animate-spin" /> : <UserCheck size={17} />}
                  Confirmer l'embauche
                  {nombrePrets > 0 && ` (${nombrePrets})`}
                </button>
                <p className="text-[11px] text-slate-500">
                  {nombrePrets === 0
                    ? "Complétez au moins une ligne (contrat, date d'embauche, contrat signé)."
                    : "Seules les lignes « Prêt à confirmer » seront confirmées ; les autres restent à compléter."}
                </p>
              </div>
            );
          })()}
        </section>
      )}

      {!estCadre && candidats.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center text-sm text-amber-700">
          Aucun candidat n'est disponible pour l'embauche.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            !toutesLesChecklistsCompletes
          }
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2
              size={17}
              className="animate-spin"
            />
          ) : (
            <Save size={17} />
          )}

          {isSubmitting
            ? "Clôture..."
            : "Terminer le processus"}
        </button>
      </div>
    </form>
  );
}
