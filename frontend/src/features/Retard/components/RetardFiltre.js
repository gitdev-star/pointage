// =====================================================
// PATH: src/features/Retard/components/RetardFilters.jsx
// =====================================================
import React from "react";
import { Search, Loader, Tag } from "lucide-react";
import { CLASS_DEFAULT, CLASS_ALL } from "../hook/useRetard";

const MONTH_NAMES = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const now = new Date();
const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

export default function RetardFilters({
  filters,
  setYear, setMonth, setMinLate, setClassification,
  classifications,
  loading,
  onSearch,
}) {
  const { year, month, minLate, classification } = filters;

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Paramètres
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">

        {/* Mois */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Mois</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTH_NAMES.slice(1).map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>

        {/* Année */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Année</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Seuil */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Seuil minimum</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={31}
              value={minLate}
              onChange={(e) => setMinLate(Math.max(1, Number(e.target.value)))}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-400">retard(s)</span>
          </div>
        </div>

        {/* Classification */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
            <Tag size={11} /> Classification
          </label>
          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={CLASS_DEFAULT}>Tous les Ouvriers (défaut)</option>
            <option value={CLASS_ALL}>Tous les employés</option>
            {classifications.length > 0 && <option disabled>──────────────</option>}
            {classifications.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Bouton */}
        <button
          onClick={onSearch}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
        >
          {loading
            ? <><Loader size={14} className="animate-spin" /> Analyse…</>
            : <><Search size={14} /> Analyser</>
          }
        </button>

      </div>
    </div>
  );
}
