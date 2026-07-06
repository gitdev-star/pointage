// =====================================================
// PATH: src/features/Presence/components/PresenceHeader.jsx
// =====================================================
import React from "react";
import { Download, RefreshCw } from "lucide-react";

export default function DashboardHeader({
  loading,
  onRefresh,
  onExport,
  exporting,
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">
          Tableau de bord de pointage
        </h1>
        <p className="text-gray-500 mt-1">
          Gestion des pointages employés
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>

        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
        >
          <Download size={18} className={exporting ? "animate-bounce" : ""} />
          {exporting ? "Export…" : "Export Excel"}
        </button>
      </div>
    </div>
  );
}
