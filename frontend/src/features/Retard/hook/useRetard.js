import { useState, useEffect, useMemo, useCallback } from "react";
import { retardService } from "../api/RetardService";
import hrClient from "../../../api/hrClient";

const now = new Date();
export const CLASS_DEFAULT = "__DEFAULT__";
export const CLASS_ALL     = "__ALL__";

// ── Chargement de l'employeeMap (sessionStorage comme cache) ─────────────────
async function loadEmployeeMap() {
  try {
    sessionStorage.removeItem("empMap_v1");
  } catch { /* ignore */ }

  const res = await hrClient.get("employees/", {
    params: { page_size: 5000, status: "ACTIVE" },
  });
  const map = {};
  (res.data.results ?? res.data).forEach((e) => {
    const id = Number(e.device_user_id || e.employee_id);
    if (id) {
      map[id] = {
        name: `${e.first_name} ${e.last_name}`,
        factoryId: e.factory,
        factoryName: e.factory_name || "Non assigné",
      };
    }
  });
  sessionStorage.setItem("empMap_v1", JSON.stringify(map));
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function useRetard() {

  // ── Filtres ────────────────────────────────────────────────────────────────
  const [year,           setYear]           = useState(now.getFullYear());
  const [month,          setMonth]          = useState(now.getMonth() + 1);
  const [minLate,        setMinLate]        = useState(3);
  const [classification, setClassification] = useState(CLASS_DEFAULT);

  // ── Données ────────────────────────────────────────────────────────────────
  const [data,            setData]            = useState(null);
  const [classifications, setClassifications] = useState([]);
  const [employeeMap,     setEmployeeMap]     = useState({});

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error,     setError]     = useState(null);
  const [search,    setSearch]    = useState("");
  const [sortBy,    setSortBy]    = useState("late_count");
  const [sortDir,   setSortDir]   = useState("desc");

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    retardService.getClassifications().then(setClassifications).catch(() => {});
    loadEmployeeMap().then(setEmployeeMap).catch(() => {});
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getEmployeeName = useCallback(
    (uid) => employeeMap[Number(uid)]?.name || null,
    [employeeMap]
  );

  const classificationParam = useMemo(() => {
    if (classification === CLASS_ALL)     return "ALL";
    if (classification === CLASS_DEFAULT) return null;
    return classification;
  }, [classification]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setError(null);
    setData(null);
    setLoading(true);
    try {
      const result = await retardService.getLateReport({
        year, month, minLate, classification: classificationParam,
      });
      setData(result);
    } catch (e) {
      setError(e.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [year, month, minLate, classificationParam]);

  const exportReport = useCallback(async () => {
    setExporting(true);
    try {
      await retardService.exportLateReport({
        year, month, minLate, classification: classificationParam,
      });
    } catch (e) {
      alert(e.message || "Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  }, [year, month, minLate, classificationParam]);

  const toggleSort = useCallback((col) => {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  }, [sortBy]);

  // ── Données triées/filtrées ────────────────────────────────────────────────
  const sortedEmployees = useMemo(() => {
    if (!data?.employees) return [];
    let list = [...data.employees];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((emp) => {
        const name = getEmployeeName(emp.user_id)?.toLowerCase() || "";
        return name.includes(q) || String(emp.user_id).includes(q);
      });
    }

    list.sort((a, b) => {
      const va = a[sortBy] ?? 0;
      const vb = b[sortBy] ?? 0;
      return sortDir === "desc" ? vb - va : va - vb;
    });

    return list;
  }, [data, sortBy, sortDir, search, getEmployeeName]);

  // ── Retour ─────────────────────────────────────────────────────────────────
  return {
    // filtres
    filters: { year, month, minLate, classification },
    setYear, setMonth, setMinLate, setClassification,
    classifications,
    // données
    data,
    sortedEmployees,
    getEmployeeName,
    // ui
    loading, exporting, error,
    search, setSearch,
    sortBy, sortDir, toggleSort,
    // actions
    fetchReport, exportReport,
    employeeMap
  };
}