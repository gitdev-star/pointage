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

// Champs supplémentaires à saisir manuellement pour certains documents
// (mêmes valeurs appliquées à tous les employés sélectionnés)
const DOC_EXTRA_FIELDS = {
  certificat: [
    { key: "date_fin", label: "Date de fin (d�bauche)", type: "date" },
  ],
  convocation_cdd: [
    { key: "date_abandon",           label: "Date d'abandon de poste",   type: "date" },
    { key: "date_derniere_presence", label: "Date de dernière présence", type: "date" },
    { key: "montant",                label: "Montant dû (Ariary)",       type: "text" },
  ],
  convocation_cdi: [
    { key: "date_abandon",           label: "Date d'abandon de poste",   type: "date" },
    { key: "date_derniere_presence", label: "Date de dernière présence", type: "date" },
    { key: "montant",                label: "Montant dû (Ariary)",       type: "text" },
  ],
  suspension: [
    { key: "ref",                label: "Référence RH",                      type: "text" },
    { key: "date_certificat",    label: "Date du certificat médical",        type: "date" },
    { key: "delivre_par",        label: "Délivré par (médecin / hôpital)",   type: "text" },
    { key: "jours_arret",        label: "Durée de l'arrêt (jours)",          type: "text" },
    { key: "date_suspension",    label: "Suspension effective à compter du", type: "date" },
    { key: "duree_preavis",      label: "Durée du préavis",                  type: "text" },
    { key: "date_preavis_debut", label: "Début période préavis",             type: "date" },
    { key: "date_preavis_fin",   label: "Fin période préavis",               type: "date" },
  ],
};

const SINGLE_EMPLOYEE_ONLY = ["convocation_cdd", "convocation_cdi", "suspension"];

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
  const [extraValues, setExtraValues] = useState({}); // { [docType]: { [fieldKey]: value } }

  const updateExtraValue = (type, key, value) =>
    setExtraValues((prev) => ({ ...prev, [type]: { ...prev[type], [key]: value } }));

const fetchEmployees = async () => {
  setLoading(true); setError("");
  try {
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

const getRefMonthLabel = () => {
  // "2026-07" -> "juillet2026"
  const [year, m] = refMonth.split("-");
  const mois = [
    "janvier","fevrier","mars","avril","mai","juin",
    "juillet","aout","septembre","octobre","novembre","decembre",
  ];
  return `${mois[parseInt(m, 10) - 1]}${year}`;
};

// Construit le payload "extra" à envoyer au backend selon le type de document
const getExtraForType = (documentType) => {
  const base = cddType
    ? {
        anciennete_months: CDD_ANCIENNETE_TYPES.find((t) => t.value === cddType)?.months,
        ref_month: refMonth,
      }
    : {};
  const custom = DOC_EXTRA_FIELDS[documentType]
    ? (extraValues[documentType] || {})
    : {};
  return { ...base, ...custom };
};

const handleBulkZipDownload = async (documentType) => {
  if (selectedIds.length === 0) { alert("Veuillez selectionner au moins un employe."); return; }
  try {
    const extra = getExtraForType(documentType);

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
    const extra = getExtraForType(documentType);

    const res = await hrClient.post("documents/bulk-pdf/",
      { employee_ids: selectedIds, document_type: documentType, extra },
      { responseType: "blob" }
    );
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const win = window.open(url, "_blank");
    if (win) win.onload = () => { win.focus(); win.print(); };
  } catch (err) {
    let message = "Erreur lors de l'impression.";
    try {
      if (err.response?.data instanceof Blob) {
        const json = JSON.parse(await err.response.data.text());
        message = json.detail || message;
      }
    } catch {}
    console.error("Erreur impression :", message, err);
    alert(message);
  }
};

  const DOC_TYPES = [
  { type: "attestation",      label: "Attestation d'emploi",           color: "primary",   always: true },
  { type: "certificat",       label: "Certificat de travail",           color: "success",   always: true },
  { type: "evaluation_cdd",   label: "Evaluation - Contrat CDD 6 mois", color: "secondary", always: true },
  { type: "cdd_18",           label: "Evaluation & Confirmation CDI - CDD 18 mois",   color: "info",      always: true },
  { type: "cdd_12",           label: "Evaluation - Contrat CDD 12 mois",   color: "secondary",      always: true },
  { type: "cdd_3",           label: "Fiche d' evaluation essai",   color: "secondary",      always: true },
  { type: "cdd_6",            label: "Contrat de travail",       color: "warning",   always: true },
  { type: "convocation_cdd",  label: "Convocation abandon de poste (CDD)",  color: "error",     always: true },
  { type: "convocation_cdi",  label: "Convocation abandon de poste (CDI)",  color: "error",     always: true },
  { type: "suspension",       label: "Suspension de contrat (maladie)",     color: "warning",   always: true },
  { type: "badge",            label: "Badge employé",                   color: "info",      always: true },
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

<Dialog open={docModalOpen} onClose={() => setDocModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>Generer documents RH</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {selectedIds.length} employe(s) selectionne(s). Choisissez le document a generer.
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            {DOC_TYPES.filter((d) => d.always).map((doc) => {
              const requiresSingle = SINGLE_EMPLOYEE_ONLY.includes(doc.type);
              const tooMany = requiresSingle && selectedIds.length > 1;

              return (
                <Box
                  key={doc.type}
                  sx={{
                    p: 2, border: "1px solid #e0e0e0", borderRadius: 2, backgroundColor: "#fafafa",
                    display: "flex", flexDirection: "column",
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1} mb={1} flexWrap="wrap">
                    <Typography fontWeight={700}>{doc.label}</Typography>
                    {requiresSingle && (
                      <Chip label="1 employé max" size="small" color="warning" variant="outlined" />
                    )}
                  </Box>

                  {tooMany && (
                    <Alert severity="warning" sx={{ mb: 1.5 }}>
                      Ce document contient des informations propres à un seul employé (dates, montant...).
                      Merci de sélectionner un seul employé pour le générer.
                    </Alert>
                  )}

                  {DOC_EXTRA_FIELDS[doc.type] && (
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 1.5 }}>
                      {DOC_EXTRA_FIELDS[doc.type].map((f) => (
                        <TextField
                          key={f.key}
                          size="small"
                          label={f.label}
                          type={f.type}
                          value={extraValues[doc.type]?.[f.key] || ""}
                          onChange={(e) => updateExtraValue(doc.type, f.key, e.target.value)}
                          InputLabelProps={f.type === "date" ? { shrink: true } : undefined}
                          disabled={tooMany}
                        />
                      ))}
                    </Box>
                  )}

                  <Box display="flex" gap={1} flexWrap="wrap" mt="auto">
                    <Button variant="contained" color={doc.color} onClick={() => handleBulkZipDownload(doc.type)} disabled={tooMany}>
                      Telecharger ZIP
                    </Button>
                    <Button variant="outlined" color={doc.color} onClick={() => handleBulkPrint(doc.type)} disabled={tooMany}>
                      Imprimer PDF
                    </Button>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocModalOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}