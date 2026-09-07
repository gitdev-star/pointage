import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  RefreshCw,
  Save,
  Search,
  UploadCloud,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";

const TAILLE_MAXIMALE =
  10 * 1024 * 1024;

const EXTENSIONS_AUTORISEES = [
  "pdf",
  "doc",
  "docx",
  "png",
  "jpeg",
  "jpg",
];

function extraireExtension(nomFichier) {
  return (
    nomFichier
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

function obtenirMessageErreur(error) {
  const data = error.response?.data;

  if (!data) {
    return (
      "Une erreur est survenue. " +
      "Vérifiez votre connexion."
    );
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.detail) {
    return data.detail;
  }

  if (data.message) {
    return data.message;
  }

  const premiereCle =
    Object.keys(data)[0];

  if (premiereCle) {
    const valeur = data[premiereCle];

    if (Array.isArray(valeur)) {
      return valeur.join(" ");
    }

    if (typeof valeur === "string") {
      return valeur;
    }
  }

  return "Impossible d’enregistrer l’offre.";
}

function nomOffre(offre) {
  return (
    offre.nom_fichier_original ||
    offre.titre ||
    offre.reference ||
    "Offre sans nom"
  );
}

export default function EtapeCreationOffre({
  recrutement,
  onComplete,
}) {
  const offreActuelle =
    recrutement?.offre || null;

  const [mode, setMode] = useState(
    offreActuelle
      ? "EXISTANTE"
      : null
  );

  const [offres, setOffres] =
    useState([]);

  const [
    offreSelectionneeId,
    setOffreSelectionneeId,
  ] = useState(
    offreActuelle?.id || null
  );

  const [fichier, setFichier] =
    useState(null);

  const [recherche, setRecherche] =
    useState("");

  const [chargement, setChargement] =
    useState(true);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [erreur, setErreur] =
    useState("");

  const [message, setMessage] =
    useState("");

  const chargerOffres = async () => {
    setChargement(true);
    setErreur("");

    try {
      const resultat =
        await recrutementApi.obtenirOffres();

      setOffres(
        Array.isArray(resultat)
          ? resultat
          : resultat?.offres || []
      );
    } catch (error) {
      console.error(
        "Erreur de chargement des offres :",
        error
      );

      setErreur(
        obtenirMessageErreur(error)
      );
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerOffres();
  }, []);

  const offresFiltrees = useMemo(() => {
    const texte = recherche
      .trim()
      .toLowerCase();

    if (!texte) {
      return offres;
    }

    return offres.filter((offre) => {
      const contenu = [
        offre.reference,
        offre.titre,
        offre.nom_fichier_original,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return contenu.includes(texte);
    });
  }, [offres, recherche]);

  const offreSelectionnee =
    useMemo(() => {
      return (
        offres.find(
          (offre) =>
            Number(offre.id) ===
            Number(
              offreSelectionneeId
            )
        ) ||
        (
          Number(offreActuelle?.id) ===
          Number(
            offreSelectionneeId
          )
            ? offreActuelle
            : null
        )
      );
    }, [
      offres,
      offreSelectionneeId,
      offreActuelle,
    ]);

  const choisirMode = (
    nouveauMode
  ) => {
    setMode(nouveauMode);
    setErreur("");
    setMessage("");

    if (nouveauMode === "NOUVELLE") {
      setOffreSelectionneeId(null);
    }

    if (nouveauMode === "EXISTANTE") {
      setFichier(null);
    }
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
      extraireExtension(
        nouveauFichier.name
      );

    if (
      !EXTENSIONS_AUTORISEES.includes(
        extension
      )
    ) {
      setFichier(null);

      setErreur(
        "Formats autorisés : PDF, DOC et DOCX."
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

  const selectionnerOffre = (
    offreId
  ) => {
    setOffreSelectionneeId(
      offreId
    );

    setErreur("");
    setMessage("");
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    setErreur("");
    setMessage("");

    if (!mode) {
      setErreur(
        "Choisissez une nouvelle offre ou une offre existante."
      );

      return;
    }

    if (
      mode === "NOUVELLE" &&
      !fichier
    ) {
      setErreur(
        "Sélectionnez le fichier de l’offre."
      );

      return;
    }

    if (
      mode === "EXISTANTE" &&
      !offreSelectionnee
    ) {
      setErreur(
        "Sélectionnez une offre existante."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      let offreAssociee;

      if (mode === "NOUVELLE") {
        offreAssociee =
          await recrutementApi.creerOffre({
            fichier,
          });
      } else {
        offreAssociee =
          offreSelectionnee;
      }

      await recrutementApi
        .associerOffreAuProcessus(
          recrutement.id,
          offreAssociee.id
        );

      setMessage(
        mode === "NOUVELLE"
          ? "L’offre a été téléversée et associée au processus."
          : "L’offre existante a été associée au processus."
      );

      onComplete?.({
        etape: 1,
        offre: offreAssociee,
      });
    } catch (error) {
      console.error(
        "Erreur d’enregistrement de l’offre :",
        error
      );

      setErreur(
        obtenirMessageErreur(error)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Choix du mode */}
      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            choisirMode("NOUVELLE")
          }
          className={`
            rounded-xl border p-5
            text-left transition
            ${
              mode === "NOUVELLE"
                ? `
                  border-blue-500
                  bg-blue-50
                  ring-2 ring-blue-100
                `
                : `
                  border-slate-200
                  bg-white
                  hover:border-blue-300
                `
            }
          `}
        >
          <div className="flex items-start gap-3">
            <div
              className={`
                rounded-lg p-2.5
                ${
                  mode === "NOUVELLE"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }
              `}
            >
              <FileUp size={21} />
            </div>

            <div>
              <p className="font-semibold text-slate-900">
                Téléverser une offre
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Ajouter un nouveau fichier
                d’offre.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            choisirMode("EXISTANTE")
          }
          className={`
            rounded-xl border p-5
            text-left transition
            ${
              mode === "EXISTANTE"
                ? `
                  border-blue-500
                  bg-blue-50
                  ring-2 ring-blue-100
                `
                : `
                  border-slate-200
                  bg-white
                  hover:border-blue-300
                `
            }
          `}
        >
          <div className="flex items-start gap-3">
            <div
              className={`
                rounded-lg p-2.5
                ${
                  mode === "EXISTANTE"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }
              `}
            >
              <FileText size={21} />
            </div>

            <div>
              <p className="font-semibold text-slate-900">
                Utiliser une offre existante
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Choisir un fichier déjà
                téléversé.
              </p>
            </div>
          </div>
        </button>
      </div>

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
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {/* Nouvelle offre */}
      {mode === "NOUVELLE" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">
            Fichier de l’offre
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Formats autorisés : PDF, DOC,
            DOCX, PNG, JPEG et JPG — 10 Mo maximum.
          </p>

          {!fichier ? (
            <label
              className="
                mt-5 flex cursor-pointer
                flex-col items-center
                justify-center rounded-xl
                border-2 border-dashed
                border-slate-300
                bg-slate-50 px-5 py-10
                text-center transition
                hover:border-blue-400
                hover:bg-blue-50
              "
            >
              <UploadCloud
                size={32}
                className="text-blue-600"
              />

              <p className="mt-3 text-sm font-semibold text-slate-800">
                Sélectionner le fichier
                de l’offre
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Cliquez pour parcourir vos
                fichiers
              </p>

              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpeg,.jpg"
                onChange={(event) => {
                  selectionnerFichier(
                    event.target
                      .files?.[0]
                  );

                  event.target.value =
                    "";
                }}
                className="hidden"
              />
            </label>
          ) : (
            <div className="mt-5 flex flex-col justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-700">
                  <FileText size={21} />
                </div>

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
                className="text-sm font-semibold text-red-600 hover:text-red-700"
              >
                Supprimer
              </button>
            </div>
          )}
        </section>
      )}

      {/* Offres existantes */}
      {mode === "EXISTANTE" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-semibold text-slate-900">
                Offres téléversées
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Sélectionnez le fichier à
                utiliser.
              </p>
            </div>

            <button
              type="button"
              onClick={chargerOffres}
              disabled={chargement}
              className="
                inline-flex items-center
                justify-center gap-2
                rounded-lg border
                border-slate-300 bg-white
                px-3.5 py-2 text-sm
                font-semibold text-slate-700
                hover:bg-slate-100
                disabled:opacity-50
              "
            >
              <RefreshCw
                size={16}
                className={
                  chargement
                    ? "animate-spin"
                    : ""
                }
              />

              Actualiser
            </button>
          </div>

          <div className="relative mt-5">
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
              placeholder="Rechercher une offre..."
              className="
                w-full rounded-lg border
                border-slate-300 py-2.5
                pl-10 pr-4 text-sm
                outline-none
                focus:border-blue-500
                focus:ring-2
                focus:ring-blue-100
              "
            />
          </div>

          {chargement ? (
            <div className="flex min-h-48 items-center justify-center">
              <Loader2
                size={28}
                className="animate-spin text-blue-600"
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {offresFiltrees.map(
                (offre) => {
                  const selected =
                    Number(
                      offreSelectionneeId
                    ) ===
                    Number(offre.id);

                  return (
                    <button
                      key={offre.id}
                      type="button"
                      onClick={() =>
                        selectionnerOffre(
                          offre.id
                        )
                      }
                      className={`
                        flex w-full
                        items-center
                        justify-between
                        gap-4 rounded-xl
                        border p-4
                        text-left transition
                        ${
                          selected
                            ? `
                              border-blue-500
                              bg-blue-50
                              ring-2
                              ring-blue-100
                            `
                            : `
                              border-slate-200
                              hover:border-blue-300
                            `
                        }
                      `}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600">
                          <FileText
                            size={20}
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {nomOffre(
                              offre
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {offre.reference}
                          </p>
                        </div>
                      </div>

                      {selected && (
                        <CheckCircle2
                          size={22}
                          className="shrink-0 text-blue-600"
                        />
                      )}
                    </button>
                  );
                }
              )}

              {offresFiltrees.length ===
                0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Aucune offre téléversée
                  n’a été trouvée.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {mode && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={
              isSubmitting ||
              chargement ||
              (mode === "NOUVELLE" &&
                !fichier) ||
              (mode === "EXISTANTE" &&
                !offreSelectionnee)
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
              : mode === "NOUVELLE"
                ? "Téléverser et continuer"
                : "Sélectionner et continuer"}
          </button>
        </div>
      )}
    </form>
  );
}