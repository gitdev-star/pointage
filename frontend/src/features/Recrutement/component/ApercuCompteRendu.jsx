import React from "react";
import { X, User, Briefcase, CheckCircle2 } from "lucide-react";

const DECISIONS = {
  favorable: "Avis favorable",
  reserve: "Avis favorable avec réserve",
  defavorable: "Avis défavorable",
  attente: "En attente de décision",
};

function afficherValeur(value) {
  return value || "—";
}

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatSalaire(value, devise) {
  if (!value) return "—";

  return `${new Intl.NumberFormat("fr-FR").format(value)} ${
    devise || "MGA"
  }`;
}

function AvisSection({ titre, avis, couleur }) {
  if (!avis) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className={`px-5 py-3 ${couleur}`}>
        <h3 className="font-semibold text-gray-900">{titre}</h3>
      </div>

      <div className="p-5 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Décision
          </p>

          <p className="mt-1 font-semibold text-gray-900">
            {DECISIONS[avis.decision] || afficherValeur(avis.decision)}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Commentaire
          </p>

          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
            {afficherValeur(avis.commentaire)}
          </p>
        </div>

        <div className="pt-5 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-900">
            {afficherValeur(avis.nomSignataire)}
          </p>

          <p className="text-sm text-gray-500">
            {afficherValeur(avis.fonctionSignataire)}
          </p>

          <p className="mt-2 text-sm text-gray-500">
            Date : {formatDate(avis.dateSignature)}
          </p>

          <div className="mt-4 min-h-[60px] border-b border-gray-400 flex items-end pb-2">
            {avis.signe ? (
              <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={17} />
                Signé
              </span>
            ) : (
              <span className="text-sm italic text-gray-400">
                Signature non renseignée
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApercuCompteRendu({
  form,
  redacteurs,
  onClose,
}) {
  const candidat = form.candidat || {};

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fermer l'aperçu"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      <div className="relative bg-gray-100 w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-2xl shadow-2xl">
        {/* Barre supérieure */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-gray-900">
              Aperçu du compte rendu
            </h2>

            <p className="text-sm text-gray-500">
              Document qui sera transmis au DRH
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-900"
          >
            <X size={22} />
          </button>
        </div>

        {/* Document */}
        <div className="p-4 sm:p-8">
          <article className="max-w-4xl mx-auto bg-white px-6 py-8 sm:px-12 sm:py-12 shadow-sm">
            {/* En-tête */}
            <header className="text-center border-b-2 border-gray-900 pb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                Système RH
              </p>

              <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-950">
                Compte rendu d’entretien
              </h1>

              <p className="mt-2 text-sm font-medium uppercase tracking-wide text-gray-500">
                Recrutement cadre
              </p>
            </header>

            {/* Informations principales */}
            <section className="py-7 border-b border-gray-200">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Date de l’entretien
                  </p>

                  <p className="mt-1 font-semibold text-gray-900">
                    {formatDate(form.dateEntretien)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Poste concerné
                  </p>

                  <p className="mt-1 font-semibold text-gray-900">
                    {afficherValeur(form.poste)}
                  </p>
                </div>
              </div>
            </section>

            {/* Candidat */}
            <section className="py-7 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                  <User size={20} />
                </div>

                <h2 className="text-lg font-bold text-gray-900">
                  Informations sur le candidat
                </h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
                <Info
                  label="Nom et prénom"
                  value={`${candidat.nom || ""} ${
                    candidat.prenom || ""
                  }`.trim()}
                />

                <Info
                  label="Téléphone"
                  value={candidat.telephone}
                />

                <Info label="Email" value={candidat.email} />

                <Info
                  label="Poste actuel"
                  value={candidat.posteActuel}
                />

                <Info
                  label="Années d’expérience"
                  value={
                    form.anneesExperience
                      ? `${form.anneesExperience} an(s)`
                      : ""
                  }
                />

                <Info label="Diplôme" value={form.diplome} />

                <Info
                  label="Établissement"
                  value={form.etablissement}
                />

                <Info
                  label="Prétention salariale"
                  value={formatSalaire(
                    form.pretentionSalariale,
                    form.devise
                  )}
                />

                <Info
                  label="Disponibilité"
                  value={form.disponibilite}
                />

                <Info
                  label="Précision sur la disponibilité"
                  value={form.precisionDisponibilite}
                />
              </div>
            </section>

            {/* Rédacteurs */}
            <section className="py-7 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-violet-50 text-violet-700 rounded-lg">
                  <Briefcase size={20} />
                </div>

                <h2 className="text-lg font-bold text-gray-900">
                  Compte rendu réalisé par
                </h2>
              </div>

              <div className="flex flex-wrap gap-3">
                {redacteurs?.rh && (
                  <span className="px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 rounded-full">
                    Responsable recrutement / RH
                  </span>
                )}

                {redacteurs?.manager && (
                  <span className="px-3 py-1.5 text-sm font-medium bg-amber-50 text-amber-700 rounded-full">
                    Manager
                  </span>
                )}

                {!redacteurs?.rh && !redacteurs?.manager && (
                  <span className="text-sm text-gray-400">
                    Aucun rédacteur sélectionné
                  </span>
                )}
              </div>
            </section>

            {/* Avis */}
            <section className="py-7">
              <h2 className="mb-5 text-lg font-bold text-gray-900">
                Avis et recommandations
              </h2>

              <div className="grid lg:grid-cols-2 gap-6">
                {redacteurs?.rh && (
                  <AvisSection
                    titre="Avis RH"
                    avis={form.avisRH}
                    couleur="bg-blue-50"
                  />
                )}

                {redacteurs?.manager && (
                  <AvisSection
                    titre="Avis Manager"
                    avis={form.avisManager}
                    couleur="bg-amber-50"
                  />
                )}
              </div>
            </section>

            {/* Observation générale */}
            {form.observationGenerale && (
              <section className="py-7 border-t border-gray-200">
                <h2 className="font-bold text-gray-900">
                  Observation générale
                </h2>

                <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {form.observationGenerale}
                </p>
              </section>
            )}

            <footer className="pt-6 mt-5 text-center border-t border-gray-200">
              <p className="text-xs text-gray-400">
                Document confidentiel destiné à la Direction des
                Ressources Humaines
              </p>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 font-medium text-gray-900">
        {afficherValeur(value)}
      </p>
    </div>
  );
}