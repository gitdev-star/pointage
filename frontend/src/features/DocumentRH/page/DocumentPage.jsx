import React, { useEffect, useMemo, useState } from "react";
import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import {
  Alert, Button, Chip, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions,
  Box, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import hrClient from "../../../api/hrClient";
import EmployeeDocumentTable from "../component/EmployeDocumentListe";

export default function DocumentsRHPage() {
  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const rowsPerPage = 50;
  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-07"
  const [refMonth, setRefMonth] = useState(currentMonth);
  const [cddType, setCddType] = useState(""); // "" | "cdd_3" | "cdd_6" | "cdd_12" | "cdd_18"

  // const selectedEmployees = employees.filter((emp) => selectedIds.includes(emp.employee_id));
  // const hasOnlyCDI = selectedEmployees.length > 0 && selectedEmployees.every((emp) => emp.contract_type === "CDI");

const fetchEmployees = async () => {
  setLoading(true); setError("");
  try {
    const anciennete = cddType
      ? CDD_ANCIENNETE_TYPES.find((t) => t.value === cddType)?.months
      : undefined;

    const res = await hrClient.get("employees/", {
      params: {
        page: page + 1,
        page_size: rowsPerPage,
        status: "ACTIVE",
        search: search || undefined,
        contract_type: cddType ? "CDD" : undefined,
        ref_month: cddType ? refMonth : undefined,
        anciennete_months: cddType
        ? CDD_ANCIENNETE_TYPES.find((t) => t.value === cddType)?.months
        : undefined,
      },
    });
    const data = res.data;
    if (Array.isArray(data)) { setEmployees(data); setTotal(data.length); }
    else { setEmployees(data.results || []); setTotal(data.count || 0); }
  } catch (err) {
    console.error("Erreur employees:", err.response?.data || err);
    setError("Impossible de charger la liste des employes.");
  } finally { setLoading(false); }
};

useEffect(() => { fetchEmployees(); }, [page, search, cddType, refMonth]);

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter((emp) => {
      const fullText = [emp.employee_id, emp.last_name, emp.first_name, emp.job_title_name, emp.job_title, emp.department_name]
        .filter(Boolean).join(" ").toLowerCase();
      return fullText.includes(q);
    });
  }, [employees, search]);

  const toggleOne = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleAll = () => {
    const visibleIds = filteredEmployees.map((e) => e.employee_id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    else setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  
const CDD_MONTHS_LABEL = {
  "3": "3mois", "6": "6mois", "12": "12mois", "18": "18mois",
};

const getRefMonthLabel = () => {
  // "2026-07" -> "juillet2026"
  const [year, m] = refMonth.split("-");
  const mois = [
    "janvier","fevrier","mars","avril","mai","juin",
    "juillet","aout","septembre","octobre","novembre","decembre",
  ];
  return `${mois[parseInt(m, 10) - 1]}${year}`;
};

const handleBulkZipDownload = async (documentType) => {
  if (selectedIds.length === 0) { alert("Veuillez selectionner au moins un employe."); return; }
  try {
    const extra = cddType
      ? {
          anciennete_months: CDD_ANCIENNETE_TYPES.find((t) => t.value === cddType)?.months,
          ref_month: refMonth,
        }
      : {};

    const res = await hrClient.post("documents/bulk/",
      { employee_ids: selectedIds, document_type: documentType, extra },
      { responseType: "blob" }
    );

    const suffix = cddType
      ? `_${CDD_ANCIENNETE_TYPES.find(t => t.value === cddType)?.months}mois_${getRefMonthLabel()}`
      : "";

    const url = URL.createObjectURL(new Blob([res.data], { type: "application/zip" }));
    const a = document.createElement("a"); a.href = url;
    a.download = `documents_rh_${documentType}${suffix}.zip`; a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    let message = "Erreur lors de la generation du ZIP.";
    try {
      if (err.response?.data instanceof Blob) {
        const json = JSON.parse(await err.response.data.text());
        message = json.detail || message;
      }
    } catch {}
    alert(message);
  }
};

const handleBulkPrint = async (documentType) => {
  if (selectedIds.length === 0) { alert("Veuillez selectionner au moins un employe."); return; }
  try {
    const extra = cddType
    ? {
        anciennete_months: CDD_ANCIENNETE_TYPES.find((t) => t.value === cddType)?.months,
        ref_month: refMonth,
      }
    : {};

    const res = await hrClient.post("documents/bulk-pdf/",
      { employee_ids: selectedIds, document_type: documentType, extra },
      { responseType: "blob" }
    );
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const win = window.open(url, "_blank");
    if (win) win.onload = () => { win.focus(); win.print(); };
  } catch (err) { console.error("Erreur impression :", err); alert("Erreur lors de l'impression."); }
};

  // const DOC_TYPES = [
  //   { type: "attestation",      label: "Attestation d'emploi",           color: "primary",   always: true },
  //   { type: "certificat",       label: "Certificat de travail",           color: "success",   always: true },
  //   { type: "cdd_6",      label: "Contrat de travail CDD",          color: "warning",   always: false },
  //   { type: "evaluation_cdd",   label: "Evaluation & Renouvellement CDD", color: "secondary", always: false },
  //   { type: "ccdd_18", label: "Evaluation & Confirmation CDI",   color: "info",      always: true },
  // ];

  const DOC_TYPES = [
  { type: "attestation",      label: "Attestation d'emploi",           color: "primary",   always: true },
  { type: "certificat",       label: "Certificat de travail",           color: "success",   always: true },
  // { type: "cdd_6",            label: "Contrat de travail CDD 6 mois",          color: "warning",   always: false },
  { type: "evaluation_cdd",   label: "Evaluation & Renouvellement CDD", color: "secondary", always: true },
  { type: "cdd_18",           label: "Evaluation & Confirmation CDI - CDD 18 mois",   color: "info",      always: true },
  { type: "cdd_12",           label: "Evaluation - Contrat CDD 12 mois",   color: "secondary",      always: true },
  { type: "cdd_3",           label: "Evaluation - Contrat CDD 3 mois",   color: "secondary",      always: true },
  { type: "cdd_6",            label: "Evaluation - Contrat CDD 6 mois",       color: "warning",   always: true },
];
  // en haut du fichier, à côté de DOC_TYPES
const CDD_ANCIENNETE_TYPES = [
  { value: "cdd_3",  label: "CDD 3 mois",  months: 3 },
  { value: "cdd_6",  label: "CDD 6 mois",  months: 6 },
  { value: "cdd_12", label: "CDD 12 mois", months: 12 },
  { value: "cdd_18", label: "CDD 18 mois", months: 18 },
];

// helper : différence en mois calendaires entre la date d'embauche et le mois de référence
function getMonthsBetween(hireDateStr, refYearMonth) {
  if (!hireDateStr || !refYearMonth) return null;
  const hire = new Date(hireDateStr);
  const [refYear, refMonthNum] = refYearMonth.split("-").map(Number);
  const hireYear = hire.getFullYear();
  const hireMonthNum = hire.getMonth() + 1;
  return (refYear - hireYear) * 12 + (refMonthNum - hireMonthNum);
}

const anciennetEmployees = useMemo(() => {
  if (!cddType) return filteredEmployees;
  const target = CDD_ANCIENNETE_TYPES.find((d) => d.value === cddType)?.months;
  if (target == null) return filteredEmployees;

  return filteredEmployees.filter((emp) => {
    if (emp.contract_type !== "CDD") return false;
    return getMonthsBetween(emp.hire_date, refMonth) === target;
  });
}, [filteredEmployees, cddType, refMonth]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents RH</h1>
          <p className="text-sm text-gray-500">Selectionnez les employes concernes par le document RH.</p>
        </div>
        <Chip label={`${selectedIds.length} selectionne(s)`} color="primary" variant="outlined" />
      </div>

      <div className="mb-4 max-w-md">
        <TextField fullWidth size="small" placeholder="Rechercher nom, prenom, matricule, poste..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }}
        />
      </div>

      <div className="mb-4 flex gap-3 flex-wrap items-center">
        <TextField
          label="Mois de référence"
          type="month"
          size="small"
          value={refMonth}
          onChange={(e) => { setRefMonth(e.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }}
        />

        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Type de contrat CDD</InputLabel>
          <Select
            label="Type de contrat CDD"
            value={cddType}
            onChange={(e) => { setCddType(e.target.value); setPage(0); }}
          >
            <MenuItem value="">Tous</MenuItem>
            {CDD_ANCIENNETE_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {cddType && (
          <Chip
            label={`${anciennetEmployees.length} employé(s) — ${CDD_ANCIENNETE_TYPES.find(t => t.value === cddType)?.label}`}
            color="warning"
          />
        )}
      </div>


      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <EmployeeDocumentTable
        employees={anciennetEmployees } selectedIds={selectedIds} loading={loading}
        page={page} total={total} rowsPerPage={rowsPerPage}
        onPageChange={setPage} onToggleOne={toggleOne} onToggleAll={toggleAll}
      />

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outlined" disabled={selectedIds.length === 0} onClick={() => setSelectedIds([])}>
          Annuler la selection
        </Button>
        <Button variant="contained" disabled={selectedIds.length === 0} onClick={() => setDocModalOpen(true)}>
          Generer document RH
        </Button>
      </div>

      <Dialog open={docModalOpen} onClose={() => setDocModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Generer documents RH</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {selectedIds.length} employe(s) selectionne(s). Choisissez le document a generer.
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            {DOC_TYPES.filter((d) => d.always).map((doc) => (
              <Box key={doc.type} sx={{ p: 2, border: "1px solid #e0e0e0", borderRadius: 2, backgroundColor: "#fafafa" }}>
                <Typography fontWeight={700} mb={1}>{doc.label}</Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button variant="contained" color={doc.color} onClick={() => handleBulkZipDownload(doc.type)}>
                    Telecharger ZIP
                  </Button>
                  <Button variant="outlined" color={doc.color} onClick={() => handleBulkPrint(doc.type)}>
                    Imprimer PDF
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocModalOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
