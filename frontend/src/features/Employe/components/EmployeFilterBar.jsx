// ─── EmployeeFilterBar.jsx ────────────────────────────────────────────────────
// Barre de filtres réutilisée par EmployeeList et RegistreView.
// Avant : copiée-collée (~60 lignes) dans les deux fichiers.

import React from "react";
import {
  TextField, FormControl, InputLabel, Select, MenuItem, InputAdornment, Button,
} from "@mui/material";
import SearchIcon        from "@mui/icons-material/Search";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import { STATUS_LABELS, CONTRACT_LABELS } from "../constants/Employe.constant";

/**
 * @param {object}   filters
 * @param {string}   searchInput
 * @param {function} onSearch          - (value: string) => void
 * @param {function} onFilterChange    - (key: string, value: string) => void
 * @param {function} onReset
 * @param {boolean}  hasActiveFilter
 * @param {array}    factories
 * @param {array}    departments
 */
export function EmployeeFilterBar({
  filters,
  searchInput,
  onSearch,
  onFilterChange,
  onReset,
  hasActiveFilter,
  factories   = [],
  departments = [],
}) {
  // Les départements sont filtrés par usine sélectionnée (cascade)
  const visibleDepts = filters.factory
    ? departments.filter((d) => String(d.factory) === String(filters.factory))
    : departments;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      {/* Recherche texte */}
      <TextField
        placeholder="Rechercher nom, ID, CIN..."
        value={searchInput}
        onChange={(e) => onSearch(e.target.value)}
        size="small"
        sx={{ minWidth: 220 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {/* Statut */}
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>Statut</InputLabel>
        <Select
          value={filters.status}
          label="Statut"
          onChange={(e) => onFilterChange("status", e.target.value)}
        >
          <MenuItem value="">Tous</MenuItem>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <MenuItem key={k} value={k}>{v}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Contrat */}
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>Contrat</InputLabel>
        <Select
          value={filters.contract_type}
          label="Contrat"
          onChange={(e) => onFilterChange("contract_type", e.target.value)}
        >
          <MenuItem value="">Tous</MenuItem>
          {Object.entries(CONTRACT_LABELS).map(([k, v]) => (
            <MenuItem key={k} value={k}>{v}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Sexe */}
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel>Sexe</InputLabel>
        <Select
          value={filters.sexe}
          label="Sexe"
          onChange={(e) => onFilterChange("sexe", e.target.value)}
        >
          <MenuItem value="">Tous</MenuItem>
          <MenuItem value="F">Femmes</MenuItem>
          <MenuItem value="M">Hommes</MenuItem>
        </Select>
      </FormControl>

      {/* Usine */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Usine</InputLabel>
        <Select
          value={filters.factory}
          label="Usine"
          onChange={(e) => onFilterChange("factory", e.target.value)}
        >
          <MenuItem value="">Toutes</MenuItem>
          {factories.map((f) => (
            <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Département (cascade usine) */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Département</InputLabel>
        <Select
          value={filters.department}
          label="Département"
          onChange={(e) => onFilterChange("department", e.target.value)}
        >
          <MenuItem value="">Tous</MenuItem>
          {visibleDepts.map((d) => (
            <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Reset — visible uniquement si un filtre non-défaut est actif */}
      {hasActiveFilter && (
        <Button
          size="small"
          color="error"
          variant="outlined"
          startIcon={<FilterListOffIcon />}
          onClick={onReset}
        >
          Réinitialiser
        </Button>
      )}
    </div>
  );
}
