import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, CircularProgress, Alert,
  Tabs, Tab, Tooltip, FormControl, InputLabel, Select, MenuItem,
  Grid, Divider, IconButton,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import hrClient from "../../api/hrClient";
import { useHRAuth } from "../../contexts/HRAuthContext";
import MaternityLeave from "./MaternityLeave";

const STATUS_COLORS = { PENDING: "warning", APPROVED: "success", REJECTED: "error", CANCELLED: "default" };
const STATUS_LABELS = { PENDING: "En attente", APPROVED: "Approuvé", REJECTED: "Rejeté", CANCELLED: "Annulé" };

const EMPTY_FORM = {
  employee: "", leave_type: "", start_date: "", end_date: "",
  days_requested: "", reason: "",
};

function EmpSearchLeave({ value, onChange, error }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState('');
  const debounceRef = React.useRef(null);

  const search = (val) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val || val.length < 1) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await hrClient.get(`employees/?search=${encodeURIComponent(val)}&page_size=30&status=ACTIVE`);
        setResults(r.data.results ?? r.data);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: `1px solid ${error ? '#d32f2f' : '#e0e0e0'}`,
    fontSize: 13, boxSizing: 'border-box', outline: 'none',
    background: value ? '#f0f7ff' : '#fff', color: '#212121',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        required={!value}
        placeholder="Rechercher nom, prénom ou matricule…"
        value={selectedLabel || q}
        onChange={e => { const v = e.target.value; setQ(v); setSelectedLabel(''); onChange(''); setOpen(true); search(v); }}
        onFocus={() => { setOpen(true); if (q) search(q); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={inputStyle}
      />
      {value && (
        <button type="button" onClick={() => { onChange(''); setQ(''); setSelectedLabel(''); setResults([]); }}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            border: 'none', background: 'none', cursor: 'pointer', color: '#9e9e9e', fontSize: 18 }}>×</button>
      )}
      {open && (loading || results.length > 0) && (
        <div style={{
          position: 'absolute', zIndex: 9999, background: '#fff',
          border: '1px solid #e0e0e0', borderRadius: 8, width: '100%',
          maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', top: '100%', marginTop: 2,
        }}>
          {loading && <div style={{ padding: '10px 12px', fontSize: 13, color: '#9e9e9e' }}>Recherche…</div>}
          {!loading && results.map(e => (
            <div key={e.id}
              onMouseDown={() => {
                onChange(String(e.id));
                setSelectedLabel(`${e.last_name} ${e.first_name}${e.employee_id ? ' — ' + e.employee_id : ''}`);
                setQ(''); setOpen(false);
              }}
              style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                borderBottom: '1px solid #f5f5f5',
                background: String(e.id) === String(value) ? '#e3f2fd' : '#fff' }}
            >
              <strong>{e.last_name} {e.first_name}</strong>
              {e.employee_id && <span style={{ color: '#9e9e9e', marginLeft: 8 }}>{e.employee_id}</span>}
            </div>
          ))}
        </div>
      )}
      {open && !loading && q.length >= 1 && results.length === 0 && (
        <div style={{
          position: 'absolute', zIndex: 9999, background: '#fff',
          border: '1px solid #e0e0e0', borderRadius: 8, width: '100%',
          padding: '10px 12px', fontSize: 13, color: '#9e9e9e', top: '100%', marginTop: 2,
        }}>Aucun résultat pour "{q}"</div>
      )}
      {!value && !open && (
        <div style={{ fontSize: 11, color: '#9e9e9e', marginTop: 3 }}>Tapez pour rechercher parmi tous les employés actifs</div>
      )}
    </div>
  );
}

export default function LeaveRequests() {
  const { can } = useHRAuth();
  const [requests, setRequests]       = useState([]);
  const [leaveTypes, setLeaveTypes]   = useState([]);
  const [employees, setEmployees]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [tab, setTab]                 = useState("PENDING");
  const [dialog, setDialog]           = useState(null);
  const [addDialog, setAddDialog]     = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [formErrors, setFormErrors]   = useState({});
  const [saving, setSaving]           = useState(false);
  const [reason, setReason]           = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [alert, setAlert]             = useState(null);
  const [searchEmp, setSearchEmp]     = useState("");

  const fetchRequests = useCallback(async () => {
    if (tab === "MATERNITY" || tab === "TYPES" || tab === "BALANCES") return;
    setLoading(true);
    try {
      const params = { page_size: 100 };
      if (tab) params.status = tab;
      if (searchEmp) params.search = searchEmp;
      const res = await hrClient.get("leaves/requests/", { params });
      setRequests(res.data.results || res.data);
    } catch { setAlert({ type: "error", msg: "Erreur chargement des demandes." }); }
    finally { setLoading(false); }
  }, [tab, searchEmp]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    hrClient.get("leaves/types/?page_size=50").then(r => setLeaveTypes(r.data.results || r.data)).catch(() => {});
    // employees loaded on demand via EmpSearchLeave
  }, []);

  // Auto-calculate days when dates change
  useEffect(() => {
    if (form.start_date && form.end_date) {
      const start = new Date(form.start_date);
      const end   = new Date(form.end_date);
      if (end >= start) {
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        setForm(p => ({ ...p, days_requested: days }));
      }
    }
  }, [form.start_date, form.end_date]);

  const handleAction = async () => {
    setSubmitting(true);
    try {
      await hrClient.post(`leaves/requests/${dialog.leave.id}/approve_reject/`, {
        action: dialog.action, rejection_reason: reason,
      });
      setAlert({ type: "success", msg: dialog.action === "approve" ? "Demande approuvée." : "Demande rejetée." });
      setDialog(null); setReason(""); fetchRequests();
    } catch (err) {
      setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur." });
    } finally { setSubmitting(false); }
  };

  const handleAdd = async () => {
    const errors = {};
    if (!form.employee)      errors.employee     = "Requis";
    if (!form.leave_type)    errors.leave_type   = "Requis";
    if (!form.start_date)    errors.start_date   = "Requis";
    if (!form.end_date)      errors.end_date     = "Requis";
    if (!form.days_requested) errors.days_requested = "Requis";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      await hrClient.post("leaves/requests/", form);
      setAlert({ type: "success", msg: "Demande de congé créée." });
      setAddDialog(false); setForm(EMPTY_FORM); fetchRequests();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") setFormErrors(data);
      else setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur." });
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Gestion des congés</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Actualiser">
            <IconButton onClick={fetchRequests}><RefreshIcon /></IconButton>
          </Tooltip>
          {can("leaves_write") && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddDialog(true)}>
              Nouvelle demande
            </Button>
          )}
        </Box>
      </Box>

      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }} variant="scrollable" scrollButtons="auto">
        <Tab label="En attente"   value="PENDING" />
        <Tab label="Approuvées"   value="APPROVED" />
        <Tab label="Rejetées"     value="REJECTED" />
        <Tab label="Toutes"       value="" />
        <Tab label="Maternité"    value="MATERNITY" />
        <Tab label="Types congés" value="TYPES" />
      </Tabs>

      {tab === "MATERNITY" ? (
        <MaternityLeave embedded />
      ) : tab === "TYPES" ? (
        <LeaveTypeManager leaveTypes={leaveTypes} setLeaveTypes={setLeaveTypes} can={can} />
      ) : (
        <>
          <Box sx={{ mb: 2 }}>
            <TextField
              size="small" placeholder="Rechercher un employé..."
              value={searchEmp} onChange={e => setSearchEmp(e.target.value)}
              sx={{ minWidth: 260 }} />
          </Box>

          <TableContainer component={Paper} elevation={2}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell><strong>Employé</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell><strong>Du</strong></TableCell>
                  <TableCell><strong>Au</strong></TableCell>
                  <TableCell><strong>Jours</strong></TableCell>
                  <TableCell><strong>Motif</strong></TableCell>
                  <TableCell><strong>Statut</strong></TableCell>
                  {can("leaves_approve") && <TableCell><strong>Actions</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={32} /></TableCell></TableRow>
                ) : requests.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucune demande trouvée</TableCell></TableRow>
                ) : requests.map(req => (
                  <TableRow key={req.id} hover>
                    <TableCell><strong>{req.employee_name}</strong></TableCell>
                    <TableCell>
                      <Chip label={req.leave_type_name} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{req.start_date}</TableCell>
                    <TableCell>{req.end_date}</TableCell>
                    <TableCell><strong>{req.days_requested}j</strong></TableCell>
                    <TableCell sx={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {req.reason || "—"}
                    </TableCell>
                    <TableCell>
                      <Chip label={STATUS_LABELS[req.status]} color={STATUS_COLORS[req.status]} size="small" />
                    </TableCell>
                    {can("leaves_approve") && (
                      <TableCell>
                        {req.status === "PENDING" && (
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            <Tooltip title="Approuver">
                              <span onClick={e => e.stopPropagation()}>
                                <IconButton size="small" color="success"
                                  onClick={() => setDialog({ leave: req, action: "approve" })}>
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Rejeter">
                              <span onClick={e => e.stopPropagation()}>
                                <IconButton size="small" color="error"
                                  onClick={() => setDialog({ leave: req, action: "reject" })}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Approve/Reject Dialog */}
      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          {dialog?.action === "approve" ? "Approuver la demande" : "Rejeter la demande"}
        </DialogTitle>
        <DialogContent>
          {dialog && (
            <Box>
              <Typography mb={2}>
                <strong>{dialog.leave.employee_name}</strong> — {dialog.leave.leave_type_name}<br />
                {dialog.leave.start_date} → {dialog.leave.end_date} ({dialog.leave.days_requested} jours)
              </Typography>
              {dialog.action === "reject" && (
                <TextField label="Motif du refus" fullWidth multiline rows={3}
                  value={reason} onChange={e => setReason(e.target.value)} />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Annuler</Button>
          <Button variant="contained" color={dialog?.action === "approve" ? "success" : "error"}
            onClick={handleAction} disabled={submitting}>
            {submitting ? "En cours..." : dialog?.action === "approve" ? "Confirmer" : "Rejeter"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Leave Request Dialog */}
      <Dialog open={addDialog} onClose={() => { setAddDialog(false); setForm(EMPTY_FORM); setFormErrors({}); }} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Nouvelle demande de congé</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12}>
              <Box>
                <Typography variant="caption" color={formErrors.employee ? "error" : "text.secondary"} sx={{ mb: 0.5, display: "block" }}>Employé *</Typography>
                <EmpSearchLeave value={form.employee} onChange={id => setForm(p => ({ ...p, employee: id }))} error={!!formErrors.employee} />
                {formErrors.employee && <Typography variant="caption" color="error">{formErrors.employee}</Typography>}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small" error={!!formErrors.leave_type}>
                <InputLabel>Type de congé *</InputLabel>
                <Select value={form.leave_type} label="Type de congé *"
                  onChange={e => setForm(p => ({ ...p, leave_type: e.target.value }))}>
                  {leaveTypes.map(t => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name} ({t.days_per_year > 0 ? `${t.days_per_year}j/an` : "illimité"})
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.leave_type && <Typography variant="caption" color="error">{formErrors.leave_type}</Typography>}
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Date début *" type="date"
                value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                error={!!formErrors.start_date} helperText={formErrors.start_date}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Date fin *" type="date"
                value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                error={!!formErrors.end_date} helperText={formErrors.end_date}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Jours demandés *" type="number"
                value={form.days_requested} onChange={e => setForm(p => ({ ...p, days_requested: e.target.value }))}
                error={!!formErrors.days_requested} helperText={formErrors.days_requested || "Calculé automatiquement"} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Motif" multiline rows={2}
                value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDialog(false); setForm(EMPTY_FORM); setFormErrors({}); }}>Annuler</Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving}>
            {saving ? "Enregistrement..." : "Créer la demande"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Leave Type Manager ─────────────────────────────────────────────────────
function LeaveTypeManager({ leaveTypes, setLeaveTypes, can }) {
  const [dialog, setDialog]         = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [form, setForm]             = useState({});
  const [saving, setSaving]         = useState(false);
  const [alert, setAlert]           = useState(null);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: "", code: "", days_per_year: 0, is_paid: true, requires_document: false, color: "#3B82F6", is_active: true });
    setDialog(true);
  };

  const openEdit = (t) => {
    setEditItem(t);
    setForm({ ...t });
    setDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editItem) {
        const res = await hrClient.patch(`leaves/types/${editItem.id}/`, form);
        setLeaveTypes(prev => prev.map(t => t.id === editItem.id ? res.data : t));
      } else {
        const res = await hrClient.post("leaves/types/", form);
        setLeaveTypes(prev => [...prev, res.data]);
      }
      setAlert({ type: "success", msg: editItem ? "Type mis à jour." : "Type créé." });
      setDialog(false);
    } catch (err) {
      setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur." });
    } finally { setSaving(false); }
  };

  return (
    <Box>
      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        {can("leaves_write") && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Ajouter un type</Button>
        )}
      </Box>
      <TableContainer component={Paper} elevation={2}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell><strong>Code</strong></TableCell>
              <TableCell><strong>Nom</strong></TableCell>
              <TableCell><strong>Jours/an</strong></TableCell>
              <TableCell><strong>Payé</strong></TableCell>
              <TableCell><strong>Document requis</strong></TableCell>
              <TableCell><strong>Statut</strong></TableCell>
              {can("leaves_write") && <TableCell><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {leaveTypes.map(t => (
              <TableRow key={t.id} hover>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: t.color }} />
                    <strong>{t.code}</strong>
                  </Box>
                </TableCell>
                <TableCell>{t.name}</TableCell>
                <TableCell>{t.days_per_year > 0 ? `${t.days_per_year}j` : "Illimité"}</TableCell>
                <TableCell><Chip label={t.is_paid ? "Payé" : "Non payé"} color={t.is_paid ? "success" : "default"} size="small" /></TableCell>
                <TableCell><Chip label={t.requires_document ? "Oui" : "Non"} color={t.requires_document ? "warning" : "default"} size="small" /></TableCell>
                <TableCell><Chip label={t.is_active ? "Actif" : "Inactif"} color={t.is_active ? "success" : "default"} size="small" /></TableCell>
                {can("leaves_write") && (
                  <TableCell>
                    <Button size="small" variant="outlined" onClick={() => openEdit(t)}>Modifier</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editItem ? "Modifier le type" : "Nouveau type de congé"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Code *" value={form.code || ""}
                onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Nom *" value={form.name || ""}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Jours/an (0=illimité)" type="number"
                value={form.days_per_year ?? 0}
                onChange={e => setForm(p => ({ ...p, days_per_year: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Couleur (hex)" value={form.color || "#3B82F6"}
                onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                InputProps={{ startAdornment: <Box sx={{ width: 20, height: 20, borderRadius: 1, backgroundColor: form.color, mr: 1 }} /> }} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Payé</InputLabel>
                <Select value={form.is_paid ?? true} label="Payé"
                  onChange={e => setForm(p => ({ ...p, is_paid: e.target.value }))}>
                  <MenuItem value={true}>Oui</MenuItem>
                  <MenuItem value={false}>Non</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Document requis</InputLabel>
                <Select value={form.requires_document ?? false} label="Document requis"
                  onChange={e => setForm(p => ({ ...p, requires_document: e.target.value }))}>
                  <MenuItem value={true}>Oui</MenuItem>
                  <MenuItem value={false}>Non</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Statut</InputLabel>
                <Select value={form.is_active ?? true} label="Statut"
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.value }))}>
                  <MenuItem value={true}>Actif</MenuItem>
                  <MenuItem value={false}>Inactif</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
