import React, {
  useEffect,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Loader2,
  UserRound,
  XCircle,
} from "lucide-react";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import recrutementApi from "../../../api/recrutementApi";


function afficherValeur(valeur) {
  if (
    valeur === null ||
    valeur === undefined ||
    valeur === ""
  ) {
    return "—";
  }

  return valeur;
}


function formaterDate(dateString) {
  if (!dateString) {
    return "—";
  }

  const date = new Date(
    `${dateString.substring(0, 10)}T00:00:00`
  );

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}


function Information({
  label,
  value,
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-800">
        {afficherValeur(value)}
      </p>
    </div>
  );
}


function StatutBadge({
  statut,
  libelle,
}) {
  const styles = {
    BROUILLON:
      "bg-slate-100 text-slate-700",

    EN_ATTENTE:
      "bg-amber-100 text-amber-700",

    EN_ATTENTE_DRH:
      "bg-violet-100 text-violet-700",

    VALIDEE:
      "bg-emerald-100 text-emerald-700",

    REFUSEE:
      "bg-red-100 text-red-700",

    REFUSEE_DIRECTEUR:
      "bg-red-100 text-red-700",

    REFUSEE_DRH:
      "bg-red-100 text-red-700",

    TERMINEE:
      "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={`
        inline-flex rounded-full
        px-3 py-1 text-xs font-semibold
        ${
          styles[statut] ||
          "bg-slate-100 text-slate-700"
        }
      `}
    >
      {libelle || statut}
    </span>
  );
}


export default function ValidationDemandeRecrutement() {
  const { id } = useParams();

  const navigate = useNavigate();

  const location = useLocation();

  const modeDRH = location.pathname.includes(
    "/approbation-drh"
  );

  const [demande, setDemande] =
    useState(null);

  const [chargement, setChargement] =
    useState(true);

  const [traitement, setTraitement] =
    useState(false);

  const [afficherRefus, setAfficherRefus] =
    useState(false);

  const [
    commentaireValidation,
    setCommentaireValidation,
  ] = useState("");

  const [
    motifRefus,
    setMotifRefus,
  ] = useState("");

  const [message, setMessage] =
    useState("");

  const [erreur, setErreur] =
    useState("");


  const demandeEnAttente = modeDRH
    ? demande?.statut === "EN_ATTENTE_DRH"
    : [
        "BROUILLON",
        "EN_ATTENTE",
      ].includes(demande?.statut);


  async function chargerDemande() {
    setChargement(true);
    setErreur("");

    try {
      const resultat =
        await recrutementApi.obtenirDemande(
          id
        );

      setDemande(resultat);
    } catch (error) {
      console.error(error);

      setErreur(
        recrutementApi.extraireErreur(
          error
        )
      );
    } finally {
      setChargement(false);
    }
  }


  useEffect(() => {
    chargerDemande();
  }, [id]);


  const validerDemande = async () => {
    setTraitement(true);
    setErreur("");
    setMessage("");

    try {
      const resultat = modeDRH
        ? await recrutementApi.approuverDemandeDRH(
            id,
            commentaireValidation.trim()
          )
        : await recrutementApi.validerDemande(
            id,
            commentaireValidation.trim()
          );

      setMessage(
        resultat.message ||
          (modeDRH
            ? "La demande a été approuvée par le DRH."
            : "La demande a été validée par le directeur.")
      );

      await chargerDemande();
    } catch (error) {
      console.error(error);

      setErreur(
        recrutementApi.extraireErreur(
          error
        )
      );
    } finally {
      setTraitement(false);
    }
  };


  const refuserDemande = async () => {
    const motif = motifRefus.trim();

    if (!motif) {
      setErreur(
        "Le motif du refus est obligatoire."
      );

      return;
    }

    setTraitement(true);
    setErreur("");
    setMessage("");

    try {
      const resultat = modeDRH
        ? await recrutementApi.refuserDemandeDRH(
            id,
            motif
          )
        : await recrutementApi.refuserDemande(
            id,
            motif
          );

      setMessage(
        resultat.message ||
          "La demande a été refusée."
      );

      setAfficherRefus(false);
      setMotifRefus("");

      await chargerDemande();
    } catch (error) {
      console.error(error);

      setErreur(
        recrutementApi.extraireErreur(
          error
        )
      );
    } finally {
      setTraitement(false);
    }
  };


  if (chargement && !demande) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <Loader2
            size={20}
            className="animate-spin text-blue-600"
          />

          Chargement de la demande...
        </div>
      </div>
    );
  }


  if (erreur && !demande) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={22}
              className="shrink-0 text-red-600"
            />

            <div>
              <h1 className="font-semibold text-red-900">
                Impossible d’afficher la demande
              </h1>

              <p className="mt-1 text-sm text-red-700">
                {erreur}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={17} />
          Retour
        </button>


        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
              <BriefcaseBusiness size={24} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {modeDRH
                  ? "Approbation DRH de la demande"
                  : "Validation de la demande"}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {demande?.reference}
              </p>
            </div>
          </div>

          <StatutBadge
            statut={demande?.statut}
            libelle={
              demande?.statut_libelle
            }
          />
        </div>


        {message && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2
              size={20}
              className="mt-0.5 shrink-0"
            />

            <p className="text-sm font-medium">
              {message}
            </p>
          </div>
        )}


        {erreur && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0"
            />

            <p className="text-sm font-medium">
              {erreur}
            </p>
          </div>
        )}


        {/* Demandeur */}
        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <UserRound
              size={20}
              className="text-blue-600"
            />

            <h2 className="font-semibold text-slate-900">
              Informations du demandeur
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Information
              label="Matricule"
              value={
                demande?.matricule_demandeur
              }
            />

            <Information
              label="Nom et prénom"
              value={
                demande?.nom_demandeur
              }
            />

            <Information
              label="Poste"
              value={
                demande?.poste_demandeur
              }
            />

            <Information
              label="Département"
              value={
                demande?.departement_demandeur
              }
            />
          </div>
        </section>


        {/* Besoin */}
        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 font-semibold text-slate-900">
            Besoin de recrutement
          </h2>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Information
              label="Site"
              value={demande?.factory_nom}
            />

            <Information
              label="Département concerné"
              value={
                demande?.departement_nom
              }
            />

            <Information
              label="Poste à recruter"
              value={demande?.poste_nom}
            />

            <Information
              label="Date de la demande"
              value={formaterDate(
                demande?.date_creation
              )}
            />

            <Information
              label="Date prévue"
              value={formaterDate(
                demande
                  ?.date_prevue_recrutement
              )}
            />

            <Information
              label="Nombre total"
              value={demande?.nombre_total}
            />

            <Information
              label="Nombre de CDI"
              value={demande?.nombre_cdi}
            />

            <Information
              label="Nombre de CDD"
              value={demande?.nombre_cdd}
            />

            <Information
              label="Motif"
              value={
                demande?.motif_libelle
              }
            />

            {demande?.motif ===
              "REMPLACEMENT" && (
              <Information
                label="Motif du remplacement"
                value={
                  demande
                    ?.motif_remplacement_libelle
                }
              />
            )}
          </div>
        </section>


        {/* Profil */}
        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 font-semibold text-slate-900">
            Profil recherché
          </h2>

          <div className="space-y-5">
            <Information
              label="Profil et diplôme"
              value={demande?.profil_diplome}
            />

            <Information
              label="Expérience professionnelle"
              value={
                demande
                  ?.experience_professionnelle
              }
            />

            <Information
              label="Compétences techniques"
              value={
                demande
                  ?.competences_techniques
              }
            />

            <Information
              label="Savoir-faire"
              value={demande?.savoir_faire}
            />

            <Information
              label="Savoir-être"
              value={demande?.savoir_etre}
            />

            <Information
              label="Désignation des tâches"
              value={
                demande?.designation_taches
              }
            />
          </div>
        </section>


        {/* Validation préalable du directeur */}
        {modeDRH && (
          <section className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold text-violet-900">
              Validation du directeur
            </h2>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Information
                label="Validée par"
                value={
                  demande?.validateur_directeur_nom
                }
              />

              <Information
                label="Date de validation"
                value={formaterDate(
                  demande?.date_decision
                )}
              />

              <div className="sm:col-span-2">
                <Information
                  label="Commentaire du directeur"
                  value={
                    demande?.motif_decision
                  }
                />
              </div>
            </div>
          </section>
        )}


        {/* Décision déjà prise */}
        {!demandeEnAttente && (
          <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">
              Décision
            </h2>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Information
                label="Statut"
                value={
                  demande?.statut_libelle
                }
              />

              <Information
                label={
                  modeDRH
                    ? "Date de décision du DRH"
                    : "Date de décision"
                }
                value={formaterDate(
                  modeDRH
                    ? demande?.date_approbation_drh
                    : demande?.date_decision
                )}
              />

              <div className="sm:col-span-2">
                <Information
                  label={
                    modeDRH
                      ? "Commentaire du DRH"
                      : "Commentaire"
                  }
                  value={
                    modeDRH
                      ? demande?.commentaire_drh
                      : demande?.motif_decision
                  }
                />
              </div>
            </div>
          </section>
        )}


        {/* Actions du directeur ou du DRH */}
        {demandeEnAttente && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold text-slate-900">
              {modeDRH
                ? "Décision finale du DRH"
                : "Décision du directeur"}
            </h2>

            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {modeDRH
                  ? "Commentaire du DRH"
                  : "Commentaire de validation"}
                <span className="ml-1 text-xs font-normal text-slate-400">
                  Facultatif
                </span>
              </label>

              <textarea
                value={commentaireValidation}
                onChange={(event) => {
                  setCommentaireValidation(
                    event.target.value
                  );

                  setErreur("");
                }}
                rows={3}
                placeholder="Commentaire ou recommandation..."
                className="w-full resize-y rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>


            {afficherRefus && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                <label className="mb-1.5 block text-sm font-semibold text-red-900">
                  Motif du refus
                  <span className="ml-1 text-red-600">
                    *
                  </span>
                </label>

                <textarea
                  value={motifRefus}
                  onChange={(event) => {
                    setMotifRefus(
                      event.target.value
                    );

                    setErreur("");
                  }}
                  rows={4}
                  placeholder="Expliquez la raison du refus..."
                  className="w-full resize-y rounded-lg border border-red-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>
            )}


            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              {afficherRefus ? (
                <>
                  <button
                    type="button"
                    disabled={traitement}
                    onClick={() => {
                      setAfficherRefus(false);
                      setMotifRefus("");
                      setErreur("");
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Annuler
                  </button>

                  <button
                    type="button"
                    disabled={
                      traitement ||
                      !motifRefus.trim()
                    }
                    onClick={refuserDemande}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {traitement ? (
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <XCircle size={17} />
                    )}

                    Confirmer le refus
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={traitement}
                    onClick={() => {
                      setAfficherRefus(true);
                      setErreur("");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle size={17} />
                    Refuser
                  </button>

                  <button
                    type="button"
                    disabled={traitement}
                    onClick={validerDemande}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {traitement ? (
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}

                    {modeDRH
                      ? "Approuver la demande"
                      : "Valider la demande"}
                  </button>
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
