import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  CalendarCheck2,
  X,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";

function dateDuJour() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function creerCandidatInitial() {
  return {
    nom: "",
    prenom: "",
    telephone: "",
    email: "",
    dateCandidature: dateDuJour(),
    observations: "",
  };
}

function formatDateHeure(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(new Date(value));
}

function obtenirNomCandidat(candidat) {
  return [
    candidat?.prenom,
    candidat?.nom,
  ]
    .filter(Boolean)
    .join(" ") || "ce candidat";
}

function Champ({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="
          w-full rounded-lg border
          border-slate-300 px-3.5
          py-2.5 text-sm outline-none
          focus:border-blue-500
          focus:ring-2 focus:ring-blue-100
        "
      />
    </div>
  );
}

function StatutCadre({ statut }) {
  const configurations = {
    AJOUTE: {
      label: "Entretien à planifier",
      className:
        "bg-slate-100 text-slate-700",
    },
    ENTRETIEN_PLANIFIE: {
      label: "Entretien planifié",
      className:
        "bg-blue-100 text-blue-700",
    },
    ENTRETIEN_REALISE: {
      label: "Compte rendu à rédiger",
      className:
        "bg-amber-100 text-amber-700",
    },
    COMPTE_RENDU_BROUILLON: {
      label: "Compte rendu en brouillon",
      className:
        "bg-violet-100 text-violet-700",
    },
    COMPTE_RENDU_ENVOYE: {
      label: "Compte rendu envoyé",
      className:
        "bg-indigo-100 text-indigo-700",
    },
    RETENU: {
      label: "Retenu",
      className:
        "bg-emerald-100 text-emerald-700",
    },
    NON_RETENU: {
      label: "Non retenu",
      className:
        "bg-red-100 text-red-700",
    },
    EMBAUCHE: {
      label: "Embauché",
      className:
        "bg-emerald-100 text-emerald-700",
    },
  };

  const configuration =
    configurations[statut] ||
    configurations.AJOUTE;

  return (
    <span
      className={`
        inline-flex rounded-full
        px-2.5 py-1 text-xs
        font-semibold
        ${configuration.className}
      `}
    >
      {configuration.label}
    </span>
  );
}

export default function SuiviCandidatCadre({
  recrutement,
  onOuvrirCompteRendu,
  onComplete,
}) {
  const [candidats, setCandidats] =
    useState([]);

  const [nouveauCandidat, setNouveauCandidat] =
    useState(creerCandidatInitial);

  const [afficherFormulaire, setAfficherFormulaire] =
    useState(false);

  const [datesEntretien, setDatesEntretien] =
    useState({});

  const [recherche, setRecherche] =
    useState("");

  const [chargement, setChargement] =
    useState(true);

  const [actionEnCours, setActionEnCours] =
    useState(null);

  const [erreur, setErreur] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [
    candidatEntretienAConfirmer,
    setCandidatEntretienAConfirmer,
  ] = useState(null);

  const [
    confirmationEntretienEnCours,
    setConfirmationEntretienEnCours,
  ] = useState(false);

  const ouvrirConfirmationEntretien = (
  candidat
) => {
  setCandidatEntretienAConfirmer(
    candidat
  );

  setErreur("");
  setMessage("");
};

const fermerConfirmationEntretien =
  () => {
    if (
      confirmationEntretienEnCours
    ) {
      return;
    }

    setCandidatEntretienAConfirmer(
      null
    );
  };

  const chargerCandidats = async () => {
    setChargement(true);
    setErreur("");

    try {
      const resultat =
        await recrutementApi
          .obtenirCandidats({
            processus:
              recrutement.id,
          });

      setCandidats(
        resultat.candidats || []
      );

      setDatesEntretien(
        (resultat.candidats || [])
          .reduce(
            (accumulateur, candidat) => {
              if (
                candidat
                  .date_entretien_prevue
              ) {
                accumulateur[
                  candidat.id
                ] = candidat
                  .date_entretien_prevue
                  .slice(0, 16);
              }

              return accumulateur;
            },
            {}
          )
      );
    } catch (error) {
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
    chargerCandidats();
  }, [recrutement.id]);

  const candidatsFiltres =
    useMemo(() => {
      const texte = recherche
        .trim()
        .toLowerCase();

      if (!texte) return candidats;

      return candidats.filter(
        (candidat) =>
          [
            candidat.nom,
            candidat.prenom,
            candidat.email,
            candidat.telephone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(texte)
      );
    }, [candidats, recherche]);

    const statutsFinaux = [
  "RETENU",
  "NON_RETENU",
  "EMBAUCHE",
];

const tousLesCandidatsTraites =
  candidats.length > 0 &&
  candidats.every((candidat) =>
    statutsFinaux.includes(
      candidat.statut
    )
  );

const nombreRetenus =
  candidats.filter((candidat) =>
    [
      "RETENU",
      "EMBAUCHE",
    ].includes(candidat.statut)
  ).length;

  const modifierNouveauCandidat = (
    event
  ) => {
    const { name, value } =
      event.target;

    setNouveauCandidat(
      (precedent) => ({
        ...precedent,
        [name]: value,
      })
    );
  };

  const ajouterCandidat = async () => {
    if (
      !nouveauCandidat.nom.trim() ||
      !nouveauCandidat.prenom.trim() ||
      !nouveauCandidat.dateCandidature
    ) {
      setErreur(
        "Le nom, le prénom et la date sont obligatoires."
      );
      return;
    }

    setActionEnCours(
      "ajouter-candidat"
    );
    setErreur("");
    setMessage("");

    try {
      await recrutementApi
        .creerCandidat({
          processusId:
            recrutement.id,
          ...nouveauCandidat,
        });

      setNouveauCandidat(
        creerCandidatInitial()
      );

      setAfficherFormulaire(false);

      setMessage(
        "Le candidat cadre a été ajouté."
      );

      await chargerCandidats();
    } catch (error) {
      setErreur(
        recrutementApi.extraireErreur(
          error
        )
      );
    } finally {
      setActionEnCours(null);
    }
  };

  const supprimerCandidat = async (
    candidat
  ) => {
    const confirmation =
      window.confirm(
        `Supprimer ${candidat.prenom} ${candidat.nom} ?`
      );

    if (!confirmation) return;

    setActionEnCours(
      `supprimer-${candidat.id}`
    );
    setErreur("");

    try {
      await recrutementApi
        .supprimerCandidat(
          candidat.id
        );

      setMessage(
        "Le candidat a été supprimé."
      );

      await chargerCandidats();
    } catch (error) {
      setErreur(
        recrutementApi.extraireErreur(
          error
        )
      );
    } finally {
      setActionEnCours(null);
    }
  };

  const planifierEntretien = async (
    candidat
  ) => {
    const date =
      datesEntretien[candidat.id];

    if (!date) {
      setErreur(
        "Indiquez la date et l’heure de l’entretien."
      );
      return;
    }

    setActionEnCours(
      `planifier-${candidat.id}`
    );
    setErreur("");
    setMessage("");

    try {
      await recrutementApi
        .planifierEntretienCadre(
          candidat.id,
          new Date(date).toISOString()
        );

      setMessage(
        "L’entretien a été planifié."
      );

      await chargerCandidats();
    } catch (error) {
      setErreur(
        recrutementApi.extraireErreur(
          error
        )
      );
    } finally {
      setActionEnCours(null);
    }
  };

const confirmerEntretienRealise =
  async () => {
    if (
      !candidatEntretienAConfirmer
    ) {
      return;
    }

    setConfirmationEntretienEnCours(
      true
    );

    setErreur("");
    setMessage("");

    try {
      const candidatModifie =
        await recrutementApi
          .marquerEntretienRealise(
            candidatEntretienAConfirmer.id
          );

      setCandidats((previous) =>
        previous.map((candidat) =>
          Number(candidat.id) ===
          Number(
            candidatEntretienAConfirmer.id
          )
            ? candidatModifie
            : candidat
        )
      );

      setMessage(
        `L’entretien de ${obtenirNomCandidat(
          candidatEntretienAConfirmer
        )} a été marqué comme réalisé.`
      );

      setCandidatEntretienAConfirmer(
        null
      );
    } catch (error) {
      console.error(
        "Erreur pendant la validation de l’entretien :",
        error
      );

      setErreur(
        recrutementApi.extraireErreur(
          error
        )
      );
    } finally {
      setConfirmationEntretienEnCours(
        false
      );
    }
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700">
            <Users size={21} />
          </div>

          <div>
            <p className="font-semibold text-slate-900">
              {candidats.length} candidat(s)
              cadre(s)
            </p>

            <p className="text-xs text-slate-500">
              Entretiens et comptes rendus
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={chargerCandidats}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>

          <button
            type="button"
            onClick={() =>
              setAfficherFormulaire(
                (precedent) =>
                  !precedent
              )
            }
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white"
          >
            <UserPlus size={16} />
            Ajouter un candidat
          </button>
        </div>
      </section>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {erreur && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {afficherFormulaire && (
        <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
          <h3 className="mb-5 flex items-center gap-2 font-semibold text-slate-900">
            <Plus
              size={18}
              className="text-blue-600"
            />
            Nouveau candidat cadre
          </h3>

          <div className="grid gap-5 md:grid-cols-2">
            <Champ
              label="Nom"
              name="nom"
              value={nouveauCandidat.nom}
              onChange={
                modifierNouveauCandidat
              }
              required
            />

            <Champ
              label="Prénom"
              name="prenom"
              value={nouveauCandidat.prenom}
              onChange={
                modifierNouveauCandidat
              }
              required
            />

            <Champ
              label="Téléphone"
              name="telephone"
              value={
                nouveauCandidat.telephone
              }
              onChange={
                modifierNouveauCandidat
              }
            />

            <Champ
              label="Adresse e-mail"
              name="email"
              type="email"
              value={nouveauCandidat.email}
              onChange={
                modifierNouveauCandidat
              }
            />

            <Champ
              label="Date de candidature"
              name="dateCandidature"
              type="date"
              value={
                nouveauCandidat
                  .dateCandidature
              }
              onChange={
                modifierNouveauCandidat
              }
              required
            />
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setAfficherFormulaire(false)
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={ajouterCandidat}
              disabled={
                actionEnCours ===
                "ajouter-candidat"
              }
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus size={17} />
              Ajouter
            </button>
          </div>
        </section>
      )}

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
          placeholder="Rechercher un candidat..."
          className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {chargement ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <Loader2
            size={28}
            className="animate-spin text-blue-600"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {candidatsFiltres.map(
            (candidat) => (
              <article
                key={candidat.id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {candidat.prenom}{" "}
                      {candidat.nom}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {candidat.email ||
                        "Aucun e-mail"}
                      {" · "}
                      {candidat.telephone ||
                        "Aucun téléphone"}
                    </p>

                    <div className="mt-3">
                      <StatutCadre
                        statut={
                          candidat.statut
                        }
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      supprimerCandidat(
                        candidat
                      )
                    }
                    disabled={
                      candidat.statut !==
                      "AJOUTE"
                    }
                    className="self-start rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                {[
                  "AJOUTE",
                  "ENTRETIEN_PLANIFIE",
                ].includes(
                  candidat.statut
                ) && (
                  <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Date et heure de l’entretien
                    </label>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type="datetime-local"
                        value={
                          datesEntretien[
                            candidat.id
                          ] || ""
                        }
                        onChange={(event) =>
                          setDatesEntretien(
                            (precedent) => ({
                              ...precedent,
                              [candidat.id]:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          planifierEntretien(
                            candidat
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                      >
                        <CalendarClock
                          size={16}
                        />

                        {candidat.statut ===
                        "ENTRETIEN_PLANIFIE"
                          ? "Reprogrammer"
                          : "Planifier"}
                      </button>
                    </div>

                    {candidat.statut ===
                      "ENTRETIEN_PLANIFIE" && (
                      <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <p className="text-sm text-blue-700">
                          Prévu le{" "}
                          {formatDateHeure(
                            candidat
                              .date_entretien_prevue
                          )}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            ouvrirConfirmationEntretien(
                              candidat
                            )
                          }
                          disabled={
                            confirmationEntretienEnCours
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
                        >
                          <CheckCircle2
                            size={16}
                          />
                          Entretien réalisé
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {[
                  "ENTRETIEN_REALISE",
                  "COMPTE_RENDU_BROUILLON",
                ].includes(
                  candidat.statut
                ) && (
                  <button
                    type="button"
                    onClick={() =>
                      onOuvrirCompteRendu?.(
                        candidat
                      )
                    }
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    <FileText size={17} />

                    {candidat.statut ===
                    "COMPTE_RENDU_BROUILLON"
                      ? "Continuer le compte rendu"
                      : "Rédiger le compte rendu"}
                  </button>
                )}

                {[
                  "RETENU",
                  "NON_RETENU",
                  "EMBAUCHE",
                ].includes(
                  candidat.statut
                ) && (
                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    Le compte rendu a été
                    finalisé et envoyé au DRH.
                  </div>
                )}
              </article>
            )
          )}

          {candidatsFiltres.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Aucun candidat trouvé.
            </div>
          )}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h3 className="font-semibold text-slate-900">
        Terminer le suivi des cadres
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {tousLesCandidatsTraites
          ? `${nombreRetenus} candidat(s) retenu(s).`
          : (
              "Tous les entretiens et comptes "
              + "rendus doivent être finalisés."
            )}
      </p>
    </div>

    <button
      type="button"
      disabled={
        !tousLesCandidatsTraites ||
        nombreRetenus === 0
      }
      onClick={() =>
        onComplete?.({
          etape: 3,

          suiviCandidatures: {
            candidats,
            candidatsRetenus:
              candidats.filter(
                (candidat) =>
                  [
                    "RETENU",
                    "EMBAUCHE",
                  ].includes(
                    candidat.statut
                  )
              ),

            nombreCandidats:
              candidats.length,

            nombreRetenus,
          },
        })
      }
      className="
        inline-flex items-center
        justify-center gap-2
        rounded-lg bg-blue-600
        px-5 py-2.5 text-sm
        font-semibold text-white
        hover:bg-blue-700
        disabled:cursor-not-allowed
        disabled:opacity-50
      "
    >
      <CheckCircle2 size={17} />
      Terminer l’étape
    </button>
  </div>
</section>

      {candidatEntretienAConfirmer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fermerConfirmationEntretien();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-confirmation-entretien"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-100 p-2.5 text-emerald-700">
                  <CalendarCheck2 size={22} />
                </div>

                <div>
                  <h2
                    id="titre-confirmation-entretien"
                    className="font-semibold text-slate-900"
                  >
                    Confirmer l’entretien
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Le compte rendu sera ensuite accessible.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={fermerConfirmationEntretien}
                disabled={confirmationEntretienEnCours}
                aria-label="Fermer"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm leading-6 text-slate-700">
                Confirmez-vous que l’entretien de{" "}
                <strong>
                  {obtenirNomCandidat(
                    candidatEntretienAConfirmer
                  )}
                </strong>{" "}
                a bien été réalisé ?
              </p>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Après confirmation, vous pourrez rédiger
                le compte rendu de l’entretien.
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 p-4">
              <button
                type="button"
                onClick={fermerConfirmationEntretien}
                disabled={confirmationEntretienEnCours}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={confirmerEntretienRealise}
                disabled={confirmationEntretienEnCours}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmationEntretienEnCours ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Validation...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={17} />
                    Confirmer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    
    </div>
  );
}
