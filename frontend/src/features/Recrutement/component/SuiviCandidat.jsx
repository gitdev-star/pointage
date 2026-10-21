import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";

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

function creerCandidatInitial() {
  return {
    nom: "",
    prenom: "",
    telephone: "",
    email: "",
    dateCandidature:
      dateDuJour(),
    observations: "",
  };
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(
    `${value}T00:00:00`
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "fr-FR"
  ).format(date);
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

function candidatActif(candidat) {
  return candidat.statut !== "DESISTE";
}

function candidatRecu(candidat) {
  if (!candidatActif(candidat)) {
    return false;
  }

  return (
    candidat.statut === "RECU" ||
    candidat.statut === "EMBAUCHE"
  );
}

function echapperHtml(valeur) {
  return String(valeur ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Fiche « Documents à fournir » : la même pour tous
// les candidats, imprimée 6 fois par page A4.
function contenuListeDossiers(documents) {
  const lignes = documents
    .map(
      (libelle) => `
        <div class="document">
          <span class="checkbox"></span>
          ${echapperHtml(libelle)}
        </div>
      `
    )
    .join("");

  const fiche = `
    <section class="fiche">
      <div class="entete-fiche">
        <div>
          <h1>Documents à fournir</h1>
          <p class="subtitle">Processus de recrutement</p>
        </div>

        <div class="reference">
          Réf. : PBI_FIC_Recru_Dossier-00
        </div>
      </div>

      <div class="documents">${lignes}</div>
    </section>
  `;

  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Liste des dossiers à fournir</title>
        <style>
          @page { size: A4 portrait; margin: 6mm; }
          * { box-sizing: border-box; }
          html, body {
            width: 100%;
            margin: 0;
            font-family: Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
          }
          .planche {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(3, 1fr);
            gap: 3mm;
            width: 100%;
            height: 285mm;
          }
          .fiche {
            overflow: hidden;
            border: 1px dashed #64748b;
            border-radius: 2mm;
            padding: 3mm;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .entete-fiche {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 2mm;
            padding-bottom: 1.5mm;
            border-bottom: 1px solid #cbd5e1;
          }
          h1 { margin: 0; font-size: 11px; line-height: 1.2; }
          .subtitle { margin: 0.8mm 0 0; color: #64748b; font-size: 7px; }
          .reference {
            max-width: 38mm;
            color: #334155;
            font-size: 6.5px;
            font-weight: 700;
            text-align: right;
          }
          .documents {
            display: grid;
            grid-template-columns: 1fr 1fr;
            column-gap: 2mm;
            margin-top: 1.5mm;
          }
          .document {
            display: flex;
            align-items: center;
            gap: 1.5mm;
            min-height: 6mm;
            padding: 0.8mm 0;
            border-bottom: 1px solid #e2e8f0;
            font-size: 7px;
            line-height: 1.15;
          }
          .checkbox {
            width: 3.2mm;
            height: 3.2mm;
            flex: 0 0 3.2mm;
            border: 1px solid #334155;
            display: inline-block;
          }
          @media screen {
            body { padding: 6mm; background: #e2e8f0; }
            .planche { max-width: 198mm; margin: 0 auto; background: #ffffff; }
          }
        </style>
      </head>
      <body>
        <main class="planche">${fiche.repeat(6)}</main>
      </body>
    </html>
  `;
}

function ChampCandidat({
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
  );
}

export default function EtapeSuiviCandidatures({
  recrutement,
  onComplete,
}) {
  const [candidats, setCandidats] =
    useState([]);

  const [
    nouveauCandidat,
    setNouveauCandidat,
  ] = useState(
    creerCandidatInitial
  );

  const [
    afficherFormulaire,
    setAfficherFormulaire,
  ] = useState(false);

  const [recherche, setRecherche] =
    useState("");

  const [
    observations,
    setObservations,
  ] = useState(
    recrutement
      ?.observations_suivi ||
    ""
  );

  const [chargement, setChargement] =
    useState(true);

  const [
    ajoutEnCours,
    setAjoutEnCours,
  ] = useState(false);

  const [
    candidatEnCours,
    setCandidatEnCours,
  ] = useState(null);

  const [
    telechargement,
    setTelechargement,
  ] = useState(false);

  const [
    generationListe,
    setGenerationListe,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [erreur, setErreur] =
    useState("");

  const [message, setMessage] =
    useState("");

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
    } catch (error) {
      console.error(
        "Erreur de chargement des candidats :",
        error
      );

      setErreur(
        obtenirErreur(error)
      );
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerCandidats();
  }, [recrutement.id]);

  const candidatsActifs = useMemo(
    () => candidats.filter(candidatActif),
    [candidats]
  );

  const candidatsFiltres =
    useMemo(() => {
      const texte = recherche
        .trim()
        .toLowerCase();

      if (!texte) {
        return candidatsActifs;
      }

      return candidatsActifs.filter(
        (candidat) => {
          const contenu = [
            candidat.nom,
            candidat.prenom,
            candidat.email,
            candidat.telephone,
            candidat.source,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return contenu.includes(
            texte
          );
        }
      );
    }, [candidatsActifs, recherche]);

  const nombreRecus = useMemo(
    () =>
      candidatsActifs.filter(
        candidatRecu
      ).length,
    [candidatsActifs]
  );

  const modifierNouveauCandidat = (
    event
  ) => {
    const { name, value } =
      event.target;

    setNouveauCandidat(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );

    setErreur("");
    setMessage("");
  };

  const ajouterCandidat = async () => {
    setErreur("");
    setMessage("");

    if (
      !nouveauCandidat.nom.trim() ||
      !nouveauCandidat.prenom.trim() ||
      !nouveauCandidat
        .dateCandidature
    ) {
      setErreur(
        "Le nom, le prénom et la date de candidature sont obligatoires."
      );

      return;
    }

    setAjoutEnCours(true);

    try {
      const candidat =
        await recrutementApi
          .creerCandidat({
            processusId:
              recrutement.id,

            ...nouveauCandidat,
          });

      setCandidats(
        (previous) => [
          ...previous,
          candidat,
        ]
      );

      setNouveauCandidat(
        creerCandidatInitial()
      );

      setAfficherFormulaire(false);

      setMessage(
        "Le candidat a été ajouté."
      );
    } catch (error) {
      console.error(
        "Erreur d'ajout du candidat :",
        error
      );

      setErreur(
        obtenirErreur(error)
      );
    } finally {
      setAjoutEnCours(false);
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

    setCandidatEnCours(
      candidat.id
    );

    setErreur("");
    setMessage("");

    try {
      await recrutementApi
        .supprimerCandidat(
          candidat.id
        );

      setCandidats(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !==
              candidat.id
          )
      );

      setMessage(
        "Le candidat a été supprimé."
      );
    } catch (error) {
      console.error(
        "Erreur de suppression du candidat :",
        error
      );

      setErreur(
        obtenirErreur(error)
      );
    } finally {
      setCandidatEnCours(null);
    }
  };

  const basculerFicheTest = async (
    candidat,
    recue
  ) => {
    setCandidatEnCours(
      candidat.id
    );

    setErreur("");
    setMessage("");

    try {
      const candidatModifie =
        await recrutementApi
          .modifierFicheTestRecue(
            candidat.id,
            recue
          );

      setCandidats(
        (previous) =>
          previous.map(
            (item) =>
              item.id ===
              candidat.id
                ? candidatModifie
                : item
          )
      );
    } catch (error) {
      console.error(
        "Erreur de mise à jour de la fiche de test :",
        error
      );

      setErreur(
        obtenirErreur(error)
      );
    } finally {
      setCandidatEnCours(null);
    }
  };

  const genererListeDossiers =
    async () => {
      setErreur("");
      setMessage("");

      // La fenêtre est ouverte tout de suite, sinon le
      // navigateur la bloque après l'appel au serveur.
      const fenetre =
        window.open("", "_blank");

      if (!fenetre) {
        setErreur(
          "Le navigateur a bloqué la fenêtre d’impression."
        );

        return;
      }

      setGenerationListe(true);

      try {
        const resultat =
          await recrutementApi
            .genererListeDossiers(
              recrutement.id
            );

        fenetre.document.write(
          contenuListeDossiers(
            resultat.documents || []
          )
        );
        fenetre.document.close();
        fenetre.focus();
        fenetre.print();

        setMessage(
          resultat.message ||
            "La liste des dossiers à fournir a été générée."
        );
      } catch (error) {
        fenetre.close();

        console.error(
          "Erreur de génération de la liste :",
          error
        );

        setErreur(
          obtenirErreur(error)
        );
      } finally {
        setGenerationListe(false);
      }
    };

  const telechargerExcel =
    async () => {
      setTelechargement(true);
      setErreur("");

      try {
        const response =
          await recrutementApi
            .obtenirFichierSuiviExcel(
              recrutement.id
            );

        const blob = new Blob(
          [response.data],
          {
            type:
              response.headers[
                "content-type"
              ] ||
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }
        );

        const url =
          URL.createObjectURL(blob);

        const lien =
          document.createElement("a");

        lien.href = url;

        lien.download =
          `suivi-${recrutement.reference}.xlsx`;

        document.body.appendChild(
          lien
        );

        lien.click();
        lien.remove();

        URL.revokeObjectURL(url);
      } catch (error) {
        console.error(
          "Erreur de téléchargement Excel :",
          error
        );

        setErreur(
          obtenirErreur(error)
        );
      } finally {
        setTelechargement(false);
      }
    };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    setErreur("");
    setMessage("");

    if (
      candidatsActifs.length === 0
    ) {
      setErreur(
        "Ajoutez au moins un candidat."
      );

      return;
    }

    if (nombreRecus === 0) {
      setErreur(
        "Cochez la fiche de test d'au moins un candidat."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      await recrutementApi
        .confirmerSuiviCandidatures({
          processusId:
            recrutement.id,

          observations,
        });

      setMessage(
        "Le suivi des candidatures a été confirmé."
      );

      const candidatsRetenus =
        candidatsActifs.filter(
          candidatRecu
        );

        onComplete?.({
          etape: 3,

          suiviCandidatures: {
            candidats: candidatsActifs,
            candidatsRetenus,
            observations,

            nombreCandidats:
              candidatsActifs.length,

            nombreRecus:
              candidatsRetenus.length,
          },
        });
    } catch (error) {
      console.error(
        "Erreur de confirmation du suivi :",
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
      {/* Résumé */}
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700">
            <Users size={21} />
          </div>

          <div>
            <p className="font-semibold text-slate-900">
              {candidatsActifs.length} candidat(s)
            </p>

            <p className="text-xs text-slate-500">
              {nombreRecus} reçu(s) avec
              une fiche de test
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={chargerCandidats}
            disabled={chargement}
            className="
              inline-flex items-center gap-2
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

          <button
            type="button"
            onClick={() =>
              setAfficherFormulaire(
                (previous) =>
                  !previous
              )
            }
            className="
              inline-flex items-center gap-2
              rounded-lg bg-blue-600
              px-3.5 py-2 text-sm
              font-semibold text-white
              hover:bg-blue-700
            "
          >
            <UserPlus size={16} />

            Ajouter un candidat
          </button>
        </div>
      </section>

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

      {/* Ajout */}
      {afficherFormulaire && (
        <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
          <h3 className="mb-5 flex items-center gap-2 font-semibold text-slate-900">
            <Plus
              size={18}
              className="text-blue-600"
            />

            Nouveau candidat
          </h3>

          <div className="grid gap-5 md:grid-cols-2">
            <ChampCandidat
              label="Nom"
              name="nom"
              value={
                nouveauCandidat.nom
              }
              onChange={
                modifierNouveauCandidat
              }
              required
            />

            <ChampCandidat
              label="Prénom"
              name="prenom"
              value={
                nouveauCandidat.prenom
              }
              onChange={
                modifierNouveauCandidat
              }
              required
            />

            <ChampCandidat
              label="Téléphone"
              name="telephone"
              value={
                nouveauCandidat.telephone
              }
              onChange={
                modifierNouveauCandidat
              }
            />

            <ChampCandidat
              label="Adresse e-mail"
              name="email"
              type="email"
              value={
                nouveauCandidat.email
              }
              onChange={
                modifierNouveauCandidat
              }
            />

            <ChampCandidat
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

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Source
              </label>

              <input
                value="Récupérée automatiquement après l'enregistrement"
                disabled
                className="
                  w-full cursor-not-allowed
                  rounded-lg border
                  border-slate-300
                  bg-slate-100 px-3.5
                  py-2.5 text-sm
                  text-slate-500
                "
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setAfficherFormulaire(
                  false
                )
              }
              className="
                rounded-lg border
                border-slate-300
                bg-white px-4 py-2.5
                text-sm font-semibold
                text-slate-700
              "
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={ajouterCandidat}
              disabled={ajoutEnCours}
              className="
                inline-flex items-center
                gap-2 rounded-lg
                bg-blue-600 px-4
                py-2.5 text-sm
                font-semibold text-white
                disabled:opacity-50
              "
            >
              {ajoutEnCours ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Plus size={17} />
              )}

              Ajouter
            </button>
          </div>
        </section>
      )}

      {/* Recherche */}
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
          className="
            w-full rounded-lg
            border border-slate-300
            py-2.5 pl-10 pr-4
            text-sm outline-none
            focus:border-blue-500
            focus:ring-2
            focus:ring-blue-100
          "
        />
      </div>

      {/* Candidats */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {chargement ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin text-blue-600"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-100">
                <tr className="text-left text-xs font-semibold uppercase text-slate-600">
                  <th className="px-4 py-3">
                    Candidat
                  </th>

                  <th className="px-4 py-3">
                    Contact
                  </th>

                  <th className="px-4 py-3">
                    Date
                  </th>

                  <th className="px-4 py-3">
                    Source
                  </th>

                  <th className="px-4 py-3 text-center">
                    Fiche de test
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {candidatsFiltres.map(
                  (candidat) => {
                    const embauche =
                      candidat.statut ===
                      "EMBAUCHE";

                    const chargementCandidat =
                      candidatEnCours ===
                      candidat.id;

                    return (
                      <tr
                        key={
                          candidat.id
                        }
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              title="Supprimer le candidat"
                              onClick={() =>
                                supprimerCandidat(
                                  candidat
                                )
                              }
                              disabled={
                                chargementCandidat
                              }
                              className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2
                                size={15}
                              />
                            </button>

                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {
                                  candidat.prenom
                                }{" "}
                                {candidat.nom}
                              </p>

                              <p className="text-xs text-slate-500">
                                {candidat.email ||
                                  "Aucun e-mail"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          {candidat.telephone ||
                            "-"}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          {formatDate(
                            candidat.date_candidature
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          {candidat.source ||
                            "Offre publiée"}
                        </td>

                        <td className="px-4 py-4 text-center">
                          {chargementCandidat ? (
                            <Loader2
                              size={18}
                              className="inline animate-spin text-blue-600"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              title={
                                embauche
                                  ? "Candidat déjà embauché"
                                  : "Fiche de test reçue"
                              }
                              checked={candidatRecu(
                                candidat
                              )}
                              disabled={embauche}
                              onChange={(event) =>
                                basculerFicheTest(
                                  candidat,
                                  event.target
                                    .checked
                                )
                              }
                              className="h-5 w-5 cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}

                {candidatsFiltres.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      Aucun candidat trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Liste des dossiers à fournir */}
      <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
        <h3 className="font-semibold text-slate-900">
          Liste des dossiers à fournir
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Une seule liste pour tous les candidats
          dont la fiche de test est cochée. Elle est
          facultative : vous pouvez passer à l'étape
          suivante sans la générer. Si vous cochez un
          nouveau candidat ensuite, générez-la à nouveau.
        </p>

        <button
          type="button"
          onClick={genererListeDossiers}
          disabled={
            generationListe ||
            nombreRecus === 0
          }
          className="
            mt-4 inline-flex
            items-center gap-2
            rounded-lg bg-blue-600
            px-4 py-2.5 text-sm
            font-semibold text-white
            hover:bg-blue-700
            disabled:opacity-50
          "
        >
          {generationListe ? (
            <Loader2
              size={17}
              className="animate-spin"
            />
          ) : (
            <Printer size={17} />
          )}

          Générer la liste des dossiers à fournir
        </button>
      </section>

      {/* Excel facultatif */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="font-semibold text-slate-900">
          Fichier Excel de suivi
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          La génération du fichier est
          facultative et ne bloque pas la
          validation de l'étape.
        </p>

        <button
          type="button"
          onClick={telechargerExcel}
          disabled={
            telechargement ||
            candidatsActifs.length === 0
          }
          className="
            mt-4 inline-flex
            items-center gap-2
            rounded-lg border
            border-slate-300 bg-white
            px-4 py-2.5 text-sm
            font-semibold text-slate-700
            hover:bg-slate-100
            disabled:opacity-50
          "
        >
          {telechargement ? (
            <Loader2
              size={17}
              className="animate-spin"
            />
          ) : (
            <Download size={17} />
          )}

          Télécharger le fichier Excel
        </button>
      </section>

      {/* Observations */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Observations générales
        </label>

        <textarea
          value={observations}
          onChange={(event) => {
            setObservations(
              event.target.value
            );

            setErreur("");
          }}
          rows={4}
          placeholder="Remarques sur la liste des candidats..."
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
            candidatsActifs.length === 0 ||
            nombreRecus === 0
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
            <CheckCircle2
              size={17}
            />
          )}

          {isSubmitting
            ? "Validation..."
            : "Valider le suivi des candidatures"}
        </button>
      </div>
    </form>
  );
}