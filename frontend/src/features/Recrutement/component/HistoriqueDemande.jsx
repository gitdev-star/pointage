import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";


const STATUS_CONFIG = {
  BROUILLON: {
    label: "Brouillon",
    icon: Clock3,
    className:
      "border-slate-200 bg-slate-50 text-slate-700",
  },

  EN_ATTENTE: {
    label: "En attente",
    icon: Clock3,
    className:
      "border-amber-200 bg-amber-50 text-amber-700",
  },

  VALIDEE: {
    label: "Validée",
    icon: CheckCircle2,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  },

  REFUSEE: {
    label: "Refusée",
    icon: XCircle,
    className:
      "border-red-200 bg-red-50 text-red-700",
  },

  TERMINEE: {
    label: "Terminée",
    icon: CheckCircle2,
    className:
      "border-blue-200 bg-blue-50 text-blue-700",
  },
};


function formatDate(dateString) {
  if (!dateString) {
    return "—";
  }

  let date;

  if (
    typeof dateString === "string" &&
    dateString.length === 10
  ) {
    date = new Date(
      `${dateString}T00:00:00`
    );
  } else {
    date = new Date(dateString);
  }

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(date);
}


function StatusBadge({
  statut,
  libelle,
}) {
  const config =
    STATUS_CONFIG[statut] ||
    STATUS_CONFIG.EN_ATTENTE;

  const Icon = config.icon;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        rounded-full border px-2.5
        py-1 text-xs font-semibold
        ${config.className}
      `}
    >
      <Icon size={13} />

      {libelle || config.label}
    </span>
  );
}


function afficherContrats(demande) {
  const contrats = [];

  if (demande.nombre_cdi > 0) {
    contrats.push(
      `${demande.nombre_cdi} CDI`
    );
  }

  if (demande.nombre_cdd > 0) {
    contrats.push(
      `${demande.nombre_cdd} CDD`
    );
  }

  return contrats.length
    ? contrats.join(" • ")
    : "—";
}


export default function HistoriqueMesDemandes() {
  const [toutesLesDemandes, setToutesLesDemandes] =
    useState([]);

  const [recherche, setRecherche] =
    useState("");

  const [statut, setStatut] =
    useState("TOUS");

  const [expandedId, setExpandedId] =
    useState(null);

  const [chargement, setChargement] =
    useState(true);

  const [erreur, setErreur] =
    useState("");


  const chargerDemandes = async () => {
    setChargement(true);
    setErreur("");

    try {
      const resultat =
        await recrutementApi
          .obtenirMesDemandes();

      setToutesLesDemandes(
        resultat.demandes || []
      );
    } catch (error) {
      console.error(
        "Erreur de chargement :",
        error.response?.data || error
      );

      setErreur(
        recrutementApi.extraireErreur(
          error
        )
      );
    } finally {
      setChargement(false);
    }
  };


  useEffect(() => {
    chargerDemandes();
  }, []);


  const demandes = useMemo(() => {
    const texte = recherche
      .toLowerCase()
      .trim();

    return toutesLesDemandes.filter(
      (demande) => {
        const reference = (
          demande.reference || ""
        ).toLowerCase();

        const poste = (
          demande.poste_nom || ""
        ).toLowerCase();

        const departement = (
          demande.departement_nom || ""
        ).toLowerCase();

        const correspondRecherche =
          !texte ||
          reference.includes(texte) ||
          poste.includes(texte) ||
          departement.includes(texte);

        const correspondStatut =
          statut === "TOUS" ||
          demande.statut === statut;

        return (
          correspondRecherche &&
          correspondStatut
        );
      }
    );
  }, [
    toutesLesDemandes,
    recherche,
    statut,
  ]);


  const toggleDetails = (id) => {
    setExpandedId((ancienId) =>
      ancienId === id
        ? null
        : id
    );
  };


  return (
    <div>
      {/* Filtres */}
      <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_auto]">
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
            placeholder="Rechercher par référence, poste ou département..."
            className="
              w-full rounded-lg border
              border-slate-300 py-2.5
              pl-10 pr-4 text-sm
              outline-none focus:border-blue-500
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
            rounded-lg border
            border-slate-300 bg-white
            px-3 py-2.5 text-sm
            outline-none focus:border-blue-500
            focus:ring-2 focus:ring-blue-100
          "
        >
          <option value="TOUS">
            Tous les statuts
          </option>

          <option value="BROUILLON">
            Brouillons
          </option>

          <option value="EN_ATTENTE">
            En attente
          </option>

          <option value="VALIDEE">
            Validées
          </option>

          <option value="REFUSEE">
            Refusées
          </option>

          <option value="TERMINEE">
            Terminées
          </option>
        </select>

        <button
          type="button"
          onClick={chargerDemandes}
          disabled={chargement}
          className="
            inline-flex items-center
            justify-center gap-2 rounded-lg
            border border-slate-300 bg-white
            px-4 py-2.5 text-sm font-semibold
            text-slate-700 hover:bg-slate-100
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <RotateCcw
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


      {erreur && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <p className="text-sm font-medium">
            {erreur}
          </p>
        </div>
      )}


      {chargement &&
      toutesLesDemandes.length === 0 ? (
        <div className="flex min-h-[250px] items-center justify-center rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <Loader2
              size={20}
              className="animate-spin text-blue-600"
            />

            Chargement des demandes...
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {demandes.map((demande) => {
            const expanded =
              expandedId === demande.id;

            return (
              <article
                key={demande.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    toggleDetails(
                      demande.id
                    )
                  }
                  className="
                    flex w-full flex-col
                    justify-between gap-4
                    p-5 text-left transition
                    hover:bg-slate-50
                    lg:flex-row lg:items-center
                  "
                >
                  <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        Référence
                      </p>

                      <p className="mt-1 text-sm font-semibold text-blue-700">
                        {demande.reference}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Poste
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {demande.poste_nom ||
                          "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Date de la demande
                      </p>

                      <p className="mt-1 text-sm text-slate-700">
                        {formatDate(
                          demande.date_creation
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs text-slate-500">
                        Statut
                      </p>

                      <StatusBadge
                        statut={
                          demande.statut
                        }
                        libelle={
                          demande
                            .statut_libelle
                        }
                      />
                    </div>
                  </div>

                  <div className="text-slate-400">
                    {expanded ? (
                      <ChevronUp
                        size={20}
                      />
                    ) : (
                      <ChevronDown
                        size={20}
                      />
                    )}
                  </div>
                </button>


                {expanded && (
                  <div className="border-t border-slate-200 bg-slate-50 p-5">
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-500">
                          Site
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {demande.factory_nom ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Département
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {demande
                            .departement_nom ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Nombre à recruter
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {demande.nombre_total}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Contrats
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {afficherContrats(
                            demande
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Date prévue
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {formatDate(
                            demande
                              .date_prevue_recrutement
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Motif
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {demande
                            .motif_libelle ||
                            "—"}
                        </p>
                      </div>

                      {demande.motif ===
                        "REMPLACEMENT" && (
                        <div>
                          <p className="text-xs text-slate-500">
                            Motif du remplacement
                          </p>

                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {demande
                              .motif_remplacement_libelle ||
                              "—"}
                          </p>
                        </div>
                      )}
                    </div>


                    {demande.statut ===
                      "EN_ATTENTE" && (
                      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                        Cette demande est en
                        attente de la décision
                        du directeur.
                      </div>
                    )}


                    {demande.statut ===
                      "BROUILLON" && (
                      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        Cette demande est
                        enregistrée comme
                        brouillon.
                      </div>
                    )}


                    {[
                      "VALIDEE",
                      "REFUSEE",
                      "TERMINEE",
                    ].includes(
                      demande.statut
                    ) && (
                      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
                        <p className="text-xs font-medium uppercase text-slate-500">
                          Décision du directeur
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {demande
                            .motif_decision ||
                            "Aucun commentaire"}
                        </p>

                        <p className="mt-3 text-xs text-slate-400">
                          Décision prise le{" "}
                          {formatDate(
                            demande
                              .date_decision
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}


          {!chargement &&
            demandes.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                Aucune demande trouvée.
              </div>
            )}
        </div>
      )}
    </div>
  );
}