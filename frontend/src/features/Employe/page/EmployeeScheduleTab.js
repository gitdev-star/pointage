// =====================================================
// PATH: pointage/frontend/src/components/hr/EmployeeScheduleTab.js
// Drop this as a tab inside EmployeeFiche.js
// =====================================================

import React, { useEffect, useState } from "react";
import {
  Box, Typography, Paper, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, Grid, Alert, CircularProgress, Divider,
  Switch, FormControlLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip,
} from "@mui/material";
import AddIcon        from "@mui/icons-material/Add";
import EditIcon       from "@mui/icons-material/Edit";
import DeleteIcon     from "@mui/icons-material/Delete";
import ScheduleIcon   from "@mui/icons-material/Schedule";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import hrClient from "../../../api/hrClient";
import { useHRAuth } from "../../../contexts/HRAuthContext";

const fmt = (t) => (t || "").slice(0, 5);

const PRESETS = [
  { label: "Journée standard",        values: { work_start:"07:40", early_leave_limit:"16:27", standard_start:"07:30", standard_end:"16:30", lunch_start:"12:00", lunch_end:"13:00", standard_work_hours:8.0, overtime_threshold_hours:8.5 } },
  { label: "Poste matin (6h–14h)",    values: { work_start:"06:10", early_leave_limit:"13:50", standard_start:"06:00", standard_end:"14:00", lunch_start:"10:00", lunch_end:"10:30", standard_work_hours:7.5, overtime_threshold_hours:8.0 } },
  { label: "Demi-journée matin",      values: { work_start:"07:40", early_leave_limit:"11:50", standard_start:"07:30", standard_end:"12:00", lunch_start:"00:00", lunch_end:"00:00", standard_work_hours:4.0, overtime_threshold_hours:4.5 } },
  { label: "Flex (9h–17h)",           values: { work_start:"09:10", early_leave_limit:"16:50", standard_start:"09:00", standard_end:"17:00", lunch_start:"12:30", lunch_end:"13:30", standard_work_hours:7.0, overtime_threshold_hours:7.5 } },
  { label: "Allaitement (→15h30)",    values: { work_start:"07:40", early_leave_limit:"15:27", standard_start:"07:30", standard_end:"15:30", lunch_start:"12:00", lunch_end:"13:00", standard_work_hours:7.0, overtime_threshold_hours:7.5 } },
];

const EMPTY_FORM = {
  name: "", description: "",
  work_start: "07:40", early_leave_limit: "16:27",
  standard_start: "07:30", standard_end: "16:30",
  lunch_start: "12:00", lunch_end: "13:00",
  standard_work_hours: 8.0, overtime_threshold_hours: 8.5,
  valid_from: "", valid_until: "",
  is_active: true,
};

// ── Main export ────────────────────────────────────────────────────────────
// Usage in EmployeeFiche:
//   import EmployeeScheduleTab from "./EmployeeScheduleTab";
//   ...
//   {activeTab === "schedule" && <EmployeeScheduleTab employeeId={employee.id} />}

export default function EmployeeScheduleTab({ employeeId }) {
  const { can } = useHRAuth();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [alert, setAlert]         = useState(null);
  const [modalOpen, setModal]     = useState(false);
  const [mode, setMode]           = useState("add");
  const [form, setForm]           = useState(EMPTY_FORM);
  const [errors, setErrors]       = useState({});
  const [saving, setSaving]       = useState(false);
  const [deleteDialog, setDel]    = useState(null);
  const [deleting, setDeleting]   = useState(false);

  // The active schedule = the most recent active one
  const activeSchedule = schedules.find(s => s.is_active) || null;

  const fetch = async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const r = await hrClient.get("employees/work-schedules/", {
        params: { employee: employeeId, page_size: 50 }
      });
      setSchedules(r.data.results || r.data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [employeeId]);

  const openAdd = () => { setForm(EMPTY_FORM); setErrors({}); setMode("add"); setModal(true); };
  const openEdit = (s) => {
    setForm({ ...EMPTY_FORM, ...s, valid_from: s.valid_from || "", valid_until: s.valid_until || "" });
    setErrors({}); setMode("edit"); setModal(true);
  };
  const close = () => { setModal(false); setForm(EMPTY_FORM); setErrors({}); };

  const applyPreset = (preset) => {
    setForm(prev => ({ ...prev, ...preset.values, name: prev.name || preset.label }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())       e.name = "Requis";
    if (!form.work_start)        e.work_start = "Requis";
    if (!form.early_leave_limit) e.early_leave_limit = "Requis";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      ...form,
      employee:                employeeId,
      department:              null,
      section:                 null,
      standard_work_hours:     Number(form.standard_work_hours),
      overtime_threshold_hours:Number(form.overtime_threshold_hours),
      valid_from:              form.valid_from  || null,
      valid_until:             form.valid_until || null,
    };
    try {
      if (mode === "add") {
        await hrClient.post("employees/work-schedules/", payload);
        setAlert({ type: "success", msg: "Horaire assigné à cet employé." });
      } else {
        await hrClient.patch(`employees/work-schedules/${form.id}/`, payload);
        setAlert({ type: "success", msg: "Horaire mis à jour." });
      }
      close(); fetch();
    } catch (err) {
      const d = err.response?.data;
      if (d && typeof d === "object") setErrors(d);
      else setAlert({ type: "error", msg: "Erreur lors de la sauvegarde." });
    } finally { setSaving(false); }
  };

  const del = async () => {
    setDeleting(true);
    try {
      await hrClient.delete(`employees/work-schedules/${deleteDialog.id}/`);
      setAlert({ type: "success", msg: "Horaire supprimé. L'employé revient à l'horaire par défaut." });
      setDel(null); fetch();
    } catch { setAlert({ type: "error", msg: "Erreur lors de la suppression." }); }
    finally { setDeleting(false); }
  };

  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box>
      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      {/* Active schedule summary card */}
      <Paper elevation={0} sx={{
        p: 2.5, mb: 3, borderRadius: 2,
        border: activeSchedule ? "1px solid #bbf7d0" : "1px dashed #cbd5e1",
        backgroundColor: activeSchedule ? "#f0fdf4" : "#f8fafc",
      }}>
        {activeSchedule ? (
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <CheckCircleIcon sx={{ color: "#22c55e", fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={700} color="success.dark">
                Horaire personnalisé actif : {activeSchedule.name}
              </Typography>
              {activeSchedule.valid_until && (
                <Chip label={`Expire le ${activeSchedule.valid_until}`} size="small" color="warning" />
              )}
            </Box>
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {[
                { label: "Tolérance retard", value: fmt(activeSchedule.work_start), color: "#92400e", bg: "#fef3c7" },
                { label: "Départ anticipé si avant", value: fmt(activeSchedule.early_leave_limit), color: "#991b1b", bg: "#fee2e2" },
                { label: "Journée", value: `${fmt(activeSchedule.standard_start)} – ${fmt(activeSchedule.standard_end)}`, color: "#1e40af", bg: "#eff6ff" },
                { label: "Pause", value: `${fmt(activeSchedule.lunch_start)} – ${fmt(activeSchedule.lunch_end)}`, color: "#065f46", bg: "#ecfdf5" },
                { label: "H/jour", value: `${activeSchedule.standard_work_hours}h`, color: "#4c1d95", bg: "#f5f3ff" },
              ].map(item => (
                <Box key={item.label} sx={{ textAlign: "center" }}>
                  <Box sx={{
                    px: 1.5, py: 0.5, borderRadius: 1.5,
                    backgroundColor: item.bg, color: item.color,
                    fontFamily: "monospace", fontWeight: 700, fontSize: 14,
                  }}>
                    {item.value}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <ScheduleIcon sx={{ color: "#94a3b8" }} />
            <Box>
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                Aucun horaire personnalisé
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Cet employé utilise l'horaire par défaut : arrivée tolérée jusqu'à 07:40, départ à partir de 16:27.
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Action button */}
      {can("employees_write") && (
        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={openAdd} size="small">
            Ajouter un horaire pour cet employé
          </Button>
        </Box>
      )}

      {/* History table */}
      {schedules.length > 0 && (
        <TableContainer component={Paper} elevation={1}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                <TableCell><strong>Nom</strong></TableCell>
                <TableCell><strong>Début toléré</strong></TableCell>
                <TableCell><strong>Départ min.</strong></TableCell>
                <TableCell><strong>H/jour</strong></TableCell>
                <TableCell><strong>Validité</strong></TableCell>
                <TableCell><strong>Statut</strong></TableCell>
                {can("employees_write") && <TableCell><strong>Actions</strong></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map(s => (
                <TableRow key={s.id} hover sx={{ opacity: s.is_active ? 1 : 0.5 }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={s.is_active ? 700 : 400}>{s.name}</Typography>
                    {s.description && <Typography variant="caption" color="text.secondary">{s.description}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip label={fmt(s.work_start)} size="small"
                      sx={{ fontFamily: "monospace", fontWeight: 700, backgroundColor: "#fef3c7", color: "#92400e" }} />
                  </TableCell>
                  <TableCell>
                    <Chip label={fmt(s.early_leave_limit)} size="small"
                      sx={{ fontFamily: "monospace", fontWeight: 700, backgroundColor: "#fee2e2", color: "#991b1b" }} />
                  </TableCell>
                  <TableCell>{s.standard_work_hours}h</TableCell>
                  <TableCell>
                    {s.valid_from || s.valid_until ? (
                      <Box>
                        {s.valid_from  && <Typography variant="caption" display="block">Dès: {s.valid_from}</Typography>}
                        {s.valid_until && <Typography variant="caption" display="block" color="warning.main">Jusqu'au: {s.valid_until}</Typography>}
                      </Box>
                    ) : <Typography variant="caption" color="text.disabled">Illimitée</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={s.is_active ? "Actif" : "Inactif"}
                      size="small"
                      color={s.is_active ? "success" : "default"}
                    />
                  </TableCell>
                  {can("employees_write") && (
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Tooltip title="Modifier">
                          <IconButton size="small" color="primary" onClick={() => openEdit(s)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer">
                          <IconButton size="small" color="error" onClick={() => setDel(s)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={modalOpen} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          {mode === "add" ? "➕ Assigner un horaire" : "✏️ Modifier l'horaire"}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={8}>
              <TextField fullWidth size="small" label="Nom *"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                error={!!errors.name} helperText={errors.name}
                placeholder="ex: Allaitement, Flex, Poste matin..." />
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Preset</InputLabel>
                <Select value="" label="Preset"
                  onChange={e => { const p = PRESETS.find(x => x.label === e.target.value); if (p) applyPreset(p); }}>
                  {PRESETS.map(p => <MenuItem key={p.label} value={p.label}>{p.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Description / Motif"
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <Divider><Typography variant="caption" color="text.secondary">Horaires</Typography></Divider>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Tolérance retard *" type="time"
                value={form.work_start} onChange={e => setForm(p => ({ ...p, work_start: e.target.value }))}
                error={!!errors.work_start} helperText={errors.work_start || "Retard si après cette heure"}
                InputLabelProps={{ shrink: true }}
                sx={{ "& .MuiInputBase-root": { backgroundColor: "#fffbeb" } }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Départ anticipé si avant *" type="time"
                value={form.early_leave_limit} onChange={e => setForm(p => ({ ...p, early_leave_limit: e.target.value }))}
                error={!!errors.early_leave_limit} helperText={errors.early_leave_limit || "Départ tôt si avant"}
                InputLabelProps={{ shrink: true }}
                sx={{ "& .MuiInputBase-root": { backgroundColor: "#fff1f2" } }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Début journée" type="time"
                value={form.standard_start} onChange={e => setForm(p => ({ ...p, standard_start: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Fin journée" type="time"
                value={form.standard_end} onChange={e => setForm(p => ({ ...p, standard_end: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Début pause" type="time"
                value={form.lunch_start} onChange={e => setForm(p => ({ ...p, lunch_start: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Fin pause" type="time"
                value={form.lunch_end} onChange={e => setForm(p => ({ ...p, lunch_end: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Heures/jour" type="number"
                inputProps={{ step: 0.5, min: 1, max: 12 }}
                value={form.standard_work_hours}
                onChange={e => setForm(p => ({ ...p, standard_work_hours: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Seuil heures sup." type="number"
                inputProps={{ step: 0.5, min: 1, max: 12 }}
                value={form.overtime_threshold_hours}
                onChange={e => setForm(p => ({ ...p, overtime_threshold_hours: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <Divider><Typography variant="caption" color="text.secondary">Validité</Typography></Divider>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Valide dès" type="date"
                value={form.valid_from} onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))}
                InputLabelProps={{ shrink: true }} helperText="Vide = immédiatement" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Expire le" type="date"
                value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))}
                InputLabelProps={{ shrink: true }} helperText="Vide = pas de limite" />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel control={
                <Switch checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
              } label="Horaire actif" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={close} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? "Enregistrement..." : mode === "add" ? "Assigner" : "Enregistrer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteDialog} onClose={() => setDel(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>🗑️ Supprimer l'horaire</DialogTitle>
        <DialogContent>
          <Typography>
            Supprimer <strong>{deleteDialog?.name}</strong> ?
            L'employé reviendra à l'horaire par défaut (07:30).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDel(null)} disabled={deleting}>Annuler</Button>
          <Button variant="contained" color="error" onClick={del} disabled={deleting}>
            {deleting ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
