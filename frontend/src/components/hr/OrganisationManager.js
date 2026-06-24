import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Tabs, Tab, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Chip, Alert, CircularProgress,
  Autocomplete, Stack,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import hrClient from "../../api/hrClient";
import { useHRAuth } from "../../contexts/HRAuthContext";

const EMPTY_FACTORY        = { name: "", location: "", is_active: true };
const EMPTY_DEPARTMENT     = { name: "", factory: "", is_active: true };
const EMPTY_SECTION        = { name: "", department: "", is_active: true };
const EMPTY_CLASSIFICATION = { classe: "", salaire: "" };
const EMPTY_POSTE          = { name: "", description: "", is_active: true };

// Maps each entity type to its API endpoint and state setter key
const ENTITY_CONFIG = {
  factory:        { url: "employees/factories/?page_size=1000",       key: "factories" },
  department:     { url: "employees/departments/?page_size=1000",     key: "departments" },
  section:        { url: "employees/sections/?page_size=1000",        key: "sections" },
  classification: { url: "employees/classifications/?page_size=200",  key: "classifications" },
  poste:          { url: "employees/postes/?page_size=200",           key: "postes" },
};

function CRUDTable({ columns, rows, loading, onAdd, onEdit, onDelete, canWrite, canDelete }) {
  return (
    <Box>
      {canWrite && (
        <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end" }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>Ajouter</Button>
        </Box>
      )}
      <TableContainer component={Paper} elevation={2}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              {columns.map(c => <TableCell key={c.key}><strong>{c.label}</strong></TableCell>)}
              {(canWrite || canDelete) && <TableCell><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  Aucun enregistrement
                </TableCell>
              </TableRow>
            ) : rows.map(row => (
              <TableRow key={row.id} hover>
                {columns.map(c => (
                  <TableCell key={c.key}>
                    {c.chip ? (
                      <Chip
                        label={row[c.key] ? "Actif" : "Inactif"}
                        color={row[c.key] ? "success" : "default"}
                        size="small"
                      />
                    ) : row[c.key] || "—"}
                  </TableCell>
                ))}
                {(canWrite || canDelete) && (
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      {canWrite && (
                        <Tooltip title="Modifier">
                          <span onClick={(e) => e.stopPropagation()}>
                            <IconButton size="small" color="primary" onClick={() => onEdit(row)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip title="Supprimer">
                          <span onClick={(e) => e.stopPropagation()}>
                            <IconButton size="small" color="error" onClick={() => onDelete(row)}>
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
    </Box>
  );
}

export default function OrganisationManager() {
  const { can } = useHRAuth();
  const canWrite  = can("organisation_write");
  const canDelete = can("organisation_write");

  const [tab, setTab]               = useState(0);
  const [factories, setFactories]   = useState([]);
  const [departments, setDepts]     = useState([]);
  const [sections, setSections]     = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [postes, setPostes]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [alert, setAlert]           = useState(null);

  const [dialog, setDialog]         = useState(null);
  const [form, setForm]             = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving]         = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const [filterFactory, setFilterFactory] = useState(null);
  const [filterDept, setFilterDept]       = useState(null);
  const [query, setQuery]                 = useState("");

  // ── Fetch all pages of a paginated endpoint ────────────────────────────────
  // FIX: The previous regex `/^\/api\/[^/]+\//` only stripped one path segment,
  // so `/api/employees/postes/?page=2` became `postes/?page=2` (missing `employees/`).
  // Now we extract everything after `/api/` to preserve nested paths.
  const fetchAllResource = useCallback(async (url) => {
    const all = [];
    let nextUrl = url;
    while (nextUrl) {
      const res = await hrClient.get(nextUrl);
      const data = res.data;
      if (Array.isArray(data)) {
        all.push(...data);
        break;
      }
      if (data.results)      all.push(...data.results);
      else if (data.items)   all.push(...data.items);

      if (data.next) {
        try {
          const parsed = new URL(data.next);
          // Keep the full path after /api/ — handles nested segments like employees/postes/
          const match = parsed.pathname.match(/^\/api\/(.+)/);
          nextUrl = match ? match[1] + parsed.search : null;
        } catch {
          nextUrl = null;
        }
      } else {
        nextUrl = null;
      }
    }
    return all;
  }, []);

  // Setter map — used by both fetchAll and targeted refetch
  const setterMap = {
    factories:       setFactories,
    departments:     setDepts,
    sections:        setSections,
    classifications: setClassifications,
    postes:          setPostes,
  };

  // ── Initial load: fetch all 5 resources in parallel ───────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const entries = Object.entries(ENTITY_CONFIG);
      const results = await Promise.all(entries.map(([, cfg]) => fetchAllResource(cfg.url)));
      entries.forEach(([, cfg], i) => setterMap[cfg.key](results[i]));
    } catch {
      setAlert({ type: "error", msg: "Erreur chargement." });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAllResource]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Targeted refetch after mutations — avoids re-fetching all 5 endpoints ──
  // FIX: Previously fetchAll() was called after every save/delete, re-loading
  // all endpoints including the heavy 55 KB sections list unnecessarily.
  const refetchByType = useCallback(async (type) => {
    const cfg = ENTITY_CONFIG[type];
    if (!cfg) return;
    const data = await fetchAllResource(cfg.url);
    setterMap[cfg.key](data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAllResource]);

  // ── Dialog helpers ─────────────────────────────────────────────────────────
  const openAdd = (type) => {
    const empty = {
      factory:        EMPTY_FACTORY,
      department:     EMPTY_DEPARTMENT,
      section:        EMPTY_SECTION,
      classification: EMPTY_CLASSIFICATION,
      poste:          EMPTY_POSTE,
    }[type];
    setForm(empty);
    setFormErrors({});
    setDialog({ type, mode: "add" });
  };

  const openEdit = (type, row) => {
    setForm({ ...row });
    setFormErrors({});
    setDialog({ type, mode: "edit", id: row.id });
  };

  const validate = () => {
    const errors = {};
    if (dialog.type === "classification") {
      if (!form.classe?.trim()) errors.classe  = "Requis";
      if (!form.salaire)        errors.salaire = "Requis";
    } else {
      if (!form.name?.trim()) errors.name = "Requis";
    }
    if (dialog.type === "department" && !form.factory)    errors.factory    = "Requis";
    if (dialog.type === "section"    && !form.department) errors.department = "Requis";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const endpointFor = (type) => ({
    factory:        "employees/factories/",
    department:     "employees/departments/",
    section:        "employees/sections/",
    classification: "employees/classifications/",
    poste:          "employees/postes/",
  })[type];

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const endpoint = endpointFor(dialog.type);
    try {
      if (dialog.mode === "add") {
        await hrClient.post(endpoint, form);
        setAlert({ type: "success", msg: "Créé avec succès." });
      } else {
        await hrClient.patch(`${endpoint}${dialog.id}/`, form);
        setAlert({ type: "success", msg: "Modifié avec succès." });
      }
      setDialog(null);
      // Only refetch the affected entity type
      await refetchByType(dialog.type);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") setFormErrors(data);
      else setAlert({ type: "error", msg: "Erreur lors de la sauvegarde." });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    const endpoint = endpointFor(deleteDialog.type);
    try {
      await hrClient.delete(`${endpoint}${deleteDialog.id}/`);
      setAlert({ type: "success", msg: "Supprimé avec succès." });
      const deletedType = deleteDialog.type;
      setDeleteDialog(null);
      // Only refetch the affected entity type
      await refetchByType(deletedType);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || "";
      let msg = "Erreur lors de la suppression.";
      if (
        status === 409 ||
        detail.toLowerCase().includes("protect") ||
        detail.toLowerCase().includes("constraint")
      ) {
        msg = `Impossible de supprimer "${deleteDialog?.name}" : des employés ou sous-éléments y sont rattachés. Veuillez d'abord les réaffecter.`;
      } else if (detail) {
        msg = detail;
      }
      setAlert({ type: "error", msg });
    } finally {
      setDeleting(false);
    }
  };

  // ── Column definitions ─────────────────────────────────────────────────────
  const factoryColumns = [
    { key: "name",      label: "Nom" },
    { key: "location",  label: "Localisation" },
    { key: "is_active", label: "Statut", chip: true },
  ];
  const deptColumns = [
    { key: "name",         label: "Nom" },
    { key: "factory_name", label: "Usine" },
    { key: "is_active",    label: "Statut", chip: true },
  ];
  const sectionColumns = [
    { key: "name",            label: "Nom" },
    { key: "department_name", label: "Département" },
    { key: "factory_name",    label: "Usine" },
    { key: "is_active",       label: "Statut", chip: true },
  ];
  const classificationColumns = [
    { key: "classe",  label: "Classe" },
    { key: "salaire", label: "Salaire" },
  ];
  const posteColumns = [
    { key: "name",        label: "Nom du poste" },
    { key: "description", label: "Description" },
    { key: "is_active",   label: "Statut", chip: true },
  ];

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filteredFactories = factories.filter(f => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (f.name || "").toLowerCase().includes(q) || (f.location || "").toLowerCase().includes(q);
  });

  const filteredDepts = departments.filter(d => {
    if (filterFactory && d.factory !== filterFactory.id) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (d.name || "").toLowerCase().includes(q) || (d.factory_name || "").toLowerCase().includes(q);
  });

  const filteredSections = sections.filter(s => {
    if (filterFactory && s.factory !== filterFactory.id) return false;
    if (filterDept && s.department !== filterDept.id)   return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (s.name || "").toLowerCase().includes(q) ||
      (s.department_name || "").toLowerCase().includes(q) ||
      (s.factory_name || "").toLowerCase().includes(q)
    );
  });

const filteredClassifications = classifications.filter(c => {
  if (!query) return true;
  const q = query.toLowerCase();

  return (
    (c.classe || "").toLowerCase().includes(q) ||
    String(c.salaire || "").toLowerCase().includes(q)
  );
});

const filteredPostes = postes.filter(p => {
  if (!query) return true;
  const q = query.toLowerCase();

  return (
    (p.name || "").toLowerCase().includes(q) ||
    (p.description || "").toLowerCase().includes(q)
  );
});
  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Structure organisationnelle
      </Typography>

      {alert && (
        <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>
          {alert.msg}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={`Usines (${factories.length})`} />
        <Tab label={`Départements (${departments.length})`} />
        <Tab label={`Sections (${sections.length})`} />
        <Tab label={`Classifications (${classifications.length})`} />
        <Tab label={`Postes (${postes.length})`} />
      </Tabs>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Rechercher par nom, localisation..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          sx={{ width: 320 }}
        />
        {tab >= 1 && (
          <Autocomplete
            size="small"
            options={factories}
            getOptionLabel={opt => opt?.name || ""}
            value={filterFactory}
            onChange={(_, v) => { setFilterFactory(v || null); setFilterDept(null); }}
            sx={{ width: 240 }}
            renderInput={(params) => <TextField {...params} label="Filtrer par Usine" />}
          />
        )}
        {tab === 2 && (
          <Autocomplete
            size="small"
            options={departments.filter(d => !filterFactory || d.factory === filterFactory.id)}
            getOptionLabel={opt => `${opt?.name || ""} — ${opt?.factory_name || ""}`}
            value={filterDept}
            onChange={(_, v) => setFilterDept(v || null)}
            sx={{ width: 320 }}
            renderInput={(params) => <TextField {...params} label="Filtrer par Département" />}
          />
        )}
        <Box sx={{ flex: 1 }} />
      </Stack>

      {tab === 0 && (
        <CRUDTable
          columns={factoryColumns} rows={filteredFactories} loading={loading}
          onAdd={() => openAdd("factory")}
          onEdit={row => openEdit("factory", row)}
          onDelete={row => setDeleteDialog({ type: "factory", id: row.id, name: row.name })}
          canWrite={canWrite} canDelete={canDelete}
        />
      )}
      {tab === 1 && (
        <CRUDTable
          columns={deptColumns} rows={filteredDepts} loading={loading}
          onAdd={() => openAdd("department")}
          onEdit={row => openEdit("department", row)}
          onDelete={row => setDeleteDialog({ type: "department", id: row.id, name: row.name })}
          canWrite={canWrite} canDelete={canDelete}
        />
      )}
      {tab === 2 && (
        <CRUDTable
          columns={sectionColumns} rows={filteredSections} loading={loading}
          onAdd={() => openAdd("section")}
          onEdit={row => openEdit("section", row)}
          onDelete={row => setDeleteDialog({ type: "section", id: row.id, name: row.name })}
          canWrite={canWrite} canDelete={canDelete}
        />
      )}
     {tab === 3 && (
  <CRUDTable
    columns={classificationColumns}
    rows={filteredClassifications.map(c => ({ ...c, id: c.id_classification }))}
    loading={loading}
    onAdd={() => openAdd("classification")}
    onEdit={row => openEdit("classification", row)}
    onDelete={row => setDeleteDialog({ type: "classification", id: row.id, name: row.classe })}
    canWrite={canWrite}
    canDelete={canDelete}
  />
)}
              {tab === 4 && (
  <CRUDTable
    columns={posteColumns}
    rows={filteredPostes}
    loading={loading}
    onAdd={() => openAdd("poste")}
    onEdit={row => openEdit("poste", row)}
    onDelete={row => setDeleteDialog({ type: "poste", id: row.id, name: row.name })}
    canWrite={canWrite}
    canDelete={canDelete}
  />
)}
      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          {dialog?.mode === "add" ? "➕ Ajouter" : "✏️ Modifier"} —{" "}
          {{ factory: "Usine", department: "Département", section: "Section",
             classification: "Classification", poste: "Poste" }[dialog?.type]}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {dialog?.type === "classification" ? (
              <>
                <TextField
                  size="small" label="Classe *" value={form.classe || ""}
                  onChange={e => setForm(p => ({ ...p, classe: e.target.value }))}
                  error={!!formErrors.classe} helperText={formErrors.classe}
                />
                <TextField
                  size="small" label="Salaire *" type="number" value={form.salaire || ""}
                  onChange={e => setForm(p => ({ ...p, salaire: e.target.value }))}
                  error={!!formErrors.salaire} helperText={formErrors.salaire}
                />
              </>
            ) : (
              <TextField
                size="small" label="Nom *" value={form.name || ""}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                error={!!formErrors.name} helperText={formErrors.name}
              />
            )}
            {dialog?.type === "factory" && (
              <TextField
                size="small" label="Localisation" value={form.location || ""}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              />
            )}
            {dialog?.type === "department" && (
              <Autocomplete
                size="small"
                options={factories}
                getOptionLabel={opt => opt?.name || ""}
                value={factories.find(f => f.id === form.factory) || null}
                onChange={(_, v) => setForm(p => ({ ...p, factory: v?.id }))}
                renderInput={(params) => (
                  <TextField
                    {...params} label="Usine *"
                    error={!!formErrors.factory} helperText={formErrors.factory}
                  />
                )}
              />
            )}
            {dialog?.type === "section" && (
              <Autocomplete
                size="small"
                options={departments}
                getOptionLabel={opt => `${opt?.name || ""} — ${opt?.factory_name || ""}`}
                value={departments.find(d => d.id === form.department) || null}
                onChange={(_, v) => setForm(p => ({ ...p, department: v?.id }))}
                renderInput={(params) => (
                  <TextField
                    {...params} label="Département *"
                    error={!!formErrors.department} helperText={formErrors.department}
                  />
                )}
              />
            )}
            {dialog?.type === "poste" && (
              <TextField
                size="small" label="Description" multiline minRows={3}
                value={form.description || ""}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                fullWidth
              />
            )}
            {dialog?.type !== "classification" && (
              <FormControl size="small" fullWidth>
                <InputLabel>Statut</InputLabel>
                <Select
                  value={form.is_active ?? true}
                  label="Statut"
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.value }))}
                >
                  <MenuItem value={true}>Actif</MenuItem>
                  <MenuItem value={false}>Inactif</MenuItem>
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>🗑️ Supprimer</DialogTitle>
        <DialogContent>
          <Typography>
            Supprimer <strong>{deleteDialog?.name}</strong> ? Cette action est irréversible.
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
