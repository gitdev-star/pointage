import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import recrutementApi from "../../../api/recrutementApi";
import EtapeCreationOffre from "./CreationOffre";
import EtapePublicationOffre from "./PubOffre";
import EtapeSuiviCandidatures from "./SuiviCandidat";
import EtapeFicheTransparence from "./FicheTransparence";
import EtapeRetourRH from "./RetourRH";
import EtapeEmbauche from "./Embauche";
import EtapePreparationEmbaucheCadre from "./EtapePreparationEmbaucheCadre";
import SuiviCandidatCadre from "./SuiviCandidatureCadre";
import CompteRenduEntretienCadre from "./CompteRendu";

import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileCheck2,
  FileText,
  Loader2,
  Megaphone,
  RefreshCw,
  ScanLine,
  UserMinus,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";

function dateDuJour() {
  return new Date().toISOString().split("T")[0];
}

function nomCandidatDepuisEmbauche(embauche) {
  return (
    embauche.candidat_nom_complet ||
    embauche.candidat_nom ||
    "Candidat"
  );
}

const ETAPES_OUVRIER = [
  {
    id: 1,
    titre: "Création de l'offre",
    description:
      "Créer une offre ou sélectionner une offre existante.",
    icon: FileText,
  },
  {
    id: 2,
    titre: "Publication de l'offre",
    description:
      "Enregistrer les canaux et les dates de publication.",
    icon: Megaphone,
  },
  {
    id: 3,
    titre: "Fiche de transparence",
    description:
      "Numériser et déposer la fiche de transparence.",
    icon: ScanLine,
  },
  {
    id: 4,
    titre: "Suivi des candidatures",
    description:
      "Ajouter les candidats et dÃ©poser les fiches de test.",
    icon: Users,
  },
  {
    id: 5,
    titre: "Retour RH",
    description:
      "Remettre et suivre la liste des dossiers à fournir.",
    icon: FileCheck2,
  },
  {
    id: 6,
    titre: "Embauche et clôture",
    description:
      "Confirmer l'embauche et clôturer le recrutement.",
    icon: UserRoundCheck,
  },
];

const ETAPES_CADRE = [
  {
    id: 1,
    titre: "Création de l'offre",
    description:
      "Créer une offre ou sélectionner une offre existante.",
    icon: FileText,
  },
  {
    id: 2,
    titre: "Publication de l'offre",
    description:
      "Enregistrer les canaux et les dates de publication.",
    icon: Megaphone,
  },
  {
    id: 3,
    titre: "Candidatures et entretiens",
    description:
      "Ajouter les candidats, réaliser les entretiens et compléter les comptes rendus.",
    icon: Users,
  },
  {
    id: 4,
    titre: "Préparation de l'embauche",
    description:
      "Suivre les préparations IT, Comptabilité et RH.",
    icon: FileCheck2,
  },
  {
    id: 5,
    titre: "Embauche et onboarding",
    description:
      "Confirmer l'embauche et terminer l'intégration.",
    icon: UserRoundCheck,
  },
];

function obtenirNombreTotal(demande) {
  if (demande.nombre_total !== undefined) {
    return Number(demande.nombre_total) || 0;
  }

  return (
    Number(demande.nombre_cdi || 0) +
    Number(demande.nombre_cdd || 0) +
    Number(demande.nombre_stage || 0) +
    Number(demande.nombre_interim || 0) +
    Number(demande.nombre_consultant || 0) +
    Number(demande.nombre_autre || 0)
  );
}

function obtenirTypesContrats(demande) {
  const contrats = [
    ["CDI", demande.nombre_cdi],
    ["CDD", demande.nombre_cdd],
    ["Stage", demande.nombre_stage],
    ["IntÃ©rim", demande.nombre_interim],
    ["Consultant", demande.nombre_consultant],
    ["Autre", demande.nombre_autre],
  ];

  const valeurs = contrats
    .filter(([, nombre]) => Number(nombre || 0) > 0)
    .map(([libelle, nombre]) => `${libelle} (${Number(nombre)})`);

  return valeurs.length ? valeurs.join(", ") : "-";
}

function normaliserCandidat(candidat) {
  return {
    ...candidat,
    dateCandidature:
      candidat.date_candidature || candidat.dateCandidature || "",
    sourceCandidature:
      candidat.source_candidature || candidat.sourceCandidature || "",
    ficheTest: candidat.fiche_test || candidat.ficheTest || null,
    retenu:
      candidat.retenu ??
      Boolean(candidat.fiche_test || candidat.ficheTest),
  };
}

function normaliserProcessus(data) {
  const demande = data.demande_detail || data.demande || {};

  return {
    ...data,
    reference:
      data.reference || demande.reference || `PROCESSUS-${data.id}`,
    poste:
      demande.poste_nom ||
      demande.designation_poste ||
      "Poste non renseignÃ©",
    departement:
      demande.departement_nom || "DÃ©partement non renseignÃ©",
    nombreARecruter: obtenirNombreTotal(demande),
    typeContrat: obtenirTypesContrats(demande),
    designationTaches: demande.designation_taches || "",
    profilDiplome: demande.profil_diplome || "",
    experiencesProfessionnelles:
      demande.experiences_professionnelles || "",
    competencesTechniques: demande.competences_techniques || "",
    autresCompetences: demande.autres_competences || "",
    savoirFaire: demande.savoir_faire || "",
    savoirEtre: demande.savoir_etre || "",
    datePrevueRecrutement:
      demande.date_prevue_recrutement || "",
    motifRecrutement: demande.motif_recrutement || "",
    motifRemplacement: demande.motif_remplacement || "",
    etapeActuelle: Number(data.etape_actuelle || 1),
    etapesTerminees: Array.isArray(data.etapes_terminees)
      ? data.etapes_terminees.map(Number)
      : [],
    offre: data.offre || null,
    publications: Array.isArray(data.publications)
      ? data.publications
      : [],
    ficheTransparence: data.fiche_transparence || null,
    candidats: Array.isArray(data.candidats)
      ? data.candidats.map(normaliserCandidat)
      : [],
    typeRecrutement:
      String(
        data.type_recrutement ||
          demande.type_recrutement ||
          "OUVRIER"
      ).toUpperCase(),
  };
}

function StepStatus({
  etapeId,
  etapesTerminees,
  etapeActuelle,
}) {
  if (etapesTerminees.includes(etapeId)) {
    return "TERMINEE";
  }

  if (etapeId === etapeActuelle) {
    return "EN_COURS";
  }

  return "A_FAIRE";
}

export default function DetailProcessusRecrutement() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [processus, setProcessus] = useState(null);
  const [selectedStep, setSelectedStep] = useState(1);
  const [etapesTerminees, setEtapesTerminees] = useState([]);
  const [donneesEtapes, setDonneesEtapes] = useState({});
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [embauches, setEmbauches] = useState([]);
  const [desistements, setDesistements] = useState([]);
  const [embaucheDesistement, setEmbaucheDesistement] =
    useState(null);
  const [envoiDesistement, setEnvoiDesistement] =
    useState(false);
  const [messageDesistement, setMessageDesistement] =
    useState("");
  const [formulaireDesistement, setFormulaireDesistement] =
    useState({
      dateDesistement: dateDuJour(),
      motif: "",
      commentaire: "",
      relancerRecrutement: true,
      dateRepriseRecrutement: dateDuJour(),
    });
  const estCadre =
    processus?.typeRecrutement === "CADRE";

  const etapesProcessus = estCadre
    ? ETAPES_CADRE
    : ETAPES_OUVRIER;
  const [
    candidatCompteRendu,
    setCandidatCompteRendu,
  ] = useState(null);

  const chargerProcessus = useCallback(async () => {
    if (!id) {
      setErreur("L'identifiant du processus est manquant.");
      setChargement(false);
      return;
    }

    setChargement(true);
    setErreur("");

    try {
      const [
        resultat,
        resultatEmbauches,
        resultatDesistements,
      ] = await Promise.all([
        recrutementApi.obtenirProcessusParId(id),
        recrutementApi.obtenirEmbauches({
          candidat__processus: id,
        }),
        recrutementApi.obtenirDesistements({
          embauche__candidat__processus: id,
        }),
      ]);
      const valeur = normaliserProcessus(resultat);

      setEmbauches(
        (resultatEmbauches.embauches || []).filter(
          (embauche) =>
            Boolean(
              embauche.confirmee ||
                embauche.date_confirmation
            )
        )
      );
      setDesistements(
        resultatDesistements.desistements || []
      );

      setProcessus(valeur);
      setSelectedStep(valeur.etapeActuelle);
      setEtapesTerminees(valeur.etapesTerminees);
      setDonneesEtapes(
        valeur.typeRecrutement === "CADRE"
          ? {
              1: { offre: valeur.offre },
              2: { publications: valeur.publications },
              3: {
                suiviCandidatures: {
                  candidats: valeur.candidats,
                },
              },
            }
          : {
              1: { offre: valeur.offre },
              2: { publications: valeur.publications },
              3: {
                ficheTransparence:
                  valeur.ficheTransparence,
              },
              4: {
                suiviCandidatures: {
                  candidats: valeur.candidats,
                },
              },
            }
      );
    } catch (error) {
      console.error("Erreur de chargement du processus :", error);
      setErreur(
        error.response?.status === 404
          ? "Ce processus de recrutement nâ€™existe pas."
          : error.response?.data?.detail ||
              "Impossible de charger le processus de recrutement."
      );
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => {
    chargerProcessus();
  }, [chargerProcessus]);

  const ouvrirDesistement = (embauche) => {
    setErreur("");
    setMessageDesistement("");
    setEmbaucheDesistement(embauche);
    setFormulaireDesistement({
      dateDesistement: dateDuJour(),
      motif: "",
      commentaire: "",
      relancerRecrutement: true,
      dateRepriseRecrutement: dateDuJour(),
    });
  };

  const fermerDesistement = () => {
    if (!envoiDesistement) {
      setEmbaucheDesistement(null);
    }
  };

  const enregistrerDesistement = async (event) => {
    event.preventDefault();
    setErreur("");

    if (
      formulaireDesistement.relancerRecrutement &&
      !formulaireDesistement.dateRepriseRecrutement
    ) {
      setErreur(
        "La date de reprise du recrutement est obligatoire."
      );
      return;
    }

        if (
      formulaireDesistement.relancerRecrutement &&
      formulaireDesistement.dateRepriseRecrutement <
        formulaireDesistement.dateDesistement
    ) {
      setErreur(
        "La date de reprise ne peut pas prÃ©cÃ©der la date du dÃ©sistement."
      );
      return;
    }

    if (
      !formulaireDesistement
        .relancerRecrutement &&
      !formulaireDesistement
        .motif
        .trim()
    ) {
      setErreur(
        "Le motif est obligatoire si le recrutement n'est pas repris."
      );

      return;
    }

    setEnvoiDesistement(true);

    try {
      await recrutementApi.signalerDesistement({
        embaucheId: embaucheDesistement.id,
        ...formulaireDesistement,
      });

      setEmbaucheDesistement(null);
      setMessageDesistement(
        "Le désistement a été enregistré et le processus a été actualisé."
      );
      await chargerProcessus();
    } catch (error) {
      console.error(
        "Erreur pendant l'enregistrement du désistement :",
        error
      );
      setErreur(recrutementApi.extraireErreur(error));
    } finally {
      setEnvoiDesistement(false);
    }
  };

  const etapeSelectionnee = useMemo(
    () =>
      etapesProcessus.find(
        (etape) =>
          etape.id === selectedStep
      ) || etapesProcessus[0],
    [selectedStep, etapesProcessus]
  );

  const progression = Math.round(
    (etapesTerminees.length / etapesProcessus.length) * 100
  );

  const terminerEtape = async (numeroEtape, donnees) => {
    if (enregistrement || !processus) return;

    setEnregistrement(true);
    setErreur("");

    try {
      const resultat =
        await recrutementApi.terminerEtapeProcessus(
          processus.id,
          numeroEtape
        );

      const processusReponse =
        resultat?.processus || resultat;

      const processusActualise = normaliserProcessus(
        processusReponse
      );

      setDonneesEtapes((previous) => ({
        ...previous,
        [numeroEtape]: donnees,
      }));

      const nouvellesEtapes =
        processusActualise.etapesTerminees.length > 0
          ? processusActualise.etapesTerminees
          : Array.from(
              new Set([
                ...etapesTerminees,
                numeroEtape,
              ])
            );

      setEtapesTerminees(nouvellesEtapes);
      setProcessus((previous) => ({
        ...previous,
        ...processusActualise,
        etapeActuelle: Number(
          processusActualise.etapeActuelle ||
            Math.min(
              numeroEtape + 1,
              etapesProcessus.length
            )
        ),
        etapesTerminees: nouvellesEtapes,
      }));

      if (numeroEtape < etapesProcessus.length) {
        setSelectedStep(numeroEtape + 1);
      }
    } catch (error) {
      console.error("Erreur de validation de l' étape :", error);
      setErreur(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          "Impossible de terminer cette étape."
      );
    } finally {
      setEnregistrement(false);
    }
  };

  const etapeActuelle =
    processus?.statut === "TERMINE"
      ? etapesProcessus.length
      : Math.min(
          Math.max(
            Number(processus?.etapeActuelle || 1),
            Math.max(0, ...etapesTerminees) + 1
          ),
          etapesProcessus.length
        );

  const allerEtapePrecedente = () => {
    setSelectedStep((previous) => Math.max(previous - 1, 1));
  };

  const allerEtapeSuivante = () => {
    setSelectedStep((previous) =>
      Math.min(previous + 1, etapesProcessus.length)
    );
  };

  if (chargement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2
            size={34}
            className="mx-auto animate-spin text-blue-600"
          />
          <p className="mt-3 text-sm text-slate-500">
            Chargement du processus...
          </p>
        </div>
      </div>
    );
  }

  if (!processus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle size={35} className="mx-auto text-red-500" />
          <p className="mt-3 text-sm text-red-700">
            {erreur || "Processus introuvable."}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/hr/recrutement/processus")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={chargerProcessus}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <RefreshCw size={16} />
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const candidatsDuSuivi =
  donneesEtapes[4]
    ?.suiviCandidatures
    ?.candidats ||
  processus.candidats ||
  [];

const candidatsRetenus =
  donneesEtapes[4]
    ?.suiviCandidatures
    ?.candidatsRetenus ||
  candidatsDuSuivi.filter(
    (candidat) =>
      candidat.statut === "RECU" ||
      candidat.statut === "EMBAUCHE" ||
      candidat.retenu === true ||
      Boolean(
        candidat.fiche_test ||
        candidat.fiche_test_url ||
        candidat.ficheTest
      )
  );

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 px-2 py-3 sm:px-3 sm:py-4 lg:px-4">
      <div className="mx-auto w-full min-w-0 max-w-none">
        {erreur && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{erreur}</span>
          </div>
        )}

        {/* Retour */}
        <button
          type="button"
          onClick={() =>
            navigate("/hr/recrutement/processus")
          }
          className="
            mb-5 inline-flex items-center gap-2
            text-sm font-medium text-slate-600
            transition hover:text-blue-600
          "
        >
          <ArrowLeft size={17} />
          Retour aux processus
        </button>

        {/* Informations du recrutement */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-white px-3 py-4 shadow-sm sm:px-4">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
                <BriefcaseBusiness size={24} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {processus.poste}
                  </h1>

                  <span className="rounded-md bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    {processus.typeContrat}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {processus.reference}·{" "}
                  {processus.departement}·{" "}
                  {processus.nombreARecruter} personne(s) à recruter
                </p>
              </div>
            </div>

            <div className="w-full max-w-xs">
              <div className="mb-2 flex justify-between text-xs">
                <span className="font-medium text-slate-600">
                  Progression
                </span>

                <span className="font-semibold text-blue-700">
                  {progression} %
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${progression}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {messageDesistement && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {messageDesistement}
          </div>
        )}

        {(processus.statut === "TERMINE" ||
          desistements.length > 0) &&
          embauches.length > 0 && (
            <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="font-semibold text-slate-900">
                  Suivi après embauche
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enregistrez ici un éventuel désistement après la clôture.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Candidat</th>
                      <th className="px-4 py-3">Embauche</th>
                      <th className="px-4 py-3">Désistement</th>
                      <th className="px-4 py-3">Reprise</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {embauches.map((embauche) => {
                      const desistement = desistements.find(
                        (element) =>
                          Number(element.embauche) ===
                          Number(embauche.id)
                      );

                      return (
                        <tr key={embauche.id}>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                            {nomCandidatDepuisEmbauche(embauche)}
                          </td>
                          <td className="px-4 py-3 text-sm text-emerald-700">
                            Confirmée
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {desistement
                              ? desistement.date_desistement
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {desistement?.relancer_recrutement
                              ? desistement.date_reprise_recrutement
                              : desistement
                                ? "Non demandé"
                                : "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {desistement ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                Désistement enregistré
                              </span>
                            ) : processus.statut === "TERMINE" ? (
                              <button
                                type="button"
                                onClick={() => ouvrirDesistement(embauche)}
                                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                              >
                                <UserMinus size={15} />
                                Signaler un désistement
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
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

        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          {/* Liste verticale des Ã©tapes */}
          <aside className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-3 py-3 sm:px-4">
              <h2 className="font-semibold text-slate-900">
                Etapes du processus
              </h2>
            </div>

            <div>
              {etapesProcessus.map((etape) => {
                const status = StepStatus({
                  etapeId: etape.id,
                  etapesTerminees,
                  etapeActuelle,
                });

                const isLocked = status === "A_FAIRE";

                const selected = selectedStep === etape.id;
                const Icon = etape.icon;

                return (
                    <button
                        key={etape.id}
                        type="button"
                        disabled={isLocked}
                        onClick={() => {
                          if (!isLocked) {
                            setSelectedStep(etape.id);
                          }
                        }}
                        className={`
                          flex w-full items-start gap-3 border-b
                          border-slate-100 px-3 py-3 text-left
                          transition last:border-b-0
                          ${
                            selected
                              ? "bg-blue-50"
                              : isLocked
                                ? "cursor-not-allowed bg-slate-50 opacity-60"
                                : "hover:bg-slate-50"
                          }
                        `}
                      >
                    <div
                      className={`
                        mt-0.5 flex h-8 w-8 shrink-0
                        items-center justify-center rounded-full
                        ${
                          status === "TERMINEE"
                            ? "bg-emerald-100 text-emerald-700"
                            : status === "EN_COURS"
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-400"
                        }
                      `}
                    >
                      {status === "TERMINEE" ? (
                        <Check size={16} />
                      ) : status === "EN_COURS" ? (
                        <Icon size={16} />
                      ) : (
                        <Circle size={14} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`
                          text-sm font-semibold
                          ${
                            selected
                              ? "text-blue-700"
                              : "text-slate-800"
                          }
                        `}
                      >
                        {etape.id}. {etape.titre}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {status === "TERMINEE" && "Terminée"}
                        {status === "EN_COURS" && "En cours"}
                        {status === "A_FAIRE" && "A faire"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Contenu de lâ€™Ã©tape */}
          <div className="min-w-0 max-w-full">
            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white px-2 py-4 shadow-sm sm:px-3 lg:px-4">
              <div className="mb-4 px-1">
                <p className="text-sm font-medium text-blue-600">
                  Etape {etapeSelectionnee.id} sur {etapesProcessus.length}
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {etapeSelectionnee.titre}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {etapeSelectionnee.description}
                </p>
              </div>



{/* Ã‰tapes communes */}
{selectedStep === 1 && (
  <EtapeCreationOffre
    recrutement={processus}
    onComplete={({ etape, offre }) =>
      terminerEtape(etape, {
        offre,
      })
    }
  />
)}

{selectedStep === 2 && (
  <EtapePublicationOffre
    recrutement={processus}
    offre={
      donneesEtapes[1]?.offre
    }
    onComplete={({
      etape,
      publications,
    }) =>
      terminerEtape(etape, {
        publications,
      })
    }
  />
)}

{/* Ã‰tape 3 du parcours ouvrier */}
{!estCadre &&
  selectedStep === 3 && (
    <EtapeFicheTransparence
      recrutement={processus}
      onComplete={(resultat) =>
        terminerEtape(
          resultat.etape,
          {
            ficheTransparence:
              resultat.ficheTransparence,
          }
        )
      }
    />
  )}

{/* Ã‰tape 3 du parcours cadre */}
{estCadre &&
  selectedStep === 3 && (
    <SuiviCandidatCadre
      key={
        processus.candidats
          ?.map(
            (candidat) =>
              `${candidat.id}-${candidat.statut}`
          )
          .join("|")
      }
      recrutement={processus}
      onOuvrirCompteRendu={(
        candidat
      ) =>
        setCandidatCompteRendu(
          candidat
        )
      }
      onComplete={({
        etape,
        suiviCandidatures,
      }) =>
        terminerEtape(etape, {
          suiviCandidatures,
        })
      }
    />
  )}

{!estCadre &&
  selectedStep === 4 && (
    <EtapeSuiviCandidatures
      recrutement={{
        ...processus,
        numeroEtape: 4,
        publications:
          donneesEtapes[2]
            ?.publications || [],
        candidats:
          donneesEtapes[4]
            ?.suiviCandidatures
            ?.candidats ||
          processus.candidats ||
          [],
      }}
      onComplete={({
        etape,
        suiviCandidatures,
      }) =>
        terminerEtape(etape, {
          suiviCandidatures,
        })
      }
    />
  )}

{!estCadre &&
  selectedStep === 5 && (
    <EtapeRetourRH
      recrutement={processus}
      selection={{
        candidatsRetenus:
          candidatsRetenus.map(
            (candidat) => ({
              candidat,
            })
          ),
      }}
      onComplete={({
        etape,
        retourRH,
      }) =>
        terminerEtape(etape, {
          retourRH,
        })
      }
    />
  )}

{!estCadre &&
  selectedStep === 6 && (
    <EtapeEmbauche
      recrutement={processus}
      retourRH={
        donneesEtapes[5]
          ?.retourRH
      }
      onComplete={({
        etape,
        embauche,
      }) =>
        terminerEtape(etape, {
          embauche,
        })
      }
    />
  )}

{/* Ã‰tapes 4 et 5 du parcours cadre */}
{estCadre &&
  selectedStep === 4 && (
    <EtapePreparationEmbaucheCadre
      recrutement={processus}
      onComplete={() =>
        chargerProcessus()
      }
    />
  )}

{estCadre &&
  selectedStep === 5 && (
    <EtapeEmbauche
      recrutement={processus}
      retourRH={null}
      onComplete={({
        etape,
        embauche,
      }) =>
        terminerEtape(etape, {
          embauche,
        })
      }
    />
  )}

  {candidatCompteRendu && (
  <CompteRenduEntretienCadre
    candidat={
      candidatCompteRendu
    }
    onClose={() =>
      setCandidatCompteRendu(null)
    }
    onSaved={async () => {
      setCandidatCompteRendu(null);
      await chargerProcessus();
    }}
  />
)}

            </div>

            <div className="mt-5 flex justify-between gap-3">
              <button
                type="button"
                onClick={allerEtapePrecedente}
                disabled={selectedStep === 1}
                className="
                  inline-flex items-center gap-2 rounded-lg
                  border border-slate-300 bg-white px-4 py-2.5
                  text-sm font-semibold text-slate-700
                  hover:bg-slate-100 disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <ChevronLeft size={17} />
                Etape précédente
              </button>

              {/* <button
                type="button"
                onClick={allerEtapeSuivante}
                disabled={selectedStep === etapesProcessus.length}
                className="
                  inline-flex items-center gap-2 rounded-lg
                  bg-blue-600 px-4 py-2.5 text-sm
                  font-semibold text-white hover:bg-blue-700
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                Etape suivante
                <ChevronRight size={17} />
              </button> */}
            </div>
          </div>
        </div>
      </div>

      {embaucheDesistement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={enregistrerDesistement}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Signaler un désistement
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {nomCandidatDepuisEmbauche(
                    embaucheDesistement
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={fermerDesistement}
                disabled={envoiDesistement}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Date du désistement <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  max={dateDuJour()}
                  value={formulaireDesistement.dateDesistement}
                  onChange={(event) =>
                    setFormulaireDesistement((previous) => ({
                      ...previous,
                      dateDesistement: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <input
                  type="checkbox"
                  checked={formulaireDesistement.relancerRecrutement}
                  onChange={(event) =>
                    setFormulaireDesistement((previous) => ({
                      ...previous,
                      relancerRecrutement: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    Reprendre ce recrutement
                  </p>
                  <p className="mt-1 text-xs text-blue-700">
                    Le même processus sera rouvert pour remplacer la personne.
                  </p>
                </div>
              </label>

              {formulaireDesistement.relancerRecrutement && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Date de reprise du recrutement <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={formulaireDesistement.dateDesistement}
                    value={formulaireDesistement.dateRepriseRecrutement}
                    onChange={(event) =>
                      setFormulaireDesistement((previous) => ({
                        ...previous,
                        dateRepriseRecrutement: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Motif

                  {!formulaireDesistement
                    .relancerRecrutement ? (
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  ) : (
                    <span className="ml-1 font-normal text-slate-400">
                      (facultatif)
                    </span>
                  )}
                </label>
                <input
                  value={
                    formulaireDesistement.motif
                  }
                  required={
                    !formulaireDesistement
                      .relancerRecrutement
                  }
                  onChange={(event) =>
                    setFormulaireDesistement(
                      (previous) => ({
                        ...previous,
                        motif: event.target.value,
                      })
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Commentaire <span className="font-normal text-slate-400">(facultatif)</span>
                </label>
                <textarea
                  rows={3}
                  value={formulaireDesistement.commentaire}
                  onChange={(event) =>
                    setFormulaireDesistement((previous) => ({
                      ...previous,
                      commentaire: event.target.value,
                    }))
                  }
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={fermerDesistement}
                disabled={envoiDesistement}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={envoiDesistement}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {envoiDesistement && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Enregistrer le désistement
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}