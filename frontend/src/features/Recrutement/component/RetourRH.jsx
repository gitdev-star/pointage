import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Printer,
  Save,
  Users,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";

const dateDuJour = () =>
  new Date().toISOString().split("T")[0];

function obtenirNomCandidat(candidat) {
  if (candidat.nom_complet) {
    return candidat.nom_complet;
  }

  const nomComplet = [
    candidat.nom,
    candidat.prenom,
  ]
    .filter(Boolean)
    .join(" ");

  return nomComplet || `Candidat ${candidat.id}`;
}

export default function RetourRH({
  recrutement,
  onComplete,
}) {
  const processusId =
    recrutement?.id ||
    recrutement?.processus_id;

  const [candidats, setCandidats] =
    useState([]);

  const [retours, setRetours] =
    useState({});

  const [responsableRH, setResponsableRH] =
    useState("");

  const [confirmation, setConfirmation] =
    useState(false);

  const [chargement, setChargement] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [erreur, setErreur] =
    useState("");

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    let composantActif = true;

    async function chargerDonnees() {
      if (!processusId) {
        setErreur(
          "L’identifiant du processus est introuvable."
        );

        setChargement(false);
        return;
      }

      setChargement(true);
      setErreur("");

      try {
        const [
          resultatCandidats,
          resultatRetours,
          profil,
        ] = await Promise.all([
          recrutementApi.obtenirCandidatsRecus(
            processusId
          ),

          recrutementApi.obtenirRetoursRH({
            candidat__processus:
              processusId,
          }),

          recrutementApi
            .obtenirMonProfil()
            .catch(() => null),
        ]);

        if (!composantActif) {
          return;
        }

        const candidatsRecus =
          resultatCandidats.candidats;

        const retoursExistants =
          resultatRetours.retours;

        const retoursParCandidat = {};

        candidatsRecus.forEach(
          (candidat) => {
            const retourExistant =
              retoursExistants.find(
                (retour) =>
                  Number(retour.candidat) ===
                  Number(candidat.id)
              );

            retoursParCandidat[candidat.id] = {
              id:
                retourExistant?.id ||
                null,

              dateRemiseListe:
                retourExistant
                  ?.date_remise_liste ||
                dateDuJour(),

              listeImprimee:
                Boolean(
                  retourExistant
                    ?.liste_imprimee
                ),

              listeRemise:
                Boolean(
                  retourExistant
                    ?.liste_remise
                ),

              remarque:
                retourExistant
                  ?.remarque || "",
            };
          }
        );

        setCandidats(candidatsRecus);
        setRetours(retoursParCandidat);

        const nomResponsable =
          profil?.nom_complet ||
          profil?.full_name ||
          [
            profil?.first_name,
            profil?.last_name,
          ]
            .filter(Boolean)
            .join(" ") ||
          profil?.username ||
          "";

        const responsableExistant =
          retoursExistants.find(
            (retour) =>
              retour.responsable_rh
          )?.responsable_rh;

        setResponsableRH(
          responsableExistant ||
            nomResponsable
        );
      } catch (error) {
        console.error(error);

        if (composantActif) {
          setErreur(
            recrutementApi.extraireErreur(
              error
            )
          );
        }
      } finally {
        if (composantActif) {
          setChargement(false);
        }
      }
    }

    chargerDonnees();

    return () => {
      composantActif = false;
    };
  }, [processusId]);

  const modifierRetour = (
    candidatId,
    champ,
    valeur
  ) => {
    setRetours((previous) => ({
      ...previous,

      [candidatId]: {
        ...previous[candidatId],
        [champ]: valeur,
      },
    }));

    setErreur("");
    setMessage("");
  };

  const nombreListesRemises = useMemo(
    () =>
      candidats.filter(
        (candidat) =>
          retours[candidat.id]
            ?.listeRemise
      ).length,
    [candidats, retours]
  );

  const tousLesRetoursValides =
    candidats.length > 0 &&
    candidats.every((candidat) => {
      const retour =
        retours[candidat.id];

      return Boolean(
        retour?.dateRemiseListe &&
          retour?.listeRemise
      );
    });

  const imprimerListe = (candidat) => {
    const nomCandidat =
      obtenirNomCandidat(candidat);

    const contenu = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8" />

          <title>
            Liste des documents -
            ${nomCandidat}
          </title>

          <style>
            body {
              font-family: Arial, sans-serif;
              color: #0f172a;
              padding: 35px;
            }

            h1 {
              font-size: 22px;
              margin-bottom: 8px;
            }

            .subtitle {
              color: #64748b;
              margin-bottom: 30px;
            }

            .info {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 25px;
            }

            .documents {
              margin-top: 20px;
            }

            .document {
              display: flex;
              gap: 10px;
              padding: 10px 0;
              border-bottom: 1px solid #e2e8f0;
            }

            .checkbox {
              width: 16px;
              height: 16px;
              border: 1px solid #334155;
              display: inline-block;
            }

            .signature {
              margin-top: 55px;
              display: flex;
              justify-content: space-between;
            }

            .signature div {
              width: 42%;
              border-top: 1px solid #334155;
              padding-top: 8px;
              text-align: center;
            }
          </style>
        </head>

        <body>
          <h1>
            Liste des documents à fournir
          </h1>

          <p class="subtitle">
            Processus de recrutement
          </p>

          <div class="info">
            <p>
              <strong>Candidat :</strong>
              ${nomCandidat}
            </p>

            <p>
              <strong>Poste :</strong>
              ${
                recrutement?.poste_nom ||
                recrutement?.poste ||
                "—"
              }
            </p>

            <p>
              <strong>Référence :</strong>
              ${
                recrutement?.reference ||
                "—"
              }
            </p>
          </div>

          <div class="documents">
            <div class="document">
              <span class="checkbox"></span>
              Copie de la carte d’identité
            </div>

            <div class="document">
              <span class="checkbox"></span>
              Curriculum vitae
            </div>

            <div class="document">
              <span class="checkbox"></span>
              Copies des diplômes
            </div>

            <div class="document">
              <span class="checkbox"></span>
              Certificats de travail
            </div>

            <div class="document">
              <span class="checkbox"></span>
              Photo d’identité
            </div>

            <div class="document">
              <span class="checkbox"></span>
              Certificat de résidence
            </div>

            <div class="document">
              <span class="checkbox"></span>
              Casier judiciaire
            </div>

            <div class="document">
              <span class="checkbox"></span>
              Certificat médical
            </div>
          </div>

          <div class="signature">
            <div>Signature RH</div>
            <div>Signature du candidat</div>
          </div>
        </body>
      </html>
    `;

    const fenetre =
      window.open("", "_blank");

    if (!fenetre) {
      setErreur(
        "Le navigateur a bloqué la fenêtre d’impression."
      );

      return;
    }

    fenetre.document.write(contenu);
    fenetre.document.close();
    fenetre.focus();
    fenetre.print();

    modifierRetour(
      candidat.id,
      "listeImprimee",
      true
    );
  };

  const verifierFormulaire = () => {
    if (!responsableRH.trim()) {
      setErreur(
        "Le nom du responsable RH est obligatoire."
      );

      return false;
    }

    if (candidats.length === 0) {
      setErreur(
        "Aucun candidat reçu n’est disponible pour le Retour RH."
      );

      return false;
    }

    const candidatIncomplet =
      candidats.find((candidat) => {
        const retour =
          retours[candidat.id];

        return (
          !retour?.dateRemiseListe ||
          !retour?.listeRemise
        );
      });

    if (candidatIncomplet) {
      setErreur(
        `La remise de la liste doit être confirmée pour ${obtenirNomCandidat(
          candidatIncomplet
        )}.`
      );

      return false;
    }

    if (!confirmation) {
      setErreur(
        "Veuillez confirmer la validation du Retour RH."
      );

      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setErreur("");
    setMessage("");

    if (!verifierFormulaire()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const retoursEnregistres =
        await Promise.all(
          candidats.map(
            async (candidat) => {
              const retour =
                retours[candidat.id];

              return recrutementApi
                .enregistrerRetourRH({
                  retourId:
                    retour.id,

                  candidatId:
                    candidat.id,

                  responsableRH:
                    responsableRH.trim(),

                  dateRemiseListe:
                    retour.dateRemiseListe,

                  listeImprimee:
                    retour.listeImprimee,

                  listeRemise:
                    retour.listeRemise,

                  remarque:
                    retour.remarque,
                });
            }
          )
        );

      /*
       * À ce stade, tous les candidats
       * reçus ont bien un RetourRHCandidat
       * avec liste_remise = true.
       */
      const processusMisAJour =
        await recrutementApi
          .terminerEtapeProcessus(
            processusId,
            5
          );

      setMessage(
        "Le Retour RH a été validé. L’étape 5 est terminée."
      );

      if (onComplete) {
        onComplete({
          etape: 5,

          retourRH: {
            responsableRH:
              responsableRH.trim(),

            candidats:
              retoursEnregistres,

            dateValidation:
              new Date().toISOString(),
          },

          processus:
            processusMisAJour
              ?.processus ||
            processusMisAJour,
        });
      }
    } catch (error) {
      console.error(error);

      setErreur(
        recrutementApi.extraireErreur(
          error
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (chargement) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2
            size={20}
            className="animate-spin text-blue-600"
          />

          Chargement des candidats reçus...
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <ClipboardCheck
                size={21}
                className="text-blue-600"
              />

              Retour RH
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Remettez la liste des documents
              aux candidats ayant réussi le
              test.
            </p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-xs text-blue-600">
              Progression
            </p>

            <p className="mt-1 text-sm font-semibold text-blue-900">
              {nombreListesRemises} sur{" "}
              {candidats.length} liste(s)
              remise(s)
            </p>
          </div>
        </div>
      </section>

      {erreur && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          {erreur}
        </div>
      )}

      {message && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0"
          />

          {message}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Responsable RH
          <span className="ml-1 text-red-500">
            *
          </span>
        </label>

        <input
          value={responsableRH}
          onChange={(event) => {
            setResponsableRH(
              event.target.value
            );

            setErreur("");
          }}
          required
          placeholder="Nom du responsable RH"
          className="
            w-full rounded-lg border
            border-slate-300 px-3.5
            py-2.5 text-sm outline-none
            focus:border-blue-500
            focus:ring-2 focus:ring-blue-100
          "
        />
      </section>

      <div className="space-y-4">
        {candidats.map((candidat) => {
          const retour =
            retours[candidat.id] || {};

          return (
            <article
              key={candidat.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-col justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5 md:flex-row md:items-center">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700">
                    <Users size={20} />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {obtenirNomCandidat(
                        candidat
                      )}
                    </h3>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {candidat.email ||
                        candidat.telephone ||
                        "Candidat reçu"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    imprimerListe(candidat)
                  }
                  className="
                    inline-flex items-center
                    justify-center gap-2
                    rounded-lg border
                    border-slate-300 bg-white
                    px-4 py-2.5 text-sm
                    font-semibold text-slate-700
                    hover:bg-slate-100
                  "
                >
                  <Printer size={17} />

                  Imprimer la liste
                </button>
              </div>

              <div className="grid gap-5 p-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Date de remise
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    type="date"
                    value={
                      retour.dateRemiseListe ||
                      ""
                    }
                    onChange={(event) =>
                      modifierRetour(
                        candidat.id,
                        "dateRemiseListe",
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
                    "
                  />
                </div>

                <div className="flex items-end">
                  <label
                    className={`
                      flex w-full cursor-pointer
                      items-start gap-3 rounded-lg
                      border p-4
                      ${
                        retour.listeRemise
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(
                        retour.listeRemise
                      )}
                      onChange={(event) =>
                        modifierRetour(
                          candidat.id,
                          "listeRemise",
                          event.target.checked
                        )
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                    />

                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Liste remise au candidat
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Le candidat a reçu la
                        liste des documents à
                        fournir.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Remarque
                  </label>

                  <textarea
                    value={
                      retour.remarque || ""
                    }
                    onChange={(event) =>
                      modifierRetour(
                        candidat.id,
                        "remarque",
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Remarque facultative..."
                    className="
                      w-full resize-none
                      rounded-lg border
                      border-slate-300
                      px-3.5 py-2.5
                      text-sm outline-none
                      focus:border-blue-500
                    "
                  />
                </div>
              </div>
            </article>
          );
        })}

        {candidats.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-700">
            Aucun candidat reçu. Un candidat
            doit avoir une fiche de test pour
            accéder au Retour RH.
          </div>
        )}
      </div>

      {tousLesRetoursValides && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <input
            type="checkbox"
            checked={confirmation}
            onChange={(event) => {
              setConfirmation(
                event.target.checked
              );

              setErreur("");
            }}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
          />

          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Je confirme le Retour RH
            </p>

            <p className="mt-1 text-xs text-emerald-700">
              La liste des documents a été
              remise à tous les candidats
              reçus.
            </p>
          </div>
        </label>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            !tousLesRetoursValides ||
            !confirmation
          }
          className="
            inline-flex items-center gap-2
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
            ? "Validation..."
            : "Terminer le Retour RH"}
        </button>
      </div>
    </form>
  );
}