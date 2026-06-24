import { Box, TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem, Button } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";

const STATUSES = [
  { value: "", label: "Toutes" },
  { value: "ACTIVE", label: "Actives" },
  { value: "CANCELLED", label: "Annulées" },
  { value: "APPEALED", label: "En appel" },
];

export default function SanctionFilter({ tab, onTabChange, search, onSearchChange, canWrite, onAdd }) {
  return (
    <Box display="flex" gap={2} mb={2} alignItems="center">
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Statut</InputLabel>
        <Select
          value={tab}
          label="Statut"
          onChange={(e) => onTabChange(e.target.value)}
        >
          {STATUSES.map(({ value, label }) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        size="small"
        placeholder="Rechercher employé..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ width: 250 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {canWrite && (
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ ml: "auto" }}>
          Nouvelle sanction
        </Button>
      )}
    </Box>
  );
}