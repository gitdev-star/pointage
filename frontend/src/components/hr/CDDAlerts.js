import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Alert, CircularProgress,
  TextField, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, Tooltip, IconButton, Grid,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import WarningIcon from "@mui/icons-material/Warning";
import hrClient from "../../api/hrClient";

const URGENCY_COLORS  = { critical: "error", warning: "warning", info: "info" };
const URGENCY_LABELS  = { critical: "Critique", warning: "Attention", info: "Info" };
const STATUS_COLORS   = { PENDING: "default", SENT: "primary", RENEWED: "success", EXPIRED: "error", IGNORED: "default" };
const STATUS_LABELS   = { PENDING: "En attente", SENT: "Envoyé", RENEWED: "Renouvelé", EXPIRED: "Expiré", IGNORED: "Ignoré" };

export default function CDDAlerts() {
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [alert, setAlert]         = useState(null);
  const [days, setDays]           = useState(90);
  const [hrEmail, setHrEmail]     = useState("");
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkDays, setBulkDays]   = useState(30);
  const [sending, setSending]     = useState(false);
  const [stats, setStats]         = useState({ critical: 0, warning: 0, info: 0 });

  const fetchExpiring = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrClient.get(`alerts/expiring/?days=${days}`);
      const data = res.data.employees || [];
      if (res.data.user_email) setHrEmail(res.data.user_email);
      setEmployees(data);
      setStats({
        critical: data.filter(e => e.urgency === "critical").length,
        warning:  data.filter(e => e.urgency === "warning").length,
        info:     data.filter(e => e.urgency === "info").length,
      });
    } catch {
      setAlert({ type: "error", msg: "Erreur chargement des alertes." });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchExpiring(); }, [fetchExpiring]);

  const handleSendBulk = async () => {
    if (!hrEmail) { setAlert({ type: "error", msg: "Email RH requis." }); return; }
    setSending(true);
    try {
      const res = await hrClient.post("alerts/send-bulk/", { days: bulkDays });
      setAlert({ type: "success", msg: res.data.detail });
      setBulkDialog(false);
      fetchExpiring();
    } catch (err) {
      setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur envoi." });
    } finally { setSending(false); }
  };

  const handleMarkRenewed = async (alertId) => {
    try {
      await hrClient.post(`alerts/cdd/${alertId}/mark_renewed/`);
      setAlert({ type: "success", msg: "Marqué comme renouvelé." });
      fetchExpiring();
    } catch { setAlert({ type: "error", msg: "Erreur." }); }
  };

  const handleMarkIgnored = async (alertId) => {
    try {
      await hrClient.post(`alerts/cdd/${alertId}/mark_ignored/`);
      setAlert({ type: "success", msg: "Alerte ignorée." });
      fetchExpiring();
    } catch { setAlert({ type: "error", msg: "Erreur." }); }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          ⚠️ Alertes Fin de CDD
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            size="small" type="number" label="Jours"
            value={days} onChange={e => setDays(parseInt(e.target.value) || 90)}
            sx={{ width: 100 }}
            InputProps={{ endAdornment: <InputAdornment position="end">j</InputAdornment> }}
          />
          <Tooltip title="Actualiser"><IconButton onClick={fetchExpiring}><RefreshIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<EmailIcon />} onClick={() => setBulkDialog(true)}>
            Envoyer alertes email
          </Button>
        </Box>
      </Box>

      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      {/* Stats cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: "center", borderLeft: "4px solid #f44336" }}>
            <Typography variant="h4" color="error.main" fontWeight={700}>{stats.critical}</Typography>
            <Typography variant="body2" color="text.secondary">Critique (≤ 30 jours)</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: "center", borderLeft: "4px solid #ff9800" }}>
            <Typography variant="h4" color="warning.main" fontWeight={700}>{stats.warning}</Typography>
            <Typography variant="body2" color="text.secondary">Attention (31-60 jours)</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: "center", borderLeft: "4px solid #2196f3" }}>
            <Typography variant="h4" color="info.main" fontWeight={700}>{stats.info}</Typography>
            <Typography variant="body2" color="text.secondary">Info (61-90 jours)</Typography>
          </Paper>
        </Grid>
      </Grid>

      <TableContainer component={Paper} elevation={2}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell><strong>Employé</strong></TableCell>
              <TableCell><strong>Poste</strong></TableCell>
              <TableCell><strong>Usine / Dép.</strong></TableCell>
              <TableCell><strong>Fin de contrat</strong></TableCell>
              <TableCell><strong>Jours restants</strong></TableCell>
              <TableCell><strong>Urgence</strong></TableCell>
              <TableCell><strong>Statut alerte</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={32} /></TableCell></TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1, display: "block", mx: "auto" }} />
                  <Typography color="text.secondary">Aucun CDD expirant dans les {days} prochains jours</Typography>
                </TableCell>
              </TableRow>
            ) : employees.map(emp => (
              <TableRow key={emp.id} hover sx={{
                backgroundColor: emp.urgency === "critical" ? "#fff5f5" : "inherit"
              }}>
                <TableCell>
                  <Typography fontWeight={600}>{emp.full_name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                    {emp.employee_id}
                  </Typography>
                </TableCell>
                <TableCell>{emp.job_title}</TableCell>
                <TableCell>
                  <Typography variant="body2">{emp.factory_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{emp.department_name}</Typography>
                </TableCell>
                <TableCell>{emp.termination_date}</TableCell>
                <TableCell>
                  <Typography fontWeight={700} color={
                    emp.days_remaining <= 30 ? "error.main" :
                    emp.days_remaining <= 60 ? "warning.main" : "info.main"
                  }>
                    {emp.days_remaining} jours
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={URGENCY_LABELS[emp.urgency]}
                    color={URGENCY_COLORS[emp.urgency]}
                    size="small"
                    icon={<WarningIcon />}
                  />
                </TableCell>
                <TableCell>
                  {emp.alert_status ? (
                    <Chip
                      label={STATUS_LABELS[emp.alert_status]}
                      color={STATUS_COLORS[emp.alert_status]}
                      size="small"
                    />
                  ) : <Typography variant="caption" color="text.secondary">—</Typography>}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    {emp.alert_id && emp.alert_status !== "RENEWED" && (
                      <Tooltip title="Marquer renouvelé">
                        <IconButton size="small" color="success"
                          onClick={() => handleMarkRenewed(emp.alert_id)}>
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {emp.alert_id && emp.alert_status !== "IGNORED" && (
                      <Tooltip title="Ignorer">
                        <IconButton size="small" color="default"
                          onClick={() => handleMarkIgnored(emp.alert_id)}>
                          <BlockIcon fontSize="small" />
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

      {/* Bulk email dialog */}
      <Dialog open={bulkDialog} onClose={() => setBulkDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>📧 Envoyer alertes email</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              size="small" label="Email du responsable RH *"
              value={hrEmail} onChange={e => setHrEmail(e.target.value)}
              placeholder="rh@company.mg" type="email"
            />
            <TextField
              size="small" type="number" label="CDD expirant dans les X prochains jours"
              value={bulkDays} onChange={e => setBulkDays(parseInt(e.target.value) || 30)}
              InputProps={{ endAdornment: <InputAdornment position="end">jours</InputAdornment> }}
            />
            <Alert severity="info">
              Un email récapitulatif sera envoyé à l'adresse indiquée avec la liste de tous les
              CDD expirant dans les <strong>{bulkDays} prochains jours</strong>.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialog(false)}>Annuler</Button>
          <Button variant="contained" startIcon={<EmailIcon />} onClick={handleSendBulk} disabled={sending}>
            {sending ? "Envoi en cours..." : "Envoyer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
