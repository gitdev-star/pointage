import React, { useState, useEffect, useRef } from "react";
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, FormControl, InputLabel, Select, MenuItem, Grid,
} from "@mui/material";
import hrClient from "../../../api/hrClient";

const EMPTY_FORM = {
  employee: "", leave_type: "", start_date: "", end_date: "",
  days_requested: "", reason: "",
};

function EmpSearchLeave({ value, onChange, error }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const debounceRef = useRef(null);

  const search = (val) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val || val.length < 1) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await hrClient.get(`employees/?search=${encodeURIComponent(val)}&page_size=30&status=ACTIVE`);
        setResults(r.data.results ?? r.data);
      }catch (err) {
  console.error("Erreur recherche employé:", err.response?.data || err);
  setResults([]);
}
      finally { setLoading(false); }
    }, 300);
  };

  const inputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: `1px solid ${error ? "#d32f2f" : "#e0e0e0"}`,
    fontSize: 13, boxSizing: "border-box", outline: "none",
    background: value ? "#f0f7ff" : "#fff", color: "#212121",
    fontFamily: "inherit",
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        placeholder="Rechercher nom, prénom ou matricule…"
        value={selectedLabel || q}
        onChange={(e) => {
          const v = e.target.value;
          setQ(v); setSelectedLabel(""); onChange(""); setOpen(true); search(v);
        }}
        onFocus={() => { setOpen(true); if (q) search(q); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={inputStyle}
      />
      {value && (
        <button type="button"
          onClick={() => { onChange(""); setQ(""); setSelectedLabel(""); setResults([]); }}
          style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            border: "none", background: "none", cursor: "pointer", color: "#9e9e9e", fontSize: 18,
          }}>×</button>
      )}
      {open && (loading || results.length > 0) && (
        <div style={{
          position: "absolute", zIndex: 9999, background: "#fff",
          border: "1px solid #e0e0e0", borderRadius: 8, width: "100%",
          maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          top: "100%", marginTop: 2,
        }}>
          {loading && <div style={{ padding: "10px 12px", fontSize: 13, color: "#9e9e9e" }}>Recherche…</div>}
          {!loading && results.map((e) => (
            <div key={e.id}
              onMouseDown={() => {
                onChange(String(e.id));
                setSelectedLabel(`${e.last_name} ${e.first_name}${e.employee_id ? " — " + e.employee_id : ""}`);
                setQ(""); setOpen(false);
              }}
              style={{
                padding: "8px 12px", fontSize: 13, cursor: "pointer",
                borderBottom: "1px solid #f5f5f5",
                background: String(e.id) === String(value) ? "#e3f2fd" : "#fff",
              }}
            >
              <strong>{e.last_name} {e.first_name}</strong>
              {e.employee_id && <span style={{ color: "#9e9e9e", marginLeft: 8 }}>{e.employee_id}</span>}
            </div>
          ))}
        </div>
      )}
      {open && !loading && q.length >= 1 && results.length === 0 && (
        <div style={{
          position: "absolute", zIndex: 9999, background: "#fff",
          border: "1px solid #e0e0e0", borderRadius: 8, width: "100%",
          padding: "10px 12px", fontSize: 13, color: "#9e9e9e", top: "100%", marginTop: 2,
        }}>Aucun résultat pour "{q}"</div>
      )}
      {!value && !open && (
        <div style={{ fontSize: 11, color: "#9e9e9e", marginTop: 3 }}>
          Tapez pour rechercher parmi tous les employés actifs
        </div>
      )}
    </div>
  );
}

export default function EvenementModal({ open, onClose, leaveTypes, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Reset au fermeture
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setFormErrors({});
    }
  }, [open]);

  // Calcul automatique des jours
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

  const handleSave = async () => {
    const errors = {};
    if (!form.employee)       errors.employee       = "Requis";
    if (!form.leave_type)     errors.leave_type     = "Requis";
    if (!form.start_date)     errors.start_date     = "Requis";
    if (!form.end_date)       errors.end_date       = "Requis";
    if (!form.days_requested) errors.days_requested = "Requis";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") setFormErrors(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Nouvel événement</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={12}>
            <Typography variant="caption"
              color={formErrors.employee ? "error" : "text.secondary"}
              sx={{ mb: 0.5, display: "block" }}>
              Employé *
            </Typography>
            <EmpSearchLeave
              value={form.employee}
              onChange={(id) => setForm((p) => ({ ...p, employee: id }))}
              error={!!formErrors.employee}
            />
            {formErrors.employee && (
              <Typography variant="caption" color="error">{formErrors.employee}</Typography>
            )}
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth size="small" error={!!formErrors.leave_type}>
              <InputLabel>Type d'événement *</InputLabel>
              <Select value={form.leave_type} label="Type d'événement *"
                onChange={(e) => setForm((p) => ({ ...p, leave_type: e.target.value }))}>
                {leaveTypes.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: t.color, flexShrink: 0 }} />
                      {t.name} ({t.days_per_year > 0 ? `${t.days_per_year}j/an` : "illimité"})
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              {formErrors.leave_type && (
                <Typography variant="caption" color="error">{formErrors.leave_type}</Typography>
              )}
            </FormControl>
          </Grid>

          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Date début *" type="date"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              error={!!formErrors.start_date} helperText={formErrors.start_date}
              InputLabelProps={{ shrink: true }} />
          </Grid>

          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Date fin *" type="date"
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
              error={!!formErrors.end_date} helperText={formErrors.end_date}
              InputLabelProps={{ shrink: true }} />
          </Grid>

          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Jours demandés *" type="number"
              value={form.days_requested}
              onChange={(e) => setForm((p) => ({ ...p, days_requested: e.target.value }))}
              error={!!formErrors.days_requested}
              helperText={formErrors.days_requested || "Calculé automatiquement"} />
          </Grid>

          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Motif" multiline rows={2}
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement..." : "Créer l'événement"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}