import React, { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  FileUp,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";

/* =========================================================
   DONNÉES FICTIVES
========================================================= */

const MOCK_RECRUTEMENTS = [
  {
    id: 1,
    reference: "REC-2026-0125",
    poste: "Machiniste",
    nombreARecruter: 4,
    departement: "Production",
    typeContrat: "CDD",
    datePrevue: "2026-09-15",
    statut: "EN_COURS",
    candidats: [
      {
        id: 1,
        nom: "Rakoto",
        prenom: "Paul",
        telephone: "034 12 345 67",
        email: "paul.rakoto@email.com",
        adresse: "Antananarivo",
        dateCandidature: "2026-08-20",
        sourceCandidature: "E-mail",
        statut: "VALIDE",
        motifRejet: null,
        observations: "",
      },
      {
        id: 2,
        nom: "Rabe",
        prenom: "Jean",
        telephone: "032 45 678 90",
        email: "jean.rabe@email.com",
        adresse: "Fianarantsoa",
        dateCandidature: "2026-08-21",
        sourceCandidature: "Dépôt physique",
        statut: "VALIDE",
        motifRejet: null,
        observations: "",
      },
      {
        id: 3,
        nom: "Andria",
        prenom: "Michel",
        telephone: "033 45 123 78",
        email: "michel.andria@email.com",
        adresse: "Antsirabe",
        dateCandidature: "2026-08-22",
        sourceCandidature: "Site d'emploi",
        statut: "REJETE",
        motifRejet:
          "Expérience insuffisante pour utiliser les machines concernées.",
        observations: "",
      },
      {
        id: 4,
        nom: "Rasolofonirina",
        prenom: "Luc",
        telephone: "034 98 765 12",
        email: "luc.rasolo@email.com",
        adresse: "Antananarivo",
        dateCandidature: "2026-08-23",
        sourceCandidature: "Recommandation interne",
        statut: "EN_ATTENTE",
        motifRejet: null,
        observations: "",
      },
    ],
  },
  {
    id: 2,
    reference: "REC-2026-0124",
    poste: "Contrôleur qualité",
    nombreARecruter: 2,
    departement: "Qualité",
    typeContrat: "CDI",
    datePrevue: "2026-09-10",
    statut: "EN_COURS",
    candidats: [
      {
        id: 5,
        nom: "Rasoanaivo",
        prenom: "Marie",
        telephone: "034 11 222 33",
        email: "marie.rasoanaivo@email.com",
        adresse: "Antananarivo",
        dateCandidature: "2026-08-19",
        sourceCandidature: "E-mail",
        statut: "VALIDE",
        motifRejet: null,
        observations: "",
      },
      {
        id: 6,
        nom: "Rakotomalala",
        prenom: "Sonia",
        telephone: "032 44 555 66",
        email: "sonia.rakotomalala@email.com",
        adresse: "Antananarivo",
        dateCandidature: "2026-08-20",
        sourceCandidature: "Dépôt physique",
        statut: "REJETE",
        motifRejet:
          "Le diplôme présenté ne correspond pas au profil demandé.",
        observations: "",
      },
    ],
  },
  {
    id: 3,
    reference: "REC-2026-0123",
    poste: "Technicien de maintenance",
    nombreARecruter: 3,
    departement: "Maintenance",
    typeContrat: "CDD",
    datePrevue: "2026-09-20",
    statut: "EN_COURS",
    candidats: [
      {
        id: 7,
        nom: "Randria",
        prenom: "Alain",
        telephone: "033 22 111 44",
        email: "alain.randria@email.com",
        adresse: "Antananarivo",
        dateCandidature: "2026-08-18",
        sourceCandidature: "Réseaux sociaux",
        statut: "VALIDE",
        motifRejet: null,
        observations: "",
      },
      {
        id: 8,
        nom: "Ramanandraibe",
        prenom: "José",
        telephone: "034 55 333 12",
        email: "jose.ramanandraibe@email.com",
        adresse: "Antananarivo",
        dateCandidature: "2026-08-22",
        sourceCandidature: "E-mail",
        statut: "EN_ATTENTE",
        motifRejet: null,
        observations: "",
      },
    ],
  },
  {
    id: 4,
    reference: "REC-2026-0122",
    poste: "Assistant administratif",
    nombreARecruter: 1,
    departement: "Administration",
    typeContrat: "Stage",
    datePrevue: "2026-10-01",
    statut: "EN_COURS",
    candidats: [],
  },
];

const SOURCES_CANDIDATURE = [
  "E-mail",
  "Dépôt physique",
  "Candidature spontanée",
  "Site d'emploi",
  "Recommandation interne",
  "Réseaux sociaux",
  "Autre",
];

const CANDIDAT_STATUS = {
  VALIDE: {
    label: "Validé",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  REJETE: {
    label: "Rejeté",
    className: "border-red-200 bg-red-50 text-red-700",
    icon: XCircle,
  },
  EN_ATTENTE: {
    label: "En attente",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Users,
  },
};

/* =========================================================
   FONCTIONS ET PETITS COMPOSANTS
========================================================= */

function formatDate(date) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function StatusBadge({ statut }) {
  const config =
    CANDIDAT_STATUS[statut] ||
    CANDIDAT_STATUS.EN_ATTENTE;

  const Icon = config.icon;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 whitespace-nowrap
        rounded-full border px-2.5 py-1 text-xs font-semibold
        ${config.className}
      `}
    >
      <Icon size={13} />
      {config.label}
    </span>
  );
}

function ContractCard({ contrat, nombre }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        Contrats {contrat}
      </p>

      <div className="mt-2 flex items-end justify-between">
        <p className="text-3xl font-bold text-slate-900">
          {nombre}
        </p>

        <FileText size={22} className="text-blue-600" />
      </div>

      <p className="mt-1 text-xs text-slate-400">
        Personnes à recruter
      </p>
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="
          w-full rounded-lg border border-slate-300
          px-3.5 py-2.5 text-sm text-slate-800
          outline-none focus:border-blue-500
          focus:ring-2 focus:ring-blue-100
        "
      />
    </div>
  );
}

/* =========================================================
   MODALE D’AJOUT D’UN CANDIDAT
========================================================= */

function AjouterCandidatModal({
  recrutement,
  onClose,
  onCandidateAdded,
}) {
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    telephone: "",
    email: "",
    adresse: "",
    dateNaissance: "",
    dateCandidature: new Date()
      .toISOString()
      .split("T")[0],
    sourceCandidature: "",
    cv: null,
    lettreMotivation: null,
    observations: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value, files } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      /*
       * Simulation de l'enregistrement.
       * Le backend remplacera cette partie plus tard.
       */
      await new Promise((resolve) =>
        setTimeout(resolve, 500)
      );

      const nouveauCandidat = {
        id: Date.now(),
        ...form,
        statut: "EN_ATTENTE",
        motifRejet: null,
        recrutementId: recrutement.id,
      };

      onCandidateAdded(nouveauCandidat);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="
          flex max-h-[92vh] w-full max-w-4xl
          flex-col overflow-hidden rounded-xl bg-white shadow-2xl
        "
      >
        {/* En-tête */}
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <UserPlus size={21} className="text-blue-600" />
              Ajouter un candidat
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Poste : {recrutement.poste}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulaire */}
        <div className="grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-2">
          <FormField
            label="Nom"
            name="nom"
            value={form.nom}
            onChange={handleChange}
            required
          />

          <FormField
            label="Prénom"
            name="prenom"
            value={form.prenom}
            onChange={handleChange}
            required
          />

          <FormField
            label="Téléphone"
            name="telephone"
            value={form.telephone}
            onChange={handleChange}
            required
          />

          <FormField
            label="Adresse e-mail"
            name="email"
            value={form.email}
            onChange={handleChange}
            type="email"
            required
          />

          <div className="md:col-span-2">
            <FormField
              label="Adresse"
              name="adresse"
              value={form.adresse}
              onChange={handleChange}
              placeholder="Adresse du candidat"
            />
          </div>

          <FormField
            label="Date de naissance"
            name="dateNaissance"
            value={form.dateNaissance}
            onChange={handleChange}
            type="date"
          />

          <FormField
            label="Date de candidature"
            name="dateCandidature"
            value={form.dateCandidature}
            onChange={handleChange}
            type="date"
            required
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Source de la candidature
              <span className="ml-1 text-red-500">*</span>
            </label>

            <select
              name="sourceCandidature"
              value={form.sourceCandidature}
              onChange={handleChange}
              required
              className="
                w-full rounded-lg border border-slate-300
                bg-white px-3.5 py-2.5 text-sm
                outline-none focus:border-blue-500
                focus:ring-2 focus:ring-blue-100
              "
            >
              <option value="">
                Sélectionner une source
              </option>

              {SOURCES_CANDIDATURE.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Poste concerné
            </label>

            <input
              value={recrutement.poste}
              disabled
              className="
                w-full cursor-not-allowed rounded-lg
                border border-slate-300 bg-slate-100
                px-3.5 py-2.5 text-sm text-slate-600
              "
            />
          </div>

          {/* CV */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              CV 
            </label>

            <label
              className="
                flex cursor-pointer items-center gap-3
                rounded-lg border border-dashed border-slate-300
                p-3 transition hover:bg-slate-50
              "
            >
              <FileUp size={20} className="text-blue-600" />

              <span className="truncate text-sm text-slate-600">
                {form.cv?.name || "Sélectionner le CV"}
              </span>

              <input
                type="file"
                name="cv"
                accept=".pdf,.doc,.docx"
                onChange={handleChange}
                required
                className="hidden"
              />
            </label>
          </div>

          {/* Lettre de motivation */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Lettre de motivation
            </label>

            <label
              className="
                flex cursor-pointer items-center gap-3
                rounded-lg border border-dashed border-slate-300
                p-3 transition hover:bg-slate-50
              "
            >
              <FileUp size={20} className="text-slate-500" />

              <span className="truncate text-sm text-slate-600">
                {form.lettreMotivation?.name ||
                  "Sélectionner le document"}
              </span>

              <input
                type="file"
                name="lettreMotivation"
                accept=".pdf,.doc,.docx"
                onChange={handleChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Observations RH
            </label>

            <textarea
              name="observations"
              value={form.observations}
              onChange={handleChange}
              rows={4}
              placeholder="Informations complémentaires sur le candidat..."
              className="
                w-full resize-none rounded-lg border
                border-slate-300 px-3.5 py-2.5 text-sm
                outline-none focus:border-blue-500
                focus:ring-2 focus:ring-blue-100
              "
            />
          </div>
        </div>

        {/* Boutons */}
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="
              rounded-lg border border-slate-300 bg-white
              px-4 py-2.5 text-sm font-medium text-slate-700
              hover:bg-slate-100
            "
          >
            Annuler
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="
              rounded-lg bg-blue-600 px-5 py-2.5
              text-sm font-semibold text-white
              hover:bg-blue-700 disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {isSubmitting
              ? "Enregistrement..."
              : "Ajouter le candidat"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* =========================================================
   MODALE DE LA LISTE COMPLÈTE DES CANDIDATS
========================================================= */

function CandidatsModal({
  recrutement,
  onClose,
  onCandidateAdded,
}) {
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("TOUS");
  const [showAddCandidate, setShowAddCandidate] =
    useState(false);

  const candidatsFiltres = useMemo(() => {
    const texte = recherche.toLowerCase().trim();

    return recrutement.candidats.filter((candidat) => {
      const nomComplet =
        `${candidat.nom} ${candidat.prenom}`.toLowerCase();

      const correspondRecherche =
        !texte ||
        nomComplet.includes(texte) ||
        candidat.email.toLowerCase().includes(texte);

      const correspondStatut =
        statut === "TOUS" ||
        candidat.statut === statut;

      return correspondRecherche && correspondStatut;
    });
  }, [recrutement, recherche, statut]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="
          flex max-h-[90vh] w-full max-w-6xl
          flex-col overflow-hidden rounded-xl bg-white shadow-2xl
        "
      >
        {/* En-tête */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Candidats — {recrutement.poste}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {recrutement.reference} ·{" "}
              {recrutement.departement}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAddCandidate(true)}
              className="
                inline-flex items-center gap-2 rounded-lg
                bg-blue-600 px-4 py-2.5 text-sm
                font-semibold text-white transition
                hover:bg-blue-700
              "
            >
              <UserPlus size={17} />
              Ajouter un candidat
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X size={21} />
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={recherche}
              onChange={(event) =>
                setRecherche(event.target.value)
              }
              placeholder="Rechercher un candidat..."
              className="
                w-full rounded-lg border border-slate-300
                bg-white py-2.5 pl-10 pr-3 text-sm
                outline-none focus:border-blue-500
                focus:ring-2 focus:ring-blue-100
              "
            />
          </div>

          <select
            value={statut}
            onChange={(event) =>
              setStatut(event.target.value)
            }
            className="
              rounded-lg border border-slate-300
              bg-white px-3 py-2.5 text-sm
              outline-none focus:border-blue-500
              focus:ring-2 focus:ring-blue-100
            "
          >
            <option value="TOUS">Tous les candidats</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="VALIDE">Validés</option>
            <option value="REJETE">Rejetés</option>
          </select>
        </div>

        {/* Tableau */}
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[1050px]">
            <thead className="sticky top-0 bg-slate-100">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-5 py-4">Candidat</th>
                <th className="px-5 py-4">Téléphone</th>
                <th className="px-5 py-4">E-mail</th>
                <th className="px-5 py-4">Source</th>
                <th className="px-5 py-4">
                  Date de candidature
                </th>
                <th className="px-5 py-4">Statut</th>
                <th className="min-w-[270px] px-5 py-4">
                  Motif du rejet
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {candidatsFiltres.map((candidat) => (
                <tr
                  key={candidat.id}
                  className="align-top hover:bg-slate-50"
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {candidat.prenom} {candidat.nom}
                    </p>

                    {candidat.adresse && (
                      <p className="mt-1 text-xs text-slate-400">
                        {candidat.adresse}
                      </p>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                    {candidat.telephone || "—"}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {candidat.email || "—"}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {candidat.sourceCandidature || "—"}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                    {formatDate(candidat.dateCandidature)}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge statut={candidat.statut} />
                  </td>

                  <td className="px-5 py-4">
                    {candidat.statut === "REJETE" ? (
                      <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm leading-5 text-red-700">
                        {candidat.motifRejet ||
                          "Aucun motif renseigné"}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {candidatsFiltres.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Aucun candidat trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-500">
          {candidatsFiltres.length} candidat(s) affiché(s)
        </div>
      </div>

      {showAddCandidate && (
        <AjouterCandidatModal
          recrutement={recrutement}
          onClose={() => setShowAddCandidate(false)}
          onCandidateAdded={(nouveauCandidat) => {
            onCandidateAdded(nouveauCandidat);
            setShowAddCandidate(false);
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   COMPOSANT PRINCIPAL
========================================================= */

export default function ListeRecrutements() {
  const [recrutements, setRecrutements] =
    useState(MOCK_RECRUTEMENTS);

  const [recherche, setRecherche] = useState("");
  const [contrat, setContrat] = useState("TOUS");
  const [expandedId, setExpandedId] = useState(null);
  const [recrutementModalId, setRecrutementModalId] =
    useState(null);

  const recrutementModal = useMemo(() => {
    return (
      recrutements.find(
        (recrutement) =>
          recrutement.id === recrutementModalId
      ) || null
    );
  }, [recrutements, recrutementModalId]);

  const typesContrat = useMemo(() => {
    return [
      ...new Set(
        recrutements.map((item) => item.typeContrat)
      ),
    ];
  }, [recrutements]);

  const resumeContrats = useMemo(() => {
    return recrutements.reduce(
      (resultat, recrutement) => {
        resultat[recrutement.typeContrat] =
          (resultat[recrutement.typeContrat] || 0) +
          recrutement.nombreARecruter;

        return resultat;
      },
      {}
    );
  }, [recrutements]);

  const recrutementsFiltres = useMemo(() => {
    const texte = recherche.toLowerCase().trim();

    return recrutements.filter((recrutement) => {
      const correspondRecherche =
        !texte ||
        recrutement.reference
          .toLowerCase()
          .includes(texte) ||
        recrutement.poste.toLowerCase().includes(texte) ||
        recrutement.departement
          .toLowerCase()
          .includes(texte);

      const correspondContrat =
        contrat === "TOUS" ||
        recrutement.typeContrat === contrat;

      return correspondRecherche && correspondContrat;
    });
  }, [recrutements, recherche, contrat]);

  const toggleAccordion = (id) => {
    setExpandedId((previous) =>
      previous === id ? null : id
    );
  };

  const handleCandidateAdded = (
    recrutementId,
    nouveauCandidat
  ) => {
    setRecrutements((previousRecrutements) =>
      previousRecrutements.map((recrutement) => {
        if (recrutement.id !== recrutementId) {
          return recrutement;
        }

        return {
          ...recrutement,
          candidats: [
            ...recrutement.candidats,
            nouveauCandidat,
          ],
        };
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* En-tête */}
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
            <BriefcaseBusiness size={24} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Liste des recrutements
            </h1>

            <p className="text-sm text-slate-500">
              Suivi des postes ouverts et des candidats recrutés
            </p>
          </div>
        </div>

        {/* Résumé des contrats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(resumeContrats).map(
            ([typeContrat, nombre]) => (
              <ContractCard
                key={typeContrat}
                contrat={typeContrat}
                nombre={nombre}
              />
            )
          )}
        </div>

        {/* Filtres */}
        <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={recherche}
              onChange={(event) =>
                setRecherche(event.target.value)
              }
              placeholder="Rechercher par poste, référence ou département..."
              className="
                w-full rounded-lg border border-slate-300
                py-2.5 pl-10 pr-4 text-sm outline-none
                focus:border-blue-500 focus:ring-2 focus:ring-blue-100
              "
            />
          </div>

          <select
            value={contrat}
            onChange={(event) =>
              setContrat(event.target.value)
            }
            className="
              rounded-lg border border-slate-300 bg-white
              px-3 py-2.5 text-sm outline-none
              focus:border-blue-500 focus:ring-2 focus:ring-blue-100
            "
          >
            <option value="TOUS">
              Tous les contrats
            </option>

            {typesContrat.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {/* Tableau principal */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-slate-100">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="w-12 px-4 py-4" />
                  <th className="px-4 py-4">Référence</th>
                  <th className="px-4 py-4">Poste</th>
                  <th className="px-4 py-4">Département</th>
                  <th className="px-4 py-4">Contrat</th>
                  <th className="px-4 py-4 text-center">
                    Demandé
                  </th>
                  <th className="px-4 py-4 text-center">
                    Recruté
                  </th>
                  <th className="px-4 py-4 text-center">
                    Restant
                  </th>
                  <th className="px-4 py-4 text-center">
                    Candidatures
                  </th>
                  <th className="px-4 py-4 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {recrutementsFiltres.map((recrutement) => {
                  const candidatsValides =
                    recrutement.candidats.filter(
                      (candidat) =>
                        candidat.statut === "VALIDE"
                    );

                  const nombreRecrute =
                    candidatsValides.length;

                  const nombreRestant = Math.max(
                    recrutement.nombreARecruter -
                      nombreRecrute,
                    0
                  );

                  const expanded =
                    expandedId === recrutement.id;

                  return (
                    <React.Fragment key={recrutement.id}>
                      <tr
                        className={`
                          transition hover:bg-slate-50
                          ${expanded ? "bg-blue-50/40" : ""}
                        `}
                      >
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              toggleAccordion(recrutement.id)
                            }
                            className="
                              rounded-lg p-2 text-slate-500
                              hover:bg-slate-200
                            "
                            title="Afficher les personnes recrutées"
                          >
                            {expanded ? (
                              <ChevronUp size={19} />
                            ) : (
                              <ChevronDown size={19} />
                            )}
                          </button>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-blue-700">
                          {recrutement.reference}
                        </td>

                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                          {recrutement.poste}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-700">
                          {recrutement.departement}
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-md bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                            {recrutement.typeContrat}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center text-sm font-semibold">
                          {recrutement.nombreARecruter}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex min-w-8 justify-center rounded-full bg-emerald-100 px-2 py-1 text-sm font-bold text-emerald-700">
                            {nombreRecrute}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span
                            className={`
                              inline-flex min-w-8 justify-center
                              rounded-full px-2 py-1 text-sm font-bold
                              ${
                                nombreRestant === 0
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }
                            `}
                          >
                            {nombreRestant}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center text-sm font-semibold">
                          {recrutement.candidats.length}
                        </td>

                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setRecrutementModalId(
                                recrutement.id
                              )
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
                            Voir les candidats
                          </button>
                        </td>
                      </tr>

                      {/* Accordéon */}
                      {expanded && (
                        <tr>
                          <td
                            colSpan={10}
                            className="bg-slate-50 px-6 py-5"
                          >
                            <div className="rounded-xl border border-slate-200 bg-white">
                              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                                <div>
                                  <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                                    <UserCheck
                                      size={18}
                                      className="text-emerald-600"
                                    />
                                    Personnes recrutées
                                  </h3>

                                  <p className="mt-1 text-xs text-slate-500">
                                    Seuls les candidats validés sont affichés
                                  </p>
                                </div>

                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                                  {nombreRecrute} recruté(s)
                                </span>
                              </div>

                              {candidatsValides.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-[700px]">
                                    <thead className="bg-slate-50">
                                      <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                                        <th className="px-5 py-3">
                                          Nom et prénom
                                        </th>
                                        <th className="px-5 py-3">
                                          Téléphone
                                        </th>
                                        <th className="px-5 py-3">
                                          E-mail
                                        </th>
                                        <th className="px-5 py-3">
                                          Date de candidature
                                        </th>
                                        <th className="px-5 py-3">
                                          Statut
                                        </th>
                                      </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100">
                                      {candidatsValides.map(
                                        (candidat) => (
                                          <tr key={candidat.id}>
                                            <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                                              {candidat.prenom}{" "}
                                              {candidat.nom}
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                              {candidat.telephone ||
                                                "—"}
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                              {candidat.email ||
                                                "—"}
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                              {formatDate(
                                                candidat.dateCandidature
                                              )}
                                            </td>

                                            <td className="px-5 py-4">
                                              <StatusBadge statut="VALIDE" />
                                            </td>
                                          </tr>
                                        )
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="p-8 text-center">
                                  <Users
                                    size={30}
                                    className="mx-auto text-slate-300"
                                  />

                                  <p className="mt-2 text-sm text-slate-500">
                                    Aucun candidat n’a encore été
                                    validé pour ce poste.
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {recrutementsFiltres.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      Aucun recrutement trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-500">
            {recrutementsFiltres.length} recrutement(s) affiché(s)
          </div>
        </div>
      </div>

      {/* Modale des candidats */}
      {recrutementModal && (
        <CandidatsModal
          recrutement={recrutementModal}
          onClose={() => setRecrutementModalId(null)}
          onCandidateAdded={(nouveauCandidat) =>
            handleCandidateAdded(
              recrutementModal.id,
              nouveauCandidat
            )
          }
        />
      )}
    </div>
  );
}