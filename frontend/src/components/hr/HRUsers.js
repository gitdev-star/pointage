import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Tooltip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress,
  Switch, FormControlLabel, TextField, InputAdornment, Avatar,
  Divider, Checkbox,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import hrClient from "../../api/hrClient";
import authClient from "../../api/authClient";
import { useHRAuth } from "../../contexts/HRAuthContext";

// ── Modules & permissions, mirrored from HRProfile model ──────────────
const MODULES = [
  { key: "employees",    label: "Employés",       perms: ["read", "write", "delete"] },
  { key: "payroll",      label: "Paie",           perms: ["read", "write", "validate"] },
  { key: "leaves",       label: "Congés",         perms: ["read", "write", "approve"] },
  { key: "reports",      label: "Rapports",       perms: ["read"] },
  { key: "shifts",       label: "Horaires",       perms: ["read", "write"] },
  { key: "recruitment",  label: "Recrutement",    perms: ["read", "write"] },
  { key: "contracts",    label: "Contrats",       perms: ["read", "write", "delete"] },
  { key: "sanctions",    label: "Sanctions",      perms: ["read", "write"] },
  { key: "retraite",     label: "Retraite",       perms: ["read", "write"] },
  { key: "pay_events",   label: "Événements paie",perms: ["read", "write"] },
  { key: "alerts",       label: "Alertes",        perms: ["read", "write"] },
  { key: "organisation", label: "Organisation",   perms: ["read", "write"] },
  { key: "hr_events",    label: "Événements RH",  perms: ["read", "write"] },
  { key: "transport",    label: "Transport",           perms: ["read", "write"] },
  { key: "cantine",      label: "Cantine",             perms: ["read", "write"] },
  { key: "horaire",      label: "Assignation horaire", perms: ["read", "write"] },
  { key: "audit_logs",   label: "Journal d'audit",     perms: ["read"] },
  { key: "dashboard", label: "Tableau de bord", perms: ["read"] },
  { key: "presence",  label: "Présence",        perms: ["read", "write"] },
  { key: "retard",    label: "Retards",         perms: ["read"] },
  { key: "devices",   label: "Appareils",       perms: ["read", "write"] },
];
// Single standalone permission (no read/write split)
const STANDALONE_PERMS = [
  { field: "perm_hr_users_manage", label: "Gestion des utilisateurs RH" },
];

const PERM_LABELS = { read: "Lecture", write: "Écriture", delete: "Suppression", validate: "Validation", approve: "Approbation" };

const buildPermFieldName = (moduleKey, perm) => `perm_${moduleKey}_${perm}`;

const EMPTY_PERM_FORM = () => {
  const form = { is_director: false, is_active: true };
  MODULES.forEach(m => m.perms.forEach(p => { form[buildPermFieldName(m.key, p)] = false; }));
  STANDALONE_PERMS.forEach(p => { form[p.field] = false; });
  return form;
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
  const [importSource, setImportSource] = useState("ldap"); // "ldap" | "entra"

  // Edit permissions dialog
  const [editDialog, setEditDialog]   = useState(null);
  const [permForm, setPermForm]       = useState(EMPTY_PERM_FORM());
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

  // ── Load AD or Entra ID users ────────────────────────────────────────
  const openLdapDialog = async (source = "ldap") => {
    setImportSource(source);
    setLdapDialog(true);
    setSelectedLdap(null);
    setLdapSearch("");
    setLdapUsers([]);
    setLdapLoading(true);
    try {
      const res = await authClient.get(`${source}/users/`);
      setLdapUsers(res.data);
    } catch {
      setAlert({ type: "error", msg: `Erreur chargement des utilisateurs ${source === "ldap" ? "AD" : "Entra ID"}.` });
    } finally {
      setLdapLoading(false);
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
      await authClient.post(`${importSource}/import/`, {
        username: selectedLdap.username,
        role: "HR",
      });
      setAlert({ type: "success", msg: `${selectedLdap.cn} importé avec succès. Le profil RH sera créé automatiquement.` });
      setLdapDialog(false);
      setSelectedLdap(null);
      setLdapUsers([]);
      setTimeout(() => fetchProfiles(), 1500);
    } catch (err) {
      setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur lors de l'importation." });
    } finally {
      setImporting(false);
    }
  };

  // ── Edit permissions ─────────────────────────────────────────────────
  const openEdit = (profile) => {
    const form = EMPTY_PERM_FORM();
    form.is_director = !!profile.is_director;
    form.is_active   = !!profile.is_active;
    form.factory     = profile.factory    || "";
    form.department  = profile.department || "";
    MODULES.forEach(m => m.perms.forEach(p => {
      const field = buildPermFieldName(m.key, p);
      form[field] = !!profile[field];
    }));
    STANDALONE_PERMS.forEach(p => { form[p.field] = !!profile[p.field]; });
    setPermForm(form);
    setEditDialog(profile);
  };

  const togglePerm = (field) => {
    setPermForm(p => ({ ...p, [field]: !p[field] }));
  };

  const toggleModuleAll = (moduleKey, perms, checked) => {
    setPermForm(p => {
      const next = { ...p };
      perms.forEach(perm => { next[buildPermFieldName(moduleKey, perm)] = checked; });
      return next;
    });
  };

  const handleSaveRole = async () => {
    setSaving(true);
    try {
      const payload = { is_active: permForm.is_active, is_director: permForm.is_director };
      if (permForm.factory)    payload.factory    = permForm.factory;
      if (permForm.department) payload.department = permForm.department;
      MODULES.forEach(m => m.perms.forEach(p => {
        const field = buildPermFieldName(m.key, p);
        payload[field] = permForm[field];
      }));
      STANDALONE_PERMS.forEach(p => { payload[p.field] = permForm[p.field]; });

      await hrClient.patch(`accounts/profiles/${editDialog.id}/`, payload);
      setAlert({ type: "success", msg: `Permissions de ${editDialog.username} mises à jour.` });
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
      await authClient.delete(`users/${deleteDialog.auth_user_id}/hr-delete/`);
      setAlert({ type: "success", msg: `${deleteDialog.username} supprimé.` });
      setDeleteDialog(null);
      fetchProfiles();
    } catch (err) {
      setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur lors de la suppression." });
    } finally {
      setDeleting(false);
    }
  };

  const filteredDepts = permForm.factory
    ? departments.filter(d => String(d.factory) === String(permForm.factory))
    : departments;

  // Small summary chip: count of active read-perms → used in the table instead of hr_role
  const permSummary = (p) => {
    if (p.is_director) return { label: "Directeur RH", color: "error" };
    const activeCount = Object.keys(p).filter(k => k.startsWith("perm_") && p[k]).length;
    if (activeCount === 0) return { label: "Aucune permission", color: "default" };
    return { label: `${activeCount} permission${activeCount > 1 ? "s" : ""}`, color: "primary" };
  };

  // ── Statut de présence, basé sur last_seen ──────────────────────────
  const getOnlineStatus = (lastSeen) => {
    if (!lastSeen) return { label: "Jamais connecté", color: "default" };
    const diffMinutes = (Date.now() - new Date(lastSeen).getTime()) / 60000;
    if (diffMinutes < 5)  return { label: "En ligne",      color: "success" };
    if (diffMinutes < 60) return { label: `Il y a ${Math.round(diffMinutes)} min`, color: "warning" };
    const diffHours = diffMinutes / 60;
    if (diffHours < 24) return { label: `Il y a ${Math.round(diffHours)} h`, color: "default" };
    const diffDays = Math.round(diffHours / 24);
    return { label: `Il y a ${diffDays} j`, color: "default" };
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Utilisateurs RH
          <Chip label={profiles.length} size="small" color="primary" sx={{ ml: 1 }} />
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Actualiser"><IconButton onClick={fetchProfiles}><RefreshIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openLdapDialog("ldap")}>
            Ajouter depuis AD
          </Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openLdapDialog("entra")}>
            Ajouter depuis Entra ID
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
              <TableCell><strong>Permissions</strong></TableCell>
              <TableCell><strong>Statut</strong></TableCell>
              <TableCell><strong>Activité</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>            ) : profiles.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucun utilisateur RH</TableCell></TableRow>
            ) : profiles.map(p => {
              const summary = permSummary(p);
              return (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontFamily: "monospace" }}>{p.username}</TableCell>
                  <TableCell><strong>{p.username}</strong></TableCell>
                  <TableCell>{p.email || "—"}</TableCell>
                  <TableCell>
                    <Chip label={summary.label} color={summary.color} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip label={p.is_active ? "Actif" : "Inactif"} color={p.is_active ? "success" : "default"} size="small" />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const status = getOnlineStatus(p.last_seen);
                      return <Chip label={status.label} color={status.color} size="small" variant={status.color === "success" ? "filled" : "outlined"} />;
                    })()}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      {!p.is_director && (
                        <Tooltip title="Modifier les permissions">
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
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── LDAP Picker Dialog (unchanged) ── */}
      <Dialog open={ldapDialog} onClose={() => setLdapDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>
          👥 Sélectionner un utilisateur {importSource === "ldap" ? "Active Directory" : "Entra ID"}
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
                    <TableCell><strong>{importSource === "ldap" ? "Login AD" : "Login Entra ID"}</strong></TableCell>
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
              — {importSource === "ldap" ? "Se connectera avec son mot de passe AD" : "Se connectera via Microsoft (Entra ID)"}
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

      {/* ── Edit Permissions Dialog ── */}
      <Dialog open={!!editDialog} onClose={() => setEditDialog(null)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>✏️ Modifier les permissions — {editDialog?.username}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControlLabel
              control={<Switch checked={permForm.is_director}
                onChange={e => setPermForm(p => ({ ...p, is_director: e.target.checked }))} />}
              label={permForm.is_director ? "Directeur RH (accès total)" : "Directeur RH"}
            />

            {!permForm.is_director && (
              <>
                <Divider />
                <Box sx={{ display: "flex", gap: 2 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Usine</InputLabel>
                    <Select value={permForm.factory} label="Usine"
                      onChange={e => setPermForm(p => ({ ...p, factory: e.target.value, department: "" }))}>
                      <MenuItem value="">Toutes</MenuItem>
                      {factories.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Département</InputLabel>
                    <Select value={permForm.department} label="Département"
                      onChange={e => setPermForm(p => ({ ...p, department: e.target.value }))}
                      disabled={!permForm.factory}>
                      <MenuItem value="">Tous</MenuItem>
                      {filteredDepts.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>

                <Divider />
                <Typography variant="subtitle2" color="text.secondary">Permissions par module</Typography>

                {MODULES.map(m => {
                  const fields = m.perms.map(p => buildPermFieldName(m.key, p));
                  const allChecked  = fields.every(f => permForm[f]);
                  const someChecked = fields.some(f => permForm[f]);
                  return (
                    <Box key={m.key} sx={{ border: "1px solid #eee", borderRadius: 1, p: 1.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={allChecked}
                              indeterminate={someChecked && !allChecked}
                              onChange={e => toggleModuleAll(m.key, m.perms, e.target.checked)}
                            />
                          }
                          label={<strong>{m.label}</strong>}
                        />
                      </Box>
                      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", pl: 4 }}>
                        {m.perms.map(perm => (
                          <FormControlLabel
                            key={perm}
                            control={
                              <Checkbox
                                size="small"
                                checked={!!permForm[buildPermFieldName(m.key, perm)]}
                                onChange={() => togglePerm(buildPermFieldName(m.key, perm))}
                              />
                            }
                            label={PERM_LABELS[perm] || perm}
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                })}

                <Divider />
                <Typography variant="subtitle2" color="text.secondary">Autres permissions</Typography>
                {STANDALONE_PERMS.map(p => (
                  <FormControlLabel
                    key={p.field}
                    control={
                      <Checkbox
                        checked={!!permForm[p.field]}
                        onChange={() => togglePerm(p.field)}
                      />
                    }
                    label={p.label}
                  />
                ))}
              </>
            )}

            <Divider />
            <FormControlLabel
              control={<Switch checked={permForm.is_active}
                onChange={e => setPermForm(p => ({ ...p, is_active: e.target.checked }))} />}
              label={permForm.is_active ? "Compte actif" : "Compte désactivé"}
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

      {/* ── Delete Dialog (unchanged) ── */}
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