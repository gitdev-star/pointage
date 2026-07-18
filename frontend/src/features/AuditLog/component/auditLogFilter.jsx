import React, { useState } from "react";
import {
  TextField, MenuItem, IconButton, Tooltip, InputAdornment,
} from "@mui/material";
import SearchIcon      from "@mui/icons-material/Search";
import RestartAltIcon  from "@mui/icons-material/RestartAlt";

export function AuditLogFilters({ filters, onFilterChange, onReset, hasActiveFilter, actionOptions }) {
  const [searchInput, setSearchInput] = useState(filters.search);

  const submitSearch = (e) => {
    e.preventDefault();
    onFilterChange("search", searchInput);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
      <form onSubmit={submitSearch} className="flex-1 min-w-[220px]">
        <TextField
          fullWidth size="small" placeholder="Rechercher (nom, objet...)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </form>

      <TextField
        select size="small" label="Action" value={filters.action}
        onChange={(e) => onFilterChange("action", e.target.value)}
        sx={{ minWidth: 160 }}
      >
        {actionOptions.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </TextField>

      <TextField
        size="small" label="Modèle" placeholder="ex: employee"
        value={filters.model_name}
        onChange={(e) => onFilterChange("model_name", e.target.value)}
        sx={{ minWidth: 140 }}
      />

      <TextField
        size="small" type="date" label="Du"
        InputLabelProps={{ shrink: true }}
        value={filters.date_from}
        onChange={(e) => onFilterChange("date_from", e.target.value)}
        sx={{ minWidth: 150 }}
      />

      <TextField
        size="small" type="date" label="Au"
        InputLabelProps={{ shrink: true }}
        value={filters.date_to}
        onChange={(e) => onFilterChange("date_to", e.target.value)}
        sx={{ minWidth: 150 }}
      />

      {hasActiveFilter && (
        <Tooltip title="Réinitialiser les filtres">
          <IconButton onClick={() => { setSearchInput(""); onReset(); }} size="small">
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
}