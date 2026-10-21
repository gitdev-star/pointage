import React, {
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
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

  // Étape 1 déjà terminée (éventuellement sans offre ni publication) :
  // on l'indique simplement au lieu d'afficher une erreur.
  const etapeTerminee = (
    recrutement?.etapesTerminees ||
    recrutement?.etapes_terminees ||
    []
  ).map(Number).includes(1);

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

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    setErreur("");
    setMessage("");

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

            lienOuReference:
              lienOuReference.trim(),

            commentaire:
              commentaire.trim(),
          });

      setMessage(
        publicationExistante
          ? "La publication a été mise à jour."
          : "La publication a été enregistrée."
      );

      onComplete?.({
        etape: 1,
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
      ) : etapeTerminee ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Cette étape a été terminée sans offre associée.
          {!publicationExistante &&
            " Aucune publication n’a été enregistrée."}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Aucune offre n’est associée. La publication peut quand même
          être enregistrée.
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

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => onComplete?.({ etape: 1, publications: [] })}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Terminer sans publication
        </button>

        <button
          type="submit"
          disabled={
            isSubmitting ||
            !canal ||
            !datePublication
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
              ? "Mettre à jour et terminer l’étape"
              : "Enregistrer et terminer l’étape"}
        </button>
      </div>
    </form>
  );
}
