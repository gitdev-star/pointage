import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";

const STATUSES = [
  { value: "", label: "Tous" },
  { value: "PENDING", label: "En attente" },
  { value: "APPROVED", label: "Approuvé" },
  { value: "REJECTED", label: "Rejeté" },
];

export default function EventStatusFilter({ value, onChange }) {
  return (
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <InputLabel>Statut</InputLabel>
      <Select
        value={value}
        label="Statut"
        onChange={(e) => onChange(e.target.value)}
      >
        {STATUSES.map(({ value: v, label }) => (
          <MenuItem key={v} value={v}>
            {label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}