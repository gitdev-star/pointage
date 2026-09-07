import React, { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, InputAdornment, Box, Table, TableHead, TableRow,
  TableCell, TableBody, Avatar, CircularProgress, Alert, Button,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import authClient from "../api/authClient";

export default function DirectoryUserPicker({
  open, onClose, source, onSourceChange, onSelect, excludeImported = false,
  confirmLabel = "Sélectionner",
}) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setSearch("");
    setUsers([]);
    setError(null);
    setLoading(true);
    authClient.get(`${source}/users/`)
      .then(res => setUsers(res.data))
      .catch(() => setError(`Erreur chargement des utilisateurs ${source === "ldap" ? "AD" : "Entra ID"}.`))
      .finally(() => setLoading(false));
  }, [open, source]);

  const filtered = users.filter(u =>
    (!excludeImported || !u.already_imported) &&
    ((u.cn || "").toLowerCase().includes(search.toLowerCase()) ||
     (u.username || "").toLowerCase().includes(search.toLowerCase()) ||
     (u.email || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle fontWeight={700}>
        👥 Sélectionner un utilisateur {source === "ldap" ? "Active Directory" : "Entra ID"}
      </DialogTitle>
      <DialogContent dividers>
        {onSourceChange && (
          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <Button size="small" variant={source === "ldap" ? "contained" : "outlined"}
              onClick={() => onSourceChange("ldap")}>Active Directory</Button>
            <Button size="small" variant={source === "entra" ? "contained" : "outlined"}
              onClick={() => onSourceChange("entra")}>Entra ID</Button>
          </Box>
        )}

        <TextField
          fullWidth size="small" placeholder="Rechercher par nom, login ou email..."
          value={search} onChange={e => setSearch(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflow: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell></TableCell>
                  <TableCell><strong>Nom complet</strong></TableCell>
                  <TableCell><strong>Login</strong></TableCell>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell><strong>Département</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                    Aucun utilisateur trouvé
                  </TableCell></TableRow>
                ) : filtered.map(u => (
                  <TableRow
                    key={u.username}
                    hover
                    selected={selected?.username === u.username}
                    onClick={() => setSelected(u)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: "primary.main" }}>
                        {u.cn?.[0]}
                      </Avatar>
                    </TableCell>
                    <TableCell><strong>{u.cn}</strong></TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{u.username}</TableCell>
                    <TableCell>{u.email || "—"}</TableCell>
                    <TableCell>{u.department || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {selected && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Sélectionné : <strong>{selected.cn}</strong> ({selected.email || selected.username})
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" disabled={!selected}
          onClick={() => { onSelect(selected); onClose(); }}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
