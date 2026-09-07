import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  FileCheck2,
  Loader2,
  Save,
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
    "—"
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

  const numeroEtapeEmbauche =
    estCadre ? 5 : 6;

  const [candidats, setCandidats] =
    useState([]);

  const [embauches, setEmbauches] =
    useState({});

  const [
    confirmationFinale,
    setConfirmationFinale,
  ] = useState(false);

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

  useEffect(() => {
    let composantActif = true;

    async function chargerDonnees() {
      if (!processusId) {
        setErreur(
          "L’identifiant du processus est introuvable."
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

    setConfirmationFinale(false);
    setErreur("");
    setMessage("");
  };

  const modifierDocument = (
    candidatId,
    documentId,
    champ,
    valeur
  ) => {
    setEmbauches((previous) => ({
      ...previous,

      [candidatId]: {
        ...previous[candidatId],

        documents:
          previous[
            candidatId
          ].documents.map(
            (document) =>
              document.id ===
              documentId
                ? {
                    ...document,
                    [champ]: valeur,
                  }
                : document
          ),
      },
    }));

    setConfirmationFinale(false);
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

  const colonnesDocumentsOuvriers =
    useMemo(() => {
      if (estCadre) {
        return [];
      }

      const libelles = new Set();

      candidats.forEach((candidat) => {
        const documents =
          embauches[candidat.id]
            ?.documents || [];

        documents.forEach((document) => {
          if (document.libelle) {
            libelles.add(document.libelle);
          }
        });
      });

      return Array.from(libelles);
    }, [candidats, embauches, estCadre]);

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

    if (
      !embauche
        .dateVerification
    ) {
      setErreur(
        `La date de vérification de ${nom} est obligatoire.`
      );

      return false;
    }

    if (
      !embauche
        .verificateur
        .trim()
    ) {
      setErreur(
        `Le vérificateur du dossier de ${nom} est obligatoire.`
      );

      return false;
    }

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

    if (!estCadre) {
      if (
        embauche.documents.length ===
        0
      ) {
        setErreur(
          `Aucune pièce obligatoire n’est disponible pour ${nom}.`
        );

        return false;
      }

      const documentManquant =
        embauche.documents.find(
          (document) =>
            !document.recu
        );

      if (documentManquant) {
        setErreur(
          `La pièce « ${documentManquant.libelle} » de ${nom} n’est pas encore reçue.`
        );

        return false;
      }
    }

    if (estCadre) {
      if (!embauche.dossierEmbaucheComplet) {
        setErreur(
          `Le dossier d’embauche de ${nom} doit être complet.`
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
      if (!embauche.signeCandidat) {
        setErreur(
          `La signature du candidat doit être confirmée pour ${nom}.`
        );
        return false;
      }

      if (!embauche.signeEmployeur) {
        setErreur(
          `La signature de l’employeur doit être confirmée pour ${nom}.`
        );
        return false;
      }
    }

    return true;
  };

  const enregistrerDocuments =
    async (embauche) => {
      if (estCadre) {
        return [];
      }

      return Promise.all(
        embauche.documents.map(
          (document) =>
            recrutementApi
              .modifierDocumentCandidat(
                document.id,
                {
                  recu:
                    document.recu,

                  remarque:
                    document.remarque,
                }
              )
        )
      );
    };

  const confirmerEmbaucheCandidat =
    async (candidat) => {
      setErreur("");
      setMessage("");

      if (
        !verifierEmbauche(candidat)
      ) {
        return;
      }

      const embauche =
        embauches[candidat.id];

      setCandidatEnCours(
        candidat.id
      );

      try {
        await enregistrerDocuments(
          embauche
        );

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
          `L’embauche de ${obtenirNomCandidat(
            candidat
          )} a été confirmée.`
        );
      } catch (error) {
        console.error(error);

        setErreur(
          recrutementApi
            .extraireErreur(error)
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
        "Confirmez d’abord l’embauche avant d’enregistrer la suite de l’onboarding."
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
            ? "Toutes les checklists d’onboarding doivent être complètes avant la clôture."
            : "Toutes les embauches doivent être confirmées avant la clôture."
        );

        return;
      }

      if (!confirmationFinale) {
        setErreur(
          "Veuillez confirmer la clôture du processus."
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
         * directement l’API.
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
      className="min-w-0 max-w-full space-y-4 px-1 sm:px-2"
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
                  "—"}{" "}
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
              Checklist d’embauche et d’onboarding des cadres
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Une ligne correspond �  un candidat. Le RI et le Code société
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
            aria-label="Checklist d’embauche scrollable horizontalement"
          >
            <table className="w-max min-w-[980px] border-collapse text-sm">
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
                            : "À confirmer"}
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
                          {embauche.reglementInterieurCommunique ? "✓ Communiqué" : "— En attente"}
                        </span>
                      </td>

                      <td className="px-2 py-3 text-center text-xs">
                        <span className={embauche.codeSocieteCommunique ? "text-emerald-600" : "text-slate-400"}>
                          {embauche.codeSocieteCommunique ? "✓ Communiqué" : "— En attente"}
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
                            Confirmer l’embauche
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

                            {!embauche.documentsCadreEmailEnvoyes && (
                              <button
                                type="button"
                                disabled={traitement}
                                onClick={() => confirmerEmbaucheCandidat(candidat)}
                                className="w-full rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                              >
                                Réessayer l’e-mail
                              </button>
                            )}

                            {embauche.checklistOnboardingComplete && (
                              <p className="flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 size={14} /> Prêt �  clôturer
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
          Aucun candidat cadre retenu n’est disponible pour l’embauche.
        </div>
      )}

      {!estCadre && candidats.length > 0 && (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <h3 className="font-semibold text-slate-900">
              Dossiers d’embauche des ouvriers
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Une ligne correspond �  un candidat et une colonne �  une pièce du dossier.
            </p>

            <p className="mt-1 text-[11px] font-medium text-blue-600">
              Faites défiler horizontalement pour consulter toutes les pièces.
            </p>
          </div>

          <div
            className="block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1"
            tabIndex={0}
            role="region"
            aria-label="Dossiers d’embauche des ouvriers"
          >
            <table className="w-max min-w-full border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <th className="sticky left-0 z-20 min-w-[190px] border-r border-slate-200 bg-slate-100 px-3 py-3">
                    Candidat
                  </th>

                  <th className="min-w-[145px] px-2 py-3">
                    Vérification
                  </th>

                  <th className="min-w-[150px] px-2 py-3">
                    Vérificateur
                  </th>

                  {colonnesDocumentsOuvriers.map(
                    (libelle) => (
                      <th
                        key={libelle}
                        title={libelle}
                        className="min-w-[130px] max-w-[160px] px-2 py-3 text-center normal-case"
                      >
                        <span className="line-clamp-3 leading-4">
                          {libelle}
                        </span>
                      </th>
                    )
                  )}

                  <th className="min-w-[110px] px-2 py-3">
                    Contrat
                  </th>

                  <th className="min-w-[145px] px-2 py-3">
                    Prise de poste
                  </th>

                  <th className="min-w-[105px] px-2 py-3 text-center">
                    Signature candidat
                  </th>

                  <th className="min-w-[105px] px-2 py-3 text-center">
                    Signature employeur
                  </th>

                  <th className="min-w-[190px] px-2 py-3">
                    Remarque
                  </th>

                  <th className="sticky right-0 z-20 min-w-[180px] border-l border-slate-200 bg-slate-100 px-3 py-3">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {candidats.map((candidat) => {
                  const embauche =
                    embauches[candidat.id];

                  if (!embauche) {
                    return null;
                  }

                  const traitement =
                    candidatEnCours ===
                    candidat.id;

                  const verrouille =
                    embauche.confirmee ||
                    traitement;

                  const nombrePiecesRecues =
                    embauche.documents.filter(
                      (document) =>
                        document.recu
                    ).length;

                  return (
                    <tr
                      key={candidat.id}
                      className={
                        embauche.confirmee
                          ? "bg-emerald-50/40"
                          : "hover:bg-slate-50"
                      }
                    >
                      <td className={`sticky left-0 z-10 border-r border-slate-200 px-3 py-3 ${
                        embauche.confirmee
                          ? "bg-emerald-50"
                          : "bg-white"
                      }`}>
                        <p className="font-semibold text-slate-900">
                          {obtenirNomCandidat(
                            candidat
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {nombrePiecesRecues}/
                          {embauche.documents.length}{" "}
                          pièces reçues
                        </p>

                        <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                          embauche.confirmee
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {embauche.confirmee
                            ? "Embauché"
                            : "À compléter"}
                        </span>
                      </td>

                      <td className="px-2 py-3">
                        <input
                          type="date"
                          value={
                            embauche.dateVerification
                          }
                          disabled={verrouille}
                          onChange={(event) =>
                            modifierEmbauche(
                              candidat.id,
                              "dateVerification",
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100"
                        />
                      </td>

                      <td className="px-2 py-3">
                        <input
                          value={embauche.verificateur}
                          disabled={verrouille}
                          onChange={(event) =>
                            modifierEmbauche(
                              candidat.id,
                              "verificateur",
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100"
                        />
                      </td>

                      {colonnesDocumentsOuvriers.map(
                        (libelle) => {
                          const document =
                            embauche.documents.find(
                              (item) =>
                                item.libelle ===
                                libelle
                            );

                          return (
                            <td
                              key={libelle}
                              className="px-2 py-3 text-center"
                              title={
                                document?.remarque ||
                                libelle
                              }
                            >
                              {document ? (
                                <input
                                  type="checkbox"
                                  checked={Boolean(
                                    document.recu
                                  )}
                                  disabled={verrouille}
                                  onChange={(event) =>
                                    modifierDocument(
                                      candidat.id,
                                      document.id,
                                      "recu",
                                      event.target.checked
                                    )
                                  }
                                  aria-label={`${libelle} reçu pour ${obtenirNomCandidat(
                                    candidat
                                  )}`}
                                  className="h-5 w-5 rounded border-slate-300 text-blue-600 disabled:opacity-60"
                                />
                              ) : (
                                <span className="text-slate-300">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        }
                      )}

                      <td className="px-2 py-3">
                        <select
                          value={embauche.typeContrat}
                          disabled={verrouille}
                          onChange={(event) =>
                            modifierEmbauche(
                              candidat.id,
                              "typeContrat",
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100"
                        >
                          <option value="">
                            Choisir
                          </option>

                          {Number(
                            demande.nombre_cdi ??
                              recrutement?.nombre_cdi ??
                              0
                          ) > 0 && (
                            <option value="CDI">
                              CDI
                            </option>
                          )}

                          {Number(
                            demande.nombre_cdd ??
                              recrutement?.nombre_cdd ??
                              0
                          ) > 0 && (
                            <option value="CDD">
                              CDD
                            </option>
                          )}
                        </select>
                      </td>

                      <td className="px-2 py-3">
                        <input
                          type="date"
                          value={
                            embauche.dateDebutContrat
                          }
                          disabled={verrouille}
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

                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(
                            embauche.signeCandidat
                          )}
                          disabled={verrouille}
                          onChange={(event) =>
                            modifierEmbauche(
                              candidat.id,
                              "signeCandidat",
                              event.target.checked
                            )
                          }
                          className="h-5 w-5 rounded border-slate-300 text-blue-600 disabled:opacity-60"
                        />
                      </td>

                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(
                            embauche.signeEmployeur
                          )}
                          disabled={verrouille}
                          onChange={(event) =>
                            modifierEmbauche(
                              candidat.id,
                              "signeEmployeur",
                              event.target.checked
                            )
                          }
                          className="h-5 w-5 rounded border-slate-300 text-blue-600 disabled:opacity-60"
                        />
                      </td>

                      <td className="px-2 py-3">
                        <textarea
                          value={
                            embauche.remarqueGenerale
                          }
                          disabled={verrouille}
                          onChange={(event) =>
                            modifierEmbauche(
                              candidat.id,
                              "remarqueGenerale",
                              event.target.value
                            )
                          }
                          rows={2}
                          placeholder="Remarque..."
                          className="w-full resize-none rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-100"
                        />
                      </td>

                      <td className={`sticky right-0 z-10 border-l border-slate-200 px-3 py-3 ${
                        embauche.confirmee
                          ? "bg-emerald-50"
                          : "bg-white"
                      }`}>
                        {embauche.confirmee ? (
                          <div className="flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={15} />
                            Confirmée
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              confirmerEmbaucheCandidat(
                                candidat
                              )
                            }
                            disabled={traitement}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {traitement ? (
                              <Loader2
                                size={15}
                                className="animate-spin"
                              />
                            ) : (
                              <UserCheck size={15} />
                            )}

                            Confirmer
                          </button>
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

      {!estCadre && candidats.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-700">
          Aucun candidat ouvrier n’est disponible pour l’embauche.
        </div>
      )}

      {false && !estCadre && (
      <div className="space-y-5">
        {candidats.map(
          (candidat) => {
            const embauche =
              embauches[candidat.id];

            if (!embauche) {
              return null;
            }

            const nom =
              obtenirNomCandidat(
                candidat
              );

            const traitement =
              candidatEnCours ===
              candidat.id;

            const nombrePiecesRecues =
              embauche.documents.filter(
                (document) =>
                  document.recu
              ).length;

            return (
              <section
                key={candidat.id}
                className={`
                  overflow-hidden rounded-xl
                  border bg-white
                  ${
                    embauche.confirmee
                      ? "border-emerald-300"
                      : "border-slate-200"
                  }
                `}
              >
                <div
                  className={`
                    flex flex-col
                    justify-between gap-4
                    border-b px-5 py-4
                    sm:flex-row
                    sm:items-center
                    ${
                      embauche.confirmee
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    }
                  `}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {nom}
                      </p>

                      {embauche.confirmee && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2
                            size={13}
                          />

                          Embauché
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      {candidat.telephone ||
                        "—"}{" "}
                      ·{" "}
                      {candidat.email ||
                        "—"}
                    </p>
                  </div>

                  {!estCadre && (
                    <p className="text-sm text-slate-600">
                      {nombrePiecesRecues}/
                      {embauche.documents.length}{" "}
                      pièces reçues
                    </p>
                  )}
                </div>

                <fieldset
                  disabled={
                    traitement ||
                    (!estCadre && embauche.confirmee)
                  }
                  className={
                    !estCadre && embauche.confirmee
                      ? "opacity-75"
                      : ""
                  }
                >
                  <div className="border-b border-slate-200 p-5">
                    <h3 className="mb-5 flex items-center gap-2 font-semibold text-slate-900">
                      <FileCheck2
                        size={18}
                        className="text-blue-600"
                      />

                      Vérification du dossier
                    </h3>

                    <div className="mb-5 grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Date de vérification
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </label>

                        <input
                          type="date"
                          value={
                            embauche
                              .dateVerification
                          }
                          onChange={(
                            event
                          ) =>
                            modifierEmbauche(
                              candidat.id,
                              "dateVerification",
                              event.target
                                .value
                            )
                          }
                          required
                          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Vérificateur
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </label>

                        <input
                          value={
                            embauche
                              .verificateur
                          }
                          onChange={(
                            event
                          ) =>
                            modifierEmbauche(
                              candidat.id,
                              "verificateur",
                              event.target
                                .value
                            )
                          }
                          required
                          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {!estCadre && (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full min-w-[700px]">
                        <thead className="bg-slate-100">
                          <tr className="text-left text-xs font-semibold uppercase text-slate-600">
                            <th className="px-4 py-3">
                              Pièce
                            </th>

                            <th className="px-4 py-3 text-center">
                              Reçue
                            </th>

                            <th className="px-4 py-3">
                              Remarque
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200">
                          {embauche.documents.map(
                            (document) => (
                              <tr
                                key={
                                  document.id
                                }
                              >
                                <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                  {
                                    document.libelle
                                  }
                                </td>

                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={
                                      document.recu
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      modifierDocument(
                                        candidat.id,
                                        document.id,
                                        "recu",
                                        event
                                          .target
                                          .checked
                                      )
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                  />
                                </td>

                                <td className="px-4 py-3">
                                  <input
                                    value={
                                      document.remarque
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      modifierDocument(
                                        candidat.id,
                                        document.id,
                                        "remarque",
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    placeholder="Remarque..."
                                    className="w-full min-w-[250px] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                  />
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>

                  <div className="p-5">
                    <h3 className="mb-5 font-semibold text-slate-900">
                      Contrat de travail
                    </h3>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Type de contrat
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </label>

                        <select
                          disabled={embauche.confirmee}
                          value={
                            embauche
                              .typeContrat
                          }
                          onChange={(
                            event
                          ) =>
                            modifierEmbauche(
                              candidat.id,
                              "typeContrat",
                              event.target
                                .value
                            )
                          }
                          required
                          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                        >
                          <option value="">
                            Sélectionner
                          </option>

                          {Number(
                            demande.nombre_cdi ??
                              recrutement
                                ?.nombre_cdi ??
                              0
                          ) > 0 && (
                            <option value="CDI">
                              CDI
                            </option>
                          )}

                          {Number(
                            demande.nombre_cdd ??
                              recrutement
                                ?.nombre_cdd ??
                              0
                          ) > 0 && (
                            <option value="CDD">
                              CDD
                            </option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Date de début
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </label>

                        <input
                          type="date"
                          disabled={embauche.confirmee}
                          value={
                            embauche
                              .dateDebutContrat
                          }
                          onChange={(
                            event
                          ) =>
                            modifierEmbauche(
                              candidat.id,
                              "dateDebutContrat",
                              event.target
                                .value
                            )
                          }
                          required
                          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {estCadre ? (
                      <div className="mt-5 space-y-3">
                        <h4 className="text-sm font-semibold text-slate-900">
                          Checklist obligatoire d’embauche et d’onboarding
                        </h4>

                        <div className="grid gap-3 md:grid-cols-2">
                          {[
                            {
                              champ: "dossierEmbaucheComplet",
                              label: "Dossier d’embauche complet",
                              verrouille: embauche.confirmee,
                            },
                            {
                              champ: "contratTravailSigne",
                              label: "Contrat de travail signé",
                              verrouille: embauche.confirmee,
                            },
                            {
                              champ: "journeeIntegrationRealisee",
                              label: "Journée d’intégration réalisée",
                              verrouille: false,
                            },
                          ].map((item) => (
                            <label
                              key={item.champ}
                              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(embauche[item.champ])}
                                disabled={item.verrouille}
                                onChange={(event) =>
                                  modifierEmbauche(
                                    candidat.id,
                                    item.champ,
                                    event.target.checked
                                  )
                                }
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                              />
                              <span className="text-sm font-semibold text-slate-800">
                                {item.label}
                              </span>
                            </label>
                          ))}

                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-800">
                              Règlement intérieur communiqué
                            </p>
                            <p className={`mt-1 text-xs ${
                              embauche.reglementInterieurCommunique
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }`}>
                              {embauche.reglementInterieurCommunique
                                ? "Oui — confirmé par le système"
                                : "En attente de l’envoi automatique"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-800">
                              Code société communiqué
                            </p>
                            <p className={`mt-1 text-xs ${
                              embauche.codeSocieteCommunique
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }`}>
                              {embauche.codeSocieteCommunique
                                ? "Oui — confirmé par le système"
                                : "En attente de l’envoi automatique"}
                            </p>
                          </div>
                        </div>

                        <div className={`rounded-lg border p-4 text-sm ${
                          embauche.documentsCadreEmailEnvoyes
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}>
                          {embauche.documentsCadreEmailEnvoyes
                            ? `RI et Code société envoyés le ${new Intl.DateTimeFormat(
                                "fr-FR",
                                { dateStyle: "short", timeStyle: "short" }
                              ).format(new Date(embauche.dateEnvoiDocumentsCadre))}.`
                            : embauche.erreurEnvoiDocumentsCadre ||
                              "Les documents seront envoyés automatiquement lors de la confirmation de l’embauche."}
                        </div>

                        {embauche.confirmee &&
                          !embauche.documentsCadreEmailEnvoyes && (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  confirmerEmbaucheCandidat(candidat)
                                }
                                disabled={traitement}
                                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                              >
                                {traitement && (
                                  <Loader2
                                    size={16}
                                    className="animate-spin"
                                  />
                                )}
                                Réessayer l’envoi du RI et du Code société
                              </button>
                            </div>
                          )}
                      </div>
                    ) : (
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <input
                          type="checkbox"
                          checked={
                            embauche
                              .signeCandidat
                          }
                          onChange={(
                            event
                          ) =>
                            modifierEmbauche(
                              candidat.id,
                              "signeCandidat",
                              event.target
                                .checked
                            )
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                        />

                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            Contrat signé par
                            le candidat
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            La signature a
                            été vérifiée.
                          </p>
                        </div>
                      </label>

                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <input
                          type="checkbox"
                          checked={
                            embauche
                              .signeEmployeur
                          }
                          onChange={(
                            event
                          ) =>
                            modifierEmbauche(
                              candidat.id,
                              "signeEmployeur",
                              event.target
                                .checked
                            )
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                        />

                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            Contrat signé par
                            l’employeur
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            La signature a
                            été vérifiée.
                          </p>
                        </div>
                      </label>
                    </div>
                    )}

                    <div className="mt-5">
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Remarque générale
                      </label>

                      <textarea
                        value={
                          embauche
                            .remarqueGenerale
                        }
                        onChange={(
                          event
                        ) =>
                          modifierEmbauche(
                            candidat.id,
                            "remarqueGenerale",
                            event.target
                              .value
                          )
                        }
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    {!embauche.confirmee && (
                      <div className="mt-6 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            confirmerEmbaucheCandidat(
                              candidat
                            )
                          }
                          disabled={
                            traitement
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {traitement ? (
                            <Loader2
                              size={17}
                              className="animate-spin"
                            />
                          ) : (
                            <UserCheck
                              size={17}
                            />
                          )}

                          Confirmer l’embauche
                        </button>
                      </div>
                    )}

                    {estCadre && embauche.confirmee && (
                      <div className="mt-6 flex flex-col items-end gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            enregistrerChecklistCadre(candidat)
                          }
                          disabled={traitement}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {traitement ? (
                            <Loader2
                              size={17}
                              className="animate-spin"
                            />
                          ) : (
                            <Save size={17} />
                          )}
                          Enregistrer la checklist
                        </button>

                        {embauche.checklistOnboardingComplete && (
                          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                            <CheckCircle2 size={17} />
                            Checklist complète — prêt pour la clôture
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </fieldset>
              </section>
            );
          }
        )}

        {candidats.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center text-sm text-amber-700">
            Aucun candidat n’est disponible
            pour l’embauche.
          </div>
        )}
      </div>
      )}

      {toutesLesChecklistsCompletes && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <input
            type="checkbox"
            checked={
              confirmationFinale
            }
            onChange={(event) => {
              setConfirmationFinale(
                event.target.checked
              );

              setErreur("");
            }}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
          />

          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Je confirme la clôture du
              processus
            </p>

            <p className="mt-1 text-xs text-emerald-700">
              {estCadre
                ? "Toutes les checklists d’onboarding sont complètes."
                : "Tous les candidats retenus ont été embauchés."}
            </p>
          </div>
        </label>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            !toutesLesChecklistsCompletes ||
            !confirmationFinale
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