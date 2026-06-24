import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, Grid, InputAdornment, InputLabel, ListSubheader,
  MenuItem, Select, TextField, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useEffect, useState } from "react";
import useEmployeeSearch from "../hook/useEmployeeSearch";

const EMPTY_FORM = {
  employee: "", sanction_type: "", date: "", reason: "", note: "", status: "ACTIVE",
};

export default function SanctionDialog({ open, onClose, editItem, sanctionTypes, onSave }) {
  const [form, setForm]                           = useState(EMPTY_FORM);
  const [saving, setSaving]                       = useState(false);
  const [empDropdownSearch, setEmpDropdownSearch] = useState("");

  const { employees, loading: empLoading } = useEmployeeSearch(empDropdownSearch);

  useEffect(() => {
    if (!open) { setForm(EMPTY_FORM); setEmpDropdownSearch(""); return; }
    if (editItem) {
      setForm({
        employee:      editItem.employee,
        sanction_type: editItem.sanction_type,
        date:          editItem.date,
        reason:        editItem.reason,
        note:          editItem.note || "",
        status:        editItem.status,
      });
    }
  }, [open, editItem]);

  const isLicenciement = (typeId) => {
    const found = sanctionTypes.find((t) => t.id == typeId); // eslint-disable-line eqeqeq
    return found && (
      found.code === "LIC" ||
      found.code === "LICENCIEMENT" ||
      found.name.toLowerCase().includes("licenci")
    );
  };

  const handleSave = async () => {
    if (!form.employee || !form.sanction_type || !form.date || !form.reason) return;
    setSaving(true);
    try {
      await onSave(form, isLicenciement(form.sanction_type));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editItem ? "Modifier la sanction" : "Nouvelle sanction"}</DialogTitle>
      <DialogContent>
        {form.sanction_type && isLicenciement(form.sanction_type) && form.status === "ACTIVE" && (
          <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
            Ce type de sanction entraînera la résiliation automatique de l'employé.
          </Alert>
        )}
        <Grid container spacing={2} mt={0.5}>
          <Grid item xs={12}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Employé</InputLabel>
              <Select
                value={form.employee}
                label="Employé"
                onChange={(e) => setForm((p) => ({ ...p, employee: e.target.value }))}
                onClose={() => setEmpDropdownSearch("")}
                MenuProps={{ autoFocus: false }}
                renderValue={(val) => {
                  const emp = employees.find((e) => e.id == val); // eslint-disable-line eqeqeq
                  return emp ? `${emp.last_name} ${emp.first_name} — ${emp.employee_id}` : val;
                }}
              >
                <ListSubheader sx={{ pt: 1, pb: 0.5, bgcolor: "background.paper" }}>
                  <TextField
                    size="small" fullWidth autoFocus
                    placeholder="Tapez pour rechercher..."
                    value={empDropdownSearch}
                    onChange={(e) => setEmpDropdownSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          {empLoading ? <CircularProgress size={16} /> : <SearchIcon fontSize="small" />}
                        </InputAdornment>
                      ),
                    }}
                  />
                </ListSubheader>
                {employees.length === 0 ? (
                  <MenuItem disabled>
                    {empLoading ? "Recherche en cours..." : "Tapez pour rechercher un employé"}
                  </MenuItem>
                ) : employees.map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.last_name} {emp.first_name}
                    <Typography variant="caption" color="text.secondary" ml={1}>
                      — {emp.employee_id}
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Type de sanction</InputLabel>
              <Select
                value={form.sanction_type}
                label="Type de sanction"
                onChange={(e) => setForm((p) => ({ ...p, sanction_type: e.target.value }))}
              >
                {sanctionTypes.filter(Boolean).map((t) => (
                <MenuItem key={t.id} value={t.id}>
                    <Box display="flex" alignItems="center" gap={1}>
                    <Box width={10} height={10} borderRadius="50%" bgcolor={t.color} />
                    {t.name}
                    </Box>
                </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small" label="Date" type="date"
              InputLabelProps={{ shrink: true }} required
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Statut</InputLabel>
              <Select
                value={form.status}
                label="Statut"
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              >
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="CANCELLED">Annulée</MenuItem>
                <MenuItem value="APPEALED">En appel</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth size="small" label="Motif" multiline rows={3} required
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth size="small" label="Note interne" multiline rows={2}
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement..." : editItem ? "Mettre à jour" : "Créer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}