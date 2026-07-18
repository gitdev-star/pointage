import { useState, useEffect, useCallback } from "react";
import hrClient from "../../../api/hrClient";

const DEFAULT_PAGE_SIZE = 50;

const ACTION_OPTIONS = [
  { value: "",       label: "Toutes les actions" },
  { value: "CREATE", label: "Création" },
  { value: "UPDATE", label: "Modification" },
  { value: "DELETE", label: "Suppression" },
];

export function useAuditLog() {
  const [logs, setLogs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const [page, setPage]         = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [filters, setFiltersState] = useState({
    action: "",
    model_name: "",
    search: "",
    date_from: "",
    date_to: "",
  });

  const setFilter = (key, value) => {
    setPage(0);
    setFiltersState((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setPage(0);
    setFiltersState({ action: "", model_name: "", search: "", date_from: "", date_to: "" });
  };

  const hasActiveFilter = Object.values(filters).some((v) => v !== "");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: pageSize,
        offset: page * pageSize,
        ordering: "-timestamp",
      };
      if (filters.action)     params.action = filters.action;
      if (filters.model_name) params.model_name = filters.model_name;
      if (filters.search)     params.search = filters.search;
      if (filters.date_from)  params.date_from = filters.date_from;
      if (filters.date_to)    params.date_to = filters.date_to;

      const r = await hrClient.get("audit/logs/", { params });
      const data = r.data;
      if (Array.isArray(data)) {
        setLogs(data);
        setTotal(data.length);
      } else if (Array.isArray(data?.results)) {
        setLogs(data.results);
        setTotal(data.count ?? data.results.length);
      } else {
        setLogs([]);
        setTotal(0);
      }
    } catch (err) {
      setError("Impossible de charger les logs d'audit.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return {
    logs, total, loading, error,
    page, setPage, pageSize, setPageSize,
    filters, setFilter, resetFilters, hasActiveFilter,
    refresh: fetchLogs,
    ACTION_OPTIONS,
  };
}