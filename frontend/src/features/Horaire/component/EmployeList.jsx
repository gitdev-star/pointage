// features/WorkSchedule/components/EmployeePicker.jsx
import React, { useState, useEffect, useMemo } from "react";
import hrClient from "../../../api/hrClient";

export default function EmployeePicker({ selectedIds, onChange, restrictToFemale = false }) {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    hrClient
      .get("employees/", { params: { status: "ACTIVE", page_size: 5000 } })
      .then(({ data }) => {
        if (!active) return;
        setEmployees(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => active && setError("Impossible de charger la liste des employés."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const isFemale = (emp) => (emp.sexe || "").trim().toLowerCase().startsWith("f");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = employees;
    if (restrictToFemale) list = list.filter(isFemale);
    if (!q) return list;
    return list.filter((e) => {
      const fullName = `${e.first_name || ""} ${e.last_name || ""}`.toLowerCase();
      const matricule = (e.employee_id || "").toLowerCase();
      return fullName.includes(q) || matricule.includes(q);
    });
  }, [employees, search, restrictToFemale]);

  const toggle = (id) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div className="border border-steel/30 rounded-md">
      {restrictToFemale && (
        <div className="px-3 py-2 text-xs bg-amber-50 text-amber-700 border-b border-amber-200">
          Seul le personnel féminin peut être sélectionné pour un horaire d'allaitement.
        </div>
      )}

      <div className="p-2 border-b border-steel/20">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou matricule..."
          className="w-full px-3 py-2 text-sm border border-steel/30 rounded-md focus:outline-none focus:ring-1 focus:ring-charcoal"
        />
        <p className="text-xs text-steel mt-1">{selectedIds.length} employé(s) sélectionné(s)</p>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {loading && <p className="p-3 text-sm text-steel">Chargement...</p>}
        {error && <p className="p-3 text-sm text-red-600">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="p-3 text-sm text-steel">Aucun employé trouvé.</p>
        )}
        {filtered.map((emp) => (
          <label
            key={emp.id}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-charcoal/5 cursor-pointer border-b border-steel/10 last:border-b-0"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(emp.id)}
              onChange={() => toggle(emp.id)}
            />
            <span className="flex-1">{emp.last_name} {emp.first_name}</span>
            <span className="text-xs text-steel">{emp.employee_id}</span>
          </label>
        ))}
      </div>
    </div>
  );
}