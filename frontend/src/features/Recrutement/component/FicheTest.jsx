import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileImage,
  FileText,
  FileUp,
  Save,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

const TYPES_ACCEPTES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];

const TAILLE_MAX = 10 * 1024 * 1024;

const PRESENCES_MOCK = [
  {
    candidatId: 101,
    presence: "PRESENT",
    candidat: {
      id: 101,
      prenom: "Aina",
      nom: "Rakoto",
      email: "aina.rakoto@example.com",
      telephone: "034 12 345 67",
    },
  },
  {
    candidatId: 102,
    presence: "PRESENT",
    candidat: {
      id: 102,
      prenom: "Miora",
      nom: "Rasoa",
      email: "miora.rasoa@example.com",
      telephone: "032 45 678 90",
    },
  },
  {
    candidatId: 103,
    presence: "ABSENT",
    candidat: {
      id: 103,
      prenom: "Toky",
      nom: "Andria",
      email: "toky.andria@example.com",
      telephone: "033 11 223 34",
    },
  },
  {
    candidatId: 104,
    presence: "PRESENT",
    candidat: {
      id: 104,
      prenom: "Fanja",
      nom: "Rabe",
      email: "fanja.rabe@example.com",
      telephone: "038 56 789 01",
    },
  },
];

function formatTaille(bytes) {
  if (!bytes) return "0 Ko";

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} Ko`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(date) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function DocumentIcon({ type }) {
  if (type === "application/pdf") {
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

export default function EtapeFichesTest({
  recrutement,
  test,
  onComplete,
}) {
  /*
   * Seuls les candidats présents à l'étape 5
   * doivent recevoir une fiche de test.
   */
  const candidatsPresents = useMemo(() => {
    /*
     * Nouveau format : test.presences
     * Ancien format  : test.resultats
     * Maquette       : PRESENCES_MOCK
     */
    const presencesEnregistrees =
      test?.presences?.length > 0
        ? test.presences
        : test?.resultats?.length > 0
          ? test.resultats
          : PRESENCES_MOCK;

    return presencesEnregistrees
      .filter(
        (resultat) =>
          resultat.presence === "PRESENT"
      )
      .map((resultat) => {
        const candidat = resultat.candidat ||
          recrutement.candidats?.find(
            (item) =>
              item.id === resultat.candidatId
          );

        if (!candidat) return null;

        return {
          ...candidat,
          observationTest:
            resultat.observation || "",
        };
      })
      .filter(Boolean);
  }, [test, recrutement.candidats]);

  /*
   * Structure :
   *
   * {
   *   candidatId: {
   *     fichier,
   *     nom,
   *     taille,
   *     type,
   *     dateReception,
   *     observation
   *   }
   * }
   */
  const [fiches, setFiches] = useState({});

  const [fichesVerifiees, setFichesVerifiees] =
    useState(false);

  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const nombreFiches = Object.keys(fiches).length;

  const nombreFichesManquantes = Math.max(
    candidatsPresents.length - nombreFiches,
    0
  );

  const toutesLesFichesPresentes =
    candidatsPresents.length > 0 &&
    candidatsPresents.every(
      (candidat) => fiches[candidat.id]
    );

  const ajouterFiche = (
    candidatId,
    fichier
  ) => {
    if (!fichier) return;

    if (!TYPES_ACCEPTES.includes(fichier.type)) {
      setErreur(
        "La fiche doit être au format PDF, JPG ou PNG."
      );
      return;
    }

    if (fichier.size > TAILLE_MAX) {
      setErreur(
        "La taille maximale autorisée est de 10 Mo par fichier."
      );
      return;
    }

    setFiches((previous) => ({
      ...previous,

      [candidatId]: {
        fichier,
        nom: fichier.name,
        taille: fichier.size,
        type: fichier.type,

        dateReception:
          previous[candidatId]?.dateReception ||
          new Date().toISOString().split("T")[0],

        observation:
          previous[candidatId]?.observation || "",
      },
    }));

    setFichesVerifiees(false);
    setErreur("");
    setMessage("");
  };

  const modifierFiche = (
    candidatId,
    champ,
    valeur
  ) => {
    setFiches((previous) => ({
      ...previous,

      [candidatId]: {
        ...previous[candidatId],
        [champ]: valeur,
      },
    }));

    setErreur("");
    setMessage("");
  };

  const supprimerFiche = (candidatId) => {
    setFiches((previous) => {
      const nouvellesFiches = { ...previous };

      delete nouvellesFiches[candidatId];

      return nouvellesFiches;
    });

    setFichesVerifiees(false);
    setMessage("");
  };

  const enregistrerBrouillon = () => {
    const brouillon = {
      recrutementId: recrutement.id,
      fiches,
      statut: "BROUILLON",
      dateEnregistrement:
        new Date().toISOString(),
    };

    console.log(
      "Brouillon des fiches de test :",
      brouillon
    );

    setErreur("");
    setMessage(
      "Le brouillon des fiches de test a été enregistré."
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setErreur("");
    setMessage("");

    if (!test) {
      setErreur(
        "Les informations de l’étape 5 sont introuvables."
      );
      return;
    }

    if (candidatsPresents.length === 0) {
      setErreur(
        "Aucun candidat présent n’a été enregistré à l’étape 5."
      );
      return;
    }

    if (!toutesLesFichesPresentes) {
      setErreur(
        "Vous devez déposer une fiche de test pour chaque candidat présent."
      );
      return;
    }

    const dateReceptionManquante =
      candidatsPresents.some(
        (candidat) =>
          !fiches[candidat.id]?.dateReception
      );

    if (dateReceptionManquante) {
      setErreur(
        "La date de réception doit être renseignée pour chaque fiche."
      );
      return;
    }

    if (!fichesVerifiees) {
      setErreur(
        "Veuillez confirmer que toutes les fiches sont lisibles et associées aux bons candidats."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 600)
      );

      const fichesCompletes =
        candidatsPresents.map((candidat) => ({
          candidatId: candidat.id,
          candidat,

          document: {
            fichier: fiches[candidat.id].fichier,
            nom: fiches[candidat.id].nom,
            taille: fiches[candidat.id].taille,
            type: fiches[candidat.id].type,
          },

          dateReception:
            fiches[candidat.id].dateReception,

          observation:
            fiches[candidat.id].observation,
        }));

      const donneesFichesTest = {
        recrutementId: recrutement.id,
        referenceRecrutement:
          recrutement.reference,
        poste: recrutement.poste,

        nombreCandidatsPresents:
          candidatsPresents.length,

        nombreFiches: fichesCompletes.length,
        fiches: fichesCompletes,

        statut: "COMPLET",
        fichesVerifiees: true,

        dateValidation:
          new Date().toISOString(),
      };

      console.log(
        "Fiches de test enregistrées :",
        donneesFichesTest
      );

      setMessage(
        "Toutes les fiches de test ont été enregistrées sur les candidats correspondants."
      );

      onComplete?.({
        etape: 6,
        fichesTest: donneesFichesTest,
      });
    } catch (error) {
      console.error(
        "Erreur pendant l’enregistrement des fiches :",
        error
      );

      setErreur(
        "Une erreur est survenue pendant l’enregistrement."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Succès */}
      {message && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0"
          />

          {message}
        </div>
      )}

      {/* Erreur */}
      {erreur && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {/* Explication */}
      <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-900">
          Dépôt des fiches reçues par e-mail
        </p>

        <p className="mt-1 text-sm text-blue-700">
          Téléchargez les fiches depuis le compte e-mail
          personnel de la responsable recrutement, puis
          associez chaque fiche au candidat correspondant.
        </p>
      </div>

      {/* Résumé */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users size={17} />
            Candidats présents
          </div>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {candidatsPresents.length}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <UserCheck size={17} />
            Fiches déposées
          </div>

          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {nombreFiches}
          </p>
        </div>

        <div
          className={`
            rounded-xl border p-4
            ${
              nombreFichesManquantes === 0
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }
          `}
        >
          <p
            className={`
              text-sm
              ${
                nombreFichesManquantes === 0
                  ? "text-emerald-700"
                  : "text-amber-700"
              }
            `}
          >
            Fiches manquantes
          </p>

          <p
            className={`
              mt-2 text-2xl font-bold
              ${
                nombreFichesManquantes === 0
                  ? "text-emerald-900"
                  : "text-amber-900"
              }
            `}
          >
            {nombreFichesManquantes}
          </p>
        </div>
      </div>

      {/* Liste des candidats présents */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold text-slate-900">
            Fiches par candidat
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Une fiche doit être déposée pour chaque candidat
            ayant participé au test.
          </p>
        </div>

        <div className="divide-y divide-slate-200">
          {candidatsPresents.map((candidat) => {
            const fiche = fiches[candidat.id];

            return (
              <div
                key={candidat.id}
                className="p-5"
              >
                <div className="grid gap-5 xl:grid-cols-[220px_1fr]">
                  {/* Candidat */}
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {candidat.prenom} {candidat.nom}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {candidat.email ||
                        candidat.telephone ||
                        "Aucun contact"}
                    </p>

                    <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      Présent au test
                    </span>
                  </div>

                  {/* Fiche */}
                  <div>
                    {!fiche ? (
                      <label
                        className="
                          flex cursor-pointer flex-col
                          items-center justify-center
                          rounded-xl border-2 border-dashed
                          border-slate-300 bg-slate-50
                          px-5 py-6 text-center
                          transition hover:border-blue-400
                          hover:bg-blue-50
                        "
                      >
                        <FileUp
                          size={27}
                          className="text-blue-600"
                        />

                        <p className="mt-2 text-sm font-semibold text-slate-800">
                          Déposer la fiche de test
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          PDF, JPG ou PNG — 10 Mo maximum
                        </p>

                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(event) => {
                            ajouterFiche(
                              candidat.id,
                              event.target.files?.[0]
                            );

                            event.target.value = "";
                          }}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <DocumentIcon
                              type={fiche.type}
                            />

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-emerald-900">
                                {fiche.nom}
                              </p>

                              <p className="text-xs text-emerald-700">
                                {formatTaille(fiche.taille)}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              supprimerFiche(candidat.id)
                            }
                            className="
                              rounded-lg p-2 text-red-600
                              transition hover:bg-red-100
                            "
                            title="Supprimer la fiche"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-700">
                              Date de réception
                            </label>

                            <input
                              type="date"
                              value={fiche.dateReception}
                              onChange={(event) =>
                                modifierFiche(
                                  candidat.id,
                                  "dateReception",
                                  event.target.value
                                )
                              }
                              required
                              className="
                                w-full rounded-lg border
                                border-slate-300 bg-white
                                px-3 py-2 text-sm outline-none
                                focus:border-blue-500
                              "
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-700">
                              Observation
                            </label>

                            <input
                              value={fiche.observation}
                              onChange={(event) =>
                                modifierFiche(
                                  candidat.id,
                                  "observation",
                                  event.target.value
                                )
                              }
                              placeholder="Observation facultative"
                              className="
                                w-full rounded-lg border
                                border-slate-300 bg-white
                                px-3 py-2 text-sm outline-none
                                focus:border-blue-500
                              "
                            />
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-emerald-700">
                          Fiche reçue le{" "}
                          {formatDate(
                            fiche.dateReception
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {candidatsPresents.length === 0 && (
            <div className="p-10 text-center text-sm text-slate-500">
              Aucun candidat présent n’a été trouvé. Vérifiez
              les présences enregistrées à l’étape 5.
            </div>
          )}
        </div>
      </div>

      {/* Vérification finale */}
      {toutesLesFichesPresentes && (
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <input
            type="checkbox"
            checked={fichesVerifiees}
            onChange={(event) => {
              setFichesVerifiees(event.target.checked);
              setErreur("");
            }}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
          />

          <div>
            <p className="text-sm font-semibold text-amber-900">
              Je confirme que toutes les fiches sont lisibles
              et associées aux bons candidats
            </p>

            <p className="mt-1 text-xs text-amber-700">
              Vérifiez le nom du candidat et le contenu de
              chaque fichier avant de terminer cette étape.
            </p>
          </div>
        </label>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <button
          type="button"
          onClick={enregistrerBrouillon}
          disabled={nombreFiches === 0}
          className="
            inline-flex items-center justify-center gap-2
            rounded-lg border border-slate-300 bg-white
            px-4 py-2.5 text-sm font-semibold text-slate-700
            hover:bg-slate-100 disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <Save size={17} />
          Enregistrer le brouillon
        </button>

        <button
          type="submit"
          disabled={
            isSubmitting ||
            !toutesLesFichesPresentes ||
            !fichesVerifiees
          }
          className="
            inline-flex items-center justify-center gap-2
            rounded-lg bg-blue-600 px-5 py-2.5
            text-sm font-semibold text-white
            hover:bg-blue-700 disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <CheckCircle2 size={17} />

          {isSubmitting
            ? "Validation..."
            : "Valider les fiches de test"}
        </button>
      </div>
    </form>
  );
}
