import React from "react";
import { Search } from "lucide-react";

export default function FiltersPanel({ filters, setFilters, onSearch }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">

      <h2 className="text-xl font-semibold mb-6">Filtres</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Matricule</label>
          <input
            type="number"
            placeholder="ID Employé"
            value={filters.user_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, user_id: e.target.value }))}
            className="border rounded-xl px-4 py-3"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Date début</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
            className="border rounded-xl px-4 py-3"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Date fin</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
            className="border rounded-xl px-4 py-3"
          />
        </div>

        <button
          onClick={onSearch}
          className="bg-blue-600 hover:bg-blue-700 transition rounded-xl text-white flex items-center justify-center gap-2 py-3"
        >
          <Search size={18} />
          Rechercher
        </button>

      </div>
    </div>
  );
}