// =====================================================
// PATH: pointage/frontend/src/components/hr/WorkSchedules.js
// =====================================================

import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Grid,
  Alert, CircularProgress, Divider, Switch, FormControlLabel,
  InputAdornment, TablePagination, Autocomplete,
} from "@mui/material";
import AddIcon          from "@mui/icons-material/Add";
import EditIcon         from "@mui/icons-material/Edit";
import DeleteIcon       from "@mui/icons-material/Delete";
import RefreshIcon      from "@mui/icons-material/Refresh";
import SearchIcon       from "@mui/icons-material/Search";
import ScheduleIcon     from "@mui/icons-material/Schedule";
import PersonIcon       from "@mui/icons-material/Person";
import ApartmentIcon    from "@mui/icons-material/Apartment";
import GroupsIcon       from "@mui/icons-material/Groups";
import AccessTimeIcon   from "@mui/icons-material/AccessTime";
import hrClient from "../../api/hrClient";
import { useHRAuth } from "../../contexts/HRAuthContext";

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (t) => (t || "").slice(0, 5);

const EMPTY_FORM = {
  name: "", description: "",
  employee: "", department: "", section: "",
  work_start: "07:40", early_leave_limit: "16:27",
  standard_start: "07:30", standard_end: "16:30",
  lunch_start: "12:00", lunch_end: "13:00",
  standard_work_hours: 8.0, overtime_threshold_hours: 8.5,
  valid_from: "", valid_until: "",
  is_active: true,
};

const PRESETS = [
  {
    label: "Journée standard",
    values: { work_start:"07:40", early_leave_limit:"16:27", standard_start:"07:30", standard_end:"16:30", lunch_start:"12:00", lunch_end:"13:00", standard_work_hours:8.0, overtime_threshold_hours:8.5 },
  },
  {
    label: "Poste matin (6h–14h)",
    values: { work_start:"06:10", early_leave_limit:"13:50", standard_start:"06:00", standard_end:"14:00", lunch_start:"10:00", lunch_end:"10:30", standard_work_hours:7.5, overtime_threshold_hours:8.0 },
  },
  {
    label: "Poste après-midi (14h–22h)",
    values: { work_start:"14:10", early_leave_limit:"21:50", standard_start:"14:00", standard_end:"22:00", lunch_start:"18:00", lunch_end:"18:30", standard_work_hours:7.5, overtime_threshold_hours:8.0 },
  },
  {
    label: "Demi-journée matin",
    values: { work_start:"07:40", early_leave_limit:"11:50", standard_start:"07:30", standard_end:"12:00", lunch_start:"00:00", lunch_end:"00:00", standard_work_hours:4.0, overtime_threshold_hours:4.5 },
  },
  {
    label: "Horaire flexible (9h–17h)",
    values: { work_start:"09:10", early_leave_limit:"16:50", standard_start:"09:00", standard_end:"17:00", lunch_start:"12:30", lunch_end:"13:30", standard_work_hours:7.0, overtime_threshold_hours:7.5 },
  },
  {
    label: "Allaitement (départ à 15h30)",
    values: { work_start:"07:40", early_leave_limit:"15:27", standard_start:"07:30", standard_end:"15:30", lunch_start:"12:00", lunch_end:"13:00", standard_work_hours:7.0, overtime_threshold_hours:7.5 },
  },
];

// ── Target badge ───────────────────────────────────────────────────────────
const TargetBadge = ({ schedule }) => {
  if (schedule.employee_name) return (
    <Chip icon={<PersonIcon sx={{ fontSize: "14px !important" }} />}
      label={schedule.employee_name} size="small" color="primary" variant="outlined" />
  );
  if (schedule.section_name) return (
    <Chip icon={<GroupsIcon sx={{ fontSize: "14px !important" }} />}
      label={schedule.section_name} size="small" color="secondary" variant="outlined" />
  );
  if (schedule.department_name) return (
    <Chip icon={<ApartmentIcon sx={{ fontSize: "14px !important" }} />}
      label={schedule.department_name} size="small" color="warning" variant="outlined" />
  );
  return <Chip label="Modèle global" size="small" variant="outlined" />;
};

// ── Main component ─────────────────────────────────────────────────────────
export default function WorkSchedules() {
  const { can } = useHRAuth();

  const [schedules, setSchedules]   = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [departments, setDepts]     = useState([]);
  const [sections, setSections]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);
  const [rowsPerPage, setRPP]       = useState(20);
  const [search, setSearch]         = useState("");
  const [alert, setAlert]           = useState(null);
  const [modalOpen, setModal]       = useState(false);
  const [mode, setMode]             = useState("add");
  const [form, setForm]             = useState(EMPTY_FORM);
  const [errors, setErrors]         = useState({});
  const [saving, setSaving]         = useState(false);
  const [deleteDialog, setDel]      = useState(null);
  const [deleting, setDeleting]     = useState(false);
  const [assignLevel, setAssignLevel] = useState("employee"); // employee | section | department

  // filtered sections by department
  const filteredSections = form.department
    ? sections.filter(s => String(s.department) === String(form.department))
    : sections;

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, page_size: rowsPerPage };
      if (search) params.search = search;
      const r = await hrClient.get("employees/work-schedules/", { params });
      setSchedules(r.data.results || r.data);
      setTotal(r.data.count || 0);
    } catch { } finally { setLoading(false); }
  }, [page, rowsPerPage, search]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  useEffect(() => {
    hrClient.get("employees/?page_size=500&status=ACTIVE").then(r => setEmployees(r.data.results || r.data)).catch(() => {});
    hrClient.get("employees/departments/?page_size=200").then(r => setDepts(r.data.results || r.data)).catch(() => {});
    hrClient.get("employees/sections/?page_size=300").then(r => setSections(r.data.results || r.data)).catch(() => {});
  }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM); setErrors({});
    setAssignLevel("employee"); setMode("add"); setModal(true);
  };

  const openEdit = (s) => {
    const level = s.employee ? "employee" : s.section ? "section" : s.department ? "department" : "employee";
    setAssignLevel(level);
    setForm({
      ...EMPTY_FORM, ...s,
      employee:   s.employee   || "",
      department: s.department || "",
      section:    s.section    || "",
      valid_from:  s.valid_from  || "",
      valid_until: s.valid_until || "",
    });
    setErrors({}); setMode("edit"); setModal(true);
  };

  const close = () => { setModal(false); setForm(EMPTY_FORM); setErrors({}); };

  const applyPreset = (preset) => {
    setForm(prev => ({ ...prev, ...preset.values, name: prev.name || preset.label }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())          e.name = "Requis";
    if (!form.work_start)           e.work_start = "Requis";
    if (!form.early_leave_limit)    e.early_leave_limit = "Requis";
    if (!form.standard_start)       e.standard_start = "Requis";
    if (!form.standard_end)         e.standard_end = "Requis";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      name:                    form.name,
      description:             form.description,
      work_start:              form.work_start,
      early_leave_limit:       form.early_leave_limit,
      standard_start:          form.standard_start,
      standard_end:            form.standard_end,
      lunch_start:             form.lunch_start,
      lunch_end:               form.lunch_end,
      standard_work_hours:     Number(form.standard_work_hours),
      overtime_threshold_hours:Number(form.overtime_threshold_hours),
      valid_from:              form.valid_from  || null,
      valid_until:             form.valid_until || null,
      is_active:               form.is_active,
      // only send the relevant level, null out the others
      employee:   assignLevel === "employee"   ? (form.employee   || null) : null,
      section:    assignLevel === "section"    ? (form.section    || null) : null,
      department: assignLevel === "department" ? (form.department || null) : null,
    };
    try {
      if (mode === "add") {
        await hrClient.post("employees/work-schedules/", payload);
        setAlert({ type: "success", msg: "Horaire créé avec succès." });
      } else {
        await hrClient.patch(`employees/work-schedules/${form.id}/`, payload);
        setAlert({ type: "success", msg: "Horaire mis à jour." });
      }
      close(); fetchSchedules();
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
      setAlert({ type: "success", msg: `Horaire "${deleteDialog.name}" supprimé.` });
      setDel(null); fetchSchedules();
    } catch { setAlert({ type: "error", msg: "Erreur lors de la suppression." }); }
    finally { setDeleting(false); }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2,
            background: "linear-gradient(135deg, #0891b2, #0e7490)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ScheduleIcon sx={{ color: "white", fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>
              Horaires de travail
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Définissez des horaires personnalisés par employé, section ou département
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Actualiser"><IconButton onClick={fetchSchedules}><RefreshIcon /></IconButton></Tooltip>
          {can("employees_write") && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
              Nouvel horaire
            </Button>
          )}
        </Box>
      </Box>

      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      {/* Info banner */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 2 }}>
        <Typography variant="body2" color="#0369a1">
          <strong>Priorité d'application :</strong> Employé &gt; Section &gt; Département &gt; Horaire par défaut (07:30–16:30).
          Si un employé a un horaire assigné directement, il prime sur celui de sa section ou département.
        </Typography>
      </Paper>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField size="small" placeholder="Rechercher un horaire..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }} sx={{ minWidth: 300 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      </Box>

      {/* Table */}
      <TableContainer component={Paper} elevation={2}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f8fafc" }}>
              <TableCell><strong>Nom</strong></TableCell>
              <TableCell><strong>Assigné à</strong></TableCell>
              <TableCell><strong>Début toléré</strong></TableCell>
              <TableCell><strong>Départ min.</strong></TableCell>
              <TableCell><strong>Pause déjeuner</strong></TableCell>
              <TableCell><strong>H/jour</strong></TableCell>
              <TableCell><strong>Validité</strong></TableCell>
              <TableCell><strong>Statut</strong></TableCell>
              {can("employees_write") && <TableCell><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  Aucun horaire personnalisé — tous les employés utilisent l'horaire par défaut (07:30)
                </TableCell>
              </TableRow>
            ) : schedules.map(s => (
              <TableRow key={s.id} hover sx={{ opacity: s.is_active ? 1 : 0.5 }}>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{
                      width: 34, height: 34, borderRadius: 2,
                      backgroundColor: "#0891b222",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <AccessTimeIcon sx={{ color: "#0891b2", fontSize: 18 }} />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{s.name}</Typography>
                      {s.description && (
                        <Typography variant="caption" color="text.secondary">{s.description}</Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell><TargetBadge schedule={s} /></TableCell>
                <TableCell>
                  <Chip label={fmt(s.work_start)} size="small"
                    sx={{ fontFamily: "monospace", fontWeight: 700, backgroundColor: "#fef3c7", color: "#92400e" }} />
                </TableCell>
                <TableCell>
                  <Chip label={fmt(s.early_leave_limit)} size="small"
                    sx={{ fontFamily: "monospace", fontWeight: 700, backgroundColor: "#fee2e2", color: "#991b1b" }} />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                    {fmt(s.lunch_start)} – {fmt(s.lunch_end)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{s.standard_work_hours}h</Typography>
                </TableCell>
                <TableCell>
                  {s.valid_from || s.valid_until ? (
                    <Box>
                      {s.valid_from  && <Typography variant="caption" display="block">Dès: {s.valid_from}</Typography>}
                      {s.valid_until && <Typography variant="caption" display="block" color="warning.main">Jusqu'au: {s.valid_until}</Typography>}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.disabled">Illimitée</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Box sx={{
                      width: 8, height: 8, borderRadius: "50%",
                      backgroundColor: s.is_active ? "#22c55e" : "#94a3b8",
                    }} />
                    <Typography variant="caption" color={s.is_active ? "success.main" : "text.disabled"}>
                      {s.is_active ? "Actif" : "Inactif"}
                    </Typography>
                  </Box>
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

      <TablePagination component="div" count={total} page={page}
        onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
        onRowsPerPageChange={e => { setRPP(parseInt(e.target.value)); setPage(0); }}
        rowsPerPageOptions={[10, 20, 50]} labelRowsPerPage="Lignes par page"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`} />

      {/* Add/Edit Dialog */}
      <Dialog open={modalOpen} onClose={close} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>
          {mode === "add" ? "➕ Nouvel horaire de travail" : "✏️ Modifier l'horaire"}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>

            {/* Name + presets */}
            <Grid item xs={12}>
              <Divider><Typography variant="caption" color="text.secondary">Identification</Typography></Divider>
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField fullWidth size="small" label="Nom de l'horaire *"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                error={!!errors.name} helperText={errors.name}
                placeholder="ex: Poste matin, Allaitement, Flex manager..." />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Appliquer un preset</InputLabel>
                <Select value="" label="Appliquer un preset"
                  onChange={e => { const p = PRESETS.find(x => x.label === e.target.value); if (p) applyPreset(p); }}>
                  {PRESETS.map(p => <MenuItem key={p.label} value={p.label}>{p.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Description / Motif"
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="ex: Horaire allaitement accordé jusqu'au 6 mois de l'enfant" />
            </Grid>

            {/* Assignment level */}
            <Grid item xs={12}>
              <Divider><Typography variant="caption" color="text.secondary">Assigner à</Typography></Divider>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: "flex", gap: 1 }}>
                {[
                  { value: "employee",   label: "Un employé",    icon: <PersonIcon sx={{ fontSize: 16 }} /> },
                  { value: "section",    label: "Une section",   icon: <GroupsIcon sx={{ fontSize: 16 }} /> },
                  { value: "department", label: "Un département",icon: <ApartmentIcon sx={{ fontSize: 16 }} /> },
                ].map(opt => (
                  <Chip key={opt.value} icon={opt.icon} label={opt.label}
                    onClick={() => {
                      setAssignLevel(opt.value);
                      setForm(p => ({ ...p, employee: "", section: "", department: "" }));
                    }}
                    sx={{
                      cursor: "pointer",
                      backgroundColor: assignLevel === opt.value ? "#0891b2" : "transparent",
                      color: assignLevel === opt.value ? "white" : "text.secondary",
                      border: `2px solid ${assignLevel === opt.value ? "#0891b2" : "#e2e8f0"}`,
                      fontWeight: assignLevel === opt.value ? 700 : 400,
                      "& .MuiChip-icon": { color: assignLevel === opt.value ? "white" : "inherit" },
                    }}
                  />
                ))}
              </Box>
            </Grid>

            {/* Employee selector */}
            {assignLevel === "employee" && (
              <Grid item xs={12}>
                <Autocomplete
                  options={employees}
                  getOptionLabel={e => `${e.last_name} ${e.first_name} (${e.employee_id})`}
                  value={employees.find(e => e.id === form.employee) || null}
                  onChange={(_, v) => setForm(p => ({ ...p, employee: v?.id || "" }))}
                  renderInput={(params) => (
                    <TextField {...params} size="small" label="Employé *"
                      error={!!errors.employee} helperText={errors.employee} />
                  )}
                />
              </Grid>
            )}

            {/* Department selector */}
            {assignLevel === "department" && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small" error={!!errors.department}>
                  <InputLabel>Département *</InputLabel>
                  <Select value={form.department} label="Département *"
                    onChange={e => setForm(p => ({ ...p, department: e.target.value, section: "" }))}>
                    {departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </Select>
                  {errors.department && <Typography variant="caption" color="error">{errors.department}</Typography>}
                </FormControl>
              </Grid>
            )}

            {/* Section selector */}
            {assignLevel === "section" && (
              <>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Département (filtre)</InputLabel>
                    <Select value={form.department} label="Département (filtre)"
                      onChange={e => setForm(p => ({ ...p, department: e.target.value, section: "" }))}>
                      <MenuItem value="">Tous</MenuItem>
                      {departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small" error={!!errors.section}>
                    <InputLabel>Section *</InputLabel>
                    <Select value={form.section} label="Section *"
                      onChange={e => setForm(p => ({ ...p, section: e.target.value }))}>
                      {filteredSections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </Select>
                    {errors.section && <Typography variant="caption" color="error">{errors.section}</Typography>}
                  </FormControl>
                </Grid>
              </>
            )}

            {/* Time settings */}
            <Grid item xs={12}>
              <Divider><Typography variant="caption" color="text.secondary">Horaires</Typography></Divider>
            </Grid>

            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Heure de début officielle" type="time"
                value={form.standard_start}
                onChange={e => setForm(p => ({ ...p, standard_start: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                helperText="Début de journée" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Tolérance retard *" type="time"
                value={form.work_start}
                onChange={e => setForm(p => ({ ...p, work_start: e.target.value }))}
                error={!!errors.work_start} helperText={errors.work_start || "Retard si arrivée après"}
                InputLabelProps={{ shrink: true }}
                sx={{ "& .MuiInputBase-root": { backgroundColor: "#fffbeb" } }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Fin de journée officielle" type="time"
                value={form.standard_end}
                onChange={e => setForm(p => ({ ...p, standard_end: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                helperText="Fin de journée" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Départ anticipé si avant *" type="time"
                value={form.early_leave_limit}
                onChange={e => setForm(p => ({ ...p, early_leave_limit: e.target.value }))}
                error={!!errors.early_leave_limit}
                helperText={errors.early_leave_limit || "Départ tôt si avant"}
                InputLabelProps={{ shrink: true }}
                sx={{ "& .MuiInputBase-root": { backgroundColor: "#fff1f2" } }} />
            </Grid>

            <Grid item xs={12}>
              <Divider><Typography variant="caption" color="text.secondary">Pause déjeuner</Typography></Divider>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Début pause" type="time"
                value={form.lunch_start}
                onChange={e => setForm(p => ({ ...p, lunch_start: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Fin pause" type="time"
                value={form.lunch_end}
                onChange={e => setForm(p => ({ ...p, lunch_end: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Heures/jour standard" type="number"
                inputProps={{ step: 0.5, min: 1, max: 12 }}
                value={form.standard_work_hours}
                onChange={e => setForm(p => ({ ...p, standard_work_hours: e.target.value }))} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Seuil heures sup." type="number"
                inputProps={{ step: 0.5, min: 1, max: 12 }}
                value={form.overtime_threshold_hours}
                onChange={e => setForm(p => ({ ...p, overtime_threshold_hours: e.target.value }))}
                helperText="Heures au-delà = heures sup." />
            </Grid>

            {/* Validity */}
            <Grid item xs={12}>
              <Divider><Typography variant="caption" color="text.secondary">Validité (optionnel)</Typography></Divider>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Valide dès" type="date"
                value={form.valid_from}
                onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))}
                InputLabelProps={{ shrink: true }} helperText="Laisser vide = immédiatement" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Expire le" type="date"
                value={form.valid_until}
                onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))}
                InputLabelProps={{ shrink: true }} helperText="Laisser vide = pas de limite" />
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
            {saving ? "Enregistrement..." : mode === "add" ? "Créer" : "Enregistrer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteDialog} onClose={() => setDel(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>🗑️ Supprimer l'horaire</DialogTitle>
        <DialogContent>
          <Typography>
            Supprimer <strong>{deleteDialog?.name}</strong> ?
            Les employés concernés reviendront à l'horaire par défaut (07:30).
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
