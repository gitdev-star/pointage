// ─── useEmployeeFilters.js ────────────────────────────────────────────────────
// Centralise tout l'état des filtres + debounce de la recherche.
// Utilisé par EmployeeList et RegistreView — plus de duplication.

import { useState, useRef, useCallback } from "react";
import { EMPTY_FILTERS } from "../constants/Employe.constant";
import { hasActiveFilters } from "../utils/EmployeUtil";

const DEBOUNCE_MS = 350;

/**
 * @returns {{
 *   filters:         object,
 *   searchInput:     string,
 *   page:            number,
 *   setPage:         (p: number) => void,
 *   setFilter:       (key: string, value: string) => void,
 *   handleSearch:    (value: string) => void,
 *   resetFilters:    () => void,
 *   hasActiveFilter: boolean,
 * }}
 */
export function useEmployeeFilters() {
  const [filters,     setFilters]     = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [page,        setPage]        = useState(0);
  const debounceRef                   = useRef(null);

  /** Met à jour un filtre et remet la page à 0.
   *  Changer l'usine réinitialise aussi le département (cascade). */
  const setFilter = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "factory") next.department = "";
      return next;
    });
    setPage(0);
  }, []);

  /** Debounce la recherche textuelle pour éviter un appel API à chaque frappe. */
  const handleSearch = useCallback((value) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: value }));
      setPage(0);
    }, DEBOUNCE_MS);
  }, []);

  /** Réinitialise tous les filtres à leur valeur par défaut. */
  const resetFilters = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchInput("");
    setFilters(EMPTY_FILTERS);
    setPage(0);
  }, []);

  return {
    filters,
    searchInput,
    page,
    setPage,
    setFilter,
    handleSearch,
    resetFilters,
    hasActiveFilter: hasActiveFilters(filters),
  };
}