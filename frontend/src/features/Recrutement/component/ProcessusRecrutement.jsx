import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  CirclePlay,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";

const NOMBRE_ETAPES = 6;

const STATUS_CONFIG = {
  A_DEMARRER: {
    label: "Ã€ dÃ©marrer",
    className:
      "border-blue-200 bg-blue-50 text-blue-700",
    icon: CirclePlay,
  },

  EN_COURS: {
    label: "En cours",
    className:
      "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock3,
  },

  TERMINE: {
    label: "TerminÃ©",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
};

function formatDate(value) {
  if (!value) return "â€”";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "â€”";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

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
    {
      label: "CDI",
      nombre: Number(demande.nombre_cdi || 0),
    },
    {
      label: "CDD",
      nombre: Number(demande.nombre_cdd || 0),
    },
    {
      label: "Stage",
      nombre: Number(demande.nombre_stage || 0),
    },
    {
      label: "IntÃ©rim",
      nombre: Number(demande.nombre_interim || 0),
    },
    {
      label: "Consultant",
      nombre: Number(
        demande.nombre_consultant || 0
      ),
    },
    {
      label: "Autre",
      nombre: Number(demande.nombre_autre || 0),
    },
  ];

  const contratsActifs = contrats
    .filter((contrat) => contrat.nombre > 0)
    .map(
      (contrat) =>
        `${contrat.label} (${contrat.nombre})`
    );

  return contratsActifs.length > 0
    ? contratsActifs.join(", ")
    : "â€”";
}

function obtenirEtapesTerminees(processus) {
  if (Array.isArray(processus.etapes_terminees)) {
    return processus.etapes_terminees.length;
  }

  if (processus.statut === "A_DEMARRER") {
    return 0;
  }

  if (processus.statut === "TERMINE") {
    return NOMBRE_ETAPES;
  }

  const etapeActuelle = Number(
    processus.etape_actuelle || 1
  );

  return Math.max(
    0,
    Math.min(etapeActuelle - 1, NOMBRE_ETAPES)
  );
}

function normaliserProcessus(processus) {
  const demande =
    processus.demande_detail ||
    processus.demande ||
    {};

  const etapesTerminees =
    obtenirEtapesTerminees(processus);

  const nombreDemande = Number(
    processus.nombre_demande ??
      obtenirNombreTotal(demande)
  ) || 0;

  const nombreRecrute = Number(
    processus.nombre_recrute ?? 0
  ) || 0;

  const besoinRestant = Math.max(
    Number(
      processus.besoin_restant ??
        nombreDemande - nombreRecrute
    ) || 0,
    0
  );

  const estCadre =
    String(
      demande.type_recrutement ||
        processus.type_recrutement ||
        "OUVRIER"
    ).toUpperCase() === "CADRE";

  return {
    id: processus.id,

    reference:
      processus.reference ||
      demande.reference ||
      `PROCESSUS-${processus.id}`,

    poste:
      demande.poste_nom ||
      demande.designation_poste ||
      processus.poste_nom ||
      "Poste non renseignÃ©",

    departement:
      demande.departement_nom ||
      processus.departement_nom ||
      "Non renseignÃ©",

    nombreARecruter:
      nombreDemande,

    nombreDemande,

    nombreRecrute,

    besoinRestant,

    nombreCdiRecrute: Number(
      processus.nombre_cdi_recrute ?? 0
    ) || 0,

    nombreCddRecrute: Number(
      processus.nombre_cdd_recrute ?? 0
    ) || 0,

    besoinCdiRestant: Number(
      processus.besoin_cdi_restant ??
        demande.nombre_cdi ??
        0
    ) || 0,

    besoinCddRestant: Number(
      processus.besoin_cdd_restant ??
        demande.nombre_cdd ??
        0
    ) || 0,

    typeContrat:
      obtenirTypesContrats(demande),

    dateValidation:
      demande.date_decision ||
      demande.date_validation ||
      processus.date_creation ||
      processus.created_at,

    dateDemande:
      processus.date_demande ||
      demande.date_creation ||
      null,

    dateClotureInitiale:
      processus.date_cloture_initiale ||
      null,

    dateRepriseRecrutement:
      processus.date_reprise_recrutement ||
      null,

    dateClotureApresDesistement:
      processus
        .date_cloture_apres_desistement ||
      null,

    etapesTerminees,

    nombreEtapes: estCadre ? 5 : NOMBRE_ETAPES,

    statut:
      processus.statut ||
      (etapesTerminees === 0
        ? "A_DEMARRER"
        : etapesTerminees >= (estCadre ? 5 : NOMBRE_ETAPES)
          ? "TERMINE"
          : "EN_COURS"),
  };
}

function StatusBadge({ statut }) {
  const config =
    STATUS_CONFIG[statut] ||
    STATUS_CONFIG.EN_COURS;

  const Icon = config.icon;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        rounded-full border px-2.5 py-1
        text-xs font-semibold
        ${config.className}
      `}
    >
      <Icon size={13} />
      {config.label}
    </span>
  );
}

function Progression({
  terminees,
  total,
}) {
  const nombreTerminees = Math.min(
    Math.max(Number(terminees) || 0, 0),
    total
  );

  const pourcentage =
    total > 0
      ? Math.round(
          (nombreTerminees / total) * 100
        )
      : 0;

  return (
    <div className="min-w-[170px]">
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-medium text-slate-600">
          {nombreTerminees}/{total} Ã©tapes
        </span>

        <span className="text-slate-400">
          {pourcentage} %
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`
            h-full rounded-full transition-all
            ${
              nombreTerminees === total
                ? "bg-emerald-500"
                : "bg-blue-600"
            }
          `}
          style={{
            width: `${pourcentage}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function ProcessusRecrutement() {
  const navigate = useNavigate();

  const [processus, setProcessus] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("TOUS");

  const [chargement, setChargement] =
    useState(true);

  const [erreur, setErreur] = useState("");

const chargerProcessus = useCallback(async (
  texteRecherche = ""
) => {
  setChargement(true);
  setErreur("");

  try {
    const rechercheServeur = String(
      texteRecherche
    ).trim();

    const resultat =
      await recrutementApi.obtenirProcessus(
        rechercheServeur
          ? { search: rechercheServeur }
          : {}
      );

    const liste = Array.isArray(resultat)
      ? resultat
      : resultat?.processus || [];

    setProcessus(
      liste.map(normaliserProcessus)
    );
  } catch (error) {
    console.error(
      "Erreur de chargement des processus :",
      error
    );

    setErreur(
      error.response?.data?.detail ||
      error.response?.data?.message ||
      "Impossible de charger les processus de recrutement."
    );

    setProcessus([]);
  } finally {
    setChargement(false);
  }
}, []);

useEffect(() => {
  const temporisateur = window.setTimeout(
    () => {
      chargerProcessus(recherche);
    },
    350
  );

  return () => {
    window.clearTimeout(temporisateur);
  };
}, [chargerProcessus, recherche]);

  const processusFiltres = useMemo(() => {
    return processus.filter((item) => {
      const correspondStatut =
        statut === "TOUS" ||
        item.statut === statut;

      return correspondStatut;
    });
  }, [processus, statut]);

  const ouvrirProcessus = (id) => {
    navigate(
      `/hr/recrutement/processus/${id}`
    );
  };

  function obtenirEtatBesoin(processus) {
  const nombreDemande = Number(
    processus.nombre_demande ??
    processus.demande_detail?.nombre_total ??
    0
  );

  const nombreRecrute = Number(
    processus.nombre_recrute ?? 0
  );

  const besoinRestant = Math.max(
    Number(
      processus.besoin_restant ??
      nombreDemande - nombreRecrute
    ),
    0
  );

  if (nombreDemande > 0 && besoinRestant === 0) {
    return {
      label: "Besoin satisfait",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (nombreRecrute > 0) {
    return {
      label: "Partiellement satisfait",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Non satisfait",
    className:
      "border-red-200 bg-red-50 text-red-700",
  };
}

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* En-tÃªte */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
              <BriefcaseBusiness size={24} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Processus de recrutement
              </h1>

              <p className="text-sm text-slate-500">
                Suivez les différentes étapes des
                recrutements validés
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              chargerProcessus(recherche)
            }
            disabled={chargement}
            className="
              inline-flex items-center justify-center
              gap-2 rounded-lg border
              border-slate-300 bg-white px-4
              py-2.5 text-sm font-semibold
              text-slate-700 transition
              hover:bg-slate-100
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={17}
              className={
                chargement
                  ? "animate-spin"
                  : ""
              }
            />

            Actualiser
          </button>
        </div>

        {/* Erreur */}
        {erreur && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">
              <p>{erreur}</p>

              <button
                type="button"
                onClick={() =>
                  chargerProcessus(recherche)
                }
                className="mt-2 font-semibold underline"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={recherche}
              onChange={(event) =>
                setRecherche(
                  event.target.value
                )
              }
              placeholder="Rechercher par candidat, poste, référence ou département..."
              className="
                w-full rounded-lg border
                border-slate-300 py-2.5
                pl-10 pr-4 text-sm outline-none
                focus:border-blue-500
                focus:ring-2 focus:ring-blue-100
              "
            />
          </div>

          <select
            value={statut}
            onChange={(event) =>
              setStatut(event.target.value)
            }
            className="
              rounded-lg border border-slate-300
              bg-white px-3 py-2.5 text-sm
              outline-none focus:border-blue-500
              focus:ring-2 focus:ring-blue-100
            "
          >
            <option value="TOUS">
              Tous les statuts
            </option>

            <option value="A_DEMARRER">
              Ã€ dÃ©marrer
            </option>

            <option value="EN_COURS">
              En cours
            </option>

            <option value="TERMINE">
              Terminés
            </option>
          </select>
        </div>

        {/* Tableau */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {chargement ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2
                size={30}
                className="animate-spin text-blue-600"
              />

              <p className="text-sm">
                Chargement des processus...
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[2050px]">
                  <thead className="bg-slate-100">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <th className="px-5 py-4">
                        Référence
                      </th>

                      <th className="px-5 py-4">
                        Poste
                      </th>

                      <th className="px-5 py-4">
                        Département
                      </th>

                      <th className="px-5 py-4">
                        Contrat
                      </th>

                      <th className="px-5 py-4 text-center">
                        Besoin initial
                      </th>

                      <th className="px-5 py-4 text-center">
                        Recrutés
                      </th>

                      <th className="px-5 py-4 text-center">
                        Restant
                      </th>

                      <th className="px-5 py-4">
                        Couverture
                      </th>

                      <th className="px-5 py-4">
                        Validation
                      </th>

                      <th className="px-5 py-4">
                        Date de demande
                      </th>

                      <th className="px-5 py-4">
                        Clôture initiale
                      </th>

                      <th className="px-5 py-4">
                        Reprise
                      </th>

                      <th className="px-5 py-4">
                        Clôture après reprise
                      </th>

                      <th className="px-5 py-4">
                        Progression
                      </th>

                      <th className="px-5 py-4">
                        Statut
                      </th>

                      <th className="px-5 py-4 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {processusFiltres.map(
                      (item) => {
                        const nombreDemande =
                          item.nombreDemande;

                        const nombreRecrute =
                          item.nombreRecrute;

                        const besoinRestant =
                          item.besoinRestant;

                        const etatBesoin =
                          obtenirEtatBesoin({
                            nombre_demande:
                              nombreDemande,
                            nombre_recrute:
                              nombreRecrute,
                            besoin_restant:
                              besoinRestant,
                          });

                        return (
                        <tr
                          key={item.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-blue-700">
                            {item.reference}
                          </td>

                          <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                            {item.poste}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">
                            {item.departement}
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-md bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                              {item.typeContrat}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span className="text-sm font-semibold text-slate-900">
                              {nombreDemande}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span className="text-sm font-semibold text-blue-700">
                              {nombreRecrute}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span
                              className={`text-sm font-semibold ${
                                besoinRestant === 0
                                  ? "text-emerald-700"
                                  : "text-amber-700"
                              }`}
                            >
                              {besoinRestant}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`
                                inline-flex rounded-full border
                                px-2.5 py-1 text-xs font-semibold
                                ${etatBesoin.className}
                              `}
                            >
                              {etatBesoin.label}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                            {formatDate(
                              item.dateValidation
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                            {formatDate(
                              item.dateDemande
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                            {formatDate(
                              item.dateClotureInitiale
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                            {formatDate(
                              item.dateRepriseRecrutement
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                            {formatDate(
                              item
                                .dateClotureApresDesistement
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <Progression
                              terminees={
                                item.etapesTerminees
                              }
                              total={
                                item.nombreEtapes
                              }
                            />
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              statut={
                                item.statut
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                ouvrirProcessus(
                                  item.id
                                )
                              }
                              className="
                                inline-flex items-center
                                gap-2 rounded-lg
                                bg-blue-600 px-4
                                py-2.5 text-sm
                                font-semibold text-white
                                transition
                                hover:bg-blue-700
                              "
                            >
                              {item.statut ===
                              "A_DEMARRER"
                                ? "Commencer"
                                : item.statut ===
                                    "TERMINE"
                                  ? "Consulter"
                                  : "Continuer"}
                            </button>
                          </td>
                        </tr>
                        );
                      }
                    )}

                    {processusFiltres.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={12}
                          className="px-5 py-12 text-center text-sm text-slate-500"
                        >
                          Aucun processus de
                          recrutement trouvÃ©.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-500">
                {processusFiltres.length} processus
                affichÃ©(s)
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}