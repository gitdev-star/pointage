import React, { useEffect, useState, useCallback, useRef } from "react";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Box, Typography, TextField, MenuItem, Select, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Tooltip,
  TablePagination, CircularProgress, Avatar, InputAdornment,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, Alert, Divider,
} from "@mui/material";
import SearchIcon        from "@mui/icons-material/Search";
import RefreshIcon       from "@mui/icons-material/Refresh";
import AddIcon           from "@mui/icons-material/Add";
import EditIcon          from "@mui/icons-material/Edit";
import DeleteIcon        from "@mui/icons-material/Delete";
import PhotoCameraIcon   from "@mui/icons-material/PhotoCamera";
import DownloadIcon      from "@mui/icons-material/Download";
import PrintIcon         from "@mui/icons-material/Print";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import hrClient          from "../../api/hrClient";
import { useNavigate }   from "react-router-dom";
import { useHRAuth }     from "../../contexts/HRAuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  ACTIVE: "success", INACTIVE: "default", ON_LEAVE: "warning", TERMINATED: "error",
};
const STATUS_LABELS = {
  ACTIVE: "Actif", INACTIVE: "Inactif", ON_LEAVE: "En congé", TERMINATED: "Résilié",
};
const CONTRACT_LABELS = {
  CDI: "CDI", CDD: "CDD", INTERN: "Stage", PART: "Temps partiel", SEASONAL: "Saisonnier",
};
const SEXE_OPTIONS = [
  { value: "Masculin", label: "Masculin" },
  { value: "Féminin",  label: "Féminin"  },
];
const STATUS_STYLE = {
  ACTIVE:     { bg: "#e8f5e9", color: "#2e7d32" },
  INACTIVE:   { bg: "#f5f5f5", color: "#616161" },
  TERMINATED: { bg: "#fce4ec", color: "#c62828" },
  ON_LEAVE:   { bg: "#fff8e1", color: "#f57f17" },
};
const CONTRACT_STYLE = {
  CDI:      { bg: "#e3f2fd", color: "#1565c0" },
  CDD:      { bg: "#fff8e1", color: "#f57f17" },
  INTERN:   { bg: "#f3e5f5", color: "#6a1b9a" },
  PART:     { bg: "#e8f5e9", color: "#2e7d32" },
  SEASONAL: { bg: "#fce4ec", color: "#c62828" },
};

const EMPTY_FORM = {
  employee_id: "", first_name: "", last_name: "", sexe: "",
  birth_date: "", birth_place: "",
  email: "", phone: "", address: "",
  cin: "", cin_date: "", cin_place: "",
  cnaps: "", nbre_enfants: "",
  factory: "", department: "", section: "",
  job_title: "", contract_type: "CDI",
  hire_date: "", termination_date: "", status: "ACTIVE",
  motif_depart: "",
  matricule_paie: "", affectation: "", hk_ou_pbi: "",
  n_rh: "", salaire: "", classification: "",
  device_user_id: "", auth_user_id: "",
};

function InlineBadge({ value, styleMap, labelMap }) {
  const s = styleMap[value] || { bg: "#f5f5f5", color: "#616161" };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600,
      padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>
      {(labelMap && labelMap[value]) || value || "—"}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EmployeeList() {
  const { can } = useHRAuth();
  const navigate = useNavigate();

  const [employees, setEmployees]     = useState([]);
  const [factories, setFactories]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections]       = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [postes, setPostes]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [total, setTotal]             = useState(0);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [factory, setFactory]         = useState("");
  const [department, setDepartment]   = useState("");
  const [statusFilter, setStatus]     = useState("");
  const [contractFilter, setContract] = useState("");
  const [sexeFilter, setSexe]         = useState("");
  const debounceRef                   = useRef(null);

  // Pagination
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Modal
  const [modalOpen, setModalOpen]       = useState(false);
  const [modalMode, setModalMode]       = useState("add");
  const [formData, setFormData]         = useState(EMPTY_FORM);
  const [formErrors, setFormErrors]     = useState({});
  const [saving, setSaving]             = useState(false);
  const [alert, setAlert]               = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [photoFile, setPhotoFile]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Cascading selects
  const filteredDepts = factory
    ? departments.filter(d => String(d.factory) === String(factory))
    : departments;
  const filteredModalDepts = formData.factory
    ? departments.filter(d => String(d.factory) === String(formData.factory))
    : departments;
  const filteredSections = formData.department
    ? sections.filter(s => String(s.department) === String(formData.department))
    : [];

  const hasActiveFilter = search || factory || department || statusFilter || contractFilter || sexeFilter;

  // ── Fetch ──
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, page_size: rowsPerPage };
      if (search)         params.search        = search;
      if (factory)        params.factory       = factory;
      if (department)     params.department    = department;
      if (statusFilter)   params.status        = statusFilter;
      if (contractFilter) params.contract_type = contractFilter;
      if (sexeFilter)     params.sexe          = sexeFilter;
      const res = await hrClient.get("employees/", { params });
      setEmployees(res.data.results || res.data);
      setTotal(res.data.count || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, rowsPerPage, search, factory, department, statusFilter, contractFilter, sexeFilter]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  useEffect(() => {
    hrClient.get("employees/factories/?page_size=100")
      .then(r => setFactories(r.data.results || r.data)).catch(() => {});
    hrClient.get("employees/departments/?page_size=200")
      .then(r => setDepartments(r.data.results || r.data)).catch(() => {});
    hrClient.get("employees/sections/?page_size=500")
      .then(r => setSections(r.data.results || r.data)).catch(() => {});
    hrClient.get("employees/classifications/?page_size=200")
      .then(r => setClassifications(r.data.results || r.data)).catch(() => {});
    hrClient.get("employees/postes/?page_size=500")
      .then(r => setPostes(r.data.results || r.data)).catch(() => {});
  }, []);

  const handleSearchChange = (val) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(val); setPage(0); }, 350);
  };

  const resetFilters = () => {
    setSearchInput(""); setSearch("");
    setFactory(""); setDepartment("");
    setStatus(""); setContract(""); setSexe("");
    setPage(0);
  };

  // ── Export CSV ──
  const exportCSV = async () => {
    setExporting(true);
    try {
      const params = { page_size: 5000 };
      if (search)         params.search        = search;
      if (factory)        params.factory       = factory;
      if (department)     params.department    = department;
      if (statusFilter)   params.status        = statusFilter;
      if (contractFilter) params.contract_type = contractFilter;
      if (sexeFilter)     params.sexe          = sexeFilter;
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
      a.href = url;
      a.download = "employes_" + new Date().toISOString().slice(0, 10) + ".csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch { setAlert({ type: "error", msg: "Erreur lors de l'export." }); }
    finally { setExporting(false); }
  };

  // ── Modal ──
  const openAdd = () => {
    setFormData(EMPTY_FORM); setFormErrors({});
    setPhotoFile(null); setPhotoPreview(null);
    setModalMode("add"); setModalOpen(true);
  };

  const openEdit = (emp) => {
    setFormData({
      employee_id:      emp.employee_id      || "",
      first_name:       emp.first_name       || "",
      last_name:        emp.last_name        || "",
      sexe:             emp.sexe             || "",
      birth_date:       emp.birth_date       || "",
      birth_place:      emp.birth_place      || "",
      email:            emp.email            || "",
      phone:            emp.phone            || "",
      address:          emp.address          || "",
      cin:              emp.cin              || "",
      cin_date:         emp.cin_date         || "",
      cin_place:        emp.cin_place        || "",
      cnaps:            emp.cnaps            || "",
      nbre_enfants:     emp.nbre_enfants     ?? "",
      factory:          emp.factory          || "",
      department:       emp.department       || "",
      section:          emp.section          || "",
      job_title:        emp.job_title        ?? "",
      contract_type:    emp.contract_type    || "CDI",
      hire_date:        emp.hire_date        || "",
      termination_date: emp.termination_date || "",
      status:           emp.status           || "ACTIVE",
      motif_depart:     emp.motif_depart     || "",
      matricule_paie:   emp.matricule_paie   || "",
      affectation:      emp.affectation      || "",
      hk_ou_pbi:        emp.hk_ou_pbi        || "",
      n_rh:             emp.n_rh             || "",
      salaire:          emp.salaire          || "",
      classification:   emp.classification   ?? "",
      device_user_id:   emp.device_user_id   ?? "",
      auth_user_id:     emp.auth_user_id     ?? "",
      _id: emp.id,
    });
    setFormErrors({}); setPhotoFile(null);
    setPhotoPreview(emp.photo || null);
    setModalMode("edit"); setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false); setFormData(EMPTY_FORM);
    setFormErrors({}); setPhotoFile(null); setPhotoPreview(null);
  };

  const handleFormChange = (field, value) => {
    let extra = {};
    if (field === "factory")                    extra = { department: "", section: "" };
    if (field === "department")                 extra = { section: "" };
    if (field === "termination_date" && value)  extra.status = "TERMINATED";
    if (field === "termination_date" && !value) extra.status = "ACTIVE";
    setFormData(prev => ({ ...prev, [field]: value, ...extra }));
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: "" }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
  };

  const validate = () => {
    const errors = {};
    if (!formData.employee_id.trim()) errors.employee_id = "Requis";
    if (!formData.first_name.trim())  errors.first_name  = "Requis";
    if (!formData.last_name.trim())   errors.last_name   = "Requis";
    if (!formData.factory)            errors.factory     = "Requis";
    if (!formData.department)         errors.department  = "Requis";
    if (!formData.job_title)          errors.job_title   = "Requis";
    if (!formData.hire_date)          errors.hire_date   = "Requis";
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = "Email invalide";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = new FormData();
      const textFields = [
        "employee_id","first_name","last_name","sexe","birth_date","birth_place",
        "email","phone","address",
        "cin","cin_date","cin_place","cnaps",
        "factory","department","section",
        "job_title","contract_type","hire_date","termination_date","status","motif_depart",
        "matricule_paie","affectation","hk_ou_pbi","n_rh","salaire","classification",
      ];
      textFields.forEach(f => {
        if (formData[f] !== "" && formData[f] != null) payload.append(f, formData[f]);
      });
      if (formData.nbre_enfants !== "")   payload.append("nbre_enfants",   formData.nbre_enfants);
      if (formData.device_user_id !== "") payload.append("device_user_id", formData.device_user_id);
      if (formData.auth_user_id   !== "") payload.append("auth_user_id",   formData.auth_user_id);
      if (photoFile) payload.append("photo", photoFile);

      if (modalMode === "add") {
        await hrClient.post("employees/", payload, { headers: { "Content-Type": "multipart/form-data" } });
        setAlert({ type: "success", msg: "Employé créé avec succès." });
      } else {
        await hrClient.patch(`employees/${formData._id}/`, payload, { headers: { "Content-Type": "multipart/form-data" } });
        setAlert({ type: "success", msg: "Employé mis à jour avec succès." });
      }
      closeModal(); fetchEmployees();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const be = {};
        Object.entries(data).forEach(([k, v]) => { be[k] = Array.isArray(v) ? v.join(" ") : v; });
        setFormErrors(be);
      } else {
        setAlert({ type: "error", msg: "Erreur lors de la sauvegarde." });
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await hrClient.delete(`employees/${deleteDialog.id}/`);
      setAlert({ type: "success", msg: `${deleteDialog.name} supprimé.` });
      setDeleteDialog(null); fetchEmployees();
    } catch {
      setAlert({ type: "error", msg: "Erreur lors de la suppression." });
    } finally { setDeleting(false); }
  };

  const FD = ({ label }) => (
    <Grid item xs={12}>
      <Divider sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Divider>
    </Grid>
  );

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #emp-print th, #emp-print td { padding: 3px 6px !important; font-size: 9px !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <Box className="no-print"
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
        <Typography variant="h5" fontWeight={700}>
          Employés <Chip label={total} size="small" color="primary" sx={{ ml: 1 }} />
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Tooltip title="Actualiser">
            <IconButton onClick={fetchEmployees} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
          <Button variant="outlined" color="success" size="small"
            startIcon={<DownloadIcon />} onClick={exportCSV} disabled={exporting}>
            {exporting ? "Export..." : "Export CSV"}
          </Button>
          <Button variant="outlined" size="small" startIcon={<PrintIcon />}
            onClick={() => window.print()}>
            Imprimer
          </Button>
          {can("employees_write") && (
            <>
              <Button variant="outlined" size="small" startIcon={<UploadFileIcon />}
                onClick={() => navigate("/hr/import")}>
                Importer
              </Button>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAdd}>
                Ajouter
              </Button>
            </>
          )}
        </Box>
      </Box>

      {alert && (
        <Alert className="no-print" severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>
          {alert.msg}
        </Alert>
      )}

      {/* ── Filters ── */}
      <Box className="no-print"
        sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <TextField
          placeholder="Rechercher nom, ID, poste, CIN..."
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          size="small" sx={{ minWidth: 240 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        {/* Statut */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Statut</InputLabel>
          <Select value={statusFilter} label="Statut"
            onChange={e => { setStatus(e.target.value); setPage(0); }}>
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </Select>
        </FormControl>
        {/* Contrat */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Contrat</InputLabel>
          <Select value={contractFilter} label="Contrat"
            onChange={e => { setContract(e.target.value); setPage(0); }}>
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(CONTRACT_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </Select>
        </FormControl>
        {/* Sexe */}
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Sexe</InputLabel>
          <Select value={sexeFilter} label="Sexe"
            onChange={e => { setSexe(e.target.value); setPage(0); }}>
            <MenuItem value="">Tous</MenuItem>
            <MenuItem value="Féminin">Femmes</MenuItem>
            <MenuItem value="Masculin">Hommes</MenuItem>
          </Select>
        </FormControl>
        {/* Usine */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Usine</InputLabel>
          <Select value={factory} label="Usine"
            onChange={e => { setFactory(e.target.value); setDepartment(""); setPage(0); }}>
            <MenuItem value="">Toutes</MenuItem>
            {factories.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
          </Select>
        </FormControl>
        {/* Département */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Département</InputLabel>
          <Select value={department} label="Département"
            onChange={e => { setDepartment(e.target.value); setPage(0); }}>
            <MenuItem value="">Tous</MenuItem>
            {filteredDepts.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </Select>
        </FormControl>
        {/* Reset */}
        {hasActiveFilter && (
          <Button size="small" color="error" variant="outlined"
            startIcon={<FilterListOffIcon />} onClick={resetFilters}>
            Réinitialiser
          </Button>
        )}
      </Box>

      {/* ── Table ── */}
      <Paper elevation={2}>
        <TableContainer id="emp-print">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell className="no-print"><strong>Photo</strong></TableCell>
                <TableCell><strong>Matricule</strong></TableCell>
                <TableCell><strong>Nom</strong></TableCell>
                <TableCell><strong>Prénom</strong></TableCell>
                <TableCell><strong>Sexe</strong></TableCell>
                <TableCell><strong>Poste</strong></TableCell>
                <TableCell><strong>Usine</strong></TableCell>
                <TableCell><strong>Département</strong></TableCell>
                <TableCell><strong>Contrat</strong></TableCell>
                <TableCell><strong>Embauche</strong></TableCell>
                <TableCell><strong>Statut</strong></TableCell>
                {(can("employees_write") || can("employees_delete")) && (
                  <TableCell className="no-print"><strong>Actions</strong></TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 5, color: "text.secondary" }}>
                    Aucun employé trouvé
                  </TableCell>
                </TableRow>
              ) : employees.map((emp, i) => (
                <TableRow key={emp.id} hover
                  sx={{ cursor: "pointer", bgcolor: i % 2 === 0 ? "#fff" : "#fafafa" }}
                  onClick={() => navigate(`/hr/employees/${emp.id}`)}>
                  <TableCell className="no-print">
                    <Avatar src={emp.photo} sx={{ width: 34, height: 34 }}>
                      {emp.first_name?.[0]}{emp.last_name?.[0]}
                    </Avatar>
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12, color: "#1565c0" }}>
                    {emp.employee_id}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>{emp.last_name}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{emp.first_name}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{emp.sexe || "—"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{emp.job_title_name || "—"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{emp.factory_name}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{emp.department_name}</TableCell>
                  <TableCell>
                    <InlineBadge value={emp.contract_type} styleMap={CONTRACT_STYLE} labelMap={CONTRACT_LABELS} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{emp.hire_date}</TableCell>
                  <TableCell>
                    <InlineBadge value={emp.status} styleMap={STATUS_STYLE} labelMap={STATUS_LABELS} />
                  </TableCell>
                  {(can("employees_write") || can("employees_delete")) && (
                    <TableCell className="no-print">
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        {can("employees_write") && (
                          <Tooltip title="Modifier">
                            <span onClick={e => e.stopPropagation()}>
                              <IconButton size="small" color="primary" onClick={() => openEdit(emp)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {can("employees_delete") && (
                          <Tooltip title="Supprimer">
                            <span onClick={e => e.stopPropagation()}>
                              <IconButton size="small" color="error"
                                onClick={() => setDeleteDialog({ id: emp.id, name: `${emp.last_name} ${emp.first_name}` })}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination className="no-print"
          component="div" count={total} page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[20, 50, 100]} labelRowsPerPage="Lignes par page"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`}
        />
      </Paper>

      {/* ══════════════════════════════════════════════
          Add / Edit Modal
      ══════════════════════════════════════════════ */}
      <Dialog open={modalOpen} onClose={closeModal} maxWidth="md" fullWidth
        PaperProps={{ sx: { maxHeight: "92vh" } }}>
        <DialogTitle fontWeight={700}>
          {modalMode === "add" ? "➕ Ajouter un employé" : "✏️ Modifier l'employé"}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>

            <Grid item xs={12} sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
              <Avatar src={photoPreview} sx={{ width: 72, height: 72, fontSize: 28 }}>
                {formData.first_name?.[0]}{formData.last_name?.[0]}
              </Avatar>
              <Button component="label" variant="outlined" startIcon={<PhotoCameraIcon />} size="small">
                {photoPreview ? "Changer la photo" : "Ajouter une photo"}
                <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
              </Button>
            </Grid>

            <FD label="Identité" />
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="ID Employé *" value={formData.employee_id}
                onChange={e => handleFormChange("employee_id", e.target.value)}
                error={!!formErrors.employee_id} helperText={formErrors.employee_id}
                disabled={modalMode === "edit"} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Prénom *" value={formData.first_name}
                onChange={e => handleFormChange("first_name", e.target.value)}
                error={!!formErrors.first_name} helperText={formErrors.first_name} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Nom *" value={formData.last_name}
                onChange={e => handleFormChange("last_name", e.target.value)}
                error={!!formErrors.last_name} helperText={formErrors.last_name} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Sexe</InputLabel>
                <Select value={formData.sexe} label="Sexe"
                  onChange={e => handleFormChange("sexe", e.target.value)}>
                  <MenuItem value="">—</MenuItem>
                  {SEXE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Date de naissance" type="date"
                value={formData.birth_date} onChange={e => handleFormChange("birth_date", e.target.value)}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Lieu de naissance" value={formData.birth_place}
                onChange={e => handleFormChange("birth_place", e.target.value)} />
            </Grid>

            <FD label="Contact" />
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Email" value={formData.email}
                onChange={e => handleFormChange("email", e.target.value)}
                error={!!formErrors.email} helperText={formErrors.email} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Téléphone" value={formData.phone}
                onChange={e => handleFormChange("phone", e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Adresse" value={formData.address}
                onChange={e => handleFormChange("address", e.target.value)} multiline minRows={2} />
            </Grid>

            <FD label="État civil & documents" />
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="CIN" value={formData.cin}
                onChange={e => handleFormChange("cin", e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Date CIN" type="date"
                value={formData.cin_date} onChange={e => handleFormChange("cin_date", e.target.value)}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Lieu CIN" value={formData.cin_place}
                onChange={e => handleFormChange("cin_place", e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="CNAPS" value={formData.cnaps}
                onChange={e => handleFormChange("cnaps", e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Nombre d'enfants" type="number"
                inputProps={{ min: 0 }} value={formData.nbre_enfants}
                onChange={e => handleFormChange("nbre_enfants", e.target.value)} />
            </Grid>

            <FD label="Organisation" />
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small" error={!!formErrors.factory}>
                <InputLabel>Usine *</InputLabel>
                <Select value={formData.factory} label="Usine *"
                  onChange={e => handleFormChange("factory", e.target.value)}>
                  {factories.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                </Select>
                {formErrors.factory && <Typography variant="caption" color="error">{formErrors.factory}</Typography>}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small" error={!!formErrors.department}>
                <InputLabel>Département *</InputLabel>
                <Select value={formData.department} label="Département *"
                  onChange={e => handleFormChange("department", e.target.value)}
                  disabled={!formData.factory}>
                  {filteredModalDepts.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
                {formErrors.department && <Typography variant="caption" color="error">{formErrors.department}</Typography>}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Section</InputLabel>
                <Select value={formData.section} label="Section"
                  onChange={e => handleFormChange("section", e.target.value)}
                  disabled={!formData.department}>
                  <MenuItem value="">—</MenuItem>
                  {filteredSections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" error={!!formErrors.job_title}>
                <InputLabel>Poste *</InputLabel>
                <Select
                  value={formData.job_title}
                  label="Poste *"
                  onChange={e => handleFormChange("job_title", e.target.value)}
                >
                  <MenuItem value="">—</MenuItem>
                  {postes.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
                {formErrors.job_title && (
                  <Typography variant="caption" color="error">{formErrors.job_title}</Typography>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Type de contrat</InputLabel>
                <Select value={formData.contract_type} label="Type de contrat"
                  onChange={e => handleFormChange("contract_type", e.target.value)}>
                  {Object.entries(CONTRACT_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Affectation" value={formData.affectation}
                onChange={e => handleFormChange("affectation", e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="HK ou PBI" value={formData.hk_ou_pbi}
                onChange={e => handleFormChange("hk_ou_pbi", e.target.value)} />
            </Grid>

            <FD label="Emploi" />
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Date d'embauche *" type="date"
                value={formData.hire_date} onChange={e => handleFormChange("hire_date", e.target.value)}
                error={!!formErrors.hire_date} helperText={formErrors.hire_date}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Date de fin" type="date"
                value={formData.termination_date}
                onChange={e => handleFormChange("termination_date", e.target.value)}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Statut</InputLabel>
                <Select value={formData.status} label="Statut"
                  onChange={e => handleFormChange("status", e.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Motif de départ" value={formData.motif_depart}
                onChange={e => handleFormChange("motif_depart", e.target.value)} />
            </Grid>

            <FD label="Paie & classification" />
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Matricule paie" value={formData.matricule_paie}
                onChange={e => handleFormChange("matricule_paie", e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Salaire" value={formData.salaire}
                onChange={e => handleFormChange("salaire", e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Classification</InputLabel>
                <Select
                  value={formData.classification}
                  label="Classification"
                  onChange={e => handleFormChange("classification", e.target.value)}
                >
                  <MenuItem value="">—</MenuItem>
                  {classifications.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="N° RH" value={formData.n_rh}
                onChange={e => handleFormChange("n_rh", e.target.value)} />
            </Grid>

            <FD label="Liaisons système (optionnel)" />
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="ID Appareil biométrique" type="number"
                value={formData.device_user_id}
                onChange={e => handleFormChange("device_user_id", e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="ID Utilisateur Auth" type="number"
                value={formData.auth_user_id}
                onChange={e => handleFormChange("auth_user_id", e.target.value)} />
            </Grid>

          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeModal} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : modalMode === "add" ? "Créer" : "Enregistrer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>🗑️ Supprimer l'employé</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer <strong>{deleteDialog?.name}</strong> ? Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)} disabled={deleting}>Annuler</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
