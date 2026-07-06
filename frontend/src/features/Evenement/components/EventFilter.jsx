import { Box, TextField, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import IconButton from "@mui/material/IconButton";
import EventStatusFilter from "./EventStatusFilter";

export default function EventFilters({ filters, onChange, onAdd, onRefresh }) {
  return (
    <Box sx={{ mb: 3, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
        <EventStatusFilter
          value={filters.status}
          onChange={(val) => onChange("status", val)}
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
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
          Nouvel événement
        </Button>
      </Box>
    </Box>
  );
}