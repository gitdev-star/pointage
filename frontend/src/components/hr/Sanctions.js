import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, Alert, CircularProgress, Tabs, Tab,
  IconButton, Grid, InputAdornment, ListSubheader, Switch, Tooltip,
} from "@mui/material";
import AddIcon     from "@mui/icons-material/Add";
import EditIcon    from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon  from "@mui/icons-material/Search";
import hrClient    from "../../api/hrClient";
import { useHRAuth } from "../../contexts/HRAuthContext";

const STATUS_COLORS = { ACTIVE: "error", CANCELLED: "default", APPEALED: "warning" };
const STATUS_LABELS = { ACTIVE: "Active", CANCELLED: "Annulée", APPEALED: "En appel" };

const EMPTY_FORM = {
  employee: "", sanction_type: "", date: "", reason: "", note: "", status: "ACTIVE",
};

export default function Sanctions() {
  const { can } = useHRAuth();

  const [tab, setTab]                             = useState(0);
  const [sanctions, setSanctions]                 = useState([]);
  const [sanctionTypes, setSanctionTypes]         = useState([]);
  const [employees, setEmployees]                 = useState([]);
  const [loading, setLoading]                     = useState(false);
  const [alert, setAlert]                         = useState(null);
  const [dialog, setDialog]                       = useState(false);
  const [editItem, setEditItem]                   = useState(null);
  const [form, setForm]                           = useState(EMPTY_FORM);
  const [saving, setSaving]                       = useState(false);
  const [searchEmp, setSearchEmp]                 = useState("");
  const [empDropdownSearch, setEmpDropdownSearch] = useState("");
  const [empSearchLoading, setEmpSearchLoading]   = useState(false);
  const empDebounceRef                            = useRef(null);

  const TABS     = ["Toutes", "Actives", "Annulées", "En appel"];
  const TAB_STAT = ["", "ACTIVE", "CANCELLED", "APPEALED"];

  // ── Main tab (Sanctions vs Types) ─────────────────────────────────────────
  const [mainTab, setMainTab] = useState(0);

  // ── Sanction Types management ──────────────────────────────────────────────
  const EMPTY_TYPE = { name: '', code: '', level: 1, color: '#f59e0b', is_active: true };
  const [typeDialog, setTypeDialog]   = useState(false);
  const [editType, setEditType]       = useState(null);
  const [typeForm, setTypeForm]       = useState(EMPTY_TYPE);
  const [typeSaving, setTypeSaving]   = useState(false);

  const openCreateType = () => { setEditType(null); setTypeForm(EMPTY_TYPE); setTypeDialog(true); };
  const openEditType = (t) => {
    setEditType(t);
    setTypeForm({ name: t.name, code: t.code, level: t.level, color: t.color, is_active: t.is_active });
    setTypeDialog(true);
  };

  const handleSaveType = async () => {
    if (!typeForm.name || !typeForm.code) {
      setAlert({ type: 'warning', msg: 'Nom et code sont obligatoires' });
      return;
    }
    setTypeSaving(true);
    try {
      if (editType) {
        await hrClient.patch(`sanctions/types/${editType.id}/`, typeForm);
      } else {
        await hrClient.post('sanctions/types/', typeForm);
      }
      setAlert({ type: 'success', msg: editType ? 'Type mis à jour' : 'Type créé' });
      setTypeDialog(false);
      fetchAll();
    } catch (e) {
      setAlert({ type: 'error', msg: e?.response?.data?.code?.[0] || e?.response?.data?.name?.[0] || 'Erreur enregistrement' });
    } finally {
      setTypeSaving(false);
    }
  };

  const handleToggleType = async (t) => {
    try {
      await hrClient.patch(`sanctions/types/${t.id}/`, { is_active: !t.is_active });
      fetchAll();
    } catch {
      setAlert({ type: 'error', msg: 'Erreur mise à jour' });
    }
  };

  // ── Fetch sanctions + sanction types ──────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (TAB_STAT[tab]) params.status = TAB_STAT[tab];
      if (searchEmp)     params.search = searchEmp;
      const [s, t] = await Promise.all([
        hrClient.get("sanctions/",       { params }),
        hrClient.get("sanctions/types/", { params: mainTab === 1 ? {} : { is_active: true } }),
      ]);
      setSanctions(s.data.results ?? s.data);
      const rawTypes = t.data.results ?? t.data;
      // Sort by level asc, LICENCIEMENT always absolute last
      setSanctionTypes([
        ...rawTypes
          .filter(x => x.code !== 'LICENCIEMENT')
          .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
        ...rawTypes.filter(x => x.code === 'LICENCIEMENT'),
      ]);
    } catch {
      setAlert({ type: "error", msg: "Erreur de chargement des sanctions" });
    } finally {
      setLoading(false);
    }
  }, [tab, searchEmp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
  const openCreate = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setEmpDropdownSearch("");
    setDialog(true);
  };

  const openEdit = (row) => {
    setEditItem(row);
    setForm({
      employee:      row.employee,
      sanction_type: row.sanction_type,
      date:          row.date,
      reason:        row.reason,
      note:          row.note || "",
      status:        row.status,
    });
    setEmpDropdownSearch("");
    setDialog(true);
  };

  // ── Licenciement detection ─────────────────────────────────────────────────
  const isLicenciement = (typeId) => {
    // eslint-disable-next-line eqeqeq
    const found = sanctionTypes.find(t => t.id == typeId);
    return found && (
      found.code === "LIC" ||
      found.code === "LICENCIEMENT" ||
      found.name.toLowerCase().includes("licenci")
    );
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.employee || !form.sanction_type || !form.date || !form.reason) {
      setAlert({ type: "warning", msg: "Employé, type, date et motif sont obligatoires" });
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        await hrClient.patch(`sanctions/${editItem.id}/`, form);
      } else {
        await hrClient.post("sanctions/", form);
      }

      if (form.status === "ACTIVE" && isLicenciement(form.sanction_type)) {
        try {
          await hrClient.patch(`employees/${form.employee}/`, {
            status:           "TERMINATED",
            termination_date: form.date,
            motif_depart:     form.reason,
          });
          setAlert({ type: "success", msg: `${editItem ? "Sanction mise à jour" : "Sanction créée"} — Employé automatiquement résilié.` });
        } catch (patchErr) {
          console.error("Auto-terminate failed:", patchErr?.response?.data || patchErr);
          setAlert({ type: "warning", msg: `${editItem ? "Sanction mise à jour" : "Sanction créée"}, mais impossible de mettre à jour le statut de l'employé.` });
        }
      } else {
        setAlert({ type: "success", msg: editItem ? "Sanction mise à jour" : "Sanction créée" });
      }

      setDialog(false);
      fetchAll();
    } catch {
      setAlert({ type: "error", msg: "Erreur lors de l'enregistrement" });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Sanctions disciplinaires</Typography>
        <Box display="flex" gap={1}>
          <IconButton onClick={fetchAll}><RefreshIcon /></IconButton>
          {can("sanctions_write") && mainTab === 0 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Nouvelle sanction
            </Button>
          )}
          {can("sanctions_write") && mainTab === 1 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateType}>
              Nouveau type
            </Button>
          )}
        </Box>
      </Box>

      {/* Main navigation tabs */}
      <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Sanctions" />
        <Tab label="Types de sanctions" />
      </Tabs>

      {alert && (
        <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>
          {alert.msg}
        </Alert>
      )}

      {mainTab === 0 && (
        <Box>
          <Box display="flex" gap={2} mb={2} alignItems="center">
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              {TABS.map((t, i) => <Tab key={i} label={t} />)}
            </Tabs>
            <TextField
              size="small"
              placeholder="Rechercher employé..."
              value={searchEmp}
              onChange={e => setSearchEmp(e.target.value)}
              sx={{ ml: "auto", width: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                ),
              }}
            />
          </Box>
          {loading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell><strong>Employé</strong></TableCell>
                    <TableCell><strong>Matricule</strong></TableCell>
                    <TableCell><strong>Sanction</strong></TableCell>
                    <TableCell><strong>Date</strong></TableCell>
                    <TableCell><strong>Motif</strong></TableCell>
                    <TableCell><strong>Statut</strong></TableCell>
                    {can("sanctions_write") && <TableCell align="center"><strong>Actions</strong></TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sanctions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        Aucune sanction trouvée
                      </TableCell>
                    </TableRow>
                  ) : sanctions.map(row => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.employee_name}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace" }}>{row.employee_id_str}</TableCell>
                      <TableCell>
                        <Chip
                          label={row.sanction_type_name}
                          size="small"
                          sx={{ bgcolor: row.sanction_color, color: "#fff", fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell sx={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.reason}
                      </TableCell>
                      <TableCell>
                        <Chip label={STATUS_LABELS[row.status]} color={STATUS_COLORS[row.status]} size="small" />
                      </TableCell>
                      {can("sanctions_write") && (
                        <TableCell align="center">
                          <IconButton size="small" onClick={() => openEdit(row)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* ── Types de sanctions tab ── */}
      {mainTab === 1 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell><strong>Code</strong></TableCell>
                <TableCell><strong>Nom</strong></TableCell>
                <TableCell><strong>Niveau</strong></TableCell>
                <TableCell><strong>Couleur</strong></TableCell>
                <TableCell align="center"><strong>Actif</strong></TableCell>
                {can('sanctions_write') && <TableCell align="center"><strong>Actions</strong></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {sanctionTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Aucun type de sanction — cliquez sur "Nouveau type" pour commencer
                  </TableCell>
                </TableRow>
              ) : sanctionTypes.map(t => (
                <TableRow key={t.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{t.code}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>
                    <Chip label={`Niveau ${t.level}`} size="small"
                      sx={{ bgcolor: t.color, color: '#fff', fontWeight: 600 }} />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box width={20} height={20} borderRadius={1} bgcolor={t.color} border="1px solid #ccc" />
                      <Typography variant="caption" fontFamily="monospace">{t.color}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={t.is_active ? 'Désactiver' : 'Activer'}>
                      <Switch
                        size="small"
                        checked={t.is_active}
                        onChange={() => handleToggleType(t)}
                        disabled={!can('sanctions_write') || t.code === 'LICENCIEMENT'}
                      />
                    </Tooltip>
                  </TableCell>
                  {can('sanctions_write') && (
                    <TableCell align="center">
                      {t.code !== 'LICENCIEMENT' && (
                        <IconButton size="small" onClick={() => openEditType(t)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Create / Edit Type Dialog ── */}
      <Dialog open={typeDialog} onClose={() => setTypeDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editType ? 'Modifier le type' : 'Nouveau type de sanction'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Code" required
                value={typeForm.code}
                onChange={e => setTypeForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                inputProps={{ maxLength: 30 }}
                helperText="Ex: AVERT, BLAME, LIC"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Niveau (1-5)" type="number"
                inputProps={{ min: 1, max: 5 }} required
                value={typeForm.level}
                onChange={e => setTypeForm(p => ({ ...p, level: parseInt(e.target.value) || 1 }))}
                helperText="1=mineur … 5=grave"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Nom" required
                value={typeForm.name}
                onChange={e => setTypeForm(p => ({ ...p, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={2}>
                <TextField size="small" label="Couleur (hex)" sx={{ flex: 1 }}
                  value={typeForm.color}
                  onChange={e => setTypeForm(p => ({ ...p, color: e.target.value }))}
                  inputProps={{ maxLength: 7 }}
                />
                <input type="color" value={typeForm.color}
                  onChange={e => setTypeForm(p => ({ ...p, color: e.target.value }))}
                  style={{ width: 48, height: 40, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                />
                <Box width={40} height={40} borderRadius={1} bgcolor={typeForm.color} border="1px solid #ccc" />
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={1}>
                <Switch checked={typeForm.is_active}
                  onChange={e => setTypeForm(p => ({ ...p, is_active: e.target.checked }))} />
                <Typography variant="body2">Actif</Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTypeDialog(false)} disabled={typeSaving}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveType} disabled={typeSaving}>
            {typeSaving ? 'Enregistrement...' : editType ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Create / Edit Sanction Dialog ── */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? "Modifier la sanction" : "Nouvelle sanction"}</DialogTitle>
        <DialogContent>
          {form.sanction_type && isLicenciement(form.sanction_type) && form.status === "ACTIVE" && (
            <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
              Ce type de sanction entraînera la résiliation automatique de l'employé.
            </Alert>
          )}
          <Grid container spacing={2} mt={0.5}>

            {/* Employee autocomplete dropdown */}
            <Grid item xs={12}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Employé</InputLabel>
                <Select
                  value={form.employee}
                  label="Employé"
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
                    employees.map(emp => (
                      <MenuItem key={emp.id} value={emp.id}>
                        {emp.last_name} {emp.first_name}
                        <Typography variant="caption" color="text.secondary" ml={1}>
                          — {emp.employee_id}
                        </Typography>
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Type de sanction</InputLabel>
                <Select
                  value={form.sanction_type}
                  label="Type de sanction"
                  onChange={e => setForm(p => ({ ...p, sanction_type: e.target.value }))}
                >
                  {sanctionTypes.map(t => (
                    <MenuItem key={t.id} value={t.id}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box width={10} height={10} borderRadius="50%" bgcolor={t.color} />
                        {t.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Date" type="date"
                InputLabelProps={{ shrink: true }} required
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Statut</InputLabel>
                <Select
                  value={form.status}
                  label="Statut"
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                >
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="CANCELLED">Annulée</MenuItem>
                  <MenuItem value="APPEALED">En appel</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth size="small" label="Motif" multiline rows={3} required
                value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth size="small" label="Note interne" multiline rows={2}
                value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : editItem ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
