import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Save,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";

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

export default function EtapeSelectionCandidats({
  recrutement,
  test,
  fichesTest,
  onComplete,
}) {
  const utiliseMocks =
    !test?.presences?.length &&
    !test?.resultats?.length;

  const candidatsATraiter = useMemo(() => {
    const presences = test?.presences?.length
      ? test.presences
      : test?.resultats?.length
        ? test.resultats
        : PRESENCES_MOCK;

    return presences
      .map((resultat) => {
        const candidat = resultat.candidat ||
          recrutement.candidats?.find(
            (item) =>
              item.id === resultat.candidatId
          );

        if (!candidat) return null;

        return {
          candidat,
          presence: resultat.presence,
          observationTest:
            resultat.observation || "",
        };
      })
      .filter(Boolean);
  }, [test, recrutement.candidats]);

  const [decisions, setDecisions] = useState(() => {
    return candidatsATraiter.reduce(
      (resultat, item) => {
        const candidatId = item.candidat.id;

        if (item.presence === "ABSENT") {
          resultat[candidatId] = {
            decision: "REJETE",
            motif: "Absent au test",
            observation: "",
          };
        } else {
          resultat[candidatId] = {
            decision: "EN_ATTENTE",
            motif: "",
            observation: "",
          };
        }

        return resultat;
      },
      {}
    );
  });

  const [confirmation, setConfirmation] =
    useState(false);

  const [observationGenerale, setObservationGenerale] =
    useState("");

  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const statistiques = useMemo(() => {
    const valeurs = Object.values(decisions);

    return {
      retenus: valeurs.filter(
        (item) => item.decision === "RETENU"
      ).length,

      rejetes: valeurs.filter(
        (item) => item.decision === "REJETE"
      ).length,

      enAttente: valeurs.filter(
        (item) => item.decision === "EN_ATTENTE"
      ).length,
    };
  }, [decisions]);

  const nombreRestant = Math.max(
    recrutement.nombreARecruter -
      statistiques.retenus,
    0
  );

  const trouverFiche = (candidatId) => {
    return fichesTest?.fiches?.find(
      (fiche) =>
        fiche.candidatId === candidatId
    );
  };

  const ouvrirFiche = (candidatId) => {
    const fiche = trouverFiche(candidatId);
    const fichier = fiche?.document?.fichier;

    if (!fichier) {
      setErreur(
        "Aucune fiche de test n’est disponible pour ce candidat."
      );
      return;
    }

    const url = URL.createObjectURL(fichier);

    window.open(url, "_blank", "noopener,noreferrer");

    /*
     * On laisse le temps au navigateur d'ouvrir
     * le fichier avant de libérer l'URL.
     */
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10000);
  };

  const modifierDecision = (
    candidatId,
    nouvelleDecision
  ) => {
    const candidat = candidatsATraiter.find(
      (item) =>
        item.candidat.id === candidatId
    );

    /*
     * Un candidat absent reste automatiquement rejeté.
     */
    if (candidat?.presence === "ABSENT") {
      return;
    }

    setDecisions((previous) => ({
      ...previous,

      [candidatId]: {
        ...previous[candidatId],
        decision: nouvelleDecision,

        motif:
          nouvelleDecision === "RETENU"
            ? ""
            : previous[candidatId]?.motif || "",
      },
    }));

    setConfirmation(false);
    setErreur("");
    setMessage("");
  };

  const modifierChamp = (
    candidatId,
    champ,
    valeur
  ) => {
    setDecisions((previous) => ({
      ...previous,

      [candidatId]: {
        ...previous[candidatId],
        [champ]: valeur,
      },
    }));

    setConfirmation(false);
    setErreur("");
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setErreur("");
    setMessage("");

    if (!test && !utiliseMocks) {
      setErreur(
        "Les données du test sont introuvables."
      );
      return;
    }

    if (!fichesTest && !utiliseMocks) {
      setErreur(
        "Les fiches de test sont introuvables. Terminez d’abord l’étape 6."
      );
      return;
    }

    if (candidatsATraiter.length === 0) {
      setErreur(
        "Aucun candidat n’est disponible pour la sélection."
      );
      return;
    }

    if (statistiques.enAttente > 0) {
      setErreur(
        "Une décision doit être prise pour chaque candidat."
      );
      return;
    }

    if (
      statistiques.retenus >
      recrutement.nombreARecruter
    ) {
      setErreur(
        `Vous ne pouvez pas retenir plus de ${recrutement.nombreARecruter} candidat(s).`
      );
      return;
    }

    const rejetSansMotif =
      candidatsATraiter.some((item) => {
        const decision =
          decisions[item.candidat.id];

        return (
          decision?.decision === "REJETE" &&
          !decision.motif?.trim()
        );
      });

    if (rejetSansMotif) {
      setErreur(
        "Le motif du rejet est obligatoire pour chaque candidat rejeté."
      );
      return;
    }

    if (!confirmation) {
      setErreur(
        "Veuillez confirmer la sélection définitive."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 600)
      );

      const candidatsAvecDecision =
        candidatsATraiter.map((item) => {
          const decision =
            decisions[item.candidat.id];

          return {
            candidatId: item.candidat.id,
            candidat: item.candidat,
            presence: item.presence,
            observationTest:
              item.observationTest,

            decision: decision.decision,
            motif:
              decision.decision === "REJETE"
                ? decision.motif.trim()
                : null,

            observation:
              decision.observation?.trim() || "",
          };
        });

      const candidatsRetenus =
        candidatsAvecDecision.filter(
          (item) =>
            item.decision === "RETENU"
        );

      const candidatsRejetes =
        candidatsAvecDecision.filter(
          (item) =>
            item.decision === "REJETE"
        );

      const donneesSelection = {
        recrutementId: recrutement.id,
        referenceRecrutement:
          recrutement.reference,
        poste: recrutement.poste,

        nombreDemande:
          recrutement.nombreARecruter,

        nombreRetenu:
          candidatsRetenus.length,

        nombreRestant:
          Math.max(
            recrutement.nombreARecruter -
              candidatsRetenus.length,
            0
          ),

        candidats: candidatsAvecDecision,
        candidatsRetenus,
        candidatsRejetes,

        observationGenerale:
          observationGenerale.trim(),

        statut: "SELECTION_VALIDEE",
        dateValidation:
          new Date().toISOString(),
      };

      console.log(
        "Sélection définitive :",
        donneesSelection
      );

      setMessage(
        "La sélection définitive des candidats a été enregistrée."
      );

      onComplete?.({
        etape: 7,
        selection: donneesSelection,
      });
    } catch (error) {
      console.error(
        "Erreur pendant la sélection :",
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

      {/* Résumé du recrutement */}
      <div className="mb-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700">
            <UserCheck size={21} />
          </div>

          <div>
            <p className="font-semibold text-slate-900">
              Sélection définitive
            </p>

            <p className="text-xs text-slate-500">
              {recrutement.reference} ·{" "}
              {recrutement.poste}
            </p>
          </div>
        </div>

        <div className="text-sm text-slate-600">
          Besoin :{" "}
          <strong>
            {recrutement.nombreARecruter}
          </strong>{" "}
          personne(s)
        </div>
      </div>

      {/* Indicateurs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users size={17} />
            Candidats
          </div>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {candidatsATraiter.length}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <UserCheck size={17} />
            Retenus
          </div>

          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {statistiques.retenus}
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <UserX size={17} />
            Rejetés
          </div>

          <p className="mt-2 text-2xl font-bold text-red-900">
            {statistiques.rejetes}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">
            Postes restant à pourvoir
          </p>

          <p className="mt-2 text-2xl font-bold text-amber-900">
            {nombreRestant}
          </p>
        </div>
      </div>

      {/* Avertissement dépassement */}
      {statistiques.retenus >
        recrutement.nombreARecruter && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Vous avez retenu {statistiques.retenus} candidat(s),
          alors que le besoin est de{" "}
          {recrutement.nombreARecruter}.
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold text-slate-900">
            Décision par candidat
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Consultez la fiche de test avant d’enregistrer la
            décision.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-slate-100">
              <tr className="text-left text-xs font-semibold uppercase text-slate-600">
                <th className="px-4 py-3">Candidat</th>
                <th className="px-4 py-3">Présence</th>
                <th className="px-4 py-3">
                  Fiche de test
                </th>
                <th className="px-4 py-3">Décision</th>
                <th className="px-4 py-3">
                  Motif du rejet
                </th>
                <th className="px-4 py-3">
                  Observation
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {candidatsATraiter.map((item) => {
                const candidat = item.candidat;
                const decision =
                  decisions[candidat.id];

                const candidatAbsent =
                  item.presence === "ABSENT";

                const fiche = trouverFiche(
                  candidat.id
                );

                return (
                  <tr
                    key={candidat.id}
                    className="align-top hover:bg-slate-50"
                  >
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {candidat.prenom} {candidat.nom}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {candidat.email ||
                          candidat.telephone}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`
                          rounded-full px-2.5 py-1
                          text-xs font-semibold
                          ${
                            candidatAbsent
                              ? "bg-red-50 text-red-700"
                              : "bg-blue-50 text-blue-700"
                          }
                        `}
                      >
                        {candidatAbsent
                          ? "Absent"
                          : "Présent"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {fiche ? (
                        <button
                          type="button"
                          onClick={() =>
                            ouvrirFiche(candidat.id)
                          }
                          className="
                            inline-flex items-center gap-2
                            rounded-lg border border-blue-200
                            bg-blue-50 px-3 py-2 text-sm
                            font-semibold text-blue-700
                            hover:bg-blue-100
                          "
                        >
                          <Eye size={16} />
                          Consulter
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">
                          {candidatAbsent
                            ? "Non requise"
                            : "Indisponible"}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <select
                        value={
                          decision?.decision ||
                          "EN_ATTENTE"
                        }
                        onChange={(event) =>
                          modifierDecision(
                            candidat.id,
                            event.target.value
                          )
                        }
                        disabled={candidatAbsent}
                        className={`
                          rounded-lg border px-3 py-2
                          text-sm outline-none
                          ${
                            candidatAbsent
                              ? "cursor-not-allowed border-red-200 bg-red-50 text-red-700"
                              : "border-slate-300 bg-white focus:border-blue-500"
                          }
                        `}
                      >
                        <option value="EN_ATTENTE">
                          Sélectionner
                        </option>

                        <option value="RETENU">
                          Retenu
                        </option>

                        <option value="REJETE">
                          Rejeté
                        </option>
                      </select>
                    </td>

                    <td className="px-4 py-4">
                      <textarea
                        value={decision?.motif || ""}
                        onChange={(event) =>
                          modifierChamp(
                            candidat.id,
                            "motif",
                            event.target.value
                          )
                        }
                        disabled={
                          decision?.decision !== "REJETE" ||
                          candidatAbsent
                        }
                        rows={2}
                        placeholder={
                          decision?.decision === "REJETE"
                            ? "Motif obligatoire..."
                            : "Non applicable"
                        }
                        className="
                          w-full min-w-[260px] resize-none
                          rounded-lg border border-slate-300
                          px-3 py-2 text-sm outline-none
                          focus:border-blue-500
                          disabled:cursor-not-allowed
                          disabled:bg-slate-100
                        "
                      />
                    </td>

                    <td className="px-4 py-4">
                      <textarea
                        value={
                          decision?.observation || ""
                        }
                        onChange={(event) =>
                          modifierChamp(
                            candidat.id,
                            "observation",
                            event.target.value
                          )
                        }
                        rows={2}
                        placeholder="Observation..."
                        className="
                          w-full min-w-[240px] resize-none
                          rounded-lg border border-slate-300
                          px-3 py-2 text-sm outline-none
                          focus:border-blue-500
                        "
                      />
                    </td>
                  </tr>
                );
              })}

              {candidatsATraiter.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    Aucun candidat n’est disponible pour la
                    sélection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observation générale */}
      <div className="mt-5">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Observation générale
        </label>

        <textarea
          value={observationGenerale}
          onChange={(event) =>
            setObservationGenerale(
              event.target.value
            )
          }
          rows={4}
          placeholder="Remarque générale sur la sélection..."
          className="
            w-full resize-none rounded-lg border
            border-slate-300 px-3.5 py-2.5
            text-sm outline-none focus:border-blue-500
            focus:ring-2 focus:ring-blue-100
          "
        />
      </div>

      {/* Confirmation */}
      {statistiques.enAttente === 0 &&
        statistiques.retenus <=
          recrutement.nombreARecruter && (
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <input
              type="checkbox"
              checked={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.checked);
                setErreur("");
              }}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
            />

            <div>
              <p className="text-sm font-semibold text-amber-900">
                Je confirme la sélection définitive
              </p>

              <p className="mt-1 text-xs text-amber-700">
                Seuls les candidats retenus passeront à
                l’étape du retour RH.
              </p>
            </div>
          </label>
        )}

      {/* Validation */}
      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            candidatsATraiter.length === 0 ||
            statistiques.enAttente > 0 ||
            statistiques.retenus >
              recrutement.nombreARecruter ||
            !confirmation
          }
          className="
            inline-flex items-center gap-2 rounded-lg
            bg-blue-600 px-5 py-2.5 text-sm
            font-semibold text-white hover:bg-blue-700
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          <Save size={17} />

          {isSubmitting
            ? "Enregistrement..."
            : "Valider la sélection"}
        </button>
      </div>
    </form>
  );
}
