import { useState, useEffect, useMemo, useCallback } from "react";
import { retardService } from "../api/RetardService";
import hrClient from "../../../api/hrClient";

const now = new Date();
export const CLASS_DEFAULT = "__DEFAULT__";
export const CLASS_ALL     = "__ALL__";

// ── Chargement de l'employeeMap (sessionStorage comme cache) ─────────────────
async function loadEmployeeMap() {
  try {
    const cached = sessionStorage.getItem("empMap_v1");
    if (cached) return JSON.parse(cached);
  } catch { /* ignore corrupt cache, fall through to fetch */ }

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
        factoryName: e.factory_name || "Non assign�",
        empId: e.employee_id || "",
        departmentName: e.department_name || "Non assign�",
        fonction: e.fonction || e.poste || e.job_title || "Non assign�", // <-- � ajuster
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

const exportReport = useCallback(() => {
  if (!data) return;
  setExporting(true);
  try {
    const MONTH_NAMES = ["", "Janvier","F�vrier","Mars","Avril","Mai","Juin",
      "Juillet","Ao�t","Septembre","Octobre","Novembre","D�cembre"];

    const DAY_NAMES_FR = {
  	Monday: "Lundi", Tuesday: "Mardi", Wednesday: "Mercredi",
  	Thursday: "Jeudi", Friday: "Vendredi", Saturday: "Samedi", Sunday: "Dimanche",
    };

    const rows = [];
    rows.push([`Rapport retards � ${MONTH_NAMES[data.month]} ${data.year}`]);
    rows.push([`Seuil minimum : ${data.min_late} retard(s)`]);
    rows.push([
      `Employ�s analys�s : ${data.total_employees_analyzed}`,
      `Employ�s en retard = ${data.min_late}x : ${data.total_late_employees}`,
    ]);
    rows.push([]);
    rows.push([
      "ID Employ�", "Nom", "Fonction", "Nb retards", "Jours pr�sents",
      "Taux retard (%)", "Date", "Jour", "Heure arriv�e", "Minutes de retard",
    ]);

data.employees.forEach((emp) => {
  const info = employeeMap[Number(emp.user_id)] || {};
  emp.late_days.forEach((ld, i) => {
    rows.push([
      i === 0 ? emp.user_id : "",
      i === 0 ? (info.name || "Employ� inconnu") : "",
      i === 0 ? (info.fonction || "") : "",
      i === 0 ? emp.late_count : "",
      i === 0 ? emp.total_days_present : "",
      i === 0 ? emp.late_rate_pct : "",
      new Date(ld.date).toLocaleDateString("fr-FR"),
      DAY_NAMES_FR[ld.day_name] || ld.day_name,
      ld.arrival || "�",
      ld.minutes_late,
    ]);
  });
});
    const csv = "\ufeff" + rows.map(r => r.join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `retards_${data.year}_${String(data.month).padStart(2, "0")}_min${data.min_late}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(e.message || "Erreur lors de l'export");
  } finally {
    setExporting(false);
  }
}, [data, employeeMap]);
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