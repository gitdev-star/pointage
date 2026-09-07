import React, {
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  FileText,
  FileUp,
  Link as LinkIcon,
  Loader2,
  Megaphone,
  Save,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";

const CANAUX_PUBLICATION = [
  "Affichage interne",
  "Réseaux sociaux",
  "Site d'emploi",
  "Agence de recrutement",
  "Presse",
  "Radio",
  "Autre",
];

const EXTENSIONS_PREUVE = [
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

function nomOffre(offre) {
  return (
    offre?.nom_fichier_original ||
    offre?.titre ||
    offre?.reference ||
    "Offre sélectionnée"
  );
}

export default function EtapePublicationOffre({
  recrutement,
  offre,
  onComplete,
}) {
  const publicationExistante =
    useMemo(() => {
      const publications =
        recrutement?.publications;

      if (
        !Array.isArray(publications)
      ) {
        return null;
      }

      return publications[0] || null;
    }, [recrutement]);

  const [
    canal,
    setCanal,
  ] = useState(
    publicationExistante?.canal || ""
  );

  const [
    datePublication,
    setDatePublication,
  ] = useState(
    publicationExistante
      ?.date_publication ||
      dateDuJour()
  );

  const [
    dateLimiteCandidature,
    setDateLimiteCandidature,
  ] = useState(
    publicationExistante
      ?.date_limite_candidature ||
      ""
  );

  const [
    lienOuReference,
    setLienOuReference,
  ] = useState(
    publicationExistante
      ?.lien_ou_reference ||
      ""
  );

  const [
    commentaire,
    setCommentaire,
  ] = useState(
    publicationExistante
      ?.commentaire ||
      ""
  );

  const [preuve, setPreuve] =
    useState(null);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [erreur, setErreur] =
    useState("");

  const [message, setMessage] =
    useState("");

  const modifierChamp = (
    callback,
    valeur
  ) => {
    callback(valeur);

    setErreur("");
    setMessage("");
  };

  const selectionnerPreuve = (
    fichier
  ) => {
    setErreur("");
    setMessage("");

    if (!fichier) {
      setPreuve(null);
      return;
    }

    const extension =
      extensionFichier(fichier.name);

    if (
      !EXTENSIONS_PREUVE.includes(
        extension
      )
    ) {
      setPreuve(null);

      setErreur(
        "Formats autorisés pour la preuve : PDF, PNG, JPG ou JPEG."
      );

      return;
    }

    if (
      fichier.size >
      TAILLE_MAXIMALE
    ) {
      setPreuve(null);

      setErreur(
        "La preuve ne doit pas dépasser 10 Mo."
      );

      return;
    }

    setPreuve(fichier);
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    setErreur("");
    setMessage("");

    if (!offre) {
      setErreur(
        "Aucune offre n’est associée. Revenez à l’étape 1."
      );

      return;
    }

    if (!canal) {
      setErreur(
        "Sélectionnez le canal de publication."
      );

      return;
    }

    if (!datePublication) {
      setErreur(
        "Renseignez la date de publication."
      );

      return;
    }

    if (!dateLimiteCandidature) {
      setErreur(
        "Renseignez la date limite de candidature."
      );

      return;
    }

    if (
      datePublication >
      dateLimiteCandidature
    ) {
      setErreur(
        "La date limite doit être postérieure ou égale à la date de publication."
      );

      return;
    }

    if (
      recrutement
        ?.datePrevueRecrutement &&
      dateLimiteCandidature >=
        recrutement
          .datePrevueRecrutement
    ) {
      setErreur(
        "La date limite doit être antérieure à la date prévue du recrutement."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const publication =
        await recrutementApi
          .enregistrerPublication({
            publicationId:
              publicationExistante?.id ||
              null,

            processusId:
              recrutement.id,

            canal,

            datePublication,

            dateLimiteCandidature,

            lienOuReference:
              lienOuReference.trim(),

            commentaire:
              commentaire.trim(),

            preuve,
          });

      setMessage(
        publicationExistante
          ? "La publication a été mise à jour."
          : "La publication a été enregistrée."
      );

      onComplete?.({
        etape: 2,
        publications: [
          publication,
        ],
      });
    } catch (error) {
      console.error(
        "Erreur de publication :",
        error
      );

      setErreur(
        recrutementApi.extraireErreur(
          error
        )
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
      {/* Offre sélectionnée */}
      {offre ? (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0 text-blue-600"
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-blue-900">
              Offre associée :{" "}
              {nomOffre(offre)}
            </p>

            <p className="mt-1 text-xs text-blue-700">
              {offre.reference} ·{" "}
              {recrutement.departement}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Aucune offre n’est associée.
          Revenez à l’étape 1.
        </div>
      )}

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

      {/* Publication unique */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-5 flex items-center gap-2 font-semibold text-slate-900">
          <Megaphone
            size={18}
            className="text-blue-600"
          />

          Publication de l’offre
        </h3>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Canal de publication
              <span className="ml-1 text-red-500">
                *
              </span>
            </label>

            <select
              value={canal}
              onChange={(event) =>
                modifierChamp(
                  setCanal,
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
                Sélectionner un canal
              </option>

              {CANAUX_PUBLICATION.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Date de publication
              <span className="ml-1 text-red-500">
                *
              </span>
            </label>

            <input
              type="date"
              value={datePublication}
              onChange={(event) =>
                modifierChamp(
                  setDatePublication,
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
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Date limite de candidature
              <span className="ml-1 text-red-500">
                *
              </span>
            </label>

            <input
              type="date"
              value={
                dateLimiteCandidature
              }
              min={datePublication}
              max={
                recrutement
                  ?.datePrevueRecrutement ||
                undefined
              }
              onChange={(event) =>
                modifierChamp(
                  setDateLimiteCandidature,
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
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Lien ou référence
            </label>

            <div className="relative">
              <LinkIcon
                size={17}
                className="
                  absolute left-3 top-1/2
                  -translate-y-1/2
                  text-slate-400
                "
              />

              <input
                value={lienOuReference}
                onChange={(event) =>
                  modifierChamp(
                    setLienOuReference,
                    event.target.value
                  )
                }
                placeholder="Lien, journal ou emplacement..."
                className="
                  w-full rounded-lg
                  border border-slate-300
                  py-2.5 pl-10 pr-3
                  text-sm outline-none
                  focus:border-blue-500
                  focus:ring-2
                  focus:ring-blue-100
                "
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Preuve de publication
            </label>

            <label
              className="
                flex cursor-pointer
                items-center gap-3
                rounded-lg border
                border-dashed
                border-slate-300 p-3
                transition
                hover:bg-slate-50
              "
            >
              <FileUp
                size={20}
                className="shrink-0 text-blue-600"
              />

              <span className="min-w-0 truncate text-sm text-slate-600">
                {preuve
                  ? preuve.name
                  : publicationExistante
                        ?.preuve
                    ? "Preuve déjà enregistrée"
                    : "Ajouter une preuve"}
              </span>

              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(event) => {
                  selectionnerPreuve(
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

            {preuve && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {formatTaille(
                    preuve.size
                  )}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPreuve(null)
                  }
                  className="font-semibold text-red-600"
                >
                  Retirer
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Commentaire
            </label>

            <textarea
              value={commentaire}
              onChange={(event) =>
                modifierChamp(
                  setCommentaire,
                  event.target.value
                )
              }
              rows={3}
              placeholder="Information complémentaire..."
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
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            !offre ||
            !canal ||
            !datePublication ||
            !dateLimiteCandidature
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
            : publicationExistante
              ? "Mettre à jour et continuer"
              : "Enregistrer et continuer"}
        </button>
      </div>
    </form>
  );
}