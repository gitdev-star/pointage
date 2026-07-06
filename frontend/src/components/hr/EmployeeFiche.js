import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Chip, Avatar, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Divider, TextField, FormControl,
  InputLabel, Select, MenuItem, InputAdornment, TablePagination,
} from "@mui/material";
import ArrowBackIcon      from "@mui/icons-material/ArrowBack";
import BarChartIcon       from "@mui/icons-material/BarChart";
import DownloadIcon       from "@mui/icons-material/Download";
import PrintIcon          from "@mui/icons-material/Print";
import SearchIcon         from "@mui/icons-material/Search";
import FilterListOffIcon  from "@mui/icons-material/FilterListOff";
import DocumentsRH        from "./DocumentsRH";
import EmployeeScheduleTab from "./EmployeeScheduleTab";
import hrClient           from "../../api/hrClient";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS  = { ACTIVE: "success", INACTIVE: "default", ON_LEAVE: "warning", TERMINATED: "error" };
const STATUS_LABELS  = { ACTIVE: "Actif", INACTIVE: "Inactif", ON_LEAVE: "En congé", TERMINATED: "Résilié" };
const CONTRACT_LABELS = { CDI: "CDI", CDD: "CDD", INTERN: "Stage", PART: "Temps partiel", SEASONAL: "Saisonnier" };
const LEAVE_STATUS_COLORS = { PENDING: "warning", APPROVED: "success", REJECTED: "error", CANCELLED: "default" };
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const STATUS_STYLE = {
  ACTIVE:     { bg: "#e8f5e9", color: "#2e7d32", label: "Actif" },
  INACTIVE:   { bg: "#f5f5f5", color: "#616161", label: "Inactif" },
  TERMINATED: { bg: "#fce4ec", color: "#c62828", label: "Parti" },
  ON_LEAVE:   { bg: "#fff8e1", color: "#f57f17", label: "En congé" },
};
const CONTRACT_STYLE = {
  CDI:      { bg: "#e3f2fd", color: "#1565c0" },
  CDD:      { bg: "#fff8e1", color: "#f57f17" },
  INTERN:   { bg: "#f3e5f5", color: "#6a1b9a" },
  PART:     { bg: "#e8f5e9", color: "#2e7d32" },
  SEASONAL: { bg: "#fce4ec", color: "#c62828" },
};

const EMPTY_FILTERS = { status: "ACTIVE", factory: "", department: "", contract_type: "", search: "", sexe: "" };
const PAGE_SIZE = 50;

// ─── Shared helpers ────────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: "flex", py: 0.8, borderBottom: "1px solid #f0f0f0" }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 180, flexShrink: 0 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value || "—"}</Typography>
    </Box>
  );
}

function StatusBadge({ value }) {
  const s = STATUS_STYLE[value] || { bg: "#f5f5f5", color: "#616161" };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600,
      padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>
      {s.label || value || "N/A"}
    </span>
  );
}

function ContractBadge({ value }) {
  const s = CONTRACT_STYLE[value] || { bg: "#f5f5f5", color: "#616161" };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600,
      padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>
      {CONTRACT_LABELS[value] || value || "N/A"}
    </span>
  );
}

function calcSeniority(hireDate, endDate) {
  if (!hireDate) return "—";
  const start = new Date(hireDate);
  const end   = endDate ? new Date(endDate) : new Date();
  const total = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return `${Math.floor(total / 12)} an(s) ${total % 12} mois`;
}

function calcRetirementDate(birthDate) {
  if (!birthDate) return "—";
  const d = new Date(birthDate);
  d.setFullYear(d.getFullYear() + 60);
  return d.toLocaleDateString("fr-MG");
}

// ─── Registre (list mode) ──────────────────────────────────────────────────────

function RegistreView() {
  const navigate = useNavigate();

  const [employees, setEmployees]     = useState([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [factories, setFactories]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [page, setPage]               = useState(0);
  const [filters, setFilters]         = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const debounceRef                   = useRef(null);

  // Load factories + departments once
  useEffect(() => {
    hrClient.get("employees/factories/?page_size=200")
      .then(r => setFactories(r.data.results ?? r.data)).catch(() => {});
    hrClient.get("employees/departments/?page_size=500")
      .then(r => setDepartments(r.data.results ?? r.data)).catch(() => {});
  }, []);

  const fetchEmployees = useCallback(async (f, p) => {
    setLoading(true);
    try {
      const params = { page: p + 1, page_size: PAGE_SIZE };
      if (f.status)        params.status        = f.status;
      if (f.factory)       params.factory       = f.factory;
      if (f.department)    params.department    = f.department;
      if (f.contract_type) params.contract_type = f.contract_type;
      if (f.search)        params.search        = f.search;
      if (f.sexe)          params.sexe          = f.sexe;
      const r = await hrClient.get("employees/", { params });
      setEmployees(r.data.results ?? r.data);
      setTotal(r.data.count ?? 0);
    } catch {}
    finally { setLoading(false); }
  }, []);

  // Debounce search separately, other filters fire immediately
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      fetchEmployees(filters, 0);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [filters, fetchEmployees]);

  const setFilter = (key, val) => {
    setFilters(prev => {
      const next = { ...prev, [key]: val };
      if (key === "factory") next.department = "";
      return next;
    });
    setPage(0);
  };

  const handleSearchChange = (val) => {
    setSearchInput(val);
    setFilters(prev => ({ ...prev, search: val }));
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters(EMPTY_FILTERS);
    setPage(0);
  };

  const hasActiveFilter = Object.entries(filters).some(([k, v]) => v && !(k === "status" && v === "ACTIVE"));

  const filteredDepts = filters.factory
    ? departments.filter(d => String(d.factory) === String(filters.factory))
    : departments;

  // ── Export CSV ──
  const exportCSV = async () => {
    setExporting(true);
    try {
      const params = { page_size: 5000 };
      if (filters.status)        params.status        = filters.status;
      if (filters.factory)       params.factory       = filters.factory;
      if (filters.department)    params.department    = filters.department;
      if (filters.contract_type) params.contract_type = filters.contract_type;
      if (filters.search)        params.search        = filters.search;
      if (filters.sexe)          params.sexe          = filters.sexe;
      const r    = await hrClient.get("employees/export/", { params });
      const rows = r.data.results ?? r.data;
      const headers = [
        "N RH","Matricule","Nom","Prénom","Sexe","Date naissance",
        "CIN","Date CIN","Lieu CIN","CNAPS",
        "Usine","Département","Section","Poste","Contrat",
        "Date embauche","Statut","Email","Téléphone","Adresse",
        "Nbre enfants","Affectation",
      ];
      const csvRows = [
        "\uFEFF" + headers.join(";"),
        ...rows.map(e =>
          [
            e.n_rh, e.employee_id, e.last_name, e.first_name, e.sexe,
            e.birth_date, e.cin, e.cin_date, e.cin_place, e.cnaps,
            e.factory_name, e.department_name, e.section_name || "", e.job_title_name, e.contract_type,
            e.hire_date, e.status, e.email, e.phone, e.address,
            e.nbre_enfants, e.affectation,
          ].map(v => '"' + (v ?? "").toString().replace(/"/g, '""') + '"').join(";")
        ),
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "registre_personnel_" + new Date().toISOString().slice(0, 10) + ".csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Erreur lors de l'export."); }
    finally { setExporting(false); }
  };

  const thSt = { padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 600,
    color: "#616161", whiteSpace: "nowrap", borderBottom: "2px solid #e0e0e0" };
  const tdSt = { padding: "7px 10px", fontSize: 12, color: "#212121", whiteSpace: "nowrap" };

  return (
    <Box sx={{ p: 3 }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #registre-print table { font-size: 9px; }
          #registre-print th, #registre-print td { padding: 3px 5px !important; }
        }
      `}</style>

      {/* Header */}
      <Box className="no-print" sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Registre du personnel</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {loading ? "Chargement..." : `${total.toLocaleString()} employé(s)`}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined" color="success" startIcon={<DownloadIcon />}
            onClick={exportCSV} disabled={exporting} size="small">
            {exporting ? "Export..." : "Export CSV"}
          </Button>
          <Button
            variant="outlined" startIcon={<PrintIcon />}
            onClick={() => window.print()} size="small">
            Imprimer
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Box className="no-print" sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          placeholder="Rechercher nom, ID, CIN..."
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          size="small" sx={{ minWidth: 220 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Statut</InputLabel>
          <Select value={filters.status} label="Statut" onChange={e => setFilter("status", e.target.value)}>
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Contrat</InputLabel>
          <Select value={filters.contract_type} label="Contrat" onChange={e => setFilter("contract_type", e.target.value)}>
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(CONTRACT_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Sexe</InputLabel>
          <Select value={filters.sexe} label="Sexe" onChange={e => setFilter("sexe", e.target.value)}>
            <MenuItem value="">Tous</MenuItem>
            <MenuItem value="F">Femmes</MenuItem>
            <MenuItem value="M">Hommes</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Usine</InputLabel>
          <Select value={filters.factory} label="Usine" onChange={e => setFilter("factory", e.target.value)}>
            <MenuItem value="">Toutes</MenuItem>
            {factories.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Département</InputLabel>
          <Select value={filters.department} label="Département" onChange={e => setFilter("department", e.target.value)}>
            <MenuItem value="">Tous</MenuItem>
            {filteredDepts.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </Select>
        </FormControl>
        {hasActiveFilter && (
          <Button size="small" color="error" variant="outlined" startIcon={<FilterListOffIcon />} onClick={resetFilters}>
            Réinitialiser
          </Button>
        )}
      </Box>

      {/* Table */}
      <div id="registre-print">
        <Paper elevation={2} sx={{ overflow: "hidden" }}>
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  {["#","Matricule","Nom","Prénom","Sexe","Naissance","CIN","CNAPS",
                    "Usine","Département","Poste","Contrat","Embauche","Statut"].map(h => (
                    <TableCell key={h} sx={thSt}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={14} align="center" sx={{ py: 5 }}>
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} align="center" sx={{ py: 5, color: "text.secondary" }}>
                      Aucun employé trouvé
                    </TableCell>
                  </TableRow>
                ) : employees.map((e, i) => (
                  <TableRow
                    key={e.id} hover
                    sx={{ cursor: "pointer", bgcolor: i % 2 === 0 ? "#fff" : "#fafafa" }}
                    onClick={() => navigate(`/hr/employees/${e.id}`)}
                  >
                    <TableCell sx={tdSt}>{page * PAGE_SIZE + i + 1}</TableCell>
                    <TableCell sx={{ ...tdSt, fontFamily: "monospace", color: "#1565c0" }}>{e.employee_id}</TableCell>
                    <TableCell sx={{ ...tdSt, fontWeight: 600 }}>{e.last_name}</TableCell>
                    <TableCell sx={tdSt}>{e.first_name}</TableCell>
                    <TableCell sx={tdSt}>{e.sexe || "—"}</TableCell>
                    <TableCell sx={tdSt}>{e.birth_date || "—"}</TableCell>
                    <TableCell sx={{ ...tdSt, fontFamily: "monospace" }}>{e.cin || "—"}</TableCell>
                    <TableCell sx={{ ...tdSt, fontFamily: "monospace" }}>{e.cnaps || "—"}</TableCell>
                    <TableCell sx={tdSt}>{e.factory_name}</TableCell>
                    <TableCell sx={tdSt}>{e.department_name}</TableCell>
                    <TableCell sx={tdSt}>{e.job_title || "—"}</TableCell>
                    <TableCell sx={tdSt}><ContractBadge value={e.contract_type} /></TableCell>
                    <TableCell sx={tdSt}>{e.hire_date}</TableCell>
                    <TableCell sx={tdSt}><StatusBadge value={e.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            className="no-print"
            component="div" count={total} page={page}
            onPageChange={(_, p) => { setPage(p); fetchEmployees(filters, p); }}
            rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`}
          />
        </Paper>
      </div>
    </Box>
  );
}

// ─── Fiche detail (single employee) ───────────────────────────────────────────

function FicheDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [employee,  setEmployee]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [tab,       setTab]       = useState(0);

  // Lazy-loaded tab data — only fetched when the tab is first opened
  const [leaves,    setLeaves]    = useState(null);
  const [payslips,  setPayslips]  = useState(null);
  const [shifts,    setShifts]    = useState(null);
  const [maternity, setMaternity] = useState(null);
  const fetchedTabs               = useRef(new Set());

  // Load core employee data immediately
  useEffect(() => {
    setLoading(true);
    hrClient.get(`employees/${id}/`)
      .then(r => setEmployee(r.data))
      .catch(() => setError("Erreur chargement de la fiche employé."))
      .finally(() => setLoading(false));
  }, [id]);

  // Lazy-load tab data on first open
  useEffect(() => {
    if (!employee) return;

    if (tab === 2 && !fetchedTabs.current.has(2)) {
      fetchedTabs.current.add(2);
      Promise.all([
        hrClient.get(`leaves/requests/?employee=${id}&page_size=50`),
        hrClient.get(`leaves/maternity/?employee=${id}&page_size=10`),
      ]).then(([lv, mat]) => {
        setLeaves(lv.data.results   || lv.data);
        setMaternity(mat.data.results || mat.data);
      }).catch(() => { setLeaves([]); setMaternity([]); });
    }

    if (tab === 3 && !fetchedTabs.current.has(3)) {
      fetchedTabs.current.add(3);
      hrClient.get(`payroll/payslips/?employee=${id}&page_size=24`)
        .then(r => setPayslips(r.data.results || r.data))
        .catch(() => setPayslips([]));
    }

    if (tab === 4 && !fetchedTabs.current.has(4)) {
      fetchedTabs.current.add(4);
      hrClient.get(`events/employee-shifts/?employee=${id}&page_size=20`)
        .then(r => setShifts(r.data.results || r.data))
        .catch(() => setShifts([]));
    }
  }, [tab, employee, id]);

  if (loading)  return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (error)    return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;
  if (!employee) return null;

  const seniority    = calcSeniority(employee.hire_date, employee.termination_date);
  const attendanceId = employee.employee_id;
//  const attendanceId = employee.id;

  const fullName     = `${employee.last_name} ${employee.first_name}`;
  const goToAnalysis = () =>
    navigate(`/attendance/analysis?user_id=${attendanceId}&name=${encodeURIComponent(fullName)}`);

  const TabSpinner = () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><CircularProgress size={28} /></Box>
  );

  return (
    <Box sx={{ p: 3 }}>

      {/* Top bar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/hr/employees")}>
          Retour à la liste
        </Button>
        {attendanceId ? (
          <Button variant="contained" color="primary" startIcon={<BarChartIcon />}
            onClick={goToAnalysis} sx={{ fontWeight: 700 }}>
            Analyse des présences
          </Button>
        ) : (
          <Button variant="outlined" disabled>Analyse des présences (pas d'ID appareil)</Button>
        )}
      </Box>

      {/* Header card */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
          <Avatar src={employee.photo} sx={{ width: 100, height: 100, fontSize: 36, bgcolor: "primary.main" }}>
            {employee.first_name?.[0]}{employee.last_name?.[0]}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Box>
                <Typography variant="h5" fontWeight={700}>{employee.last_name} {employee.first_name}</Typography>
                <Typography variant="body1" color="text.secondary" mb={1}>{employee.job_title_name}</Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Chip label={employee.employee_id} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />
                  <Chip label={STATUS_LABELS[employee.status]} color={STATUS_COLORS[employee.status]} size="small" />
                  <Chip label={CONTRACT_LABELS[employee.contract_type] || employee.contract_type} size="small" variant="outlined" />
                  <Chip label={employee.factory_name} size="small" color="primary" variant="outlined" />
                  <Chip label={employee.department_name} size="small" color="secondary" variant="outlined" />
                </Box>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary">Ancienneté</Typography>
                <Typography variant="h6" fontWeight={700} color="primary.main">{seniority}</Typography>
                <Typography variant="caption" color="text.secondary">Depuis le {employee.hire_date}</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }} variant="scrollable">
        <Tab label="Informations" />
        <Tab label="Contrat & Poste" />
        <Tab label={`Congés${leaves !== null ? ` (${(leaves?.length || 0) + (maternity?.length || 0)})` : ""}`} />
        <Tab label={`Fiches de paie${payslips !== null ? ` (${payslips?.length || 0})` : ""}`} />
        <Tab label="Shifts" />
        <Tab label="Ancienneté & Retraite" />
        <Tab label="Documents RH" />
        <Tab label="Horaire" />
        <Tab label="Analyse présences" disabled={!attendanceId} />
      </Tabs>

      {/* Tab 0: Informations */}
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

      {/* Tab 1: Contrat */}
      {tab === 1 && (
        <Paper sx={{ p: 3 }} elevation={1}>
          <Typography fontWeight={700} mb={2}>Contrat & Poste</Typography>
          <InfoRow label="Poste"           value={employee.job_title_name} />
          <InfoRow label="Type de contrat" value={CONTRACT_LABELS[employee.contract_type]} />
          <InfoRow label="Usine"           value={employee.factory_name} />
          <InfoRow label="Département"     value={employee.department_name} />
          <InfoRow label="Date d'embauche" value={employee.hire_date} />
          <InfoRow label="Date de fin"     value={employee.termination_date || "En cours"} />
          <InfoRow label="Statut"          value={STATUS_LABELS[employee.status]} />
        </Paper>
      )}

      {/* Tab 2: Congés */}
      {tab === 2 && (
        leaves === null ? <TabSpinner /> : (
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
                {maternity.map(m => (
                  <TableRow key={`mat-${m.id}`} hover sx={{ bgcolor: "#fce4ec" }}>
                    <TableCell><strong style={{ color: "#c62828" }}>🤰 Maternité</strong></TableCell>
                    <TableCell>{m.leave_start_date}</TableCell>
                    <TableCell>{m.leave_end_date}</TableCell>
                    <TableCell>98j</TableCell>
                    <TableCell>
                      <Chip label={m.status} size="small"
                        color={m.status === "RETURNED" ? "success" : m.status === "CANCELLED" ? "default" : "warning"} />
                    </TableCell>
                  </TableRow>
                ))}
                {leaves.length === 0 && maternity.length === 0
                  ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>Aucun congé</TableCell></TableRow>
                  : leaves.map(l => (
                    <TableRow key={l.id} hover>
                      <TableCell>{l.leave_type_name}</TableCell>
                      <TableCell>{l.start_date}</TableCell>
                      <TableCell>{l.end_date}</TableCell>
                      <TableCell>{l.days_requested}j</TableCell>
                      <TableCell><Chip label={l.status} color={LEAVE_STATUS_COLORS[l.status]} size="small" /></TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}

      {/* Tab 3: Fiches de paie */}
      {tab === 3 && (
        payslips === null ? <TabSpinner /> : (
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
                {payslips.length === 0
                  ? <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>Aucune fiche de paie</TableCell></TableRow>
                  : payslips.map(p => (
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
                  ))
                }
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}

      {/* Tab 4: Shifts */}
      {tab === 4 && (
        shifts === null ? <TabSpinner /> : (
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
                {shifts.length === 0
                  ? <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>Aucun shift assigné</TableCell></TableRow>
                  : shifts.map(s => (
                    <TableRow key={s.id} hover>
                      <TableCell><Chip label={s.shift_name} size="small" color="primary" /></TableCell>
                      <TableCell>{s.start_date}</TableCell>
                      <TableCell>{s.end_date || "En cours"}</TableCell>
                      <TableCell>{s.note || "—"}</TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}

      {/* Tab 5: Ancienneté */}
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

      {/* Tab 6: Documents */}
      {tab === 6 && (
        <Paper sx={{ p: 3 }} elevation={1}>
          <Typography fontWeight={700} mb={2}>Documents RH</Typography>
          <DocumentsRH employee={employee} />
        </Paper>
      )}

      {/* Tab 7: Horaire */}
      {tab === 7 && <EmployeeScheduleTab employeeId={employee.id} />}

      {/* Tab 8: Analyse présences */}
      {tab === 8 && (
        <Paper sx={{ p: 4, textAlign: "center" }} elevation={1}>
          <BarChartIcon sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />
          <Typography variant="h6" fontWeight={700} mb={1}>Analyse des présences</Typography>
          <Typography variant="body2" color="text.secondary" mb={1}>
            Employé : <strong>{fullName}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            ID appareil : <strong>{attendanceId}</strong>
          </Typography>
          <Button variant="contained" size="large" startIcon={<BarChartIcon />}
            onClick={goToAnalysis} sx={{ fontWeight: 700, px: 4 }}>
            Ouvrir l'analyse des présences
          </Button>
        </Paper>
      )}
    </Box>
  );
}

// ─── Router: list vs detail ────────────────────────────────────────────────────

export default function EmployeeFiche() {
  const { id } = useParams();
  return id ? <FicheDetail /> : <RegistreView />;
}
