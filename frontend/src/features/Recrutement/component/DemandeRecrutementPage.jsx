import React, {
  useState,
} from "react";

import {
  FileClock,
  FilePlus2,
} from "lucide-react";

import FormulaireDemandeRecrutement
  from "./FormulaireDemandeRecrutement";

import HistoriqueMesDemandes
  from "./HistoriqueDemande";


const TABS = {
  FORMULAIRE: "FORMULAIRE",
  HISTORIQUE: "HISTORIQUE",
};


export default function DemandeRecrutementPage() {
  const [
    activeTab,
    setActiveTab,
  ] = useState(
    TABS.FORMULAIRE
  );

  const [
    historiqueVersion,
    setHistoriqueVersion,
  ] = useState(0);


  const handleDemandeSubmitted = () => {
    setHistoriqueVersion(
      (ancienneVersion) =>
        ancienneVersion + 1
    );

    setActiveTab(
      TABS.HISTORIQUE
    );
  };


  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        {/* En-tête */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Demande de recrutement
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Créez une nouvelle demande et
            suivez la décision du directeur.
          </p>
        </div>


        {/* Onglets */}
        <div className="mb-6 border-b border-slate-200">
          <div className="flex gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  TABS.FORMULAIRE
                )
              }
              className={`
                relative flex items-center
                gap-2 whitespace-nowrap
                px-5 py-3 text-sm
                font-semibold transition
                ${
                  activeTab ===
                  TABS.FORMULAIRE
                    ? "text-blue-700"
                    : "text-slate-500 hover:text-slate-800"
                }
              `}
            >
              <FilePlus2 size={18} />

              Nouvelle demande

              {activeTab ===
                TABS.FORMULAIRE && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-blue-600" />
              )}
            </button>


            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  TABS.HISTORIQUE
                )
              }
              className={`
                relative flex items-center
                gap-2 whitespace-nowrap
                px-5 py-3 text-sm
                font-semibold transition
                ${
                  activeTab ===
                  TABS.HISTORIQUE
                    ? "text-blue-700"
                    : "text-slate-500 hover:text-slate-800"
                }
              `}
            >
              <FileClock size={18} />

              Historique de mes demandes

              {activeTab ===
                TABS.HISTORIQUE && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-blue-600" />
              )}
            </button>
          </div>
        </div>


        {/* Contenu de l’onglet formulaire */}
        {activeTab ===
          TABS.FORMULAIRE && (
          <FormulaireDemandeRecrutement
            onSubmitted={
              handleDemandeSubmitted
            }
          />
        )}


        {/* Contenu de l’onglet historique */}
        {activeTab ===
          TABS.HISTORIQUE && (
          <HistoriqueMesDemandes
            key={historiqueVersion}
          />
        )}
      </div>
    </div>
  );
}