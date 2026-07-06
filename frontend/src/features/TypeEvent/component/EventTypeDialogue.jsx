import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, Grid, InputLabel, MenuItem, Select, TextField, Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

const EMPTY_FORM = {
  name: "", code: "", days_per_year: 0,
  is_paid: true, requires_document: false,
  color: "#3B82F6", is_active: true,
};

export default function EventTypeDialog({ open, onClose, editItem, onSave }) {
  const [form, setForm]   = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setForm(EMPTY_FORM); return; }
    if (editItem) setForm({ ...editItem });
  }, [open, editItem]);

  const handleSave = async () => {
    if (!form.name || !form.code) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>
        {editItem ? "Modifier le type d'événement" : "Nouveau type d'événement"}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Code *"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Nom *"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Jours/an (0=illimité)" type="number"
              value={form.days_per_year}
              onChange={(e) => setForm((p) => ({ ...p, days_per_year: e.target.value }))}
            />
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
              Couleur
            </Typography>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box
                component="label"
                htmlFor="event-type-color-picker"
                title="Cliquer pour choisir une couleur"
                sx={{
                  width: 38, height: 38, borderRadius: "8px",
                  backgroundColor: form.color,
                  border: "2px solid #e0e0e0", cursor: "pointer", flexShrink: 0,
                  "&:hover": { borderColor: "#9e9e9e" },
                }}
              />
              <input
                id="event-type-color-picker"
                type="color"
                value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
              />
              <Typography variant="body2" sx={{ fontFamily: "monospace", color: "text.secondary", fontSize: 13 }}>
                {form.color.toUpperCase()}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Payé</InputLabel>
              <Select value={form.is_paid} label="Payé"
                onChange={(e) => setForm((p) => ({ ...p, is_paid: e.target.value }))}>
                <MenuItem value={true}>Oui</MenuItem>
                <MenuItem value={false}>Non</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Document requis</InputLabel>
              <Select value={form.requires_document} label="Document requis"
                onChange={(e) => setForm((p) => ({ ...p, requires_document: e.target.value }))}>
                <MenuItem value={true}>Oui</MenuItem>
                <MenuItem value={false}>Non</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Statut</InputLabel>
              <Select value={form.is_active} label="Statut"
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.value }))}>
                <MenuItem value={true}>Actif</MenuItem>
                <MenuItem value={false}>Inactif</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement..." : editItem ? "Sauvegarder" : "Créer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}