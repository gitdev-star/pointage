import React, { useState } from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Collapse, IconButton, Box, Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon   from "@mui/icons-material/KeyboardArrowUp";

const ACTION_META = {
  CREATE:  { label: "Création",     color: "success" },
  UPDATE:  { label: "Modification", color: "primary" },
  DELETE:  { label: "Suppression",  color: "error" },
  APPROVE: { label: "Approbation",  color: "success" },
  REJECT:  { label: "Rejet",        color: "error" },
};

const MODEL_LABELS = {
  employee:       "Employé",
  leaverequest:   "Événement",
  maternityleave: "Congé maternité",
  workschedule:   "Horaire",
  transportlist:  "Transport",
  section:        "Section",
  department:     "Département",
  factory:        "Usine",
  poste:          "Poste",
  classification: "Classification",
};

function formatModelName(name) {
  return MODEL_LABELS[name] || name;
}

function formatValue(v) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function ChangesRow({ changes }) {
  const entries = Object.entries(changes || {});
  if (!entries.length) {
    return <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>Aucun détail de champ disponible.</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell><strong>Champ</strong></TableCell>
          <TableCell><strong>Avant</strong></TableCell>
          <TableCell><strong>Après</strong></TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map(([field, { old, new: newVal }]) => (
          <TableRow key={field}>
            <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{field}</TableCell>
            <TableCell sx={{ fontSize: 12, color: "#b71c1c" }}>{formatValue(old)}</TableCell>
            <TableCell sx={{ fontSize: 12, color: "#1b5e20" }}>{formatValue(newVal)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[log.action] || { label: log.action, color: "default" };
  const date = log.timestamp ? new Date(log.timestamp) : null;
  const hasChanges = log.changes && Object.keys(log.changes).length > 0;

  return (
    <>
      <TableRow hover sx={{ cursor: hasChanges ? "pointer" : "default" }} onClick={() => hasChanges && setOpen((o) => !o)}>
        <TableCell width={40}>
          {hasChanges && (
            <IconButton size="small">
              {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        <TableCell sx={{ fontSize: 13 }}>
          {date ? date.toLocaleDateString("fr-FR") + " à " + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
        </TableCell>
        <TableCell><Chip size="small" label={meta.label} color={meta.color} /></TableCell>
        <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{log.username || "Système"}</TableCell>
        <TableCell sx={{ fontSize: 12, color: "#555" }}>{formatModelName(log.model_name)}</TableCell>
        <TableCell sx={{ fontSize: 13 }}>{log.object_repr}</TableCell>
        <TableCell sx={{ fontSize: 12, color: "#888" }}>{log.ip_address || "—"}</TableCell>
      </TableRow>
      {hasChanges && (
        <TableRow>
          <TableCell colSpan={7} sx={{ py: 0, borderBottom: open ? undefined : "none" }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ bgcolor: "#fafafa", my: 1, borderRadius: 1 }}>
                <ChangesRow changes={log.changes} />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function AuditLogTable({ logs, loading }) {
  return (
    <Paper elevation={2}>
      <TableContainer sx={{ maxHeight: "calc(100vh - 320px)", overflow: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell width={40} />
              <TableCell><strong>Date</strong></TableCell>
              <TableCell><strong>Action</strong></TableCell>
              <TableCell><strong>Utilisateur</strong></TableCell>
              <TableCell><strong>Section touchée</strong></TableCell>
              <TableCell><strong>Objet</strong></TableCell>
              <TableCell><strong>IP</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  Aucun log trouvé
                </TableCell>
              </TableRow>
            ) : logs.map((log) => <LogRow key={log.id} log={log} />)}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}