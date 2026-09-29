import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, Paper, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, Chip,
} from "@mui/material";
import AddIcon  from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { useState } from "react";

const EMPTY_TYPE = { name: "", code: "" };

export default function SanctionTypeManager({ sanctionTypes = [], canWrite, onCreate, onUpdate, onToggle }) {
  const [dialog, setDialog]     = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm]         = useState(EMPTY_TYPE);
  const [saving, setSaving]     = useState(false);

  const openCreate = () => { setEditItem(null); setForm(EMPTY_TYPE); setDialog(true); };
  const openEdit   = (t) => { setEditItem(t); setForm({ name: t.name, code: t.code }); setDialog(true); };

  const handleSave = async () => {
    if (!form.name || !form.code) return;
    setSaving(true);
    try {
      if (editItem) await onUpdate(editItem.id, form);
      else          await onCreate(form);
      setDialog(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {canWrite && (
        <Box display="flex" justifyContent="flex-end" mb={2}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Nouveau type
          </Button>
        </Box>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "grey.50" }}>
              <TableCell><strong>Code</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              {/* <TableCell><strong>Niveau</strong></TableCell> */}
              {/* <TableCell><strong>Couleur</strong></TableCell> */}
              {/* <TableCell align="center"><strong>Actif</strong></TableCell> */}
              {canWrite && <TableCell align="center"><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {sanctionTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  Aucun type — cliquez sur "Nouveau type" pour commencer
                </TableCell>
              </TableRow>
            ) : sanctionTypes.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>{t.code}</TableCell>
                <TableCell>{t.name}</TableCell>
                {/* <TableCell>
                  <Chip label={`Niveau ${t.level}`} size="small"
                    sx={{ bgcolor: t.color, color: "#fff", fontWeight: 600 }} />
                </TableCell> */}
                {/* <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box width={20} height={20} borderRadius={1} bgcolor={t.color} border="1px solid #ccc" />
                    <Typography variant="caption" fontFamily="monospace">{t.color}</Typography>
                  </Box>
                </TableCell> */}
                {/* <TableCell align="center">
                  <Tooltip title={t.is_active ? "Désactiver" : "Activer"}>
                    <Switch
                      size="small"
                      checked={t.is_active}
                      onChange={() => onToggle(t)}
                      disabled={!canWrite || t.code === "LICENCIEMENT"}
                    />
                  </Tooltip>
                </TableCell> */}
                {canWrite && (
                  <TableCell align="center">
                    {t.code !== "LICENCIEMENT" && (
                      <IconButton size="small" onClick={() => openEdit(t)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editItem ? "Modifier le type" : "Nouveau type de sanction"}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Code" required
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                inputProps={{ maxLength: 30 }}
                helperText="Ex: AVERT, BLAME, LIC"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Nom" required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : editItem ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}