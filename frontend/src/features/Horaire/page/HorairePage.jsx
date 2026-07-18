// features/WorkSchedule/page/WorkSchedulePage.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import AssignScheduleModal from "../component/HoraireModal";
import { getWorkSchedules, deleteWorkSchedule } from "../api/workSchedule";

function groupKey(name) {
  const idx = name.lastIndexOf(" - ");
  return idx === -1 ? name : name.substring(0, idx);
}

function groupSchedules(schedules) {
  const map = new Map();
  for (const s of schedules) {
    const key = groupKey(s.name);
    if (!map.has(key)) {
      map.set(key, {
        label: key,
        standard_start: s.standard_start,
        standard_end: s.standard_end,
        early_leave_limit: s.early_leave_limit,
        standard_work_hours: s.standard_work_hours,
        overtime_threshold_hours: s.overtime_threshold_hours,
        items: [],
      });
    }
    map.get(key).items.push(s);
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function fmtDate(d) {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function formatValidity(from, until) {
  if (!from && !until) return "Sans limite de date";
  if (from && until) return `${fmtDate(from)} → ${fmtDate(until)}`;
  if (from) return `À partir du ${fmtDate(from)}`;
  return `Jusqu'au ${fmtDate(until)}`;
}

export default function WorkSchedulePage() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [banner, setBanner] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState("");
  const [addToGroup, setAddToGroup] = useState(null);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWorkSchedules();
      setSchedules(data);
    } catch {
      setBanner({ type: "error", text: "Impossible de charger les horaires." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(t);
  }, [banner]);

  const groups = useMemo(() => groupSchedules(schedules), [schedules]);

const filteredGroups = useMemo(() => {
  const q = search.trim().toLowerCase();
  if (!q) return groups;

  const result = [];
  for (const g of groups) {
    const groupMatches = g.label.toLowerCase().includes(q);
    if (groupMatches) {
      result.push(g);
      continue;
    }

    const matchingItems = g.items.filter((s) => {
      const name = (s.employee_name || s.target_label || "").toLowerCase();
      const matricule = (s.employee_matricule || "").toLowerCase();
      return name.includes(q) || matricule.includes(q);
    });

    if (matchingItems.length > 0) {
      result.push({ ...g, items: matchingItems });
    }
  }
  return result;
}, [groups, search]);

  const toggleGroup = (label) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleDelete = async (schedule) => {
    const ok = window.confirm(`Retirer cet horaire pour ${schedule.target_label} ?`);
    if (!ok) return;
    try {
      await deleteWorkSchedule(schedule.id);
      setBanner({ type: "success", text: "Horaire retiré." });
      loadSchedules();
    } catch {
      setBanner({ type: "error", text: "Suppression impossible." });
    }
  };

  const handleAssigned = () => {
    setBanner({ type: "success", text: "Horaire assigné avec succès." });
    loadSchedules();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-ink">Horaires personnalisés</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-sm bg-ink text-white rounded-md hover:bg-charcoal"
        >
          + Assigner un horaire
        </button>
      </div>

      {banner && (
        <div
          className={`mb-4 px-3 py-2 text-sm rounded-md border ${
            banner.type === "success"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer par nom d'horaire, employé ou matricule......"
          className="w-full pl-9 pr-3 py-2 text-sm border border-steel/30 rounded-md focus:outline-none focus:ring-1 focus:ring-charcoal"
        />
      </div>

      {loading && <p className="text-sm text-steel">Chargement...</p>}
      {!loading && filteredGroups.length === 0 && (
        <p className="text-sm text-steel">Aucun horaire trouvé.</p>
      )}

      <div className="space-y-3">
        {filteredGroups.map((group) => {
          const isOpen = expanded[group.label] ?? true;
          const activeCount = group.items.filter((i) => i.is_active).length;

          return (
            <div key={group.label} className="bg-white border border-steel/20 rounded-md overflow-hidden">
              <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-charcoal/5">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="font-semibold text-ink">{group.label}</span>
                  <span className="text-xs text-steel">
                    {group.standard_start}–{group.standard_end}
                  </span>
                </button>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-steel">{group.items.length} employé(s)</span>
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">
                    {activeCount} actif(s)
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddToGroup(group); }}
                    className="px-2 py-1 rounded border border-steel/30 text-ink hover:bg-charcoal/5"
                  >
                    + Ajouter employés
                  </button>
                </div>
              </div>

{isOpen && (
  <table className="w-full text-sm border-t border-steel/10">
    <thead className="bg-charcoal/5 text-left text-steel">
      <tr>
        <th className="px-4 py-2">Employé</th>
        <th className="px-4 py-2">Début</th>
        <th className="px-4 py-2">Fin</th>
        <th className="px-4 py-2">Validité</th>
        <th className="px-4 py-2"></th>
      </tr>
    </thead>
    <tbody>
      {group.items.map((s) => (
        <tr key={s.id} className="border-t border-steel/10">
          <td className="px-4 py-2">{s.target_label}</td>
          <td className="px-4 py-2">{s.standard_start}</td>
          <td className="px-4 py-2">{s.standard_end}</td>
          <td className="px-4 py-2 text-xs text-steel">
            {formatValidity(s.valid_from, s.valid_until)}
          </td>
          <td className="px-4 py-2 text-right">
            <button onClick={() => handleDelete(s)} className="text-xs text-red-600 hover:underline">
              Supprimer
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)}
            </div>
          );
        })}
      </div>

      {showModal && (
        <AssignScheduleModal
          onClose={() => setShowModal(false)}
          onAssigned={handleAssigned}
        />
      )}

      {addToGroup && (
        <AssignScheduleModal
          onClose={() => setAddToGroup(null)}
          onAssigned={() => { setAddToGroup(null); handleAssigned(); }}
          prefill={{
            name: addToGroup.label,
            standard_start: addToGroup.standard_start,
            standard_end: addToGroup.standard_end,
            early_leave_limit: addToGroup.early_leave_limit,
            standard_work_hours: addToGroup.standard_work_hours,
            overtime_threshold_hours: addToGroup.overtime_threshold_hours,
          }}
          excludeIds={addToGroup.items.map((i) => i.employee).filter(Boolean)}
        />
      )}
    </div>
  );
}