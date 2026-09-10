import React, { useState, useMemo, useRef } from "react";
import {
  Box, Typography, Paper, Button, TextField, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import hrClient from "../../api/hrClient";

const CONCURRENCY = 3; // nombre d'employés traités en parallèle

function parseIds(raw) {
  return Array.from(
    new Set(raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))
  );
}

export default function BulkDebauche() {
  const [raw, setRaw] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState([]); // { employee_id, state: 'pending'|'running'|'done'|'error', ...result }
  const cancelledRef = useRef(false);

  const ids = useMemo(() => parseIds(raw), [raw]);

  const updateRow = (employeeId, patch) => {
    setRows((prev) =>
      prev.map((r) => (r.employee_id === employeeId ? { ...r, ...patch } : r))
    );
  };

  const processOne = async (employeeId) => {
    updateRow(employeeId, { state: "running" });
    try {
      const res = await hrClient.post("employees/debauche-one/", {
        employee_id: employeeId,
      });
      updateRow(employeeId, { state: "done", ...res.data });
    } catch (err) {
      updateRow(employeeId, {
        state: "error",
        detail: err.response?.data?.detail || "Erreur inconnue.",
      });
    }
  };

  const runDebauche = async () => {
    setConfirmOpen(false);
    setConfirmText("");
    setRunning(true);
    cancelledRef.current = false;

    const initialRows = ids.map((id) => ({ employee_id: id, state: "pending" }));
    setRows(initialRows);

    const queue = [...ids];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length && !cancelledRef.current) {
        const id = queue.shift();
        await processOne(id);
      }
    });
    await Promise.all(workers);

    setRunning(false);
  };

  const doneCount = rows.filter((r) => r.state === "done" || r.state === "error").length;
  const successCount = rows.filter((r) => r.state === "done" && r.device_deleted).length;
  const errorCount = rows.filter((r) => r.state === "error" || (r.state === "done" && !r.device_deleted)).length;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={1}>🚪 Débauche en masse</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Collez les matricules à traiter (retour à la ligne, virgule ou espace).
        Chaque matricule sera passé au statut « Terminated », ce qui déclenche
        automatiquement la suppression sur toutes les pointeuses. Action irréversible.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <TextField
          multiline minRows={6} fullWidth
          placeholder={"1210\n1518\n1578\n..."}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          disabled={running}
        />
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {ids.length} matricule(s) détecté(s)
          </Typography>
          <Button
            variant="contained" color="error"
            disabled={ids.length === 0 || running}
            onClick={() => setConfirmOpen(true)}
          >
            {running ? "Traitement..." : "Débaucher"}
          </Button>
        </Box>
      </Paper>

      {running && rows.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={(doneCount / rows.length) * 100} />
          <Typography variant="caption" color="text.secondary">
            {doneCount} / {rows.length} traités
          </Typography>
        </Box>
      )}

      {rows.length > 0 && !running && (
        <Alert severity={errorCount === 0 ? "success" : "warning"} sx={{ mb: 2 }}>
          {successCount} employé(s) traité(s) avec succès, {errorCount} en erreur (voir tableau).
        </Alert>
      )}

      {rows.length > 0 && (
        <Paper elevation={1}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell><strong>Matricule</strong></TableCell>
                  <TableCell><strong>Statut</strong></TableCell>
                  <TableCell><strong>Pointeuses</strong></TableCell>
                  <TableCell><strong>Détail</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.employee_id} hover>
                    <TableCell>{r.employee_id}</TableCell>
                    <TableCell>
                      {r.state === "pending" && <Chip size="small" label="En attente" />}
                      {r.state === "running" && <Chip size="small" label="En cours..." color="info" />}
                      {r.state === "done" && <Chip size="small" label="Terminated" color="success" />}
                      {r.state === "error" && <Chip size="small" label="Erreur" color="error" />}
                    </TableCell>
                    <TableCell>
                      {r.state === "done" && (
                        <Chip
                          size="small"
                          label={r.device_deleted ? "Supprimé" : "Échec / absent"}
                          color={r.device_deleted ? "success" : "warning"}
                        />
                      )}
                      {r.state === "error" && "—"}
                    </TableCell>
                    <TableCell>
                      {r.state === "error"
                        ? r.detail
                        : r.state === "done"
                        ? (typeof r.device_detail === "string" ? r.device_detail : JSON.stringify(r.device_detail))
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>⚠️ Confirmer la débauche</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Vous êtes sur le point de passer <strong>{ids.length}</strong> employé(s)
            au statut « Terminated », ce qui les supprimera automatiquement de toutes
            les pointeuses. Cette action est irréversible.
          </Typography>
          <TextField
            fullWidth size="small"
            label='Tapez "CONFIRMER" pour continuer'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Annuler</Button>
          <Button
            variant="contained" color="error"
            disabled={confirmText.trim().toUpperCase() !== "CONFIRMER"}
            onClick={runDebauche}
          >
            Débaucher
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}