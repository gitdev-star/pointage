import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  Save,
  Send,
  X,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";
import ApercuCompteRendu from "./ApercuCompteRendu";

const AVIS_OPTIONS = [
  {
    value: "",
    label: "Sélectionner un avis",
  },
  {
    value: "FAVORABLE",
    label: "Favorable",
  },
  {
    value: "FAVORABLE_RESERVE",
    label: "Favorable avec réserve",
  },
  {
    value: "DEFAVORABLE",
    label: "Défavorable",
  },
  {
    value: "A_REVOIR",
    label: "À revoir",
  },
];

const DISPONIBILITES = [
  "Immédiate",
  "Sous 15 jours",
  "Sous 1 mois",
  "Sous 2 mois",
  "Sous 3 mois",
  "Autre",
];

function dateDuJour() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function dateEntretienCandidat(
  candidat
) {
  return (
    candidat
      ?.date_entretien_realisee
      ?.slice(0, 10) ||
    dateDuJour()
  );
}

function creerFormulaireInitial(
  candidat
) {
  return {
    pretentionSalariale: "",
    devise: "MGA",
    disponibilite: "",
    precisionDisponibilite: "",
    anneesExperience: "",
    diplome: "",
    etablissement: "",
    observationGenerale: "",
    decisionFinale: "",

    avisRH: {
      decision: "",
      commentaire: "",
      nomSignataire: "",
      fonctionSignataire:
        "Responsable recrutement",
      dateSignature: dateDuJour(),
      signe: false,
    },

    avisManager: {
      decision: "",
      commentaire: "",
      nomSignataire: "",
      fonctionSignataire: "Manager",
      dateSignature: dateDuJour(),
      signe: false,
    },

    dateEntretien:
      dateEntretienCandidat(
        candidat
      ),
  };
}

function convertirCompteRendu(
  compteRendu,
  candidat
) {
  return {
    pretentionSalariale:
      compteRendu
        .pretention_salariale ?? "",

    devise:
      compteRendu.devise || "MGA",

    disponibilite:
      compteRendu.disponibilite || "",

    precisionDisponibilite:
      compteRendu
        .precision_disponibilite || "",

    anneesExperience:
      compteRendu
        .annees_experience ?? "",

    diplome:
      compteRendu.diplome || "",

    etablissement:
      compteRendu.etablissement || "",

    observationGenerale:
      compteRendu
        .observation_generale || "",

    decisionFinale:
      compteRendu
        .decision_finale || "",

    dateEntretien:
      compteRendu.date_entretien ||
      dateEntretienCandidat(
        candidat
      ),

    avisRH: {
      decision:
        compteRendu.avis_rh || "",

      commentaire:
        compteRendu
          .commentaire_rh || "",

      nomSignataire:
        compteRendu
          .nom_signataire_rh || "",

      fonctionSignataire:
        compteRendu
          .fonction_signataire_rh ||
        "Responsable recrutement",

      dateSignature:
        compteRendu
          .date_signature_rh ||
        dateDuJour(),

      signe: Boolean(
        compteRendu.signe_rh
      ),
    },

    avisManager: {
      decision:
        compteRendu
          .avis_manager || "",

      commentaire:
        compteRendu
          .commentaire_manager || "",

      nomSignataire:
        compteRendu
          .nom_signataire_manager ||
        "",

      fonctionSignataire:
        compteRendu
          .fonction_signataire_manager ||
        "Manager",

      dateSignature:
        compteRendu
          .date_signature_manager ||
        dateDuJour(),

      signe: Boolean(
        compteRendu.signe_manager
      ),
    },
  };
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  min,
  placeholder,
  disabled = false,
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
        value={value}
        onChange={onChange}
        required={required}
        min={min}
        placeholder={placeholder}
        disabled={disabled}
        className="
          w-full rounded-lg border
          border-slate-300 bg-white
          px-3.5 py-2.5 text-sm
          text-slate-800 outline-none
          focus:border-blue-500
          focus:ring-2 focus:ring-blue-100
          disabled:cursor-not-allowed
          disabled:bg-slate-100
          disabled:text-slate-500
        "
      />
    </div>
  );
}

function AvisSection({
  titre,
  couleur,
  avis,
  actif,
  onActifChange,
  onChange,
  lectureSeule,
}) {
  return (
    <section
      className={`
        overflow-hidden rounded-xl border
        ${couleur}
      `}
    >
      <div className="flex items-center justify-between border-b border-inherit px-5 py-4">
        <h3 className="font-semibold text-slate-900">
          {titre}
        </h3>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={actif}
            disabled={lectureSeule}
            onChange={(event) =>
              onActifChange(
                event.target.checked
              )
            }
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />

          Participer
        </label>
      </div>

      {actif && (
        <div className="grid gap-5 bg-white p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Avis
              <span className="ml-1 text-red-500">
                *
              </span>
            </label>

            <select
              value={avis.decision}
              disabled={lectureSeule}
              onChange={(event) =>
                onChange(
                  "decision",
                  event.target.value
                )
              }
              className="
                w-full rounded-lg border
                border-slate-300 bg-white
                px-3.5 py-2.5 text-sm
                outline-none
                focus:border-blue-500
                disabled:bg-slate-100
              "
            >
              {AVIS_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Compte rendu écrit
              <span className="ml-1 text-red-500">
                *
              </span>
            </label>

            <textarea
              value={avis.commentaire}
              disabled={lectureSeule}
              onChange={(event) =>
                onChange(
                  "commentaire",
                  event.target.value
                )
              }
              rows={5}
              placeholder="Observations, points forts, points d’attention et recommandation..."
              className="
                w-full resize-y rounded-lg
                border border-slate-300
                px-3.5 py-2.5 text-sm
                outline-none
                focus:border-blue-500
                disabled:bg-slate-100
              "
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-4 text-sm font-semibold text-slate-800">
              Signature
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Nom du signataire"
                value={avis.nomSignataire}
                disabled={lectureSeule}
                onChange={(event) =>
                  onChange(
                    "nomSignataire",
                    event.target.value
                  )
                }
                required
              />

              <Field
                label="Fonction"
                value={
                  avis.fonctionSignataire
                }
                disabled={lectureSeule}
                onChange={(event) =>
                  onChange(
                    "fonctionSignataire",
                    event.target.value
                  )
                }
                required
              />

              <Field
                label="Date de signature"
                type="date"
                value={avis.dateSignature}
                disabled={lectureSeule}
                onChange={(event) =>
                  onChange(
                    "dateSignature",
                    event.target.value
                  )
                }
                required
              />
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <input
                type="checkbox"
                checked={avis.signe}
                disabled={lectureSeule}
                onChange={(event) =>
                  onChange(
                    "signe",
                    event.target.checked
                  )
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
              />

              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Je confirme et signe cet avis
                </p>

                <p className="mt-1 text-xs text-amber-700">
                  Le nom, la fonction et la
                  date seront enregistrés.
                </p>
              </div>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}

export default function CompteRenduEntretienCadre({
  candidat,
  compteRenduExistant = null,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(
    () =>
      creerFormulaireInitial(
        candidat
      )
  );

  const [redacteurs, setRedacteurs] =
    useState({
      rh: true,
      manager: true,
    });

  const [compteRendu, setCompteRendu] =
    useState(null);

  const [chargement, setChargement] =
    useState(true);

  const [actionEnCours, setActionEnCours] =
    useState("");

  const [showPreview, setShowPreview] =
    useState(false);

  const [erreur, setErreur] =
    useState("");

  const [message, setMessage] =
    useState("");

  const lectureSeule =
    compteRendu?.statut === "ENVOYE";

  useEffect(() => {
    let actif = true;

    async function chargerCompteRendu() {
      setChargement(true);
      setErreur("");

      try {
        const resultat =
          await recrutementApi
            .obtenirCompteRenduCandidat(
              candidat.id
            );

        if (!actif) return;

        if (resultat) {
          setCompteRendu(resultat);

          setForm(
            convertirCompteRendu(
              resultat,
              candidat
            )
          );

          setRedacteurs({
            rh: Boolean(
              resultat.redacteur_rh
            ),
            manager: Boolean(
              resultat
                .redacteur_manager
            ),
          });
        }
      } catch (error) {
        if (!actif) return;

        setErreur(
          recrutementApi.extraireErreur(
            error
          )
        );
      } finally {
        if (actif) {
          setChargement(false);
        }
      }
    }

    chargerCompteRendu();

    return () => {
      actif = false;
    };
  }, [candidat]);

  const modifierChamp = (
    champ,
    valeur
  ) => {
    setForm((precedent) => ({
      ...precedent,
      [champ]: valeur,
    }));

    setErreur("");
    setMessage("");
  };

  const modifierAvis = (
    typeAvis,
    champ,
    valeur
  ) => {
    setForm((precedent) => ({
      ...precedent,
      [typeAvis]: {
        ...precedent[typeAvis],
        [champ]: valeur,
      },
    }));

    setErreur("");
    setMessage("");
  };

  const construirePayload = () => ({
    candidat: candidat.id,

    date_entretien:
      form.dateEntretien,

    pretention_salariale:
      form.pretentionSalariale === ""
        ? null
        : Number(
            form.pretentionSalariale
          ),

    devise: form.devise,

    disponibilite:
      form.disponibilite,

    precision_disponibilite:
      form.precisionDisponibilite,

    annees_experience:
      form.anneesExperience === ""
        ? null
        : Number(
            form.anneesExperience
          ),

    diplome: form.diplome,

    etablissement:
      form.etablissement,

    redacteur_rh:
      redacteurs.rh,

    redacteur_manager:
      redacteurs.manager,

    avis_rh:
      redacteurs.rh
        ? form.avisRH.decision
        : "",

    commentaire_rh:
      redacteurs.rh
        ? form.avisRH.commentaire
        : "",

    nom_signataire_rh:
      redacteurs.rh
        ? form.avisRH.nomSignataire
        : "",

    fonction_signataire_rh:
      redacteurs.rh
        ? form.avisRH
            .fonctionSignataire
        : "",

    date_signature_rh:
      redacteurs.rh
        ? form.avisRH.dateSignature
        : null,

    signe_rh:
      redacteurs.rh
        ? form.avisRH.signe
        : false,

    avis_manager:
      redacteurs.manager
        ? form.avisManager.decision
        : "",

    commentaire_manager:
      redacteurs.manager
        ? form.avisManager.commentaire
        : "",

    nom_signataire_manager:
      redacteurs.manager
        ? form.avisManager
            .nomSignataire
        : "",

    fonction_signataire_manager:
      redacteurs.manager
        ? form.avisManager
            .fonctionSignataire
        : "",

    date_signature_manager:
      redacteurs.manager
        ? form.avisManager
            .dateSignature
        : null,

    signe_manager:
      redacteurs.manager
        ? form.avisManager.signe
        : false,

    observation_generale:
      form.observationGenerale,

    decision_finale:
      form.decisionFinale,
  });

  const enregistrerBrouillon =
    async () => {
      if (
        !redacteurs.rh &&
        !redacteurs.manager
      ) {
        setErreur(
          "Sélectionnez au moins un rédacteur."
        );
        return null;
      }

      setActionEnCours("brouillon");
      setErreur("");
      setMessage("");

      try {
        const payload =
          construirePayload();

        let resultat;

        if (compteRendu?.id) {
          resultat =
            await recrutementApi
              .modifierCompteRenduCadre(
                compteRendu.id,
                payload
              );
        } else {
          resultat =
            await recrutementApi
              .creerCompteRenduCadre(
                payload
              );
        }

        setCompteRendu(resultat);

        setMessage(
          "Le brouillon a été enregistré."
        );

        onSaved?.(resultat);

        return resultat;
      } catch (error) {
        setErreur(
          recrutementApi.extraireErreur(
            error
          )
        );

        return null;
      } finally {
        setActionEnCours("");
      }
    };

  const verifierAvis = (
    avis,
    libelle
  ) => {
    if (
      !avis.decision ||
      !avis.commentaire.trim() ||
      !avis.nomSignataire.trim() ||
      !avis.fonctionSignataire.trim() ||
      !avis.dateSignature ||
      !avis.signe
    ) {
      setErreur(
        `${libelle} doit être complété et signé.`
      );

      return false;
    }

    return true;
  };

  const verifierFormulaire = () => {
    if (
      !redacteurs.rh &&
      !redacteurs.manager
    ) {
      setErreur(
        "Sélectionnez au moins un rédacteur."
      );
      return false;
    }

    if (
      form.pretentionSalariale === "" ||
      Number(
        form.pretentionSalariale
      ) < 0
    ) {
      setErreur(
        "La prétention salariale est obligatoire."
      );
      return false;
    }

    if (!form.disponibilite) {
      setErreur(
        "La disponibilité est obligatoire."
      );
      return false;
    }

    if (
      form.disponibilite ===
        "Autre" &&
      !form.precisionDisponibilite.trim()
    ) {
      setErreur(
        "Précisez la disponibilité."
      );
      return false;
    }

    if (
      form.anneesExperience === ""
    ) {
      setErreur(
        "Les années d’expérience sont obligatoires."
      );
      return false;
    }

    if (!form.diplome.trim()) {
      setErreur(
        "Le diplôme est obligatoire."
      );
      return false;
    }

    if (!form.decisionFinale) {
      setErreur(
        "Sélectionnez la décision finale."
      );
      return false;
    }

    if (
      redacteurs.rh &&
      !verifierAvis(
        form.avisRH,
        "L’avis RH"
      )
    ) {
      return false;
    }

    if (
      redacteurs.manager &&
      !verifierAvis(
        form.avisManager,
        "L’avis Manager"
      )
    ) {
      return false;
    }

    return true;
  };

  const validerEtEnvoyer =
    async () => {
      console.log(
        "[Compte rendu] Clic sur Valider et envoyer",
        {
          candidatId: candidat?.id,
          compteRenduId: compteRendu?.id || null,
        }
      );

      if (!candidat?.id) {
        setErreur(
          "Le candidat associé au compte rendu est introuvable."
        );
        return;
      }

      if (!verifierFormulaire()) {
        console.warn(
          "[Compte rendu] Le formulaire est incomplet."
        );
        return;
      }

      setActionEnCours("envoi");
      setErreur("");
      setMessage("");

      try {
        const payload =
          construirePayload();

        console.log(
          "[Compte rendu] Enregistrement du compte rendu :",
          payload
        );

        let brouillon;

        if (compteRendu?.id) {
          brouillon =
            await recrutementApi
              .modifierCompteRenduCadre(
                compteRendu.id,
                payload
              );
        } else {
          brouillon =
            await recrutementApi
              .creerCompteRenduCadre(
                payload
              );
        }

        console.log(
          "[Compte rendu] Compte rendu enregistré :",
          brouillon
        );

        const resultat =
          await recrutementApi
            .validerEtEnvoyerCompteRenduCadre(
              brouillon.id,
              form.decisionFinale
            );

        console.log(
          "[Compte rendu] Réponse de l’envoi au DRH :",
          resultat
        );

        const compteRenduFinal =
          resultat.compte_rendu ||
          brouillon;

        setCompteRendu(
          compteRenduFinal
        );

        setMessage(
          resultat.message ||
            "Le compte rendu a été envoyé au DRH."
        );

        onSaved?.(
          compteRenduFinal
        );
      } catch (error) {
        console.error(
          "[Compte rendu] Erreur :",
          error.response?.data || error
        );

        setErreur(
          recrutementApi.extraireErreur(
            error
          )
        );
      } finally {
        setActionEnCours("");
      }
    };

  const telechargerPdf =
    async () => {
      if (!compteRendu?.id) {
        setErreur(
          "Enregistrez d’abord le compte rendu."
        );
        return;
      }

      setActionEnCours("pdf");
      setErreur("");

      try {
        await recrutementApi
          .telechargerCompteRenduCadre(
            compteRendu.id,
            `${compteRendu.reference}.pdf`
          );
      } catch (error) {
        setErreur(
          recrutementApi.extraireErreur(
            error
          )
        );
      } finally {
        setActionEnCours("");
      }
    };

const formulaireApercu = useMemo(
  () => ({
    dateEntretien: form.dateEntretien,
    poste:
      compteRendu?.poste ||
      candidat?.poste ||
      candidat?.poste_nom ||
      "",
    candidat: {
      nom: candidat?.nom || "",
      prenom: candidat?.prenom || "",
      telephone: candidat?.telephone || "",
      email: candidat?.email || "",
      posteActuel: "",
    },
    ...form,
  }),
  [form, candidat, compteRendu]
);
  if (chargement) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <Loader2
          size={30}
          className="animate-spin text-blue-600"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 p-4">
      <div className="mx-auto max-w-6xl rounded-2xl bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-100 p-3 text-violet-700">
              <FileText size={22} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Compte rendu d’entretien
              </h1>

              <p className="text-sm text-slate-500">
                {candidat.prenom}{" "}
                {candidat.nom}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={22} />
          </button>
        </header>

        <div className="space-y-5 p-5">
          {message && (
            <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <CheckCircle2 size={18} />
              {message}
            </div>
          )}

          {erreur && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {erreur}
            </div>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">
              Informations automatiques
            </h2>

            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <Field
                label="Candidat"
                value={`${candidat.prenom || ""} ${
                  candidat.nom || ""
                }`.trim()}
                disabled
              />

              <Field
                label="Date de l’entretien"
                type="date"
                value={form.dateEntretien}
                disabled
              />

              <Field
                label="Poste"
                value={
                  compteRendu?.poste ||
                  candidat.poste_nom ||
                  "Récupéré depuis la demande"
                }
                disabled
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-5 font-semibold text-slate-900">
              Profil professionnel
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Prétention salariale *
                </label>

                <div className="grid grid-cols-[1fr_110px]">
                  <input
                    type="number"
                    min="0"
                    value={
                      form.pretentionSalariale
                    }
                    disabled={lectureSeule}
                    onChange={(event) =>
                      modifierChamp(
                        "pretentionSalariale",
                        event.target.value
                      )
                    }
                    className="rounded-l-lg border border-r-0 border-slate-300 px-3.5 py-2.5 text-sm"
                  />

                  <select
                    value={form.devise}
                    disabled={lectureSeule}
                    onChange={(event) =>
                      modifierChamp(
                        "devise",
                        event.target.value
                      )
                    }
                    className="rounded-r-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="MGA">
                      MGA
                    </option>
                    <option value="EUR">
                      EUR
                    </option>
                    <option value="USD">
                      USD
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Disponibilité / préavis *
                </label>

                <select
                  value={form.disponibilite}
                  disabled={lectureSeule}
                  onChange={(event) =>
                    modifierChamp(
                      "disponibilite",
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                >
                  <option value="">
                    Sélectionner
                  </option>

                  {DISPONIBILITES.map(
                    (disponibilite) => (
                      <option
                        key={disponibilite}
                        value={disponibilite}
                      >
                        {disponibilite}
                      </option>
                    )
                  )}
                </select>
              </div>

              {form.disponibilite ===
                "Autre" && (
                <Field
                  label="Précision"
                  value={
                    form.precisionDisponibilite
                  }
                  disabled={lectureSeule}
                  onChange={(event) =>
                    modifierChamp(
                      "precisionDisponibilite",
                      event.target.value
                    )
                  }
                />
              )}

              <Field
                label="Années d’expérience"
                type="number"
                min="0"
                value={
                  form.anneesExperience
                }
                disabled={lectureSeule}
                onChange={(event) =>
                  modifierChamp(
                    "anneesExperience",
                    event.target.value
                  )
                }
                required
              />

              <Field
                label="Diplôme"
                value={form.diplome}
                disabled={lectureSeule}
                onChange={(event) =>
                  modifierChamp(
                    "diplome",
                    event.target.value
                  )
                }
                required
              />

              <Field
                label="Établissement"
                value={form.etablissement}
                disabled={lectureSeule}
                onChange={(event) =>
                  modifierChamp(
                    "etablissement",
                    event.target.value
                  )
                }
              />
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <AvisSection
              titre="Avis RH"
              couleur="border-blue-200"
              avis={form.avisRH}
              actif={redacteurs.rh}
              lectureSeule={lectureSeule}
              onActifChange={(valeur) =>
                setRedacteurs(
                  (precedent) => ({
                    ...precedent,
                    rh: valeur,
                  })
                )
              }
              onChange={(champ, valeur) =>
                modifierAvis(
                  "avisRH",
                  champ,
                  valeur
                )
              }
            />

            <AvisSection
              titre="Avis Manager"
              couleur="border-violet-200"
              avis={form.avisManager}
              actif={redacteurs.manager}
              lectureSeule={lectureSeule}
              onActifChange={(valeur) =>
                setRedacteurs(
                  (precedent) => ({
                    ...precedent,
                    manager: valeur,
                  })
                )
              }
              onChange={(champ, valeur) =>
                modifierAvis(
                  "avisManager",
                  champ,
                  valeur
                )
              }
            />
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Commentaires / observations
            </label>

            <textarea
              value={form.observationGenerale}
              disabled={lectureSeule}
              onChange={(event) =>
                modifierChamp(
                  "observationGenerale",
                  event.target.value
                )
              }
              rows={4}
              className="w-full resize-y rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm disabled:bg-slate-100"
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">
              Décision finale
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <input
                  type="radio"
                  value="RETENU"
                  checked={
                    form.decisionFinale ===
                    "RETENU"
                  }
                  disabled={lectureSeule}
                  onChange={(event) =>
                    modifierChamp(
                      "decisionFinale",
                      event.target.value
                    )
                  }
                />

                <span className="font-semibold text-emerald-800">
                  Favorable / Retenu
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <input
                  type="radio"
                  value="NON_RETENU"
                  checked={
                    form.decisionFinale ===
                    "NON_RETENU"
                  }
                  disabled={lectureSeule}
                  onChange={(event) =>
                    modifierChamp(
                      "decisionFinale",
                      event.target.value
                    )
                  }
                />

                <span className="font-semibold text-red-800">
                  Non favorable / Non retenu
                </span>
              </label>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setShowPreview(true)
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              <Eye size={17} />
              Aperçu
            </button>

            {compteRendu?.id && (
              <button
                type="button"
                onClick={telechargerPdf}
                disabled={
                  actionEnCours === "pdf"
                }
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700"
              >
                <Download size={17} />
                Télécharger PDF
              </button>
            )}

            {!lectureSeule && (
              <>
                <button
                  type="button"
                  onClick={
                    enregistrerBrouillon
                  }
                  disabled={
                    Boolean(actionEnCours)
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  <Save size={17} />
                  Enregistrer le brouillon
                </button>

                <button
                  type="button"
                  onClick={
                    validerEtEnvoyer
                  }
                  disabled={
                    Boolean(actionEnCours)
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {actionEnCours ===
                  "envoi" ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Send size={17} />
                  )}

                  Valider et envoyer au DRH
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showPreview && (
        <ApercuCompteRendu
          form={formulaireApercu}
          redacteurs={redacteurs}
          onClose={() =>
            setShowPreview(false)
          }
        />
      )}
    </div>
  );
}