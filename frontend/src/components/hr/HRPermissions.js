import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Checkbox, Button,
  Alert, CircularProgress, Chip, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import hrClient from "../../api/hrClient";
import { useHRAuth } from "../../contexts/HRAuthContext";

const MODULES = [
  { key: "employees", label: "Employés", perms: [
    { key: "employees_read",   label: "Voir" },
    { key: "employees_write",  label: "Modifier" },
    { key: "employees_delete", label: "Supprimer" },
  ]},
  { key: "payroll", label: "Fiches de paie", perms: [
    { key: "payroll_read",     label: "Voir" },
    { key: "payroll_write",    label: "Modifier" },
    { key: "payroll_validate", label: "Valider/Payer" },
  ]},
  { key: "leaves", label: "Congés", perms: [
    { key: "leaves_read",    label: "Voir" },
    { key: "leaves_write",   label: "Créer" },
    { key: "leaves_approve", label: "Approuver" },
  ]},
  { key: "reports", label: "Rapports", perms: [
    { key: "reports_read", label: "Voir" },
  ]},
  { key: "shifts", label: "Shifts & Événements", perms: [
    { key: "shifts_read",  label: "Voir" },
    { key: "shifts_write", label: "Modifier" },
  ]},
  { key: "recruitment", label: "Recrutement", perms: [
    { key: "recruitment_read",  label: "Voir" },
    { key: "recruitment_write", label: "Modifier" },
  ]},
  { key: "contracts", label: "Contrats & Documents", perms: [
    { key: "contracts_read",   label: "Voir" },
    { key: "contracts_write",  label: "Modifier" },
    { key: "contracts_delete", label: "Supprimer" },
  ]},
  { key: "sanctions", label: "Sanctions", perms: [
    { key: "sanctions_read",  label: "Voir" },
    { key: "sanctions_write", label: "Modifier" },
  ]},
  { key: "retraite", label: "Retraite & Ancienneté", perms: [
    { key: "retraite_read",  label: "Voir" },
    { key: "retraite_write", label: "Modifier" },
  ]},
  { key: "pay_events", label: "Événements de paie", perms: [
    { key: "pay_events_read",  label: "Voir" },
    { key: "pay_events_write", label: "Modifier" },
  ]},
  { key: "organisation", label: "Organisation", perms: [
    { key: "organisation_read",  label: "Voir" },
    { key: "organisation_write", label: "Modifier" },
  ]},
  { key: "alerts", label: "Alertes CDD", perms: [
    { key: "alerts_read",  label: "Voir" },
    { key: "alerts_write", label: "Envoyer alertes" },
  ]},
  { key: "hr_events", label: "Événements RH", perms: [
  { key: "hr_events_read",  label: "Voir" },
  { key: "hr_events_write", label: "Créer / Modifier" },
]},
  { key: "hr_users", label: "Utilisateurs RH", perms: [
    { key: "hr_users_manage", label: "Gérer" },
  ]},
    { key: "transport", label: "Transport", perms: [
    { key: "transport_read",  label: "Voir" },
    { key: "transport_write", label: "Modifier" },
  ]},
  { key: "horaire", label: "Assignation horaire", perms: [
    { key: "horaire_read",  label: "Voir" },
    { key: "horaire_write", label: "Modifier" },
  ]},
  { key: "audit_logs", label: "Journal d'audit", perms: [
    { key: "audit_logs_read", label: "Voir" },
  ]},
];

export default function HRPermissions() {
  const { hrProfile } = useHRAuth();
  const isDirector = hrProfile?.is_director === true;

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [alert, setAlert]       = useState(null);
  const [selected, setSelected] = useState(null);
  const [perms, setPerms]       = useState({});
  const [saving, setSaving]     = useState(false);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrClient.get("accounts/profiles/?page_size=100");
      const data = res.data.results || res.data;
      setProfiles(data.filter(p => !p.is_director));
    } catch {
      setAlert({ type: "error", msg: "Erreur chargement des profils." });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const openPermissions = (profile) => {
    const initial = {};
    MODULES.forEach(m => m.perms.forEach(p => {
      initial[p.key] = profile.all_permissions?.[p.key] || false;
    }));
    setPerms(initial);
    setSelected(profile);
  };

  const handleToggle = (permKey) => setPerms(prev => ({ ...prev, [permKey]: !prev[permKey] }));

  const handleSelectAll = (module) => {
    const allKeys    = module.perms.map(p => p.key);
    const allChecked = allKeys.every(k => perms[k]);
    setPerms(prev => ({ ...prev, ...Object.fromEntries(allKeys.map(k => [k, !allChecked])) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      Object.entries(perms).forEach(([key, value]) => { payload[`perm_${key}`] = value; });
      await hrClient.patch(`accounts/profiles/${selected.id}/`, payload);
      setAlert({ type: "success", msg: `Permissions de ${selected.username} sauvegardées.` });
      setSelected(null); fetchProfiles();
    } catch {
      setAlert({ type: "error", msg: "Erreur lors de la sauvegarde." });
    } finally { setSaving(false); }
  };

  const countPerms = (profile) => Object.values(profile.all_permissions || {}).filter(Boolean).length;
  const totalPerms = MODULES.reduce((acc, m) => acc + m.perms.length, 0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={1}>Permissions utilisateurs</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Cliquez sur un utilisateur pour définir ses accès.
      </Typography>

      {!isDirector && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Seul le Directeur RH peut modifier les permissions.
        </Alert>
      )}

      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      <TableContainer component={Paper} elevation={2}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell><strong>Utilisateur</strong></TableCell>
              <TableCell><strong>Poste</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Permissions actives</strong></TableCell>
              <TableCell><strong>Statut</strong></TableCell>
              {isDirector && <TableCell><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : profiles.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucun utilisateur RH</TableCell></TableRow>
            ) : profiles.map(p => (
              <TableRow key={p.id} hover>
                <TableCell><strong>{p.username}</strong></TableCell>
                <TableCell>{p.job_title || "—"}</TableCell>
                <TableCell>{p.email || "—"}</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ height: 6, borderRadius: 3, backgroundColor: "#e0e0e0", flex: 1, maxWidth: 100, overflow: "hidden" }}>
                      <Box sx={{ height: "100%", borderRadius: 3, backgroundColor: countPerms(p) === 0 ? "#e0e0e0" : "#1976d2", width: `${(countPerms(p) / totalPerms) * 100}%` }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">{countPerms(p)}/{totalPerms}</Typography>
                  </Box>
                </TableCell>
                <TableCell><Chip label={p.is_active ? "Actif" : "Inactif"} color={p.is_active ? "success" : "default"} size="small" /></TableCell>
                {isDirector && (
                  <TableCell>
                    <Tooltip title="Gérer les permissions">
                      <span onClick={e => e.stopPropagation()}>
                        <IconButton size="small" color="primary" onClick={() => openPermissions(p)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>
          Permissions — {selected?.username}
          <Typography variant="body2" color="text.secondary">{selected?.job_title || "Aucun poste défini"}</Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell sx={{ fontWeight: 700, width: 200 }}>Module</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Permissions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {MODULES.map(module => (
                <TableRow key={module.key} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{module.label}</Typography>
                      {module.perms.length > 1 && (
                        <Chip label="Tout" size="small" variant="outlined"
                          onClick={() => handleSelectAll(module)} sx={{ cursor: "pointer", fontSize: 10 }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                      {module.perms.map(perm => (
                        <Box key={perm.key} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Checkbox size="small" checked={perms[perm.key] || false} onChange={() => handleToggle(perm.key)} />
                          <Typography variant="body2">{perm.label}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSelected(null)} disabled={saving}>Annuler</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
