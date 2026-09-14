import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  ExternalLink,
  FileImage,
  FileText,
  FileUp,
  Loader2,
  Save,
  ScanLine,
  Trash2,
  Users,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";

const EXTENSIONS_AUTORISEES = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
];

const TAILLE_MAXIMALE =
  10 * 1024 * 1024;

function dateDuJour() {
  const date = new Date();

  const annee = date.getFullYear();

  const mois = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const jour = String(
    date.getDate()
  ).padStart(2, "0");

  return `${annee}-${mois}-${jour}`;
}

function extensionFichier(nom) {
  return (
    nom
      ?.split(".")
      .pop()
      ?.toLowerCase() || ""
  );
}

function formatTaille(taille) {
  if (!taille) return "0 Ko";

  if (taille < 1024 * 1024) {
    return `${Math.ceil(
      taille / 1024
    )} Ko`;
  }

  return `${(
    taille /
    (1024 * 1024)
  ).toFixed(1)} Mo`;
}

function obtenirErreur(error) {
  if (!error.response) {
    return (
      error.message ||
      "Impossible de communiquer avec le serveur."
    );
  }

  return recrutementApi.extraireErreur(
    error
  );
}

function IconeFichier({
  nom,
}) {
  const extension =
    extensionFichier(nom);

  if (extension === "pdf") {
    return (
      <FileText
        size={21}
        className="shrink-0 text-red-600"
      />
    );
  }

  return (
    <FileImage
      size={21}
      className="shrink-0 text-blue-600"
    />
  );
}

export default function EtapeFicheTransparence({
  recrutement,
  onComplete,
}) {
  const processusId =
    recrutement?.id ||
    recrutement?.processus_id;

  const fichesInitiales =
    recrutement?.fiches_transparence ||
    (recrutement?.fiche_transparence
      ? [recrutement.fiche_transparence]
      : []);

  const [fiches, setFiches] =
    useState(fichesInitiales);

  const [chargementFiches, setChargementFiches] =
    useState(true);

  const [
    dateFiche,
    setDateFiche,
  ] = useState(dateDuJour());

  const [lieu, setLieu] =
    useState("");

  const [
    observations,
    setObservations,
  ] = useState("");

  const [fichier, setFichier] =
    useState(null);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [erreur, setErreur] =
    useState("");

  const [message, setMessage] =
    useState("");

  const nombreCandidats =
    useMemo(() => {
      return (
        recrutement?.candidats
          ?.length || 0
      );
    }, [recrutement]);

  useEffect(() => {
    let actif = true;

    async function chargerFiches() {
      if (!processusId) {
        setChargementFiches(false);
        return;
      }

      try {
        const resultat =
          await recrutementApi
            .obtenirFichesTransparence({
              processus: processusId,
            });

        if (actif) {
          setFiches(resultat.fiches || []);
        }
      } catch (error) {
        if (actif) {
          setErreur(obtenirErreur(error));
        }
      } finally {
        if (actif) {
          setChargementFiches(false);
        }
      }
    }

    chargerFiches();

    return () => {
      actif = false;
    };
  }, [processusId]);

  const modifierChamp = (
    callback,
    valeur
  ) => {
    callback(valeur);

    setErreur("");
    setMessage("");
  };

  const selectionnerFichier = (
    nouveauFichier
  ) => {
    setErreur("");
    setMessage("");

    if (!nouveauFichier) {
      setFichier(null);
      return;
    }

    const extension =
      extensionFichier(
        nouveauFichier.name
      );

    if (
      !EXTENSIONS_AUTORISEES.includes(
        extension
      )
    ) {
      setFichier(null);

      setErreur(
        "Formats autorisés : PDF, PNG, JPG ou JPEG."
      );

      return;
    }

    if (
      nouveauFichier.size >
      TAILLE_MAXIMALE
    ) {
      setFichier(null);

      setErreur(
        "Le fichier ne doit pas dépasser 10 Mo."
      );

      return;
    }

    setFichier(nouveauFichier);
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    setErreur("");
    setMessage("");

    if (!dateFiche) {
      setErreur(
        "La date de la fiche est obligatoire."
      );

      return;
    }

    if (!lieu) {
      setErreur(
        "Le lieu est obligatoire."
      );

      return;
    }

    if (!fichier) {
      setErreur(
        "Le fichier de la fiche de transparence est obligatoire."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const fiche =
        await recrutementApi
          .enregistrerFicheTransparence({
            processusId:
              processusId,

            dateFiche,

            lieu,

            fichier,

            observations:
              observations.trim(),

            originalSigne: true,
          });

      setFiches((precedentes) => [
        fiche,
        ...precedentes,
      ]);

      setDateFiche(dateDuJour());
      setLieu("");
      setFichier(null);
      setObservations("");
      setMessage(
        "La nouvelle fiche de transparence a été ajoutée."
      );
    } catch (error) {
      console.error(
        "Erreur fiche de transparence :",
        error
      );

      setErreur(
        obtenirErreur(error)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {message && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0"
          />

          {message}
        </div>
      )}

      {erreur && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {/* Résumé */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700">
            <ScanLine size={21} />
          </div>

          <div>
            <p className="font-semibold text-slate-900">
              Fiche de transparence
            </p>

            <p className="text-xs text-slate-500">
              {recrutement.reference} Â·{" "}
              {recrutement.poste}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Users size={17} />

          <span>
            <strong>
              {nombreCandidats}
            </strong>{" "}
            candidat(s)
          </span>
        </div>
      </div>

      {/* Historique des fiches */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">
              Fiches déjÃ  enregistrées
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Les anciennes fiches sont conservées et ne sont jamais remplacées.
            </p>
          </div>

          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {fiches.length} fiche(s)
          </span>
        </div>

        {chargementFiches ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Chargement des fiches...
          </div>
        ) : fiches.length === 0 ? (
          <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            Aucune fiche de transparence enregistrée.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {fiches.map((fiche, index) => {
              const url = fiche.fichier_url || fiche.fichier;
              const nom = url
                ? decodeURIComponent(url.split("/").pop().split("?")[0])
                : `Fiche ${fiches.length - index}`;

              return (
                <div
                  key={fiche.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <IconeFichier nom={nom} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {nom}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {fiche.date_fiche} Â· {fiche.lieu_libelle || fiche.lieu}
                      </p>
                    </div>
                  </div>

                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-blue-700"
                    >
                      <ExternalLink size={16} />
                      Ouvrir
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Informations */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-5 font-semibold text-slate-900">
          Informations de la fiche
        </h3>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Date de remplissage
              <span className="ml-1 text-red-500">
                *
              </span>
            </label>

            <input
              type="date"
              value={dateFiche}
              max={dateDuJour()}
              onChange={(event) =>
                modifierChamp(
                  setDateFiche,
                  event.target.value
                )
              }
              required
              className="
                w-full rounded-lg
                border border-slate-300
                px-3.5 py-2.5
                text-sm outline-none
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-100
              "
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Lieu de travail
              <span className="ml-1 text-red-500">
                *
              </span>
            </label>

            <select
              value={lieu}
              onChange={(event) =>
                modifierChamp(
                  setLieu,
                  event.target.value
                )
              }
              required
              className="
                w-full rounded-lg
                border border-slate-300
                bg-white px-3.5 py-2.5
                text-sm outline-none
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-100
              "
            >
              <option value="">
                Sélectionner un site
              </option>

              <option value="SITE_1">
                PBI 1
              </option>

              <option value="SITE_2">
                PBI 2
              </option>

              <option value="SITE_3">
                PBI 3
              </option>
            </select>
          </div>
        </div>
      </section>

      {/* Fichier */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">
          Document numérisé
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Regroupez toutes les pages dans
          un seul fichier PDF ou utilisez
          une image.
        </p>

        {!fichier ? (
          <label
            className="
              mt-5 flex cursor-pointer
              flex-col items-center
              justify-center rounded-xl
              border-2 border-dashed
              border-slate-300
              bg-slate-50 px-5 py-8
              text-center transition
              hover:border-blue-400
              hover:bg-blue-50
            "
          >
            <FileUp
              size={30}
              className="text-blue-600"
            />

            <p className="mt-3 text-sm font-semibold text-slate-800">
              Sélectionner une nouvelle fiche
            </p>

            <p className="mt-1 text-xs text-slate-500">
              PDF, PNG, JPG ou JPEG -
              10 Mo maximum
            </p>

            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(event) => {
                selectionnerFichier(
                  event.target
                    .files?.[0] ||
                    null
                );

                event.target.value =
                  "";
              }}
              className="hidden"
            />
          </label>
        ) : (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <IconeFichier
                nom={fichier.name}
              />

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-emerald-900">
                  {fichier.name}
                </p>

                <p className="mt-1 text-xs text-emerald-700">
                  {formatTaille(
                    fichier.size
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setFichier(null)
              }
              className="rounded-lg p-2 text-red-600 hover:bg-red-100"
              title="Retirer le fichier"
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}

      </section>

      {/* Observations */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Observations
        </label>

        <textarea
          value={observations}
          onChange={(event) =>
            modifierChamp(
              setObservations,
              event.target.value
            )
          }
          rows={4}
          placeholder="Remarques concernant la fiche de transparence..."
          className="
            w-full resize-none
            rounded-lg border
            border-slate-300
            px-3.5 py-2.5
            text-sm outline-none
            focus:border-blue-500
            focus:ring-2
            focus:ring-blue-100
          "
        />
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            !dateFiche ||
            !lieu ||
            !fichier
          }
          className="
            inline-flex items-center
            gap-2 rounded-lg
            bg-blue-600 px-5
            py-2.5 text-sm
            font-semibold text-white
            hover:bg-blue-700
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
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
            ? "Enregistrement..."
            : "Ajouter cette fiche"}
        </button>
      </div>

      <div className="flex justify-end border-t border-slate-200 pt-5">
        <button
          type="button"
          disabled={
            isSubmitting ||
            chargementFiches ||
            fiches.length === 0
          }
          onClick={() =>
            onComplete?.({
              etape: 3,
              ficheTransparence:
                fiches[0],
              fichesTransparence:
                fiches,
            })
          }
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 size={17} />
          Continuer vers le suivi des candidatures
        </button>
      </div>
    </form>
  );
}