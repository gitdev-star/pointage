// ─── useExportCSV.js ──────────────────────────────────────────────────────────
// Remplace la logique exportCSV() copiée-collée dans EmployeeList et RegistreView.

import { useState, useCallback } from "react";
import hrClient from "../../../api/hrClient";
import { buildCSVContent, downloadCSV, csvFilename, buildApiParams } from "../utils/EmployeUtil";

/**
 * Hook d'export CSV pour le module employé.
 *
 * @param {object}   filters       - Filtres courants (depuis useEmployeeFilters)
 * @param {string}   [filenamePrefix="employes"] - Préfixe du fichier téléchargé
 * @param {string}   [endpoint="employees/export/"]
 * @returns {{ exporting: boolean, exportCSV: () => Promise<void>, exportError: string|null }}
 */
export function useExportCSV(filters, filenamePrefix = "employes", endpoint = "employees/export/") {
  const [exporting,   setExporting]   = useState(false);
  const [exportError, setExportError] = useState(null);

  const exportCSV = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      // On demande jusqu'à 5 000 lignes pour l'export (pas de pagination)
      const params = buildApiParams(filters, 0, 5000);
      // L'export ne doit pas être paginé → on force page=1 et on retire page de la query
      params.page = 1;

      const r    = await hrClient.get(endpoint, { params });
      const rows = (r.data.results ?? r.data).slice().sort((a, b) =>
        String(a.employee_id ?? "").localeCompare(String(b.employee_id ?? ""), undefined, { numeric: true, sensitivity: "base" })
      );

      const content = buildCSVContent(rows);
      downloadCSV(content, csvFilename(filenamePrefix));
    } catch {
      setExportError("Erreur lors de l'export CSV.");
    } finally {
      setExporting(false);
    }
  }, [filters, filenamePrefix, endpoint]);

  return { exporting, exportCSV, exportError };
}