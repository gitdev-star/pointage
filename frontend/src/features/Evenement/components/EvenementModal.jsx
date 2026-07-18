import React, { useState, useEffect } from "react";
import EmployeeSearch from "./EmployeSearch";

const EMPTY_FORM = {
  employee: "", leave_type: "", start_date: "", end_date: "",
  days_requested: "", duration_hours: "", reason: "",
};

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: '#616161', marginBottom: 4 };
const inputSt = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #e0e0e0', fontSize: 13, boxSizing: 'border-box',
  outline: 'none', background: '#fff', color: '#212121', fontFamily: 'inherit',
};
const errorSt = { fontSize: 11, color: '#d32f2f', marginTop: 3 };
const helperSt = { fontSize: 11, color: '#9e9e9e', marginTop: 3 };

export default function EvenementModal({ open, onClose, leaveTypes, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const selectedType = leaveTypes.find((t) => t.id === form.leave_type);
  const isHourly = selectedType?.code === "PM";

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setFormErrors({});
    }
  }, [open]);

  useEffect(() => {
    if (form.start_date && form.end_date) {
      const start = new Date(form.start_date);
      const end = new Date(form.end_date);
      if (end >= start) {
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        setForm((p) => ({ ...p, days_requested: days }));
      }
    }
  }, [form.start_date, form.end_date]);

  useEffect(() => {
    if (isHourly && form.start_date) {
      setForm((p) => ({ ...p, end_date: p.start_date, days_requested: 1 }));
    }
  }, [isHourly, form.start_date]);

  const handleSave = async () => {
    const errors = {};
    if (!form.employee)       errors.employee       = "Requis";
    if (!form.leave_type)     errors.leave_type     = "Requis";
    if (!form.start_date)     errors.start_date     = "Requis";
    if (!form.end_date)       errors.end_date       = "Requis";
    if (!form.days_requested) errors.days_requested = "Requis";
    if (isHourly && !form.duration_hours) errors.duration_hours = "Requis pour une permission en heure";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload = { ...form };
      if (!isHourly) delete payload.duration_hours;
      await onSave(payload);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") setFormErrors(data);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '28px 32px',
        width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 20px', color: '#212121' }}>
          Nouvel événement
        </h2>

        {/* Employé */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Employé *</label>
          <EmployeeSearch
            value={form.employee}
            onChange={(id) => setForm((p) => ({ ...p, employee: id }))}
            error={!!formErrors.employee}
          />
          {formErrors.employee && <div style={errorSt}>{formErrors.employee}</div>}
        </div>

        {/* Type d'événement */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Type d'événement *</label>
          <select
            value={form.leave_type}
            onChange={(e) => setForm((p) => ({ ...p, leave_type: Number(e.target.value) || "" }))}
            style={{ ...inputSt, border: formErrors.leave_type ? '1px solid #d32f2f' : inputSt.border }}
          >
            <option value="">-- Sélectionner --</option>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.days_per_year > 0 ? `${t.days_per_year}j/an` : "illimité"})
              </option>
            ))}
          </select>
          {formErrors.leave_type && <div style={errorSt}>{formErrors.leave_type}</div>}
        </div>

        {/* Dates */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isHourly ? '1fr' : '1fr 1fr',
          gap: 12, marginBottom: 14,
        }}>
          <div>
            <label style={labelSt}>{isHourly ? "Date *" : "Date début *"}</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({
                ...p,
                start_date: e.target.value,
                ...(isHourly ? { end_date: e.target.value } : {}),
              }))}
              style={{ ...inputSt, border: formErrors.start_date ? '1px solid #d32f2f' : inputSt.border }}
            />
            {formErrors.start_date && <div style={errorSt}>{formErrors.start_date}</div>}
          </div>

          {!isHourly && (
            <div>
              <label style={labelSt}>Date fin *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                style={{ ...inputSt, border: formErrors.end_date ? '1px solid #d32f2f' : inputSt.border }}
              />
              {formErrors.end_date && <div style={errorSt}>{formErrors.end_date}</div>}
            </div>
          )}
        </div>

        {/* Durée */}
        <div style={{ marginBottom: 14 }}>
          {isHourly ? (
            <>
              <label style={labelSt}>Durée (heures) *</label>
              <input
                type="number"
                step={0.5}
                min={0.5}
                value={form.duration_hours}
                onChange={(e) => setForm((p) => ({ ...p, duration_hours: e.target.value }))}
                style={{ ...inputSt, border: formErrors.duration_hours ? '1px solid #d32f2f' : inputSt.border }}
              />
              <div style={formErrors.duration_hours ? errorSt : helperSt}>
                {formErrors.duration_hours || "Ex: 2 pour 2 heures"}
              </div>
            </>
          ) : (
            <>
              <label style={labelSt}>Jours demandés *</label>
              <input
                type="number"
                value={form.days_requested}
                onChange={(e) => setForm((p) => ({ ...p, days_requested: e.target.value }))}
                style={{ ...inputSt, border: formErrors.days_requested ? '1px solid #d32f2f' : inputSt.border }}
              />
              <div style={formErrors.days_requested ? errorSt : helperSt}>
                {formErrors.days_requested || "Calculé automatiquement"}
              </div>
            </>
          )}
        </div>

        {/* Motif */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Motif</label>
          <textarea
            rows={3}
            value={form.reason}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            style={{ ...inputSt, resize: 'vertical' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 8, border: '1px solid #e0e0e0',
              background: '#fafafa', fontSize: 13, cursor: 'pointer', color: '#424242',
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#1976d2', color: '#fff', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Enregistrement..." : "Créer l'événement"}
          </button>
        </div>
      </div>
    </div>
  );
}