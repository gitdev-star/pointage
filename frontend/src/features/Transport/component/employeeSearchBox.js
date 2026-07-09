import React from "react";
import { Search } from "lucide-react";
import useEmployeeSearch from "../hook/useEmployeeSearch";

export default function EmployeeSearchBox({ onSelect }) {
  const { query, setQuery, results, setResults, searching } = useEmployeeSearch();

  const handleSelect = (emp) => {
    onSelect(emp);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="relative mb-4">
      <div className="flex items-center border rounded-xl px-3 py-2">
        <Search size={16} className="text-gray-400 mr-2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par matricule ou nom…"
          className="w-full outline-none text-sm"
        />
      </div>

      {query.trim().length >= 2 && (
        <div className="absolute z-10 w-full bg-white border rounded-xl shadow-lg mt-1 max-h-64 overflow-y-auto">
          {searching && <div className="p-3 text-sm text-gray-400">Recherche…</div>}
          {!searching && results.length === 0 && (
            <div className="p-3 text-sm text-gray-400">Aucun résultat</div>
          )}
          {results.map(emp => (
            <button
              key={emp.id}
              onClick={() => handleSelect(emp)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-b-0"
            >
              <div className="font-medium text-gray-800">
                {emp.first_name} {emp.last_name}
                <span className="text-gray-400 font-normal"> — {emp.employee_id}</span>
              </div>
              <div className="text-xs text-gray-500">{emp.job_title_name || "Fonction non renseignée"}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}