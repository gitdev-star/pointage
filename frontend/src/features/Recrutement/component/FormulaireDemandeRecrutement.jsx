import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Send,
  UserRound,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";


const MOTIFS_RECRUTEMENT = [
  {
    value: "RAJOUT",
    label: "Rajout d’effectif",
  },
  {
    value: "CREATION",
    label: "Création de poste",
  },
  {
    value: "REMPLACEMENT",
    label: "Remplacement",
  },
];

const MOTIFS_REMPLACEMENT = [
  {
    value: "FIN",
    label: "Fin de période d’essai",
  },
  {
    value: "DEMISSION",
    label: "Démission",
  },
  {
    value: "ABANDON",
    label: "Abandon de poste",
  },
  {
    value: "LICENCIEMENT",
    label: "Licenciement",
  },
  {
    value: "INAPTITUDE",
    label: "Inaptitude",
  },
  {
    value: "RETRAITE",
    label: "Départ à la retraite",
  },
  {
    value: "FIN_CDD",
    label: "Fin de CDD / non-renouvellement",
  },
  {
    value: "RUPTURE",
    label: "Rupture conventionnelle",
  },
  {
    value: "MUTATION",
    label: "Mutation / mobilité interne",
  },
  {
    value: "PROMOTION",
    label: "Promotion ou changement de poste",
  },
  {
    value: "MATERNITE",
    label: "Congé maternité",
  },
  {
    value: "DECES",
    label: "Décès",
  },
];


function dateDuJour() {
  return new Date().toISOString().split("T")[0];
}


function ajouterJoursOuvrables(
  dateString,
  nombreJours
) {
  if (!dateString) {
    return "";
  }

  const [annee, mois, jour] = dateString
    .split("-")
    .map(Number);

  const date = new Date(
    annee,
    mois - 1,
    jour
  );

  let joursAjoutes = 0;

  while (joursAjoutes < nombreJours) {
    date.setDate(date.getDate() + 1);

    const jourSemaine = date.getDay();

    if (
      jourSemaine !== 0 &&
      jourSemaine !== 6
    ) {
      joursAjoutes += 1;
    }
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(
      2,
      "0"
    ),
    String(date.getDate()).padStart(
      2,
      "0"
    ),
  ].join("-");
}


function formaterDate(dateString) {
  if (!dateString) {
    return "";
  }

  const [annee, mois, jour] = dateString
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  ).format(
    new Date(annee, mois - 1, jour)
  );
}


function creerFormulaireInitial(
  profil = null
) {
  return {
    type_recrutement: "",
    factory: profil?.factory
      ? String(profil.factory)
      : "",

    departement: profil?.department
      ? String(profil.department)
      : "",

    poste: "",

    nombre_cdi: 0,
    nombre_cdd: 0,

    date_prevue_recrutement: "",

    motif: "",
    motif_remplacement: "",

    designation_taches: "",
    profil_diplome: "",
    experience_professionnelle: "",
    competences_techniques: "",
    savoir_faire: "",
    savoir_etre: "",
  };
}


function FieldLabel({
  children,
  required = false,
}) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}

      {required && (
        <span className="ml-1 text-red-500">
          *
        </span>
      )}
    </label>
  );
}


function InputField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  min,
  disabled = false,
  placeholder,
}) {
  return (
    <div>
      <FieldLabel required={required}>
        {label}
      </FieldLabel>

      <input
        name={name}
        value={value}
        onChange={onChange}
        type={type}
        required={required}
        min={min}
        disabled={disabled}
        placeholder={placeholder}
        className={`
          w-full rounded-lg border
          border-slate-300 px-3.5
          py-2.5 text-sm text-slate-800
          outline-none transition
          focus:border-blue-500
          focus:ring-2 focus:ring-blue-100
          ${
            disabled
              ? "cursor-not-allowed bg-slate-100"
              : "bg-white"
          }
        `}
      />
    </div>
  );
}


function TextAreaField({
  label,
  name,
  value,
  onChange,
  required = false,
  placeholder,
  rows = 4,
}) {
  return (
    <div>
      <FieldLabel required={required}>
        {label}
      </FieldLabel>

      <textarea
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        rows={rows}
        className="
          w-full resize-y rounded-lg
          border border-slate-300 bg-white
          px-3.5 py-2.5 text-sm
          text-slate-800 outline-none
          transition focus:border-blue-500
          focus:ring-2 focus:ring-blue-100
        "
      />
    </div>
  );
}


function InformationDemandeur({
  label,
  value,
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">
        {label}
      </p>

      <div className="min-h-[42px] rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-700">
        {value || "Non renseigné"}
      </div>
    </div>
  );
}


export default function FormulaireDemandeRecrutement({
  onSubmitted,
}) {
  const [profil, setProfil] =
    useState(null);

  const [sites, setSites] =
    useState([]);

  const [departements, setDepartements] =
    useState([]);

  const [postes, setPostes] =
    useState([]);

  const [form, setForm] = useState(
    creerFormulaireInitial()
  );

  const [chargementInitial, setChargementInitial] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [successMessage, setSuccessMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");


  const dateDemande = dateDuJour();

  const dateMinimaleRecrutement =
    ajouterJoursOuvrables(
      dateDemande,
      5
    );


  const nombreTotal = useMemo(
    () =>
      Number(form.nombre_cdi || 0) +
      Number(form.nombre_cdd || 0),
    [
      form.nombre_cdi,
      form.nombre_cdd,
    ]
  );


  const departementsFiltres = useMemo(
    () => {
      if (!form.factory) {
        return [];
      }

      return departements.filter(
        (departement) =>
          String(departement.factory) ===
          String(form.factory)
      );
    },
    [
      departements,
      form.factory,
    ]
  );


  useEffect(() => {
    let composantActif = true;

    async function chargerDonnees() {
      setChargementInitial(true);
      setErrorMessage("");

      try {
        const [
          profilConnecte,
          listeSites,
          listeDepartements,
          listePostes,
        ] = await Promise.all([
          recrutementApi.obtenirMonProfil(),
          recrutementApi.obtenirSites(),
          recrutementApi.obtenirDepartements(),
          recrutementApi.obtenirPostes(),
        ]);

        if (!composantActif) {
          return;
        }

        setProfil(profilConnecte);

        setSites(
          listeSites.filter(
            (site) =>
              site.is_active !== false
          )
        );

        setDepartements(
          listeDepartements.filter(
            (departement) =>
              departement.is_active !== false
          )
        );
        setPostes(
          (Array.isArray(listePostes)
            ? listePostes
            : listePostes?.postes || []
          )
            .filter(
              (poste) =>
                poste.is_active !== false
            )
            .sort((a, b) =>
              (a.name || "").localeCompare(
                b.name || "",
                "fr",
                {
                  sensitivity: "base",
                }
              )
            )
        );

        setForm(
          creerFormulaireInitial(
            profilConnecte
          )
        );

        if (!profilConnecte.matricule) {
          setErrorMessage(
            "Aucune fiche employé active n’est liée à votre compte. Contactez l’administrateur."
          );
        }
      } catch (error) {
        console.error(error);

        if (composantActif) {
          setErrorMessage(
            recrutementApi.extraireErreur(
              error
            )
          );
        }
      } finally {
        if (composantActif) {
          setChargementInitial(false);
        }
      }
    }

    chargerDonnees();

    return () => {
      composantActif = false;
    };
  }, []);


  const effacerMessages = () => {
    setSuccessMessage("");
    setErrorMessage("");
  };


  const handleChange = ({
    target: {
      name,
      value,
    },
  }) => {
    setForm((ancienFormulaire) => {
      const nouveauFormulaire = {
        ...ancienFormulaire,
        [name]: value,
      };

      if (name === "factory") {
        nouveauFormulaire.departement = "";
      }

      if (
        name === "motif" &&
        value !== "REMPLACEMENT"
      ) {
        nouveauFormulaire.motif_remplacement =
          "";
      }

      return nouveauFormulaire;
    });

    effacerMessages();
  };


  const reinitialiser = () => {
    setForm(
      creerFormulaireInitial(profil)
    );

    effacerMessages();
  };


  const validerFormulaire = () => {
    if (!profil?.matricule) {
      return (
        "Votre compte n’est pas lié à une "
        + "fiche employé active."
      );
    }

     if (!form.type_recrutement) {
    return (
      "Sélectionnez le type de recrutement."
    );
  }

  if (
    !form.factory ||
    !form.departement ||
    !form.poste
  ) {
    return (
      "Le site, le département et le "
      + "poste sont obligatoires."
    );
  }

    if (
      !form.factory ||
      !form.departement ||
      !form.poste
    ) {
      return (
        "Le site, le département et le "
        + "poste sont obligatoires."
      );
    }

    if (nombreTotal < 1) {
      return (
        "Indiquez au moins une personne "
        + "en CDI ou en CDD."
      );
    }

    if (
      !form.date_prevue_recrutement ||
      form.date_prevue_recrutement <
        dateMinimaleRecrutement
    ) {
      return (
        "La date prévue doit être égale "
        + `ou postérieure au ${
          formaterDate(
            dateMinimaleRecrutement
          )
        }.`
      );
    }

    if (!form.motif) {
      return (
        "Sélectionnez le motif du recrutement."
      );
    }

    if (
      form.motif === "REMPLACEMENT" &&
      !form.motif_remplacement
    ) {
      return (
        "Sélectionnez le motif du remplacement."
      );
    }

    if (
      !form.experience_professionnelle.trim()
    ) {
      return (
        "L’expérience professionnelle "
        + "est obligatoire."
      );
    }

    if (
      !form.competences_techniques.trim()
    ) {
      return (
        "Les compétences techniques "
        + "sont obligatoires."
      );
    }

    if (!form.savoir_faire.trim()) {
      return (
        "Le savoir-faire est obligatoire."
      );
    }

    if (!form.savoir_etre.trim()) {
      return (
        "Le savoir-être est obligatoire."
      );
    }

    return "";
  };


  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    effacerMessages();

    const erreurValidation =
      validerFormulaire();

    if (erreurValidation) {
      setErrorMessage(
        erreurValidation
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        type_recrutement:form.type_recrutement,
  
        factory: Number(form.factory),

        departement: Number(
          form.departement
        ),

        poste: Number(form.poste),

        nombre_cdi: Number(
          form.nombre_cdi || 0
        ),

        nombre_cdd: Number(
          form.nombre_cdd || 0
        ),

        date_prevue_recrutement:
          form.date_prevue_recrutement,

        motif: form.motif,

        motif_remplacement:
          form.motif === "REMPLACEMENT"
            ? form.motif_remplacement
            : "",

        designation_taches:
          form.designation_taches.trim(),

        profil_diplome:
          form.profil_diplome.trim(),

        experience_professionnelle:
          form
            .experience_professionnelle
            .trim(),

        competences_techniques:
          form
            .competences_techniques
            .trim(),

        savoir_faire:
          form.savoir_faire.trim(),

        savoir_etre:
          form.savoir_etre.trim(),
      };

      const demandeCreee =
        await recrutementApi.creerDemande(
          payload
        );

      setSuccessMessage(
        `La demande ${
          demandeCreee.reference || ""
        } a été soumise avec succès.`
      );

      setForm(
        creerFormulaireInitial(profil)
      );

      if (onSubmitted) {
        onSubmitted(demandeCreee);
      }
    } catch (error) {
      console.error(error);

      setErrorMessage(
        recrutementApi.extraireErreur(
          error
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };


  if (chargementInitial) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <Loader2
            size={20}
            className="animate-spin text-blue-600"
          />

          Chargement du formulaire...
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
            <BriefcaseBusiness size={24} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Demande de recrutement
            </h1>

            <p className="text-sm text-slate-500">
              Formulaire destiné aux managers
            </p>
          </div>
        </div>


        {successMessage && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2
              size={20}
              className="mt-0.5 shrink-0"
            />

            <p className="text-sm font-medium">
              {successMessage}
            </p>
          </div>
        )}


        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}


        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          {/* Demandeur connecté */}
          <section className="border-b border-slate-200 p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-2">
              <UserRound
                size={20}
                className="text-blue-600"
              />

              <div>
                <h2 className="font-semibold text-slate-900">
                  Informations du demandeur
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Informations récupérées automatiquement depuis votre compte.
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <InformationDemandeur
                label="Matricule"
                value={profil?.matricule}
              />

              <InformationDemandeur
                label="Nom et prénom"
                value={
                  profil?.nom_complet
                }
              />

              <InformationDemandeur
                label="Poste du demandeur"
                value={profil?.poste_nom}
              />

              <InformationDemandeur
                label="Département du demandeur"
                value={
                  profil
                    ?.departement_employe_nom
                }
              />
            </div>
          </section>


          {/* Besoin */}
              <section className="border-b border-slate-200 p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-2">
                  <CalendarDays
                    size={20}
                    className="text-blue-600"
                  />

                  <h2 className="font-semibold text-slate-900">
                    Informations du besoin
                  </h2>
                </div>

                <div>
      <FieldLabel required>
        Type de recrutement
      </FieldLabel>

      <select
        name="type_recrutement"
        value={
          form.type_recrutement
        }
        onChange={handleChange}
        required
        className="
          w-full rounded-lg border
          border-slate-300 bg-white
          px-3.5 py-2.5 text-sm
          outline-none
          focus:border-blue-500
          focus:ring-2
          focus:ring-blue-100
        "
      >
        <option value="">
          Sélectionner le type
        </option>

        <option value="OUVRIER">
          Recrutement ouvrier
        </option>

        <option value="CADRE">
          Recrutement cadre
        </option>
      </select>
    </div>

            <div className="grid gap-5 md:grid-cols-2">
              <InputField
                label="Date de la demande"
                value={dateDemande}
                type="date"
                disabled
              />

              <div>
                <FieldLabel required>
                  Site
                </FieldLabel>

                <select
                  name="factory"
                  value={form.factory}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    Sélectionner un site
                  </option>

                  {sites.map((site) => (
                    <option
                      key={site.id}
                      value={site.id}
                    >
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>


              <div>
                <FieldLabel required>
                  Département concerné
                </FieldLabel>

                <select
                  name="departement"
                  value={form.departement}
                  onChange={handleChange}
                  disabled={!form.factory}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    Sélectionner un département
                  </option>

                  {departementsFiltres.map(
                    (departement) => (
                      <option
                        key={departement.id}
                        value={departement.id}
                      >
                        {departement.name}
                      </option>
                    )
                  )}
                </select>
              </div>


              <div>
                <FieldLabel required>
                  Poste à recruter
                </FieldLabel>

                <select
                  name="poste"
                  value={form.poste}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    Sélectionner un poste
                  </option>

                  {postes.map((poste) => (
                    <option
                      key={poste.id}
                      value={poste.id}
                    >
                      {poste.name}
                    </option>
                  ))}
                </select>
              </div>


              <div className="md:col-span-2">
                <TextAreaField
                  label="Désignation des tâches"
                  name="designation_taches"
                  value={
                    form.designation_taches
                  }
                  onChange={handleChange}
                  required
                  placeholder="Décrivez les principales tâches du poste..."
                />
              </div>
            </div>
          </section>


          {/* Profil recherché */}
          <section className="border-b border-slate-200 p-5 sm:p-6">
            <h2 className="mb-5 font-semibold text-slate-900">
              Profil recherché
            </h2>

            <div className="grid gap-5">
              <TextAreaField
                label="Profil et diplôme"
                name="profil_diplome"
                value={form.profil_diplome}
                onChange={handleChange}
                required
                rows={3}
                placeholder="Diplôme ou niveau d’études demandé..."
              />

              <TextAreaField
                label="Expérience professionnelle"
                name="experience_professionnelle"
                value={
                  form
                    .experience_professionnelle
                }
                onChange={handleChange}
                required
                rows={3}
                placeholder="Nombre d’années et domaine d’expérience..."
              />

              <TextAreaField
                label="Compétences techniques"
                name="competences_techniques"
                value={
                  form
                    .competences_techniques
                }
                onChange={handleChange}
                required
                rows={3}
                placeholder="Machines, logiciels ou procédés techniques..."
              />

              <TextAreaField
                label="Savoir-faire"
                name="savoir_faire"
                value={form.savoir_faire}
                onChange={handleChange}
                required
                rows={3}
                placeholder="Compétences pratiques nécessaires..."
              />

              <TextAreaField
                label="Savoir-être"
                name="savoir_etre"
                value={form.savoir_etre}
                onChange={handleChange}
                required
                rows={3}
                placeholder="Rigueur, autonomie, ponctualité, esprit d’équipe..."
              />
            </div>
          </section>


          {/* Recrutement */}
          <section className="p-5 sm:p-6">
            <h2 className="mb-5 font-semibold text-slate-900">
              Détails du recrutement
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel required>
                  Motif du recrutement
                </FieldLabel>

                <select
                  name="motif"
                  value={form.motif}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    Sélectionner un motif
                  </option>

                  {MOTIFS_RECRUTEMENT.map(
                    (motif) => (
                      <option
                        key={motif.value}
                        value={motif.value}
                      >
                        {motif.label}
                      </option>
                    )
                  )}
                </select>
              </div>


              {form.motif ===
                "REMPLACEMENT" && (
                <div>
                  <FieldLabel required>
                    Motif du remplacement
                  </FieldLabel>

                  <select
                    name="motif_remplacement"
                    value={
                      form.motif_remplacement
                    }
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">
                      Sélectionner
                    </option>

                    {MOTIFS_REMPLACEMENT.map(
                      (motif) => (
                        <option
                          key={motif.value}
                          value={motif.value}
                        >
                          {motif.label}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}


              <div>
                <FieldLabel required>
                  Date prévue du recrutement
                </FieldLabel>

                <input
                  type="date"
                  name="date_prevue_recrutement"
                  value={
                    form
                      .date_prevue_recrutement
                  }
                  min={
                    dateMinimaleRecrutement
                  }
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <p className="mt-1.5 text-xs text-slate-500">
                  Minimum :{" "}
                  {formaterDate(
                    dateMinimaleRecrutement
                  )}
                  . Les week-ends ne sont pas
                  comptés.
                </p>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Nombre de CDI"
                  name="nombre_cdi"
                  value={form.nombre_cdi}
                  onChange={handleChange}
                  type="number"
                  min="0"
                  required
                />

                <InputField
                  label="Nombre de CDD"
                  name="nombre_cdd"
                  value={form.nombre_cdd}
                  onChange={handleChange}
                  type="number"
                  min="0"
                  required
                />
              </div>


              <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">
                  Nombre total à recruter :{" "}
                  {nombreTotal}
                </p>
              </div>
            </div>
          </section>


          <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:px-6">
            <button
              type="button"
              onClick={reinitialiser}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Réinitialiser
            </button>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                !profil?.matricule
              }
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Send size={17} />
              )}

              {isSubmitting
                ? "Envoi en cours..."
                : "Soumettre la demande"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}