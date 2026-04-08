import React, { useEffect, useState } from "react";
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, CircularProgress, Alert,
} from "@mui/material";
import hrClient from "../../api/hrClient";

const EVENT_TYPE_LABELS = { TRAINING: "Formation", MEETING: "Réunion", ANNOUNCEMENT: "Annonce", PARTY: "Fête", OTHER: "Autre" };
const EVENT_TYPE_COLORS = { TRAINING: "primary", MEETING: "info", ANNOUNCEMENT: "warning", PARTY: "success", OTHER: "default" };

export default function ShiftsEvents() {
  const [tab, setTab]           = useState(0);
  const [shifts, setShifts]     = useState([]);
  const [empShifts, setEmpShifts] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      hrClient.get("events/shifts/?page_size=100"),
      hrClient.get("events/employee-shifts/?page_size=50"),
      hrClient.get(`events/holidays/?year=${new Date().getFullYear()}`),
      hrClient.get("events/company/?page_size=50"),
    ])
      .then(([sh, es, hd, ev]) => {
        setShifts(sh.data.results || sh.data);
        setEmpShifts(es.data.results || es.data);
        setHolidays(hd.data.results || hd.data);
        setEvents(ev.data.results || ev.data);
      })
      .catch(() => setError("Erreur chargement des données."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (error)   return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Shifts & Événements</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Plannings de shift" /><Tab label="Shifts employés" />
        <Tab label="Jours fériés" /><Tab label="Événements entreprise" />
      </Tabs>
      {tab === 0 && (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell><strong>Code</strong></TableCell><TableCell><strong>Nom</strong></TableCell>
                <TableCell><strong>Début</strong></TableCell><TableCell><strong>Fin</strong></TableCell>
                <TableCell><strong>Pause</strong></TableCell><TableCell><strong>Couleur</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shifts.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucun planning défini</TableCell></TableRow>
              ) : shifts.map(s => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontFamily: "monospace" }}>{s.code}</TableCell>
                  <TableCell><strong>{s.name}</strong></TableCell>
                  <TableCell>{s.start_time}</TableCell><TableCell>{s.end_time}</TableCell>
                  <TableCell>{s.break_minutes} min</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: s.color, border: "1px solid #ccc" }} />
                      {s.color}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {tab === 1 && (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell><strong>Employé</strong></TableCell><TableCell><strong>Shift</strong></TableCell>
                <TableCell><strong>Début</strong></TableCell><TableCell><strong>Fin</strong></TableCell><TableCell><strong>Note</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {empShifts.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucun shift assigné</TableCell></TableRow>
              ) : empShifts.map(es => (
                <TableRow key={es.id} hover>
                  <TableCell><strong>{es.employee_name}</strong></TableCell>
                  <TableCell><Chip label={es.shift_name} size="small" color="primary" /></TableCell>
                  <TableCell>{es.start_date}</TableCell><TableCell>{es.end_date || "—"}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{es.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {tab === 2 && (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell><strong>Date</strong></TableCell><TableCell><strong>Nom</strong></TableCell><TableCell><strong>Récurrent</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {holidays.length === 0 ? (
                <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucun jour férié enregistré</TableCell></TableRow>
              ) : holidays.map(h => (
                <TableRow key={h.id} hover>
                  <TableCell>{h.date}</TableCell><TableCell><strong>{h.name}</strong></TableCell>
                  <TableCell><Chip label={h.is_recurring ? "Oui" : "Non"} color={h.is_recurring ? "success" : "default"} size="small" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {tab === 3 && (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell><strong>Titre</strong></TableCell><TableCell><strong>Type</strong></TableCell>
                <TableCell><strong>Début</strong></TableCell><TableCell><strong>Fin</strong></TableCell>
                <TableCell><strong>Lieu</strong></TableCell><TableCell><strong>Usine</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucun événement enregistré</TableCell></TableRow>
              ) : events.map(ev => (
                <TableRow key={ev.id} hover>
                  <TableCell><strong>{ev.title}</strong></TableCell>
                  <TableCell><Chip label={EVENT_TYPE_LABELS[ev.event_type] || ev.event_type} color={EVENT_TYPE_COLORS[ev.event_type] || "default"} size="small" /></TableCell>
                  <TableCell>{new Date(ev.start_datetime).toLocaleString("fr-MG")}</TableCell>
                  <TableCell>{new Date(ev.end_datetime).toLocaleString("fr-MG")}</TableCell>
                  <TableCell>{ev.location || "—"}</TableCell>
                  <TableCell>{ev.factory || "Toute l'entreprise"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
