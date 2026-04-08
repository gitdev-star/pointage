import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Chip, Avatar, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DocumentsRH from "./DocumentsRH";
import EmployeeScheduleTab from "./EmployeeScheduleTab";
import hrClient from "../../api/hrClient";

const STATUS_COLORS = {
  ACTIVE: "success", INACTIVE: "default", ON_LEAVE: "warning", TERMINATED: "error",
};
const STATUS_LABELS = {
  ACTIVE: "Actif", INACTIVE: "Inactif", ON_LEAVE: "En congé", TERMINATED: "Résilié",
};
const CONTRACT_LABELS = {
  CDI: "CDI", CDD: "CDD", INTERN: "Stage", PART: "Temps partiel", SEASONAL: "Saisonnier",
};
const LEAVE_STATUS_COLORS = {
  PENDING: "warning", APPROVED: "success", REJECTED: "error", CANCELLED: "default",
};
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: "flex", py: 0.8, borderBottom: "1px solid #f0f0f0" }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 180, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>{value || "—"}</Typography>
    </Box>
  );
}

function calcSeniority(hireDate, endDate) {
  if (!hireDate) return "—";
  const start = new Date(hireDate);
  const end   = endDate ? new Date(endDate) : new Date();
  const total = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const y = Math.floor(total / 12);
  const m = total % 12;
  return `${y} an(s) ${m} mois`;
}

function calcRetirementDate(birthDate) {
  if (!birthDate) return "—";
  const birth = new Date(birthDate);
  const retire = new Date(birth);
  retire.setFullYear(retire.getFullYear() + 60);
  return retire.toLocaleDateString("fr-MG");
}

export default function EmployeeFiche() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [leaves, setLeaves]     = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [shifts, setShifts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [tab, setTab]           = useState(0);
  const [maternity, setMaternity] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      hrClient.get(`employees/${id}/`),
      hrClient.get(`leaves/requests/?employee=${id}&page_size=50`),
      hrClient.get(`payroll/payslips/?employee=${id}&page_size=24`),
      hrClient.get(`events/employee-shifts/?employee=${id}&page_size=20`),
      hrClient.get(`leaves/maternity/?employee=${id}&page_size=10`),
    ])
      .then(([emp, lv, py, sh, mat]) => {
        setEmployee(emp.data);
        setLeaves(lv.data.results   || lv.data);
        setPayslips(py.data.results || py.data);
        setShifts(sh.data.results   || sh.data);
        setMaternity(mat.data.results || mat.data);
      })
      .catch(() => setError("Erreur chargement de la fiche employé."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>
  );
  if (error)    return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;
  if (!employee) return null;

  const seniority = calcSeniority(employee.hire_date, employee.termination_date);

  return (
    <Box sx={{ p: 3 }}>

      {/* Top bar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/hr/employees")}>
          Retour à la liste
        </Button>
      </Box>

      {/* Header card */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
          <Avatar src={employee.photo}
            sx={{ width: 100, height: 100, fontSize: 36, bgcolor: "primary.main" }}>
            {employee.first_name?.[0]}{employee.last_name?.[0]}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                {employee.last_name} {employee.first_name}
              </Typography>
              <Typography variant="body1" color="text.secondary" mb={1}>{employee.job_title}</Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Chip label={employee.employee_id} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />
                <Chip label={STATUS_LABELS[employee.status]} color={STATUS_COLORS[employee.status]} size="small" />
                <Chip label={CONTRACT_LABELS[employee.contract_type] || employee.contract_type} size="small" variant="outlined" />
                <Chip label={employee.factory_name} size="small" color="primary" variant="outlined" />
                <Chip label={employee.department_name} size="small" color="secondary" variant="outlined" />
              </Box>
            </Box>
            <Box sx={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
              <Typography variant="caption" color="text.secondary">Ancienneté</Typography>
              <Typography variant="h6" fontWeight={700} color="primary.main">{seniority}</Typography>
              <Typography variant="caption" color="text.secondary">Depuis le {employee.hire_date}</Typography>
            </Box>
          </Box>
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => {
          if (v === 8 && employee.device_user_id) {
            navigate(`/attendance/analysis?user_id=${employee.device_user_id}&name=${encodeURIComponent(employee.last_name + " " + employee.first_name)}`);
          } else {
            setTab(v);
          }
        }}
        sx={{ mb: 3 }}
        variant="scrollable"
      >
        <Tab label="Informations" />
        <Tab label="Contrat & Poste" />
        <Tab label={`Congés (${leaves.length + maternity.length})`} />
        <Tab label={`Fiches de paie (${payslips.length})`} />
        <Tab label="Shifts" />
        <Tab label="Ancienneté & Retraite" />
        <Tab label="Documents RH" />
        <Tab label="Horaire" />
        {employee.device_user_id && <Tab label="Analyse présences" />}
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 3 }} elevation={1}>
          <Typography fontWeight={700} mb={2}>Informations personnelles</Typography>
          <InfoRow label="Nom complet"    value={`${employee.first_name} ${employee.last_name}`} />
          <InfoRow label="Email"          value={employee.email} />
          <InfoRow label="Téléphone"      value={employee.phone} />
          <InfoRow label="ID Employé"     value={employee.employee_id} />
          <InfoRow label="ID Appareil"    value={employee.device_user_id} />
          <InfoRow label="Sexe"           value={employee.sexe} />
          <InfoRow label="Date naissance" value={employee.birth_date} />
          <InfoRow label="Lieu naissance" value={employee.birth_place} />
          <InfoRow label="Nbre enfants"   value={employee.nbre_enfants} />
          <InfoRow label="Adresse"        value={employee.address} />
          <Divider sx={{ my: 2 }} />
          <Typography fontWeight={700} mb={2}>Documents officiels</Typography>
          <InfoRow label="CIN"            value={employee.cin} />
          <InfoRow label="Date CIN"       value={employee.cin_date} />
          <InfoRow label="Lieu CIN"       value={employee.cin_place} />
          <InfoRow label="CNAPS"          value={employee.cnaps} />
          <Divider sx={{ my: 2 }} />
          <Typography fontWeight={700} mb={2}>Informations RH</Typography>
          <InfoRow label="Matricule paie" value={employee.matricule_paie} />
          <InfoRow label="N° RH"          value={employee.n_rh} />
          <InfoRow label="HK ou PBI"      value={employee.hk_ou_pbi} />
          <InfoRow label="Affectation"    value={employee.affectation} />
          <InfoRow label="Motif départ"   value={employee.motif_depart} />
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 3 }} elevation={1}>
          <Typography fontWeight={700} mb={2}>Contrat & Poste</Typography>
          <InfoRow label="Poste"           value={employee.job_title} />
          <InfoRow label="Type de contrat" value={CONTRACT_LABELS[employee.contract_type]} />
          <InfoRow label="Usine"           value={employee.factory_name} />
          <InfoRow label="Département"     value={employee.department_name} />
          <InfoRow label="Date d'embauche" value={employee.hire_date} />
          <InfoRow label="Date de fin"     value={employee.termination_date || "En cours"} />
          <InfoRow label="Statut"          value={STATUS_LABELS[employee.status]} />
        </Paper>
      )}

      {tab === 2 && (
        <TableContainer component={Paper} elevation={1}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell><strong>Du</strong></TableCell>
                <TableCell><strong>Au</strong></TableCell>
                <TableCell><strong>Jours</strong></TableCell>
                <TableCell><strong>Statut</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {maternity.length > 0 && maternity.map(m => (
                <TableRow key={`mat-${m.id}`} hover sx={{ bgcolor: '#fce4ec' }}>
                  <TableCell><strong style={{color:'#c62828'}}>🤰 Maternité</strong></TableCell>
                  <TableCell>{m.leave_start_date}</TableCell>
                  <TableCell>{m.leave_end_date}</TableCell>
                  <TableCell>98j</TableCell>
                  <TableCell><Chip label={m.status} size="small" color={m.status === 'RETURNED' ? 'success' : m.status === 'CANCELLED' ? 'default' : 'warning'} /></TableCell>
                </TableRow>
              ))}
              {leaves.length === 0 && maternity.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>Aucun congé</TableCell></TableRow>
              ) : leaves.map(l => (
                <TableRow key={l.id} hover>
                  <TableCell>{l.leave_type_name}</TableCell>
                  <TableCell>{l.start_date}</TableCell>
                  <TableCell>{l.end_date}</TableCell>
                  <TableCell>{l.days_requested}j</TableCell>
                  <TableCell><Chip label={l.status} color={LEAVE_STATUS_COLORS[l.status]} size="small" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 3 && (
        <TableContainer component={Paper} elevation={1}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell><strong>Période</strong></TableCell>
                <TableCell align="right"><strong>Salaire base</strong></TableCell>
                <TableCell align="right"><strong>Net</strong></TableCell>
                <TableCell><strong>Statut</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payslips.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>Aucune fiche de paie</TableCell></TableRow>
              ) : payslips.map(p => (
                <TableRow key={p.id} hover>
                  <TableCell>{MONTHS[p.period_month - 1]} {p.period_year}</TableCell>
                  <TableCell align="right">{Number(p.base_salary).toLocaleString("fr-MG")} Ar</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "success.main" }}>
                    {Number(p.net_salary).toLocaleString("fr-MG")} Ar
                  </TableCell>
                  <TableCell>
                    <Chip label={p.status} size="small"
                      color={p.status === "PAID" ? "success" : p.status === "VALIDATED" ? "warning" : "default"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 4 && (
        <TableContainer component={Paper} elevation={1}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell><strong>Shift</strong></TableCell>
                <TableCell><strong>Début</strong></TableCell>
                <TableCell><strong>Fin</strong></TableCell>
                <TableCell><strong>Note</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shifts.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>Aucun shift assigné</TableCell></TableRow>
              ) : shifts.map(s => (
                <TableRow key={s.id} hover>
                  <TableCell><Chip label={s.shift_name} size="small" color="primary" /></TableCell>
                  <TableCell>{s.start_date}</TableCell>
                  <TableCell>{s.end_date || "En cours"}</TableCell>
                  <TableCell>{s.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 5 && (
        <Paper sx={{ p: 3 }} elevation={1}>
          <Typography fontWeight={700} mb={2}>Ancienneté & Retraite</Typography>
          <InfoRow label="Date d'embauche" value={employee.hire_date} />
          <InfoRow label="Ancienneté"      value={seniority} />
          <InfoRow label="Type de contrat" value={CONTRACT_LABELS[employee.contract_type]} />
          {employee.contract_type === "CDD" && (
            <>
              <Divider sx={{ my: 2 }} />
              <Alert severity="warning">
                Contrat CDD — Date de fin : <strong>{employee.termination_date || "Non définie"}</strong>
              </Alert>
            </>
          )}
          <Divider sx={{ my: 2 }} />
          <Typography fontWeight={700} mb={2}>Retraite</Typography>
          <InfoRow label="Âge de retraite"          value="60 ans" />
          <InfoRow label="Date de retraite estimée" value={calcRetirementDate(employee.birth_date)} />
          <Alert severity="info" sx={{ mt: 2 }}>
            Pour calculer la date de retraite exacte, ajoutez la date de naissance dans le profil employé.
          </Alert>
        </Paper>
      )}

      {tab === 6 && (
        <Paper sx={{ p: 3 }} elevation={1}>
          <Typography fontWeight={700} mb={2}>Documents RH</Typography>
          <DocumentsRH employee={employee} />
        </Paper>
      )}

      {tab === 7 && (
        <EmployeeScheduleTab employeeId={employee.id} />
      )}

      {tab === 8 && employee.device_user_id && (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography variant="body1" color="text.secondary" mb={3}>
            Cliquez pour analyser les présences de cet employé (ID appareil: {employee.device_user_id})
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate(`/attendance/analysis?user_id=${employee.device_user_id}&name=${encodeURIComponent(employee.last_name + " " + employee.first_name)}`)}
          >
            Ouvrir l analyse des présences
          </Button>
        </Box>
      )}

    </Box>
  );
}
