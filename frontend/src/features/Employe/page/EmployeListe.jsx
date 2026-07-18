import React, { useEffect, useState, useCallback } from "react";
import { useNavigate }                              from "react-router-dom";
import {Typography, Paper, Avatar, Button, Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import RefreshIcon       from "@mui/icons-material/Refresh";
import AddIcon           from "@mui/icons-material/Add";
import EditIcon          from "@mui/icons-material/Edit";
import DeleteIcon        from "@mui/icons-material/Delete";
import DownloadIcon      from "@mui/icons-material/Download";
import PrintIcon         from "@mui/icons-material/Print";
import UploadFileIcon    from "@mui/icons-material/UploadFile";

import hrClient from "../../../api/hrClient";
import { useHRAuth } from "../../../contexts/HRAuthContext";
import { useEmployeeFilters }      from "../hooks/useEmployeFilter";
import { useExportCSV }            from "../hooks/useExportCSV";
import { EmployeeFilterBar }       from "../components/EmployeFilterBar";
import { StatusBadge, ContractBadge } from "../components/EmployeComponent";
import {
  EMPTY_EMPLOYEE_FORM, DEFAULT_PAGE_SIZE,
} from "../constants/Employe.constant";
import {
  buildApiParams, validateEmployeeForm,
} from "../utils/EmployeUtil";
import EmployeeModal from "../components/EmployeForm";

// ─── Styles d'impression ───────────────────────────────────────────────────────

const PRINT_STYLE = `
  @media print {
    /*
     * Technique visibility (et non display:none) :
     * display:none sur #root supprime tous ses enfants du flux,
     * même avec display:block sur un enfant — ils ne réapparaissent pas.
     * visibility:hidden permet à un enfant de se rendre visible
     * individuellement avec visibility:visible.
     */

    /* 1. Rendre tout le root invisible */
    #root {
      visibility: hidden;
    }

    /* 2. Rendre visible uniquement le wrapper et TOUS ses descendants */
    #emp-print-wrapper,
    #emp-print-wrapper * {
      visibility: visible;
    }

    /* 3. Sortir le wrapper du flux pour qu'il s'affiche en haut de page */
    #emp-print-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      background: white;
    }

    /* En-tête visible uniquement à l'impression */
    #emp-print-header {
      display: block !important;
      text-align: center;
      margin-bottom: 12px;
      font-family: sans-serif;
    }

    /* Masquer les éléments non imprimables à l'intérieur du wrapper */
    .no-print {
      visibility: hidden !important;
      display: none !important;
    }

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

    /* Annuler les contraintes MUI */
    .MuiPaper-root          { overflow: visible !important; box-shadow: none !important; }
    .MuiTableContainer-root { overflow: visible !important; }

    /* Liens en noir */
    a { color: black !important; text-decoration: none; }

    @page {
      size: A4 landscape;
      margin: 10mm;
    }
  }
`;

// ─── Composant principal ───────────────────────────────────────────────────────

export default function EmployeeList() {
  const { can }  = useHRAuth();
  const navigate = useNavigate();

  // ── Données ──────────────────────────────────────────────────────────────────
  const [employees,   setEmployees]   = useState([]);
  const [factories,   setFactories]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections,    setSections]    = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [classifications, setClassifications] = useState([]);

  // ── Filtres ───────────────────────────────────────────────────────────────────
  const {
    filters, searchInput, page, setPage,
    setFilter, handleSearch, resetFilters, hasActiveFilter,
  } = useEmployeeFilters();

  // ── Export ────────────────────────────────────────────────────────────────────
  const { exporting, exportCSV, exportError } = useExportCSV(filters, "employes");

  // ── Modal CRUD ────────────────────────────────────────────────────────────────
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalMode,    setModalMode]    = useState("add"); // "add" | "edit"
  const [formData,     setFormData]     = useState(EMPTY_EMPLOYEE_FORM);
  const [formErrors,   setFormErrors]   = useState({});
  const [saving,       setSaving]       = useState(false);
  const [photoFile,    setPhotoFile]    = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [postes, setPostes] = useState([]);

  // ── Suppression ───────────────────────────────────────────────────────────────
  const [deleteDialog, setDeleteDialog] = useState(null); // { id, name } | null
  const [deleting,     setDeleting]     = useState(false);

  // ── Alertes ───────────────────────────────────────────────────────────────────
  const [alert, setAlert] = useState(null); // { type, msg } | null
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // ── Selects cascadants ────────────────────────────────────────────────────────
  const filteredModalDepts = formData.factory
    ? departments.filter((d) => String(d.factory) === String(formData.factory))
    : departments;
const filteredSections = sections.filter(
  (s) => String(s.department) === String(formData.department)
);
  const fetchEmployees = useCallback(async () => {
  setLoading(true);
  try {
    const r = await hrClient.get("employees/", { 
      params: buildApiParams(filters, page, pageSize) 
    });
    
    // ✅ Toujours s'assurer que c'est un tableau
    const data = r.data;
    if (Array.isArray(data)) {
      setEmployees(data);
      setTotal(data.length);
    } else if (Array.isArray(data?.results)) {
      setEmployees(data.results);
      setTotal(data.count || data.results.length);
    } else {
      // // console.error("Format inattendu:", data);
      setEmployees([]);
      setTotal(0);
    }
  } catch (err) {
    // // console.error("Erreur fetch employees:", err);
    setEmployees([]); // ✅ évite le crash map
  } finally { 
    setLoading(false); 
  }
}, [filters, page, pageSize]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

useEffect(() => {
  hrClient.get("employees/factories/?page_size=100")
    .then((r) => setFactories(r.data.results || r.data || []))
    .catch(() => {});
  hrClient.get("employees/departments/?page_size=200")
    .then((r) => setDepartments(r.data.results || r.data || []))
    .catch(() => {});
  hrClient.get("employees/sections/?page_size=500")
    .then((r) => setSections(r.data.results || r.data || []))
    .catch(() => {});
// Dans EmployeListe.jsx, remplace le fetch classifications par :
hrClient.get("employees/classifications/?page_size=100")
  .then((r) => {
    // // console.log("✅ classifications OK:", r.data);
    setClassifications(r.data.results || r.data || []);
  })
  .catch((err) => {
    // // console.error("❌ classifications error:", err.response?.status, err.response?.data);
  });
hrClient.get("employees/postes/?page_size=500&is_active=true")
    .then((r) => {
      // // console.log("✅ postes OK:", r.data);
      setPostes(r.data.results || r.data || []);
    })
    .catch(() => {});
}, []);

  // ─── Modal helpers ────────────────────────────────────────────────────────────

  const openAdd = () => {
    setFormData(EMPTY_EMPLOYEE_FORM);
    setFormErrors({});
    setPhotoFile(null);
    setPhotoPreview(null);
    setModalMode("add");
    setModalOpen(true);
  };
const openEdit = async (emp) => {
  try {
    const { data } = await hrClient.get(`employees/${emp.id}/`);
    const classificationId = 
  data.classification?.id_classification
  ?? data.classification
  ?? "";
    // // console.log("data:", data)
    setFormData({
      ...EMPTY_EMPLOYEE_FORM,
      ...data,
      classification: classificationId,
      _id: data.id,
    });

    setFormErrors({});
    setPhotoFile(null);
    setPhotoPreview(data.photo || null);
    setModalMode("edit");
    setModalOpen(true);
  } catch (error) {
    // // console.error(error);
  }
};

  const closeModal = () => {
    setModalOpen(false);
    setFormData(EMPTY_EMPLOYEE_FORM);
    setFormErrors({});
    setPhotoFile(null);
    setPhotoPreview(null);
  };

// Dans handleFormChange dans ListeEmploye.jsx
const handleFormChange = (field, value) => {
  setFormData((prev) => {
    const next = { ...prev, [field]: value };
    if (field === "factory")    { next.department = ""; next.section = ""; }
    if (field === "department") { next.section = ""; }
    if (field === "termination_date") next.status = value ? "TERMINATED" : "ACTIVE";
    
    // ← Ajouter ceci
    if (field === "classification") {
      const found = classifications.find(
        (c) => String(c.id_classification) === String(value)
      );
      next.salaire = found ? String(found.salaire) : "";
    }

    return next;
  });
  if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: "" }));
};

 
const handleSave = async () => {
  const errors = validateEmployeeForm(formData);
  if (Object.keys(errors).length) {
    setFormErrors(errors);
    return;
  }

  setSaving(true);
  try {
    const payload = new FormData();

    const textFields = [
      "employee_id", "first_name", "last_name", "sexe", "birth_date", "birth_place",
      "email", "phone", "address", "cin", "cin_date", "cin_place", "cnaps",
      "factory", "department", "section", "contract_type",
      "hire_date", "termination_date", "status", "motif_depart",
      "matricule_paie", "affectation", "hk_ou_pbi", "n_rh", "salaire",
    ];

    textFields.forEach((f) => {
      if (formData[f] !== "" && formData[f] != null)
        payload.append(f, formData[f]);
    });

    if (formData.classification !== "" && formData.classification != null) {
      payload.append("classification", formData.classification);
    }
    if (formData.job_title) {
      payload.append("job_title", formData.job_title);
    }
    if (formData.nbre_enfants !== "" && formData.nbre_enfants != null)
      payload.append("nbre_enfants", parseInt(formData.nbre_enfants, 10));
    if (formData.device_user_id != null && formData.device_user_id !== "")
      payload.append("device_user_id", formData.device_user_id);
    if (formData.auth_user_id != null && formData.auth_user_id !== "")
      payload.append("auth_user_id", formData.auth_user_id);
    if (photoFile) payload.append("photo", photoFile);

    const headers = { "Content-Type": "multipart/form-data" };

    console.log("📦 payload entries:");
    for (let [k, v] of payload.entries()) console.log(" ", k, "=", v);
    console.log("🚀 envoi vers:", modalMode === "add" ? "POST employees/" : `PATCH employees/${formData._id}/`);

    // ✅ plus de try/catch interne : laisse l'erreur remonter au catch ci-dessous
    if (modalMode === "add") {
      await hrClient.post("employees/", payload, { headers });
      setAlert({ type: "success", msg: "Employé créé avec succès." });
      setPage(0);
    } else {
      await hrClient.patch(`employees/${formData._id}/`, payload, { headers });
      setAlert({ type: "success", msg: "Employé mis à jour avec succès." });
    }

    closeModal();
    fetchEmployees();

  } catch (err) {
    console.error("❌ erreur complète:", err);
    console.error("❌ response data:", err.response?.data);
    console.error("❌ status:", err.response?.status);

    const data = err.response?.data;
    if (data && typeof data === "object") {
      const be = {};
      Object.entries(data).forEach(([k, v]) => {
        be[k] = Array.isArray(v) ? v.join(" ") : v;
      });
      setFormErrors(be);
      setAlert({ type: "error", msg: "Erreur de validation : voir les champs en rouge." });
    } else {
      setAlert({ type: "error", msg: "Erreur lors de la sauvegarde." });
    }
  } finally {
    setSaving(false);
  }
};

  // ─── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await hrClient.delete(`employees/${deleteDialog.id}/`);
      setAlert({ type: "success", msg: `${deleteDialog.name} supprimé.` });
      setDeleteDialog(null);
      fetchEmployees();
    } catch {
      setAlert({ type: "error", msg: "Erreur lors de la suppression." });
    } finally { setDeleting(false); }
  };

const ACTION_LABELS = {
  CREATE: { label: "Créé", color: "#2e7d32" },
  UPDATE: { label: "Modifié", color: "#1565c0" },
  DELETE: { label: "Supprimé", color: "#c62828" },
};

function LastActionCell({ action, at, by }) {
  if (!action) return <span style={{ fontSize: 12, color: "#999" }}>—</span>;
  const meta = ACTION_LABELS[action] || { label: action, color: "#666" };
  const date = at ? new Date(at) : null;
  const formatted = date
    ? date.toLocaleDateString("fr-FR") + " à " + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "";
  return (
      <div style={{ fontSize: 12 }}>
        <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label} {by ? `par ${by}` : "Système"}</span>
        <div style={{ color: "#777", fontSize: 11 }}>{formatted}</div>
      </div>
  );
}

  // // // console.log("formData:", formData)
  return (
    <div className="p-6">
      <style>{PRINT_STYLE}</style>

      {/* ── En-tête (masqué à l'impression) ── */}
      <div className="no-print flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Employés</h1>
          <Chip label={total} size="small" color="primary" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Tooltip title="Actualiser">
            <IconButton onClick={fetchEmployees} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
          <button
            onClick={exportCSV} disabled={exporting}
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
          {can("employees_write") && (
            <>
              <button
                onClick={() => navigate("/hr/import")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <UploadFileIcon fontSize="small" />
                Importer
              </button>
              <button
                onClick={openAdd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                <AddIcon fontSize="small" />
                Ajouter
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Alertes (masquées à l'impression) ── */}
      {alert && (
        <Alert className="no-print mb-3" severity={alert.type} onClose={() => setAlert(null)}>
          {alert.msg}
        </Alert>
      )}
      {exportError && (
        <Alert className="no-print mb-3" severity="error">{exportError}</Alert>
      )}

      {/* ── Filtres (masqués à l'impression) ── */}
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

      {/* ══════════════════════════════════════════════════════════════
          Wrapper dédié à l'impression — seul élément affiché en print
      ══════════════════════════════════════════════════════════════ */}
      <div id="emp-print-wrapper">

        {/* En-tête visible uniquement à l'impression */}
        <div id="emp-print-header" style={{ display: "none" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
            Liste des employés
          </h2>
          <p style={{ fontSize: 10, color: "#555" }}>
            Imprimé le {new Date().toLocaleDateString("fr-FR")} — {total.toLocaleString()} employé(s)
          </p>
        </div>

        {/* ── Tableau ── */}
        <Paper elevation={2}>
          <TableContainer sx={{ maxHeight: "calc(100vh - 300px)", overflow: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell><strong>Matricule</strong></TableCell>
                  <TableCell><strong>Nom</strong></TableCell>
                  <TableCell><strong>Sexe</strong></TableCell>
                  <TableCell><strong>Poste</strong></TableCell>
                  <TableCell><strong>Usine</strong></TableCell>
                  <TableCell><strong>Contrat</strong></TableCell>
                  <TableCell><strong>Statut</strong></TableCell>
                  {(can("employees_write") || can("employees_delete")) && (
                    <TableCell className="no-print"><strong>Actions</strong></TableCell>
                  )}
                  <TableCell className="no-print"><strong>Dernière action</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 6, color: "text.secondary" }}>
                      Aucun employé trouvé
                    </TableCell>
                  </TableRow>
                ) : employees.map((emp, i) => (
                  <TableRow
                    key={emp.id} hover
                    sx={{ cursor: "pointer", bgcolor: i % 2 === 0 ? "#fff" : "#fafafa" }}
                    onClick={() => navigate(`/hr/employees/${emp.id}`)}
                  >
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12, color: "#1565c0" }}>{emp.employee_id}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>{emp.last_name} {emp.first_name}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{emp.sexe || "—"}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{emp.job_title_name || "—"}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{emp.factory_name}</TableCell>
                    <TableCell><ContractBadge value={emp.contract_type} /></TableCell>
                    <TableCell><StatusBadge value={emp.status} /></TableCell>
                    {(can("employees_write") || can("employees_delete")) && (
                      <TableCell className="no-print">
                        <div className="flex gap-1">
                          {can("employees_write") && (
                            <Tooltip title="Modifier">
                              <span onClick={(e) => e.stopPropagation()}>
                                <IconButton size="small" color="primary" onClick={() => openEdit(emp)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          {can("employees_delete") && (
                            <Tooltip title="Supprimer">
                              <span onClick={(e) => e.stopPropagation()}>
                                <IconButton size="small" color="error"
                                  onClick={() => setDeleteDialog({ id: emp.id, name: `${emp.last_name} ${emp.first_name}` })}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    )}
                      <TableCell className="no-print">
                        <LastActionCell
                          action={emp.last_action}
                          at={emp.last_action_at}
                          by={emp.last_action_by}
                        />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
              className="no-print"
                component="div" count={total} page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={pageSize}                          
                onRowsPerPageChange={(e) => {                    {/* ← nouveau */}
                  setPageSize(parseInt(e.target.value, 10));
                  setPage(0);                                     // reset à la page 1 pour éviter une page vide
                }}
                rowsPerPageOptions={[100, 1000]}
                labelRowsPerPage="Lignes par page"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`}
          />
        </Paper>

      </div>
      {/* fin #emp-print-wrapper */}

      {/* ══════════════════════════════════════
          Modal Ajouter / Modifier
      ══════════════════════════════════════ */}
      <EmployeeModal
        open={modalOpen}
        onClose={closeModal}
        modalMode={modalMode}
        formData={formData}
        formErrors={formErrors}
        handleFormChange={handleFormChange}
        handleSave={handleSave}
        saving={saving}
        factories={factories}
        filteredModalDepts={filteredModalDepts}
        filteredSections={filteredSections}
        photoPreview={photoPreview}
        setPhotoFile={setPhotoFile}
        setPhotoPreview={setPhotoPreview}
        classifications={classifications}
        postes={postes}
      />

      {/* ── Dialog suppression ── */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>🗑️ Supprimer l'employé</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer <strong>{deleteDialog?.name}</strong> ?
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)} disabled={deleting}>Annuler</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
