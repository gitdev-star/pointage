import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Tooltip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress,
  Switch, FormControlLabel, TextField, InputAdornment, Avatar,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import hrClient from "../../api/hrClient";
import apiClient from "../../api/apiClient";
import { useHRAuth } from "../../contexts/HRAuthContext";

const ROLE_COLORS = {
  DIRECTOR:     "error",
  MANAGER_HR:   "primary",
  ASSISTANT_HR: "warning",
  MANAGER:      "secondary",
};
const ROLE_LABELS = {
  DIRECTOR:     "Directeur RH",
  MANAGER_HR:   "Responsable RH",
  ASSISTANT_HR: "Assistant RH",
  MANAGER:      "Manager",
};
const EMPTY_ROLE_FORM = {
  hr_role: "ASSISTANT_HR", factory: "", department: "", is_active: true,
};

export default function HRUsers() {
  const { isRole } = useHRAuth();
  const isDirector = isRole ? isRole("DIRECTOR") : false;

  const [profiles, setProfiles]       = useState([]);
  const [factories, setFactories]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [alert, setAlert]             = useState(null);

  // LDAP picker dialog
  const [ldapDialog, setLdapDialog]   = useState(false);
  const [ldapUsers, setLdapUsers]     = useState([]);
  const [ldapLoading, setLdapLoading] = useState(false);
  const [ldapSearch, setLdapSearch]   = useState("");
  const [selectedLdap, setSelectedLdap] = useState(null);
  const [importing, setImporting]     = useState(false);

  // Edit role dialog
  const [editDialog, setEditDialog]   = useState(null);
  const [roleForm, setRoleForm]       = useState(EMPTY_ROLE_FORM);
  const [saving, setSaving]           = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrClient.get("accounts/profiles/?page_size=100");
      setProfiles(res.data.results || res.data);
    } catch {
      setAlert({ type: "error", msg: "Erreur chargement des profils." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  useEffect(() => {
    hrClient.get("employees/factories/?page_size=100").then(r => setFactories(r.data.results || r.data)).catch(() => {});
    hrClient.get("employees/departments/?page_size=200").then(r => setDepartments(r.data.results || r.data)).catch(() => {});
  }, []);

  // ── Load LDAP users ──────────────────────────────────────────────────
  const openLdapDialog = async () => {
    setLdapDialog(true);
    setSelectedLdap(null);
    setLdapSearch("");
    if (ldapUsers.length === 0) {
      setLdapLoading(true);
      try {
        const res = await apiClient.get("auth/ldap/users/");
        setLdapUsers(res.data);
      } catch {
        setAlert({ type: "error", msg: "Erreur chargement des utilisateurs AD." });
      } finally {
        setLdapLoading(false);
      }
    }
  };

  const filteredLdap = ldapUsers.filter(u =>
    !u.already_imported &&
    (u.cn.toLowerCase().includes(ldapSearch.toLowerCase()) ||
     u.username.toLowerCase().includes(ldapSearch.toLowerCase()) ||
     u.email.toLowerCase().includes(ldapSearch.toLowerCase()))
  );

  // ── Import from LDAP ─────────────────────────────────────────────────
  const handleImport = async () => {
    if (!selectedLdap) return;
    setImporting(true);
    try {
      await apiClient.post("auth/ldap/import/", {
        username: selectedLdap.username,
        role: "HR",
      });
      setAlert({ type: "success", msg: `${selectedLdap.cn} importé avec succès. Le profil RH sera créé automatiquement.` });
      setLdapDialog(false);
      setSelectedLdap(null);
      // Refresh ldap list and profiles
      setLdapUsers([]);
      setTimeout(() => fetchProfiles(), 1500);
    } catch (err) {
      setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur lors de l'importation." });
    } finally {
      setImporting(false);
    }
  };

  // ── Edit role ────────────────────────────────────────────────────────
  const openEdit = (profile) => {
    setRoleForm({
      hr_role:    profile.hr_role    || "ASSISTANT_HR",
      factory:    profile.factory    || "",
      department: profile.department || "",
      is_active:  profile.is_active,
    });
    setEditDialog(profile);
  };

  const handleSaveRole = async () => {
    setSaving(true);
    try {
      const payload = { hr_role: roleForm.hr_role, is_active: roleForm.is_active };
      if (roleForm.factory)    payload.factory    = roleForm.factory;
      if (roleForm.department) payload.department = roleForm.department;
      await hrClient.patch(`accounts/profiles/${editDialog.id}/`, payload);
      setAlert({ type: "success", msg: `Rôle de ${editDialog.username} mis à jour.` });
      setEditDialog(null);
      fetchProfiles();
    } catch (err) {
      setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur." });
    } finally { setSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Uses the new HR-allowed delete endpoint
      await apiClient.delete(`auth/users/${deleteDialog.auth_user_id}/hr-delete/`);
      setAlert({ type: "success", msg: `${deleteDialog.username} supprimé.` });
      setDeleteDialog(null);
      fetchProfiles();
    } catch (err) {
      setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur lors de la suppression." });
    } finally { 
      setDeleting(false); 
    }
  };

  const filteredDepts = roleForm.factory
    ? departments.filter(d => String(d.factory) === String(roleForm.factory))
    : departments;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Utilisateurs RH
          <Chip label={profiles.length} size="small" color="primary" sx={{ ml: 1 }} />
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Actualiser"><IconButton onClick={fetchProfiles}><RefreshIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openLdapDialog}>
            Ajouter depuis AD
          </Button>
        </Box>
      </Box>

      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      <TableContainer component={Paper} elevation={2}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell><strong>Utilisateur</strong></TableCell>
              <TableCell><strong>Nom complet</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Rôle RH</strong></TableCell>
              <TableCell><strong>Statut</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : profiles.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucun utilisateur RH</TableCell></TableRow>
            ) : profiles.map(p => (
              <TableRow key={p.id} hover>
                <TableCell sx={{ fontFamily: "monospace" }}>{p.username}</TableCell>
                <TableCell><strong>{p.username}</strong></TableCell>
                <TableCell>{p.email || "—"}</TableCell>
                <TableCell>
                  {p.is_director ? (
                    <Chip label="Directeur RH" color="error" size="small" />
                  ) : (
                    <Chip label={ROLE_LABELS[p.hr_role] || "—"} color={ROLE_COLORS[p.hr_role] || "default"} size="small" />
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={p.is_active ? "Actif" : "Inactif"} color={p.is_active ? "success" : "default"} size="small" />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    {!p.is_director && (
                      <Tooltip title="Modifier le rôle">
                        <IconButton size="small" color="primary" onClick={() => openEdit(p)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {!p.is_director && (
                      <Tooltip title="Supprimer">
                        <IconButton size="small" color="error"
                          onClick={() => setDeleteDialog({ id: p.id, auth_user_id: p.auth_user_id, username: p.username })}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── LDAP Picker Dialog ── */}
      <Dialog open={ldapDialog} onClose={() => setLdapDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>
          👥 Sélectionner un utilisateur Active Directory
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth size="small" placeholder="Rechercher par nom, login ou email..."
            value={ldapSearch} onChange={e => setLdapSearch(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          {ldapLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
          ) : (
            <Box sx={{ maxHeight: 400, overflow: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableCell></TableCell>
                    <TableCell><strong>Nom complet</strong></TableCell>
                    <TableCell><strong>Login AD</strong></TableCell>
                    <TableCell><strong>Email</strong></TableCell>
                    <TableCell><strong>Département</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLdap.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                      Aucun utilisateur trouvé
                    </TableCell></TableRow>
                  ) : filteredLdap.map(u => (
                    <TableRow
                      key={u.username}
                      hover
                      selected={selectedLdap?.username === u.username}
                      onClick={() => setSelectedLdap(u)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: "primary.main" }}>
                          {u.cn?.[0]}
                        </Avatar>
                      </TableCell>
                      <TableCell><strong>{u.cn}</strong></TableCell>
                      <TableCell sx={{ fontFamily: "monospace" }}>{u.username}</TableCell>
                      <TableCell>{u.email || "—"}</TableCell>
                      <TableCell>{u.department || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
          {selectedLdap && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Sélectionné : <strong>{selectedLdap.cn}</strong> ({selectedLdap.username})
              — Se connectera avec son mot de passe AD
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLdapDialog(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleImport} disabled={!selectedLdap || importing}>
            {importing ? "Importation..." : "Ajouter comme utilisateur RH"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Role Dialog ── */}
      <Dialog open={!!editDialog} onClose={() => setEditDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>✏️ Modifier le rôle — {editDialog?.username}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Rôle RH</InputLabel>
              <Select value={roleForm.hr_role} label="Rôle RH"
                onChange={e => setRoleForm(p => ({ ...p, hr_role: e.target.value }))}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            {roleForm.hr_role === "MANAGER" && (
              <>
                <FormControl size="small" fullWidth>
                  <InputLabel>Usine</InputLabel>
                  <Select value={roleForm.factory} label="Usine"
                    onChange={e => setRoleForm(p => ({ ...p, factory: e.target.value, department: "" }))}>
                    <MenuItem value="">Toutes</MenuItem>
                    {factories.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Département</InputLabel>
                  <Select value={roleForm.department} label="Département"
                    onChange={e => setRoleForm(p => ({ ...p, department: e.target.value }))}
                    disabled={!roleForm.factory}>
                    <MenuItem value="">Tous</MenuItem>
                    {filteredDepts.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </>
            )}
            <FormControlLabel
              control={<Switch checked={roleForm.is_active}
                onChange={e => setRoleForm(p => ({ ...p, is_active: e.target.checked }))} />}
              label={roleForm.is_active ? "Compte actif" : "Compte désactivé"}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(null)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveRole} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>🗑️ Supprimer l'utilisateur</DialogTitle>
        <DialogContent>
          <Typography>
            Supprimer <strong>{deleteDialog?.username}</strong> ? Cette action supprimera également son accès.
          </Typography>
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
