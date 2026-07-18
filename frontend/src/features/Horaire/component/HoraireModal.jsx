// features/WorkSchedule/components/AssignScheduleModal.jsx
import React, { useState, useEffect } from "react";
import EmployeePicker from "../component/EmployeList";
import { assignWorkSchedule } from "../api/workSchedule";
import hrClient from "../../../api/hrClient";

const initialForm = {
  name: "",
  description: "",
  standard_start: "07:30",
  standard_end: "16:30",
  early_leave_limit: "16:27",
  standard_work_hours: 8,
  overtime_threshold_hours: 8.5,
  valid_from: "",
  valid_until: "",
};

function calcHours(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (diffMinutes < 0) diffMinutes += 24 * 60;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

export default function AssignScheduleModal({ onClose, onAssigned, prefill = null, excludeIds = [] }) {
  const isAddMode = !!prefill;
  const [form, setForm] = useState(prefill ? { ...initialForm, ...prefill } : initialForm);
  const [employeeIds, setEmployeeIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const restrictToFemale = form.name.trim().toLowerCase().includes("allaitement");

  useEffect(() => {
    if (!restrictToFemale || employeeIds.length === 0) return;
    let active = true;
    hrClient
      .get("employees/", { params: { status: "ACTIVE", page_size: 5000 } })
      .then(({ data }) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : data.results || [];
        const femaleIds = new Set(
          list.filter((e) => (e.sexe || "").trim().toLowerCase().startsWith("f")).map((e) => e.id)
        );
        setEmployeeIds((prev) => prev.filter((id) => femaleIds.has(id)));
      })
      .catch(() => {});
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restrictToFemale]);

  // Calcul automatique des heures — désactivé en mode "ajouter" puisque
  // les horaires sont déjà fixés par le groupe existant et non modifiables.
  useEffect(() => {
    if (isAddMode) return;
    const hours = calcHours(form.standard_start, form.standard_end);
    if (hours === null) return;
    setForm((prev) => ({
      ...prev,
      standard_work_hours: hours,
      overtime_threshold_hours: Math.round((hours + 0.5) * 100) / 100,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.standard_start, form.standard_end, isAddMode]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (employeeIds.length === 0) {
      setError("Choisissez au moins un employé.");
      return;
    }

    const ok = window.confirm(
      isAddMode
        ? `Ajouter ${employeeIds.length} employé(s) à l'horaire "${form.name}" ?`
        : `Assigner cet horaire à ${employeeIds.length} employé(s) ?`
    );
    if (!ok) return;

    setSubmitting(true);
    try {
      await assignWorkSchedule({
        ...form,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        employee_ids: employeeIds,
      });
      onAssigned?.();
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.detail
        || Object.values(err?.response?.data || {}).flat().join(" ")
        || "Une erreur est survenue.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-steel/20">
          <h3 className="font-bold text-ink">
            {isAddMode ? `Ajouter des employés — ${prefill.name}` : "Assigner un horaire"}
          </h3>
          <button onClick={onClose} className="text-steel hover:text-ink">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {isAddMode && (
            <div className="px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
              Les horaires de cet horaire sont fixés et ne peuvent pas être modifiés ici.
              Sélectionnez simplement les nouveaux employés à ajouter.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Nom de l'horaire</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={handleChange("name")}
              placeholder="ex: Maternité, Équipe après-midi..."
              readOnly={isAddMode}
              disabled={isAddMode}
              className={`w-full px-3 py-2 text-sm border border-steel/30 rounded-md ${isAddMode ? "bg-charcoal/5 text-steel cursor-not-allowed" : ""}`}
            />
          </div>

          {!isAddMode && (
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={handleChange("description")}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-steel/30 rounded-md"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Début</label>
              <input type="time" required value={form.standard_start} onChange={handleChange("standard_start")} readOnly={isAddMode} disabled={isAddMode} className={`w-full px-3 py-2 text-sm border border-steel/30 rounded-md ${isAddMode ? "bg-charcoal/5 text-steel cursor-not-allowed" : ""}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Fin</label>
              <input type="time" required value={form.standard_end} onChange={handleChange("standard_end")} readOnly={isAddMode} disabled={isAddMode} className={`w-full px-3 py-2 text-sm border border-steel/30 rounded-md ${isAddMode ? "bg-charcoal/5 text-steel cursor-not-allowed" : ""}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Limite départ anticipé</label>
              <input type="time" required value={form.early_leave_limit} onChange={handleChange("early_leave_limit")} readOnly={isAddMode} disabled={isAddMode} className={`w-full px-3 py-2 text-sm border border-steel/30 rounded-md ${isAddMode ? "bg-charcoal/5 text-steel cursor-not-allowed" : ""}`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Heures de travail standard {!isAddMode && <span className="text-steel font-normal">(calculé)</span>}
              </label>
              <input type="number" step="0.5" value={form.standard_work_hours} readOnly disabled className="w-full px-3 py-2 text-sm border border-steel/30 rounded-md bg-charcoal/5 text-steel cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Seuil heures sup. {!isAddMode && <span className="text-steel font-normal">(+30min)</span>}
              </label>
              <input type="number" step="0.5" value={form.overtime_threshold_hours} readOnly disabled className="w-full px-3 py-2 text-sm border border-steel/30 rounded-md bg-charcoal/5 text-steel cursor-not-allowed" />
            </div>
          </div>

          {isAddMode && (
            <p className="text-xs text-steel -mt-2">
              Chaque employé ajouté peut avoir sa propre période de validité (ex: dates de congé maternité différentes).
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Valide à partir de</label>
              <input type="date" value={form.valid_from} onChange={handleChange("valid_from")} className="w-full px-3 py-2 text-sm border border-steel/30 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Valide jusqu'à</label>
              <input type="date" value={form.valid_until} onChange={handleChange("valid_until")} className="w-full px-3 py-2 text-sm border border-steel/30 rounded-md" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Employés</label>
            <EmployeePicker
              selectedIds={employeeIds}
              onChange={setEmployeeIds}
              restrictToFemale={restrictToFemale}
              excludeIds={excludeIds}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-steel/40 rounded-md hover:bg-charcoal/5">
              Annuler
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-ink text-white rounded-md hover:bg-charcoal disabled:opacity-50">
              {submitting ? "Enregistrement..." : (isAddMode ? "Ajouter" : "Assigner")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}