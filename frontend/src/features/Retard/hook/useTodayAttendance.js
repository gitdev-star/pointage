// =====================================================
// PATH: src/features/Retard/hook/useTodayAttendance.js
//
// Hook léger — fetch uniquement les pointages du jour
// sans déclencher stats, kpi, employeeMap ni clockers.
// =====================================================
import { useState, useEffect } from "react";
import { attendanceService } from "../../Presence/api/PresenceService";

const TODAY = new Date().toISOString().split("T")[0];

export default function useTodayAttendance() {
  const [todayRecords, setTodayRecords] = useState([]);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    params.append("date_from", TODAY);
    params.append("date_to",   TODAY);
    params.append("limit",     1000);
    params.append("skip",      0);

    attendanceService
      .getGrouped(params.toString())
      .then((data) => { if (!cancelled) setTodayRecords(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { todayRecords, loading };
}
