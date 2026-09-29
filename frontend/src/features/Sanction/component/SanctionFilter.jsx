import { Box, TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem, Button } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";

export default function SanctionFilter({
  sanctionType, onSanctionTypeChange,
  date, onDateChange,
  sanctionTypes = [],
  search, onSearchChange,
  canWrite, onAdd,
}) {
  return (
    <Box display="flex" gap={2} mb={2} alignItems="center" flexWrap="wrap">
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Sanction</InputLabel>
        <Select
          value={sanctionType}
          label="Sanction"
          onChange={(e) => onSanctionTypeChange(e.target.value)}
        >
          <MenuItem value="">Toutes</MenuItem>
          {sanctionTypes.filter(Boolean).map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        size="small"
        label="Date"
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 170 }}
      />

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