import { useState, useEffect } from "react";
import { Box, TextField, Button, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import IconButton from "@mui/material/IconButton";
import EventStatusFilter from "./EventStatusFilter";
import hrClient from "../../../api/hrClient";
import { eventService } from "../api/EvenementApi";

export default function EventFilters({ filters, onChange, onAdd, onRefresh, leaveTypes = [] }) {
  const [factories, setFactories] = useState([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    hrClient
      .get("employees/factories/", { params: { page_size: 200 } })
      .then((res) => setFactories(res.data.results ?? res.data))
      .catch(() => setFactories([]));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filters.status)     params.status = filters.status;
      if (filters.search)     params.search = filters.search;
      if (filters.leave_type) params.leave_type = filters.leave_type;
      if (filters.factory)    params["employee__factory"] = filters.factory;
      if (filters.date_from)  params.date_from = filters.date_from;
      if (filters.date_to)    params.date_to = filters.date_to;

      await eventService.exportRequests(params);
    } catch {
      alert("Erreur lors de l'export.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ mb: 3, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <EventStatusFilter
          value={filters.status}
          onChange={(val) => onChange("status", val)}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Type d'événement</InputLabel>
          <Select
            label="Type d'événement"
            value={filters.leave_type || ""}
            onChange={(e) => onChange("leave_type", e.target.value)}
          >
            <MenuItem value="">Tous les types</MenuItem>
            {leaveTypes.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Usine</InputLabel>
          <Select
            label="Usine"
            value={filters.factory || ""}
            onChange={(e) => onChange("factory", e.target.value)}
          >
            <MenuItem value="">Toutes les usines</MenuItem>
            {factories.map((f) => (
              <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="Du"
          type="date"
          value={filters.date_from || ""}
          onChange={(e) => onChange("date_from", e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />

        <TextField
          size="small"
          label="Au"
          type="date"
          value={filters.date_to || ""}
          onChange={(e) => onChange("date_to", e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />

        <TextField
          size="small"
          placeholder="Rechercher un employé..."
          value={filters.search}
          onChange={(e) => onChange("search", e.target.value)}
          sx={{ minWidth: 280 }}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1 }}>
        <IconButton onClick={onRefresh}>
          <RefreshIcon />
        </IconButton>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? "Export..." : "Exporter CSV"}
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
          Nouvel événement
        </Button>
      </Box>
    </Box>
  );
}