import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  IconButton, Tooltip, Switch, FormControlLabel, Tabs, Tab,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import hrClient from "../../api/hrClient";
import DirectoryUserPicker from "../DirectoryUserPicker";

const EMPTY_FORM = {
  _profile_id: "", auth_user_id: "", username: "", email: "",
  factory: "", department: "", is_active: true,
};

function AssignmentTab({ hrClient, profiles, factories, departments }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [alert, setAlert]             = useState(null);
  const [dialog, setDialog]           = useState(false);
  const [editItem, setEditItem]       = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const filteredDepts = form.factory
    ? departments.filter(d => String(d.factory) === String(form.factory))
    : departments;

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrClient.get("alerts/notifications/?page_size=100");
      setAssignments(res.data.results || res.data);
    } catch { setAlert({ type: "error", msg: "Erreur chargement." }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const handleProfileSelect = (profileId) => {
    const profile = profiles.find(p => String(p.id) === String(profileId));
    if (profile) {
      setForm(prev => ({
        ...prev,
        _profile_id:  profile.id,
        auth_user_id: profile.auth_user_id,
        username:     profile.username,
        email:        profile.email || "",
      }));
    }
  };

  const openAdd = () => { setForm(EMPTY_FORM); setEditItem(null); setDialog(true); };

  const openEdit = (item) => {
    const match = profiles.find(p => p.auth_user_id === item.auth_user_id);
    setForm({
      _profile_id:  match?.id || "",
      auth_user_id: item.auth_user_id,
      username:     item.username,
      email:        item.email,
      factory:      item.factory    || "",
      department:   item.department || "",
      is_active:    item.is_active,
    });
    setEditItem(item);
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.email || !form.username) {
      setAlert({ type: "error", msg: "Utilisateur et email requis." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        auth_user_id: form.auth_user_id, username: form.username,
        email: form.email, is_active: form.is_active,
      };
      if (form.factory)    payload.factory    = form.factory;
      if (form.department) payload.department = form.department;

      if (editItem) {
        await hrClient.patch(`alerts/notifications/${editItem.id}/`, payload);
      } else {
        await hrClient.post("alerts/notifications/", payload);
      }
      setAlert({ type: "success", msg: "Sauvegardé." });
      setDialog(false);
      fetchAssignments();
    } catch (err) {
      setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur." });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await hrClient.delete(`alerts/notifications/${deleteDialog.id}/`);
      setAlert({ type: "success", msg: "Supprimé." });
      setDeleteDialog(null);
      fetchAssignments();
    } catch { setAlert({ type: "error", msg: "Erreur suppression." }); }
    finally { setDeleting(false); }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Définissez qui reçoit les alertes CDD et Maternité par périmètre.
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAdd}>
          Ajouter
        </Button>
      </Box>

      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      <TableContainer component={Paper} elevation={1}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell><strong>Utilisateur RH</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Périmètre</strong></TableCell>
              <TableCell><strong>Statut</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}><CircularProgress size={24} /></TableCell></TableRow>
            ) : assignments.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                Aucun destinataire — cliquez sur Ajouter
              </TableCell></TableRow>
            ) : assignments.map(a => (
              <TableRow key={a.id} hover>
                <TableCell><strong>{a.username}</strong></TableCell>
                <TableCell>{a.email}</TableCell>
                <TableCell>
                  {!a.factory ? (
                    <Chip label="Toute la société" color="primary" size="small" />
                  ) : !a.department ? (
                    <Chip label={a.factory_name} color="info" size="small" />
                  ) : (
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Chip label={a.factory_name} size="small" variant="outlined" />
                      <Chip label={a.department_name} color="secondary" size="small" />
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={a.is_active ? "Actif" : "Inactif"} color={a.is_active ? "success" : "default"} size="small" />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Tooltip title="Modifier">
                      <IconButton size="small" color="primary" onClick={() => openEdit(a)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton size="small" color="error" onClick={() => setDeleteDialog(a)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editItem ? "✏️ Modifier" : "➕ Ajouter destinataire"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Utilisateur RH *</InputLabel>
              <Select value={form._profile_id || ""} label="Utilisateur RH *"
                onChange={e => handleProfileSelect(e.target.value)}>
                {profiles.filter(p => !p.is_director).map(p => (
                  <MenuItem key={p.id} value={p.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{p.username}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.email || "Pas d'email"}{p.job_title ? ` — ${p.job_title}` : ""}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField size="small" label="Email *" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              type="email" helperText="Email où les alertes seront envoyées" />
            <FormControl size="small" fullWidth>
              <InputLabel>Usine (vide = toute la société)</InputLabel>
              <Select value={form.factory || ""} label="Usine"
                onChange={e => setForm(p => ({ ...p, factory: e.target.value, department: "" }))}>
                <MenuItem value=""><em>Toute la société</em></MenuItem>
                {factories.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Département (vide = toute l'usine)</InputLabel>
              <Select value={form.department || ""} label="Département"
                onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                disabled={!form.factory}>
                <MenuItem value=""><em>Toute l'usine</em></MenuItem>
                {filteredDepts.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Switch checked={form.is_active}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
              label={form.is_active ? "Actif" : "Inactif"}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>🗑️ Supprimer</DialogTitle>
        <DialogContent>
          <Typography>Supprimer <strong>{deleteDialog?.username}</strong> des destinataires ?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)} disabled={deleting}>Annuler</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}



const EMPTY_LATE_FORM = { email: "", username: "", factory: "", recipient_type: "to", is_active: true };

function LateAssignmentTab({ hrClient, factories }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [alert, setAlert]             = useState(null);
  const [dialog, setDialog]           = useState(false);
  const [editItem, setEditItem]       = useState(null);
  const [form, setForm]               = useState(EMPTY_LATE_FORM);
  const [saving, setSaving]           = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [pickerOpen, setPickerOpen]     = useState(false);
  const [pickerSource, setPickerSource] = useState("ldap");

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrClient.get("alerts/late-notifications/?page_size=100");
      setAssignments(res.data.results || res.data);
    } catch { setAlert({ type: "error", msg: "Erreur chargement." }); }
    finally { setLoading(false); }
  }, [hrClient]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const openAdd = () => {
    setForm({ ...EMPTY_LATE_FORM, factory: factories[0]?.id || "" });
    setEditItem(null);
    setDialog(true);
  };

  const openEdit = (item) => {
    setForm({
      email:          item.email,
      username:       item.username || "",
      factory:        item.factory,
      recipient_type: item.recipient_type || "to",
      is_active:      item.is_active,
    });
    setEditItem(item);
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.email || !form.factory) {
      setAlert({ type: "error", msg: "Usine et email requis." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        email: form.email, username: form.username,
        factory: form.factory, recipient_type: form.recipient_type,
        is_active: form.is_active,
      };
      if (editItem) {
        await hrClient.patch(`alerts/late-notifications/${editItem.id}/`, payload);
      } else {
        await hrClient.post("alerts/late-notifications/", payload);
      }
      setAlert({ type: "success", msg: "Sauvegardé." });
      setDialog(false);
      fetchAssignments();
    } catch (err) {
      setAlert({
        type: "error",
        msg: err.response?.data?.non_field_errors?.[0]
          || err.response?.data?.email?.[0]
          || "Erreur (email déjà configuré pour cette usine ?).",
      });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await hrClient.delete(`alerts/late-notifications/${deleteDialog.id}/`);
      setAlert({ type: "success", msg: "Supprimé." });
      setDeleteDialog(null);
      fetchAssignments();
    } catch { setAlert({ type: "error", msg: "Erreur suppression." }); }
    finally { setDeleting(false); }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Définissez qui reçoit, chaque jour à 10h00, la liste des employés en retard, par usine.
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAdd}>
          Ajouter
        </Button>
      </Box>

      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      <TableContainer component={Paper} elevation={1}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell><strong>Usine</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Nom</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell><strong>Statut</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}><CircularProgress size={24} /></TableCell></TableRow>
            ) : assignments.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                Aucun destinataire — cliquez sur Ajouter
              </TableCell></TableRow>
            ) : assignments.map(a => (
              <TableRow key={a.id} hover>
                <TableCell><Chip label={a.factory_name} color="info" size="small" /></TableCell>
                <TableCell>{a.email}</TableCell>
                <TableCell>{a.username || "—"}</TableCell>
                <TableCell>
                  <Chip
                    label={a.recipient_type === "cc" ? "Cc" : "À (To)"}
                    color={a.recipient_type === "cc" ? "warning" : "default"}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip label={a.is_active ? "Actif" : "Inactif"} color={a.is_active ? "success" : "default"} size="small" />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Tooltip title="Modifier">
                      <IconButton size="small" color="primary" onClick={() => openEdit(a)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton size="small" color="error" onClick={() => setDeleteDialog(a)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editItem ? "✏️ Modifier" : "➕ Ajouter destinataire"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Usine *</InputLabel>
              <Select value={form.factory || ""} label="Usine *"
                onChange={e => setForm(p => ({ ...p, factory: e.target.value }))}>
                {factories.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Button size="small" variant="outlined"
                onClick={() => { setPickerSource("ldap"); setPickerOpen(true); }}>
                Depuis AD
              </Button>
              <Button size="small" variant="outlined"
                onClick={() => { setPickerSource("entra"); setPickerOpen(true); }}>
                Depuis Entra ID
              </Button>
              <Typography variant="caption" color="text.secondary">
                ou saisissez un email externe ci-dessous
              </Typography>
            </Box>
            <TextField size="small" label="Email *" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              type="email" helperText="Email où l'alerte retards sera envoyée" />
            <DirectoryUserPicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              source={pickerSource}
              onSelect={(u) => setForm(p => ({
                ...p,
                email: u.email || "",
                username: u.cn || u.username || "",
              }))}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Type de destinataire</InputLabel>
              <Select value={form.recipient_type || "to"} label="Type de destinataire"
                onChange={e => setForm(p => ({ ...p, recipient_type: e.target.value }))}>
                <MenuItem value="to">À (To)</MenuItem>
                <MenuItem value="cc">Cc</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" label="Nom (optionnel)" value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
            <FormControlLabel
              control={<Switch checked={form.is_active}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
              label={form.is_active ? "Actif" : "Inactif"}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>🗑️ Supprimer</DialogTitle>
        <DialogContent>
          <Typography>Supprimer <strong>{deleteDialog?.email}</strong> ({deleteDialog?.factory_name}) des destinataires ?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)} disabled={deleting}>Annuler</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}



const EMPTY_MONTHLY_FORM = { email: "", username: "", is_active: true };

function MonthlyReportAssignmentTab({ hrClient }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [alert, setAlert]             = useState(null);
  const [dialog, setDialog]           = useState(false);
  const [editItem, setEditItem]       = useState(null);
  const [form, setForm]               = useState(EMPTY_MONTHLY_FORM);
  const [saving, setSaving]           = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [pickerOpen, setPickerOpen]     = useState(false);
  const [pickerSource, setPickerSource] = useState("ldap");

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrClient.get("alerts/monthly-hc-notifications/?page_size=100");
      setAssignments(res.data.results || res.data);
    } catch { setAlert({ type: "error", msg: "Erreur chargement." }); }
    finally { setLoading(false); }
  }, [hrClient]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const openAdd = () => { setForm(EMPTY_MONTHLY_FORM); setEditItem(null); setDialog(true); };

  const openEdit = (item) => {
    setForm({
      email:     item.email,
      username:  item.username || "",
      is_active: item.is_active,
    });
    setEditItem(item);
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.email) {
      setAlert({ type: "error", msg: "Email requis." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        email: form.email, username: form.username, is_active: form.is_active,
      };
      if (editItem) {
        await hrClient.patch(`alerts/monthly-hc-notifications/${editItem.id}/`, payload);
      } else {
        await hrClient.post("alerts/monthly-hc-notifications/", payload);
      }
      setAlert({ type: "success", msg: "Sauvegardé." });
      setDialog(false);
      fetchAssignments();
    } catch (err) {
      setAlert({
        type: "error",
        msg: err.response?.data?.email?.[0] || "Erreur (email déjà configuré ?).",
      });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await hrClient.delete(`alerts/monthly-hc-notifications/${deleteDialog.id}/`);
      setAlert({ type: "success", msg: "Supprimé." });
      setDeleteDialog(null);
      fetchAssignments();
    } catch { setAlert({ type: "error", msg: "Erreur suppression." }); }
    finally { setDeleting(false); }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Définissez qui reçoit, le 1er de chaque mois, le rapport des retards des employés HC (cadres).
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAdd}>
          Ajouter
        </Button>
      </Box>

      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      <TableContainer component={Paper} elevation={1}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Nom</strong></TableCell>
              <TableCell><strong>Statut</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}><CircularProgress size={24} /></TableCell></TableRow>
            ) : assignments.length === 0 ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>
                Aucun destinataire — cliquez sur Ajouter
              </TableCell></TableRow>
            ) : assignments.map(a => (
              <TableRow key={a.id} hover>
                <TableCell>{a.email}</TableCell>
                <TableCell>{a.username || "—"}</TableCell>
                <TableCell>
                  <Chip label={a.is_active ? "Actif" : "Inactif"} color={a.is_active ? "success" : "default"} size="small" />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Tooltip title="Modifier">
                      <IconButton size="small" color="primary" onClick={() => openEdit(a)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton size="small" color="error" onClick={() => setDeleteDialog(a)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editItem ? "✏️ Modifier" : "➕ Ajouter destinataire"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Button size="small" variant="outlined"
                onClick={() => { setPickerSource("ldap"); setPickerOpen(true); }}>
                Depuis AD
              </Button>
              <Button size="small" variant="outlined"
                onClick={() => { setPickerSource("entra"); setPickerOpen(true); }}>
                Depuis Entra ID
              </Button>
              <Typography variant="caption" color="text.secondary">
                ou saisissez un email externe ci-dessous
              </Typography>
            </Box>
            <TextField size="small" label="Email *" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              type="email" helperText="Email où le rapport mensuel HC sera envoyé" />
            <DirectoryUserPicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              source={pickerSource}
              onSelect={(u) => setForm(p => ({
                ...p,
                email: u.email || "",
                username: u.cn || u.username || "",
              }))}
            />
            <TextField size="small" label="Nom (optionnel)" value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
            <FormControlLabel
              control={<Switch checked={form.is_active}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
              label={form.is_active ? "Actif" : "Inactif"}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>🗑️ Supprimer</DialogTitle>
        <DialogContent>
          <Typography>Supprimer <strong>{deleteDialog?.email}</strong> des destinataires ?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)} disabled={deleting}>Annuler</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}



export default function NotificationsRH() {
  const [tab, setTab]             = useState(0);
  const [profiles, setProfiles]   = useState([]);
  const [factories, setFactories] = useState([]);
  const [departments, setDepts]   = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      hrClient.get("accounts/profiles/?page_size=100"),
      hrClient.get("employees/factories/?page_size=100"),
      hrClient.get("employees/departments/?page_size=200"),
    ]).then(([prof, fact, dept]) => {
      setProfiles(prof.data.results  || prof.data);
      setFactories(fact.data.results || fact.data);
      setDepts(dept.data.results     || dept.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={1}>🔔 Notifications RH</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Gérez les destinataires des alertes automatiques (fin CDD, congé maternité).
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Destinataires alertes CDD & Maternité" />
        <Tab label="Destinataires alertes Retards" />
        <Tab label="Destinataires rapport mensuel HC" />
        <Tab label="Configuration alertes" />
      </Tabs>

      {tab === 0 && (
        <AssignmentTab
          hrClient={hrClient}
          profiles={profiles}
          factories={factories}
          departments={departments}
        />
      )}

      {tab === 1 && (
        <LateAssignmentTab
          hrClient={hrClient}
          factories={factories}
        />
      )}

      {tab === 2 && (
        <MonthlyReportAssignmentTab
          hrClient={hrClient}
        />
      )}

      {tab === 3 && (
        <Paper sx={{ p: 3 }} elevation={1}>
          <Typography fontWeight={700} mb={2}>Alertes automatiques configurées</Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="info">
              Les alertes CDD et Maternité sont envoyées chaque jour à <strong>7h00</strong>.
              Les alertes Retards sont envoyées chaque jour à <strong>10h00</strong>.
            </Alert>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography fontWeight={600} mb={1}>⚠️ Alertes Fin de CDD</Typography>
              <Typography variant="body2">• 90 jours avant la fin du contrat</Typography>
              <Typography variant="body2">• 60 jours avant la fin du contrat</Typography>
              <Typography variant="body2">• 30 jours avant la fin du contrat</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography fontWeight={600} mb={1}>🤰 Alertes Congé Maternité</Typography>
              <Typography variant="body2">• 7 jours avant l'accouchement prévu</Typography>
              <Typography variant="body2">• 7 jours avant la fin du congé</Typography>
              <Typography variant="body2">• Le jour de la reprise de travail</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography fontWeight={600} mb={1}>⏰ Alertes Retards</Typography>
              <Typography variant="body2">• Envoyée chaque matin à 10h00</Typography>
              <Typography variant="body2">• Liste des employés en retard, groupée par usine</Typography>
            </Paper>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
