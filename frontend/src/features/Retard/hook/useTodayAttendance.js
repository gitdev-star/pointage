import { useState, useEffect } from "react";
import { attendanceService } from "../../Presence/api/PresenceService";

const TODAY = new Date().toISOString().split("T")[0];

export default function useTodayAttendance() {
  const [allLateRecords, setAllLateRecords] = useState([]);
  const [kpi, setKpi] = useState({});
  const [loading, setLoading] = useState(false);
  // const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      // limit=1000 pour tout récupérer d'un coup (max retards raisonnables)
      attendanceService.getLateToday(TODAY, 0, 1000),
      attendanceService.getKpi(TODAY),
    ])
      .then(([lateRes, kpiData]) => {
        if (cancelled) return;
        setAllLateRecords(lateRes.data ?? []);
        setKpi(kpiData);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { allLateRecords, kpi, loading };
}