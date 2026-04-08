import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, Alert, CircularProgress, Tabs, Tab, Tooltip,
  IconButton, Grid, Divider, InputAdornment, ListSubheader,
} from "@mui/material";
import AddIcon         from "@mui/icons-material/Add";
import EditIcon        from "@mui/icons-material/Edit";
import RefreshIcon     from "@mui/icons-material/Refresh";
import UploadFileIcon  from "@mui/icons-material/UploadFile";
import SearchIcon      from "@mui/icons-material/Search";
import hrClient        from "../../api/hrClient";
import { useHRAuth }   from "../../contexts/HRAuthContext";

const STATUS_COLORS   = { ACTIVE: "success", CLOSED: "default", CANCELLED: "error" };
const STATUS_LABELS   = { ACTIVE: "Actif",   CLOSED: "Clôturé", CANCELLED: "Annulé" };
const CATEGORY_LABELS = { ABSENCE: "Absence", LEAVE: "Congé", PERMISSION: "Permission", MEDICAL: "Médical", DEPARTURE: "Départ", OTHER: "Autre" };
const CATEGORY_COLORS = { ABSENCE: "error", LEAVE: "primary", PERMISSION: "warning", MEDICAL: "info", DEPARTURE: "default", OTHER: "secondary" };

const HOUR_BASED_CODES  = ["PERH"];
const NO_END_DATE_CODES = ["ABS"];
const DOC_REQUIRED_CODES = ["HOSP", "INAPT", "LIC", "DEM", "MAP"];

const TABS     = ["Tous", "Absence", "Permission", "Médical", "Départ", "Autre"];
const TAB_CATS = ["",     "ABSENCE", "PERMISSION", "MEDICAL", "DEPARTURE", "OTHER"];

const EMPTY_FORM = { employee: "", event_type: "", start_date: "", end_date: "", duration_hours: "", reason: "", status: "ACTIVE", note: "" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("fr-MG");
}

export default function HREvents() {
  const { can } = useHRAuth();

  const [tab, setTab]               = useState(0);
  const [events, setEvents]         = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [alert, setAlert]           = useState(null);
  const [dialog, setDialog]         = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [docFile, setDocFile]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [searchEmp, setSearchEmp]   = useState("");

  // Employee dropdown autocomplete
  const [empDropdownSearch, setEmpDropdownSearch] = useState("");
  const [empSearchLoading, setEmpSearchLoading]   = useState(false);
  const empDebounceRef                            = useRef(null);

  // ── Fetch events ───────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page_size: 200 };
      const cat = TAB_CATS[tab];
      if (cat) params["event_type__category"] = cat;
      if (searchEmp.trim()) params.search = searchEmp.trim();
      const res = await hrClient.get("hr-events/", { params });
      setEvents(res.data.results ?? res.data);
    } catch {
      setAlert({ type: "error", msg: "Erreur chargement des événements." });
    } finally { setLoading(false); }
  }, [tab, searchEmp]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ── Fetch event types once ─────────────────────────────────────────────────
  useEffect(() => {
    hrClient.get("hr-events/types/?page_size=100&is_active=true")
      .then(r => setEventTypes(r.data.results ?? r.data))
      .catch(() => {});
  }, []);

  // ── Search employees server-side (debounced 300ms) ─────────────────────────
  const searchEmployees = useCallback(async (query) => {
    setEmpSearchLoading(true);
    try {
      const params = { page: 1, page_size: 30 };
      if (query.trim()) params.search = query.trim();
      const res = await hrClient.get("employees/", { params });
      setEmployees(res.data.results ?? res.data ?? []);
    } catch (err) {
      console.error("searchEmployees error:", err?.response?.data || err);
    } finally {
      setEmpSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (empDebounceRef.current) clearTimeout(empDebounceRef.current);
    empDebounceRef.current = setTimeout(() => {
      searchEmployees(empDropdownSearch);
    }, 300);
    return () => clearTimeout(empDebounceRef.current);
  }, [empDropdownSearch, searchEmployees]);

  // ── Dialog helpers ─────────────────────────────────────────────────────────
  const selectedType   = eventTypes.find(t => t.id === form.event_type);
  const isHourBased    = selectedType && HOUR_BASED_CODES.includes(selectedType.code);
  const hasNoEndDate   = selectedType && NO_END_DATE_CODES.includes(selectedType.code);
  const docRequired    = selectedType && DOC_REQUIRED_CODES.includes(selectedType.code);

  const openAdd = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setDocFile(null);
    setEmpDropdownSearch("");
    setDialog(true);
  };

  const openEdit = (e) => {
    setEditItem(e);
    setForm({
      employee:       e.employee,
      event_type:     e.event_type,
      start_date:     e.start_date,
      end_date:       e.end_date || "",
      duration_hours: e.duration_hours || "",
      reason:         e.reason || "",
      status:         e.status,
      note:           e.note || "",
    });
    setDocFile(null);
    setEmpDropdownSearch("");
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.employee || !form.event_type || !form.start_date) {
      setAlert({ type: "warning", msg: "Employé, type et date de début sont obligatoires." });
      return;
    }
    if (isHourBased && !form.duration_hours) {
      setAlert({ type: "warning", msg: "La durée en heures est obligatoire pour une permission horaire." });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) fd.append(k, v);
      });
      if (docFile) fd.append("document", docFile);
      const config = { headers: { "Content-Type": "multipart/form-data" } };
      if (editItem) {
        await hrClient.patch(`hr-events/${editItem.id}/`, fd, config);
        setAlert({ type: "success", msg: "Événement mis à jour." });
      } else {
        await hrClient.post("hr-events/", fd, config);
        setAlert({ type: "success", msg: "Événement créé avec succès." });
      }
      setDialog(false);
      fetchEvents();
    } catch (err) {
      const data = err.response?.data;
      const msg = typeof data === "object"
        ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(" | ")
        : (data?.detail || "Erreur lors de la sauvegarde.");
      setAlert({ type: "error", msg });
    } finally { setSaving(false); }
  };

  const typesByCategory = TABS.slice(1).reduce((acc, label, i) => {
    const cat   = TAB_CATS[i + 1];
    const items = eventTypes.filter(t => t.category === cat);
    if (items.length) acc.push({ label, cat, items });
    return acc;
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Événements RH</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Actualiser"><IconButton onClick={fetchEvents}><RefreshIcon /></IconButton></Tooltip>
          {can("hr_events_write") && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Nouvel événement</Button>
          )}
        </Box>
      </Box>

      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        {TABS.map((t, i) => <Tab key={i} label={t} />)}
      </Tabs>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Rechercher un employé (nom, matricule)…"
          value={searchEmp}
          onChange={e => setSearchEmp(e.target.value)}
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper} elevation={2}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell><strong>Employé</strong></TableCell>
              <TableCell><strong>Événement</strong></TableCell>
              <TableCell><strong>Catégorie</strong></TableCell>
              <TableCell><strong>Du</strong></TableCell>
              <TableCell><strong>Au</strong></TableCell>
              <TableCell><strong>Durée</strong></TableCell>
              <TableCell><strong>Payé</strong></TableCell>
              <TableCell><strong>Statut</strong></TableCell>
              <TableCell><strong>Document</strong></TableCell>
              {can("hr_events_write") && <TableCell><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : events.length === 0 ? (
              <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucun événement trouvé</TableCell></TableRow>
            ) : events.map(e => (
              <TableRow key={e.id} hover>
                <TableCell>
                  <Typography fontSize={13} fontWeight={600}>{e.employee_name}</Typography>
                  <Typography fontSize={11} color="text.secondary" sx={{ fontFamily: "monospace" }}>{e.employee_id_str}</Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: e.event_color, flexShrink: 0 }} />
                    <Typography fontSize={13}>{e.event_type_name}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={CATEGORY_LABELS[e.event_category] ?? e.event_category} color={CATEGORY_COLORS[e.event_category] ?? "default"} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{fmtDate(e.start_date)}</TableCell>
                <TableCell>{e.end_date ? fmtDate(e.end_date) : "—"}</TableCell>
                <TableCell>{e.duration_hours ? `${e.duration_hours}h` : "—"}</TableCell>
                <TableCell>
                  <Chip
                    label={eventTypes.find(t => t.id === e.event_type)?.is_paid ? "Oui" : "Non"}
                    color={eventTypes.find(t => t.id === e.event_type)?.is_paid ? "success" : "error"}
                    size="small" variant="outlined"
                  />
                </TableCell>
                <TableCell><Chip label={STATUS_LABELS[e.status]} color={STATUS_COLORS[e.status]} size="small" /></TableCell>
                <TableCell>
                  {e.document
                    ? <Tooltip title="Voir le document"><IconButton size="small" component="a" href={e.document} target="_blank"><UploadFileIcon fontSize="small" color="primary" /></IconButton></Tooltip>
                    : <Typography fontSize={12} color="text.secondary">—</Typography>}
                </TableCell>
                {can("hr_events_write") && (
                  <TableCell>
                    <Tooltip title="Modifier">
                      <IconButton size="small" color="primary" onClick={() => openEdit(e)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editItem ? "Modifier l'événement" : "Nouvel événement RH"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>

            {/* Employee autocomplete dropdown */}
            <Grid item xs={12}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Employé *</InputLabel>
                <Select
                  value={form.employee}
                  label="Employé *"
                  onChange={e => setForm(p => ({ ...p, employee: e.target.value }))}
                  onClose={() => setEmpDropdownSearch("")}
                  MenuProps={{ autoFocus: false }}
                  renderValue={(val) => {
                    // eslint-disable-next-line eqeqeq
                    const emp = employees.find(e => e.id == val);
                    return emp
                      ? `${emp.last_name} ${emp.first_name} — ${emp.employee_id}`
                      : val;
                  }}
                >
                  <ListSubheader sx={{ pt: 1, pb: 0.5, bgcolor: "background.paper" }}>
                    <TextField
                      size="small"
                      fullWidth
                      autoFocus
                      placeholder="Tapez pour rechercher..."
                      value={empDropdownSearch}
                      onChange={e => setEmpDropdownSearch(e.target.value)}
                      onKeyDown={e => e.stopPropagation()}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {empSearchLoading
                              ? <CircularProgress size={16} />
                              : <SearchIcon fontSize="small" />}
                          </InputAdornment>
                        ),
                      }}
                    />
                  </ListSubheader>

                  {employees.length === 0 ? (
                    <MenuItem disabled>
                      {empSearchLoading ? "Recherche en cours..." : "Tapez pour rechercher un employé"}
                    </MenuItem>
                  ) : (
                    employees.map(e => (
                      <MenuItem key={e.id} value={e.id}>
                        {e.last_name} {e.first_name}
                        <Typography variant="caption" color="text.secondary" ml={1} sx={{ fontFamily: "monospace" }}>
                          — {e.employee_id}
                        </Typography>
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>

            {/* Event type */}
            <Grid item xs={12}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Type d'événement *</InputLabel>
                <Select
                  value={form.event_type}
                  label="Type d'événement *"
                  onChange={e => setForm(p => ({ ...p, event_type: e.target.value, duration_hours: "", end_date: "" }))}
                >
                  {typesByCategory.map(({ label, items }) => [
                    <MenuItem key={`hdr-${label}`} disabled sx={{ fontWeight: 700, color: "text.secondary", fontSize: 12, opacity: 1 }}>
                      ── {label.toUpperCase()} ──
                    </MenuItem>,
                    ...items.map(t => (
                      <MenuItem key={t.id} value={t.id}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: t.color, flexShrink: 0 }} />
                          <span>{t.name}</span>
                          {!t.is_paid && (
                            <Chip label="non payé" size="small" color="error" variant="outlined" sx={{ ml: "auto", fontSize: 10, height: 18 }} />
                          )}
                        </Box>
                      </MenuItem>
                    )),
                  ])}
                </Select>
              </FormControl>
              {selectedType?.affects_status && (
                <Alert severity="warning" sx={{ mt: 1 }} icon={false}>
                  ⚠️ Cet événement changera le statut de l'employé en <strong>{selectedType.target_status}</strong>
                </Alert>
              )}
              {selectedType && !selectedType.is_paid && (
                <Alert severity="info" sx={{ mt: 1 }} icon={false}>
                  Cet événement est <strong>non rémunéré</strong>.
                </Alert>
              )}
            </Grid>

            <Grid item xs={isHourBased ? 12 : 6}>
              <TextField fullWidth size="small" label="Date début *" type="date" value={form.start_date}
                onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
            </Grid>
            {!isHourBased && !hasNoEndDate && (
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Date fin" type="date" value={form.end_date}
                  onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
            )}
            {isHourBased && (
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Durée (heures) *" type="number"
                  inputProps={{ min: 0.5, step: 0.5 }} value={form.duration_hours}
                  onChange={e => setForm(p => ({ ...p, duration_hours: e.target.value }))}
                  InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }} />
              </Grid>
            )}

            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Statut</InputLabel>
                <Select value={form.status} label="Statut" onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Motif" multiline rows={2} value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Note interne" multiline rows={2} value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary" mb={1}>
                Document justificatif {docRequired ? <strong style={{ color: "#EF4444" }}>*</strong> : "(optionnel)"}
              </Typography>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} size="small" color={docRequired ? "error" : "primary"}>
                {docFile ? docFile.name : editItem?.document ? "Remplacer le document" : "Choisir un fichier"}
                <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => setDocFile(e.target.files[0] || null)} />
              </Button>
              {editItem?.document && !docFile && (
                <Typography fontSize={12} color="text.secondary" mt={0.5}>
                  Fichier actuel : <a href={editItem.document} target="_blank" rel="noreferrer">voir</a>
                </Typography>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : editItem ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
