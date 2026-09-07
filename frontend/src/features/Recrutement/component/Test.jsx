import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileUp,
  Save,
  TestTube2,
  Trash2,
  Users,
} from "lucide-react";

const TAILLE_MAXIMALE = 10 * 1024 * 1024;
const TYPES_AUTORISES = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
];
const EXTENSIONS_AUTORISEES = [
  "pdf",
  "xlsx",
  "xls",
  "csv",
  "jpg",
  "jpeg",
  "png",
];

function formatTaille(taille) {
  if (!taille) return "0 Ko";
  if (taille < 1024 * 1024) return `${Math.ceil(taille / 1024)} Ko`;
  return `${(taille / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function EtapeTests({ recrutement, onComplete }) {
  const candidats = recrutement.candidats || [];

  const [presences, setPresences] = useState(() =>
    candidats.map((candidat) => ({
      candidatId: candidat.id,
      presence: "NON_RENSEIGNEE",
    }))
  );
  const [fichierPresence, setFichierPresence] = useState(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statistiques = useMemo(
    () => ({
      presents: presences.filter((item) => item.presence === "PRESENT").length,
      absents: presences.filter((item) => item.presence === "ABSENT").length,
      nonRenseignes: presences.filter(
        (item) => item.presence === "NON_RENSEIGNEE"
      ).length,
    }),
    [presences]
  );

  const modifierPresence = (candidatId, presence) => {
    setPresences((previous) =>
      previous.map((item) =>
        item.candidatId === candidatId ? { ...item, presence } : item
      )
    );
    setErreur("");
    setMessage("");
  };

  const ajouterFichier = (file) => {
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    const formatAutorise =
      TYPES_AUTORISES.includes(file.type) ||
      EXTENSIONS_AUTORISEES.includes(extension);

    if (!formatAutorise) {
      setErreur(
        "Format non autorisé. Utilisez un fichier PDF, Excel, CSV, JPG ou PNG."
      );
      return;
    }

    if (file.size > TAILLE_MAXIMALE) {
      setErreur("Le fichier de présence ne doit pas dépasser 10 Mo.");
      return;
    }

    setFichierPresence(file);
    setErreur("");
    setMessage("");
  };

  const supprimerFichier = () => {
    setFichierPresence(null);
    setErreur("");
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErreur("");
    setMessage("");

    if (candidats.length === 0) {
      setErreur("Aucun candidat n’est enregistré pour ce recrutement.");
      return;
    }

    if (statistiques.nonRenseignes > 0) {
      setErreur("Indiquez la présence ou l’absence de chaque candidat.");
      return;
    }

    if (!fichierPresence) {
      setErreur("Le fichier de présence est obligatoire.");
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const donneesTest = {
        recrutementId: recrutement.id,
        referenceRecrutement: recrutement.reference,
        poste: recrutement.poste,
        presences: presences.map((presence) => ({
          ...presence,
          candidat:
            candidats.find(
              (candidat) => candidat.id === presence.candidatId
            ) || null,
        })),
        fichierPresence: {
          nom: fichierPresence.name,
          taille: fichierPresence.size,
          type: fichierPresence.type,
          fichier: fichierPresence,
        },
        statistiques,
        dateEnregistrement: new Date().toISOString(),
      };

      console.log("Présences du test :", donneesTest);
      setMessage("Les présences et le fichier ont été enregistrés.");

      onComplete?.({
        etape: 5,
        test: donneesTest,
      });
    } catch (error) {
      console.error("Erreur pendant l’enregistrement :", error);
      setErreur("Une erreur est survenue pendant l’enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {message && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {message}
        </div>
      )}

      {erreur && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erreur}
        </div>
      )}

      <div className="mb-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700">
            <TestTube2 size={21} />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Présence au test</p>
            <p className="text-xs text-slate-500">
              {recrutement.reference} · {recrutement.poste}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Users size={17} />
          <span>
            <strong>{candidats.length}</strong> candidat(s)
          </span>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">Présents</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">
            {statistiques.presents}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Absents</p>
          <p className="mt-1 text-2xl font-bold text-red-900">
            {statistiques.absents}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Non renseignés</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {statistiques.nonRenseignes}
          </p>
        </div>
      </div>

      <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold text-slate-900">
            Présence des candidats
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Indiquez si chaque candidat est présent ou absent.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="bg-slate-100">
              <tr className="text-left text-xs font-semibold uppercase text-slate-600">
                <th className="px-4 py-3">Candidat</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Présence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {candidats.map((candidat) => {
                const presence = presences.find(
                  (item) => item.candidatId === candidat.id
                );

                return (
                  <tr key={candidat.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                      {candidat.prenom} {candidat.nom}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">
                      {candidat.email || candidat.telephone || "—"}
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={presence?.presence || "NON_RENSEIGNEE"}
                        onChange={(event) =>
                          modifierPresence(candidat.id, event.target.value)
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                      >
                        <option value="NON_RENSEIGNEE">Sélectionner</option>
                        <option value="PRESENT">Présent</option>
                        <option value="ABSENT">Absent</option>
                      </select>
                    </td>
                  </tr>
                );
              })}

              {candidats.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-500">
                    Aucun candidat n’est disponible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Fichier de présence
          <span className="ml-1 text-red-500">*</span>
        </label>

        {!fichierPresence ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50">
            <FileUp size={30} className="text-blue-600" />
            <p className="mt-2 text-sm font-semibold text-slate-800">
              Déposer le fichier de présence
            </p>
            <p className="mt-1 text-xs text-slate-500">
              PDF, Excel, CSV, JPG ou PNG — 10 Mo maximum
            </p>
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
              onChange={(event) => {
                ajouterFichier(event.target.files?.[0]);
                event.target.value = "";
              }}
              className="hidden"
            />
          </label>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-emerald-900">
                {fichierPresence.name}
              </p>
              <p className="text-xs text-emerald-700">
                {formatTaille(fichierPresence.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={supprimerFichier}
              className="rounded-lg p-2 text-red-600 hover:bg-red-100"
              aria-label="Supprimer le fichier"
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </section>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            candidats.length === 0 ||
            statistiques.nonRenseignes > 0 ||
            !fichierPresence
          }
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={17} />
          {isSubmitting ? "Enregistrement..." : "Valider les présences"}
        </button>
      </div>
    </form>
  );
}