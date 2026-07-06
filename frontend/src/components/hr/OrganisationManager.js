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

const EMPTY_FACTORY    = { name: "", location: "", is_active: true };
const EMPTY_DEPARTMENT = { name: "", factory: "", is_active: true };
const EMPTY_SECTION    = { name: "", department: "", is_active: true };

function CRUDTable({ columns, rows, loading, onAdd, onEdit, onDelete, canWrite, canDelete }) {
  return (
    <Box>
      {canWrite && (
        <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end" }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>Ajouter</Button>
        </Box>
      )}
      <TableContainer component={Paper} elevation={2} sx={{ maxHeight: "60vh", overflow: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              {columns.map(c => <TableCell key={c.key}><strong>{c.label}</strong></TableCell>)}
              {(canWrite || canDelete) && <TableCell><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={columns.length + 1} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length + 1} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucun enregistrement</TableCell></TableRow>
            ) : rows.map(row => (
              <TableRow key={row.id} hover>
                {columns.map(c => (
                  <TableCell key={c.key}>
                    {c.chip ? (
                      <Chip label={row[c.key] ? "Actif" : "Inactif"} color={row[c.key] ? "success" : "default"} size="small" />
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
  const [loading, setLoading]       = useState(false);
  const [alert, setAlert]           = useState(null);

  const [dialog, setDialog]         = useState(null); // {type, mode, data}
  const [form, setForm]             = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving]         = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  // Fetch paginated resources fully (follow `next` links)
  const fetchAllResource = useCallback(async (url) => {
    const all = [];
    let next = url;
    while (next) {
      const res = await hrClient.get(next);
      const data = res.data;
      if (Array.isArray(data)) {
        all.push(...data);
        break;
      }
      if (data.results) all.push(...data.results);
      else if (data.items) all.push(...data.items);
      // follow pagination link if provided
      next = data.next || null;
    }
    return all;
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, d, s] = await Promise.all([
        fetchAllResource("employees/factories/?page_size=1000"),
        fetchAllResource("employees/departments/?page_size=1000"),
        fetchAllResource("employees/sections/?page_size=1000"),
      ]);
      setFactories(f);
      setDepts(d);
      setSections(s);
    } catch (err) {
      setAlert({ type: "error", msg: "Erreur chargement." });
    } finally {
      setLoading(false);
    }
  }, [fetchAllResource]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Filters / search
  const [filterFactory, setFilterFactory] = useState(null);
  const [filterDept, setFilterDept] = useState(null);
  const [query, setQuery] = useState("");

  const openAdd = (type) => {
    const empty = type === "factory" ? EMPTY_FACTORY
                : type === "department" ? EMPTY_DEPARTMENT
                : EMPTY_SECTION;
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
    if (!form.name?.trim()) errors.name = "Requis";
    if (dialog.type === "department" && !form.factory) errors.factory = "Requis";
    if (dialog.type === "section"    && !form.department) errors.department = "Requis";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const endpoint = dialog.type === "factory"    ? "employees/factories/"
                   : dialog.type === "department" ? "employees/departments/"
                   : "employees/sections/";
    try {
      if (dialog.mode === "add") {
        await hrClient.post(endpoint, form);
        setAlert({ type: "success", msg: "Créé avec succès." });
      } else {
        await hrClient.patch(`${endpoint}${dialog.id}/`, form);
        setAlert({ type: "success", msg: "Modifié avec succès." });
      }
      setDialog(null);
      fetchAll();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") setFormErrors(data);
      else setAlert({ type: "error", msg: "Erreur lors de la sauvegarde." });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const endpoint = deleteDialog.type === "factory"    ? "employees/factories/"
                   : deleteDialog.type === "department" ? "employees/departments/"
                   : "employees/sections/";
    try {
      await hrClient.delete(`${endpoint}${deleteDialog.id}/`);
      setAlert({ type: "success", msg: "Supprimé avec succès." });
      setDeleteDialog(null);
      fetchAll();
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || "";
      let msg = "Erreur lors de la suppression.";
      if (status === 409 || detail.toLowerCase().includes("protect") || detail.toLowerCase().includes("constraint")) {
        msg = `Impossible de supprimer "${deleteDialog?.name}" : des employés ou sous-éléments y sont rattachés. Veuillez d'abord les réaffecter.`;
      } else if (detail) {
        msg = detail;
      }
      setAlert({ type: "error", msg });
    } finally { setDeleting(false); }
  };

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

  // Derived filtered data
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
  const deptIdsForFactory = filterFactory ? departments.filter(d => d.factory === filterFactory.id).map(d => d.id) : null;

  const filteredSections = sections.filter(s => {
    if (filterFactory) {
      const directFactoryMatch = s.factory === filterFactory.id || s.factory_id === filterFactory.id;
      const viaDepartment = deptIdsForFactory && deptIdsForFactory.includes(s.department);
      if (!directFactoryMatch && !viaDepartment) return false;
    }
    if (filterDept && s.department !== filterDept.id) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (s.name || "").toLowerCase().includes(q) || (s.department_name || "").toLowerCase().includes(q) || (s.factory_name || "").toLowerCase().includes(q);
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Structure organisationnelle
      </Typography>

      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={`Usines (${factories.length})`} />
        <Tab label={`Départements (${departments.length})`} />
        <Tab label={`Sections (${sections.length})`} />
      </Tabs>
      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField size="small" placeholder="Rechercher par nom, localisation..." value={query}
          onChange={e => setQuery(e.target.value)} sx={{ width: 320 }} />
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

      {/* Add/Edit Dialog */}
      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          {dialog?.mode === "add" ? "➕ Ajouter" : "✏️ Modifier"} —{" "}
          {dialog?.type === "factory" ? "Usine" : dialog?.type === "department" ? "Département" : "Section"}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField size="small" label="Nom *" value={form.name || ""}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              error={!!formErrors.name} helperText={formErrors.name} />
            {dialog?.type === "factory" && (
              <TextField size="small" label="Localisation" value={form.location || ""}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            )}
            {dialog?.type === "department" && (
              <Autocomplete
                size="small"
                options={factories}
                getOptionLabel={opt => opt?.name || ""}
                value={factories.find(f => f.id === form.factory) || null}
                onChange={(_, v) => setForm(p => ({ ...p, factory: v?.id }))}
                renderInput={(params) => (
                  <TextField {...params} label="Usine *" error={!!formErrors.factory} helperText={formErrors.factory} />
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
                  <TextField {...params} label="Département *" error={!!formErrors.department} helperText={formErrors.department} />
                )}
              />
            )}
            <FormControl size="small" fullWidth>
              <InputLabel>Statut</InputLabel>
              <Select value={form.is_active ?? true} label="Statut"
                onChange={e => setForm(p => ({ ...p, is_active: e.target.value }))}>
                <MenuItem value={true}>Actif</MenuItem>
                <MenuItem value={false}>Inactif</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
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
