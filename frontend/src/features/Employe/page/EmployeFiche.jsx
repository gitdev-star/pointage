//==========================================================
//frontend/src/features/Employe/page/EmployeFiche.jsx
//==========================================================

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate }                  from "react-router-dom";
import {
  Box, Paper, Chip, Avatar, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Divider, TablePagination,
} from "@mui/material";
import ArrowBackIcon  from "@mui/icons-material/ArrowBack";
import BarChartIcon   from "@mui/icons-material/BarChart";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";

import hrClient from "../../../api/hrClient";
import DocumentsRH from "../../../components/hr/DocumentsRH";
import EmployeeScheduleTab           from "../page/EmployeeScheduleTab";
import { useEmployeeFilters }        from "../hooks/useEmployeFilter";
// import { useExportCSV }              from "../hooks/useExportCSV";
import { EmployeeFilterBar }         from "../components/EmployeFilterBar";
import {
  StatusBadge, StatusChip, ContractBadge, InfoRow, TabSpinner,
} from "../components/EmployeComponent";
import { CONTRACT_LABELS, LEAVE_STATUS_CHIP_COLORS, MONTHS,
  STATUS_LABELS, DEFAULT_PAGE_SIZE,
} from "../constants/Employe.constant";
import {
  calcSeniority, calcRetirementDate, buildApiParams,
} from "../utils/EmployeUtil";

// ─── RegistreView ─────────────────────────────────────────────────────────────

const PRINT_STYLE = `
  @media print {
    /* Cacher tout sauf le tableau */
    body > * { display: none !important; }
    #registre-print { display: block !important; }

    /* Réinitialiser le layout pour l'impression */
    #registre-print {
      position: fixed;
      top: 0; left: 0;
      width: 100%;
      background: white;
      z-index: 99999;
    }

    /* En-tête d'impression */
    #print-header {
      display: block !important;
      text-align: center;
      margin-bottom: 12px;
      font-family: sans-serif;
    }

    /* Masquer la pagination */
    .no-print { display: none !important; }

    /* Style tableau compact */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8px;
      font-family: sans-serif;
    }
    th {
      background: #f0f0f0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      border: 1px solid #ccc;
      padding: 4px 6px;
      text-align: left;
      font-weight: 600;
    }
    td {
      border: 1px solid #e0e0e0;
      padding: 3px 6px;
    }
    tr:nth-child(even) td {
      background: #fafafa !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Forcer l'affichage du tableau (annuler l'overflow hidden de Paper) */
    .MuiPaper-root { overflow: visible !important; box-shadow: none !important; }
    .MuiTableContainer-root { overflow: visible !important; }

    /* Liens en noir */
    a { color: black !important; text-decoration: none; }

    @page {
      size: A4 landscape;
      margin: 10mm;
    }
  }
`;

function RegistreView() {
  const navigate = useNavigate();

  const { filters, searchInput, page, setPage, setFilter, handleSearch, resetFilters, hasActiveFilter } =
    useEmployeeFilters();

  const [employees,   setEmployees]   = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [factories,   setFactories]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [absentToday, setAbsentToday] = useState({});

  // const { exporting, exportCSV, exportError } = useExportCSV(filters, "registre_personnel");

  useEffect(() => {
    hrClient.get("employees/factories/?page_size=200")
      .then((r) => setFactories(r.data.results ?? r.data)).catch(() => {});
    hrClient.get("employees/departments/?page_size=500")
      .then((r) => setDepartments(r.data.results ?? r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    hrClient.get("leaves/requests/presence-status/")
      .then((r) => {
        const map = {};
        (r.data.currently_absent || []).forEach((a) => { map[a.employee_id] = a; });
        setAbsentToday(map);
      })
      .catch(() => {});
  }, []);

  
  const fetchEmployees = useCallback(async (f, p) => {
    setLoading(true);
    try {
      const r = await hrClient.get("employees/", { params: buildApiParams(f, p, DEFAULT_PAGE_SIZE) });
      setEmployees(r.data.results ?? r.data);
      setTotal(r.data.count ?? 0);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);

    // console.log("employe:", employees)

  useEffect(() => {
    fetchEmployees(filters, page);
  }, [filters, page, fetchEmployees]);



  return (
    <div className="p-6">
      <style>{PRINT_STYLE}</style>

      {/* En-tête (masqué à l'impression) */}
      <div className="no-print flex justify-between items-start mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registre du personnel</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? "Chargement..." : `${total.toLocaleString()} employé(s)`}
          </p>
        </div>
        {/* <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-green-500 text-green-700 hover:bg-green-50 disabled:opacity-50"
          >
            <DownloadIcon fontSize="small" />
            {exporting ? "Export..." : "Export CSV"}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <PrintIcon fontSize="small" />
            Imprimer
          </button>
        </div> */}
      </div>

      {/* {exportError && <Alert severity="error" className="no-print mb-3">{exportError}</Alert>} */}

      {/* Filtres (masqués à l'impression) */}
      <div className="no-print">
        <EmployeeFilterBar
          filters={filters}
          searchInput={searchInput}
          onSearch={handleSearch}
          onFilterChange={setFilter}
          onReset={resetFilters}
          hasActiveFilter={hasActiveFilter}
          factories={factories}
          departments={departments}
        />
      </div>

      {/* Tableau — seul élément imprimé */}
      <div id="registre-print">

        {/* En-tête visible uniquement à l'impression */}
        <div id="print-header" style={{ display: "none" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
            Registre du personnel
          </h2>
          <p style={{ fontSize: 10, color: "#555" }}>
            Imprimé le {new Date().toLocaleDateString("fr-FR")} — {total.toLocaleString()} employé(s)
          </p>
        </div>

        <Paper elevation={2} sx={{ overflow: "hidden" }}>
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  {["#","Matricule","Nom","Prénom","Sexe","Naissance","CIN","CNAPS",
                    "Usine","Département","Poste","Contrat","Embauche","Statut"].map((h) => (
                    <TableCell key={h} sx={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#616161", whiteSpace: "nowrap" }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={14} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} align="center" sx={{ py: 6, color: "text.secondary" }}>
                      Aucun employé trouvé
                    </TableCell>
                  </TableRow>
                ) : employees.map((e, i) => (
                  <TableRow
                    key={e.id}
                    hover
                    sx={{ cursor: "pointer", bgcolor: i % 2 === 0 ? "#fff" : "#fafafa" }}
                    onClick={() => navigate(`/hr/employees/${e.id}`)}
                  >
                    <TableCell sx={{ fontSize: 12 }}>{page * DEFAULT_PAGE_SIZE + i + 1}</TableCell>
                    <TableCell sx={{ fontSize: 12, fontFamily: "monospace", color: "#1565c0" }}>{e.employee_id}</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>
                      {e.last_name}
                      {absentToday[e.id] && (
                        <Chip
                          label={absentToday[e.id].leave_type}
                          size="small"
                          sx={{
                            ml: 1, height: 18, fontSize: 10, fontWeight: 700,
                            bgcolor: "#fb8c00", color: "#fff",
                          }}
                          title={`Absent jusqu'au ${absentToday[e.id].end_date}`}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{e.first_name}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{e.sexe || "—"}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{e.birth_date || "—"}</TableCell>
                    <TableCell sx={{ fontSize: 12, fontFamily: "monospace" }}>{e.cin || "—"}</TableCell>
                    <TableCell sx={{ fontSize: 12, fontFamily: "monospace" }}>{e.cnaps || "—"}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{e.factory_name}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{e.department_name}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{e.job_title_name}</TableCell>
                    <TableCell><ContractBadge value={e.contract_type} /></TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{e.hire_date}</TableCell>
                    <TableCell><StatusBadge value={e.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            className="no-print"
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={DEFAULT_PAGE_SIZE}
            rowsPerPageOptions={[DEFAULT_PAGE_SIZE]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`}
          />
        </Paper>
      </div>
    </div>
  );
}

const SANCTION_STATUS_COLORS = { ACTIVE: "error", CANCELLED: "default", APPEALED: "warning" };
const SANCTION_STATUS_LABELS = { ACTIVE: "Active", CANCELLED: "Annulée", APPEALED: "En appel" };

// ─── FicheDetail ──────────────────────────────────────────────────────────────

function FicheDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [employee,  setEmployee]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [tab,       setTab]       = useState(0);

  const [leaves,    setLeaves]    = useState(null);
  const [payslips,  setPayslips]  = useState(null);
  const [shifts,    setShifts]    = useState(null);
  const [maternity, setMaternity] = useState(null);
  const [balances,  setBalances]  = useState(null);
  const fetchedTabs = React.useRef(new Set());
  const [sanctions, setSanctions] = useState(null);
  const [contractPdfUrl, setContractPdfUrl] = useState(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractError, setContractError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(true);
    hrClient.get(`employees/${id}/`)
      .then((r) => setEmployee(r.data))
      .catch(() => setError("Erreur chargement de la fiche employé."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!employee) return;
    const currentYear = new Date().getFullYear();
    hrClient.get(`leaves/balances/?employee=${id}&year=${currentYear}`)
      .then((r) => setBalances(r.data.results || r.data))
      .catch(() => setBalances([]));
  }, [employee, id]);

  useEffect(() => {
    if (!employee) return;
    if (tab !== 1) return;
    if (fetchedTabs.current.has("contract-pdf")) return;

    fetchedTabs.current.add("contract-pdf");
    setContractLoading(true);
    setContractError(null);

    hrClient
      .post(`documents/${employee.id}/cdd_6/pdf/`, {}, { responseType: "blob" })
      .then((r) => {
        const url = URL.createObjectURL(r.data);
        setContractPdfUrl(url);
      })
      .catch(() => setContractError("Impossible de générer l'aperçu du contrat."))
      .finally(() => setContractLoading(false));
  }, [tab, employee]);

  useEffect(() => {
    return () => {
      if (contractPdfUrl) URL.revokeObjectURL(contractPdfUrl);
    };
  }, [contractPdfUrl]);
    
  const downloadContract = async (format) => {
  setDownloading(true);
  try {
    const url = format === "pdf"
      ? `documents/${employee.id}/cdd_6/pdf/`
      : `documents/${employee.id}/cdd_6/`;

    const r = await hrClient.post(url, {}, { responseType: "blob" });
    const blobUrl = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `Contrat_de_travail_${employee.last_name}_${employee.first_name}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    setContractError("Échec du téléchargement.");
  } finally {
    setDownloading(false);
  }
};

  useEffect(() => {
    if (!employee) return;

    if (!fetchedTabs.current.has(2)) {
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
        .then((r) => setPayslips(r.data.results || r.data))
        .catch(() => setPayslips([]));
    }

    if (tab === 4 && !fetchedTabs.current.has(4)) {
      fetchedTabs.current.add(4);
      hrClient.get(`events/employee-shifts/?employee=${id}&page_size=20`)
        .then((r) => setShifts(r.data.results || r.data))
        .catch(() => setShifts([]));
    }
  }, [tab, employee, id]);

  if (tab === 9 && !fetchedTabs.current.has(9)) {
  fetchedTabs.current.add(9);
  hrClient.get(`sanctions/?employee=${id}&page_size=50`)
    .then((r) => setSanctions(r.data.results || r.data))
    .catch(() => setSanctions([]));
}

  if (loading)   return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (error)     return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;
  if (!employee) return null;

  const seniority    = calcSeniority(employee.hire_date, employee.termination_date);
  const attendanceId = employee.employee_id;
  const fullName     = `${employee.last_name} ${employee.first_name}`;
  const goToAnalysis = () =>
    navigate(`/attendance/analysis?user_id=${attendanceId}&name=${encodeURIComponent(fullName)}`);

  const today = new Date().toISOString().slice(0, 10);
  const currentAbsence = leaves?.find(
    (l) => l.status === "APPROVED" && l.start_date <= today && l.end_date >= today
  );

  const cdBalance = balances?.find((b) => b.leave_type_code === "CD");
  const cdRemaining = cdBalance ? Number(cdBalance.remaining_days) : null;

    // console.log("employe fiche:", employee

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/hr/employees")}>
          Retour à la liste
        </Button>
        {attendanceId ? (
          <Button variant="contained" color="primary" startIcon={<BarChartIcon />} onClick={goToAnalysis} sx={{ fontWeight: 700 }}>
            Analyse des présences
          </Button>
        ) : (
          <Button variant="outlined" disabled>Analyse des présences (pas d'ID appareil)</Button>
        )}
      </div>

      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <div className="flex gap-5 items-start">
          <Avatar src={employee.photo} sx={{ width: 100, height: 100, fontSize: 36, bgcolor: "primary.main" }}>
            {employee.first_name?.[0]}{employee.last_name?.[0]}
          </Avatar>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{employee.last_name} {employee.first_name}</h2>
                <p className="text-gray-500 mb-2">{employee.job_title_name}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip label={employee.employee_id} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />
                  <StatusChip value={employee.status} size="small" />
                  <Chip label={CONTRACT_LABELS[employee.contract_type] || employee.contract_type} size="small" variant="outlined" />
                  <Chip label={employee.factory_name}    size="small" color="primary"   variant="outlined" />
                  <Chip label={employee.department_name} size="small" color="secondary" variant="outlined" />
                  <Chip label={employee.classification_name || "-"} size="small" color="secondary" variant="outlined" />
                  {currentAbsence ? (
                    <Chip
                      label={`Absent — ${currentAbsence.leave_type_name} (jusqu'au ${currentAbsence.end_date})`}
                      size="small"
                      color="error"
                    />
                  ) : (
                    <Chip label="Présent" size="small" color="success" />
                  )}
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Solde congé (CD)</p>
                  <p
                    className="text-xl font-bold"
                    style={{ color: cdRemaining === null ? "#9e9e9e" : cdRemaining > 0 ? "#2e7d32" : "#c62828" }}
                  >
                    {cdBalance ? `${cdBalance.remaining_days}j` : "0j"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {cdBalance
                      ? `${cdBalance.entitled_days}j acquis − ${cdBalance.used_days}j pris${Number(cdBalance.pending_days) > 0 ? ` − ${cdBalance.pending_days}j en attente` : ""}`
                      : "0j acquis"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Ancienneté</p>
                  <p className="text-xl font-bold text-blue-600">{seniority}</p>
                  <p className="text-xs text-gray-400">Depuis le {employee.hire_date}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Paper>

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
        <Tab label={`Sanctions${sanctions !== null ? ` (${sanctions?.length || 0})` : ""}`} />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 3 }} elevation={1}>
          <p className="font-bold mb-3">Informations personnelles</p>
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
          <p className="font-bold mb-3">Documents officiels</p>
          <InfoRow label="CIN"      value={employee.cin} />
          <InfoRow label="Date CIN" value={employee.cin_date} />
          <InfoRow label="Lieu CIN" value={employee.cin_place} />
          <InfoRow label="CNAPS"    value={employee.cnaps} />
          <Divider sx={{ my: 2 }} />
          <p className="font-bold mb-3">Informations RH</p>
          <InfoRow label="N° RH"          value={employee.n_rh} />
          <InfoRow label="Classification" value={employee.classification_name} />
          <InfoRow label="Affectation"    value={employee.affectation} />
          <InfoRow label="Motif départ"   value={employee.motif_depart} />
        </Paper>
      )}

      {tab === 1 && (
  <>
    <Paper sx={{ p: 3, mb: 3 }} elevation={1}>
      <p className="font-bold mb-3">Contrat & Poste</p>
      <InfoRow label="Poste"           value={employee.job_title_name} />
      <InfoRow label="Type de contrat" value={CONTRACT_LABELS[employee.contract_type]} />
      <InfoRow label="Usine"           value={employee.factory_name} />
      <InfoRow label="Département"     value={employee.department_name} />
      <InfoRow label="Date d'embauche" value={employee.hire_date} />
      <InfoRow label="Date de fin"     value={employee.termination_date || "En cours"} />
      <InfoRow label="Statut"          value={STATUS_LABELS[employee.status]} />
    </Paper>

    <Paper sx={{ p: 3 }} elevation={1}>
      <div className="flex justify-between items-center mb-3">
        <p className="font-bold flex items-center gap-1.5">
          <VisibilityIcon fontSize="small" /> Aperçu du contrat de travail
        </p>
        <div className="flex gap-2">
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            disabled={downloading}
            onClick={() => downloadContract("pdf")}
          >
            PDF
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            disabled={downloading}
            onClick={() => downloadContract("docx")}
          >
            Word
          </Button>
        </div>
      </div>

      {contractLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : contractError ? (
        <Alert severity="error">{contractError}</Alert>
      ) : contractPdfUrl ? (
        <iframe
          src={contractPdfUrl}
          title="Aperçu contrat de travail"
          style={{ width: "100%", height: "70vh", border: "1px solid #e0e0e0", borderRadius: 4 }}
        />
      ) : (
        <p className="text-sm text-gray-500">Aucun aperçu disponible.</p>
      )}
    </Paper>
  </>
)}

      {tab === 2 && (
        leaves === null ? <TabSpinner /> : (
          <>
            <TableContainer component={Paper} elevation={1}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                    {["Type","Du","Au","Jours","Statut"].map((h) => (
                      <TableCell key={h}><strong>{h}</strong></TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {maternity.map((m) => (
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
                  {leaves.length === 0 && maternity.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        Aucun congé
                      </TableCell>
                    </TableRow>
                  ) : leaves.map((l) => (
                    <TableRow key={l.id} hover>
                      <TableCell>{l.leave_type_name}</TableCell>
                      <TableCell>{l.start_date}</TableCell>
                      <TableCell>{l.end_date}</TableCell>
                      <TableCell>{l.days_requested}j</TableCell>
                      <TableCell>
                        <Chip label={l.status} color={LEAVE_STATUS_CHIP_COLORS[l.status]} size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 2 }} />
            <p className="font-bold mb-3">Solde de congés — tous types</p>
            {balances === null ? <TabSpinner /> : balances.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun solde enregistré pour {new Date().getFullYear()}.</p>
            ) : (
              <TableContainer component={Paper} elevation={0} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                      {["Type", "Acquis", "Utilisé", "En attente", "Restant"].map((h) => (
                        <TableCell key={h}><strong>{h}</strong></TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {balances.map((b) => (
                      <TableRow key={b.id} hover>
                        <TableCell>{b.leave_type_name}</TableCell>
                        <TableCell>{b.entitled_days}j</TableCell>
                        <TableCell>{b.used_days}j</TableCell>
                        <TableCell>{b.pending_days}j</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: Number(b.remaining_days) > 0 ? "#2e7d32" : "#c62828" }}>
                          {b.remaining_days}j
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )
      )}

      {tab === 3 && (
        payslips === null ? <TabSpinner /> : (
          <TableContainer component={Paper} elevation={1}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  {["Période","Salaire base","Net","Statut"].map((h) => (
                    <TableCell key={h}><strong>{h}</strong></TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {payslips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      Aucune fiche de paie
                    </TableCell>
                  </TableRow>
                ) : payslips.map((p) => (
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
        )
      )}

      {tab === 4 && (
        shifts === null ? <TabSpinner /> : (
          <TableContainer component={Paper} elevation={1}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  {["Shift","Début","Fin","Note"].map((h) => (
                    <TableCell key={h}><strong>{h}</strong></TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {shifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      Aucun shift assigné
                    </TableCell>
                  </TableRow>
                ) : shifts.map((s) => (
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
        )
      )}

      {tab === 5 && (
        <Paper sx={{ p: 3 }} elevation={1}>
          <p className="font-bold mb-3">Ancienneté & Retraite</p>
          <InfoRow label="Date d'embauche" value={employee.hire_date} />
          <InfoRow label="Ancienneté"      value={seniority} />
          <InfoRow label="Type de contrat" value={CONTRACT_LABELS[employee.contract_type]} />
          {employee.contract_type === "CDD" && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Contrat CDD — Date de fin : <strong>{employee.termination_date || "Non définie"}</strong>
            </Alert>
          )}
          <Divider sx={{ my: 2 }} />
          <p className="font-bold mb-3">Retraite</p>
          <InfoRow label="Âge de retraite"          value="60 ans" />
          <InfoRow label="Date de retraite estimée" value={calcRetirementDate(employee.birth_date)} />
          <Alert severity="info" sx={{ mt: 2 }}>
            Pour calculer la date de retraite exacte, ajoutez la date de naissance dans le profil employé.
          </Alert>
        </Paper>
      )}

      {tab === 6 && (
        <Paper sx={{ p: 3 }} elevation={1}>
          <p className="font-bold mb-3">Documents RH</p>
          <DocumentsRH employee={employee} />
        </Paper>
      )}

      {tab === 7 && <EmployeeScheduleTab employeeId={employee.id} />}

      {tab === 8 && (
        <Paper sx={{ p: 5, textAlign: "center" }} elevation={1}>
          <BarChartIcon sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />
          <p className="text-lg font-bold mb-1">Analyse des présences</p>
          <p className="text-sm text-gray-500 mb-1">Employé : <strong>{fullName}</strong></p>
          <p className="text-sm text-gray-500 mb-4">ID appareil : <strong>{attendanceId}</strong></p>
          <Button variant="contained" size="large" startIcon={<BarChartIcon />}
            onClick={goToAnalysis} sx={{ fontWeight: 700, px: 4 }}>
            Ouvrir l'analyse des présences
          </Button>
        </Paper>
      )}

      {tab === 9 && (
  sanctions === null ? <TabSpinner /> : (
    <TableContainer component={Paper} elevation={1}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
            {["Sanction", "Date", "Motif", "Statut"].map((h) => (
              <TableCell key={h}><strong>{h}</strong></TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sanctions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                Aucune sanction enregistrée
              </TableCell>
            </TableRow>
          ) : sanctions.map((s) => (
            <TableRow key={s.id} hover>
              <TableCell>
                <Chip
                  label={s.sanction_type_name}
                  size="small"
                  sx={{ bgcolor: s.sanction_color, color: "#fff", fontWeight: 600 }}
                />
              </TableCell>
              <TableCell>{s.date}</TableCell>
              <TableCell sx={{ maxWidth: 350, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.reason}
              </TableCell>
              <TableCell>
                <Chip label={SANCTION_STATUS_LABELS[s.status]} color={SANCTION_STATUS_COLORS[s.status]} size="small" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
)}
    </div>
  );
}

// ─── Router ────────────────────────────────────────────────────────────────────

export default function EmployeeFiche() {
  const { id } = useParams();
  return id ? <FicheDetail /> : <RegistreView />;
}
