import React, {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  CalendarClock,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";
import CompteRenduEntretienCadre from "./CompteRendu";

const LISTE_URL = "/hr/recrutement/mes-comptes-rendus";

function formatDateHeure(valeur) {
  if (!valeur) return "—";

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(new Date(valeur));
}

function libelleAction(candidat) {
  if (!candidat.a_rediger) {
    return "Voir le compte rendu";
  }

  return candidat.compte_rendu_id
    ? "Continuer"
    : "Rédiger";
}

/*
 * Page des rédacteurs choisis à la planification :
 * uniquement leurs candidats, sans accès aux étapes
 * du processus de recrutement.
 */
export default function MesComptesRendus() {
  const { candidatId } = useParams();
  const navigate = useNavigate();

  const [candidats, setCandidats] =
    useState([]);

  const [onglet, setOnglet] =
    useState("a_rediger");

  const [chargement, setChargement] =
    useState(true);

  const [erreur, setErreur] =
    useState("");

  const [candidatOuvert, setCandidatOuvert] =
    useState(null);

  const charger = async () => {
    setChargement(true);
    setErreur("");

    try {
      setCandidats(
        await recrutementApi
          .obtenirMesComptesRendus()
      );
    } catch (error) {
      setErreur(
        recrutementApi.extraireErreur(error)
      );
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  // Lien direct du mail : /mes-comptes-rendus/<candidat>
  useEffect(() => {
    if (!candidatId) {
      setCandidatOuvert(null);
      return;
    }

    let actif = true;

    recrutementApi
      .obtenirMonCompteRendu(candidatId)
      .then((candidat) => {
        if (actif) setCandidatOuvert(candidat);
      })
      .catch(() => {
        if (!actif) return;

        setErreur(
          "Ce compte rendu n’existe pas ou vous n’en êtes pas rédacteur."
        );
        navigate(LISTE_URL, { replace: true });
      });

    return () => {
      actif = false;
    };
  }, [candidatId, navigate]);

  const aRediger = candidats.filter(
    (candidat) => candidat.a_rediger
  );

  const autres = candidats.filter(
    (candidat) => !candidat.a_rediger
  );

  const liste =
    onglet === "a_rediger" ? aRediger : autres;

  const fermer = () => {
    navigate(LISTE_URL);
    charger();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-3 text-violet-700">
            <FileText size={22} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Mes comptes rendus à rédiger
            </h1>

            <p className="text-sm text-slate-500">
              Entretiens dont vous avez été choisi
              comme rédacteur du compte rendu.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={charger}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>

      {erreur && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erreur}
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {[
          ["a_rediger", "À rédiger", aRediger.length],
          ["envoyes", "Envoyés", autres.length],
        ].map(([valeur, libelle, nombre]) => (
          <button
            type="button"
            key={valeur}
            onClick={() => setOnglet(valeur)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              onglet === valeur
                ? "bg-violet-600 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {libelle} ({nombre})
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {chargement ? (
          <div className="flex justify-center py-12">
            <Loader2
              size={28}
              className="animate-spin text-violet-600"
            />
          </div>
        ) : liste.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            {onglet === "a_rediger"
              ? "Aucun compte rendu à rédiger pour le moment."
              : "Aucun compte rendu envoyé."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Candidat</th>
                  <th className="px-4 py-3">Poste</th>
                  <th className="px-4 py-3">Entretien</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {liste.map((candidat) => (
                  <tr key={candidat.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {candidat.nom_complet}
                      </p>
                      <p className="text-xs text-slate-500">
                        {candidat.reference_processus}
                      </p>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {candidat.poste_nom || "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock
                          size={14}
                          className="text-slate-400"
                        />
                        {formatDateHeure(
                          candidat.date_entretien_realisee ||
                            candidat.date_entretien_prevue
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {candidat.statut_libelle}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `${LISTE_URL}/${candidat.id}`
                          )
                        }
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                          candidat.a_rediger
                            ? "bg-violet-600 text-white hover:bg-violet-700"
                            : "border border-violet-300 text-violet-700 hover:bg-violet-50"
                        }`}
                      >
                        <FileText size={15} />
                        {libelleAction(candidat)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {candidatOuvert && (
        <CompteRenduEntretienCadre
          candidat={candidatOuvert}
          onClose={fermer}
          onSaved={fermer}
        />
      )}
    </div>
  );
}
