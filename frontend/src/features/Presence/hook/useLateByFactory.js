import { useState, useEffect } from "react";
import { attendanceService } from "../api/PresenceService";

export default function useLateByFactory(employeeMap, targetDate) {
  const [presentUserIds, setPresentUserIds] = useState([]);
  const [lateRecords, setLateRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!targetDate) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      attendanceService.getPresentToday(targetDate),
      attendanceService.getLateToday(targetDate, 0, 1000), // large limit pour tout récupérer
    ])
      .then(([present, lateRes]) => {
        if (cancelled) return;
        setPresentUserIds(present.map((r) => r.user_id));
        setLateRecords(lateRes.data ?? lateRes);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [targetDate]);

const byFactory = {};

presentUserIds.forEach((uid) => {
  const emp = employeeMap[uid];
  const factory = emp
    ? (emp.factoryName || "Sans usine")
    : "Employé inconnu";
  if (!byFactory[factory]) byFactory[factory] = { factory, present: 0, late: 0 };
  byFactory[factory].present += 1;
});

lateRecords.forEach((r) => {
  const emp = employeeMap[r.user_id];
  const factory = emp
    ? (emp.factoryName || "Sans usine")
    : "Employé inconnu";
  if (!byFactory[factory]) byFactory[factory] = { factory, present: 0, late: 0 };
  byFactory[factory].late += 1;
});

  const data = Object.values(byFactory).map((f) => ({
    ...f,
    rate: f.present > 0 ? Math.round((f.late / f.present) * 100) : 0,
  }));

  console.log("presentUserIds.length:", presentUserIds.length);
  console.log("lateRecords.length:", lateRecords.length);
  console.log("lateRecords sample:", lateRecords[0]);
  console.log("byFactory:", byFactory);
  console.log("data:", data);
  const unknownPresent = presentUserIds.filter((uid) => !employeeMap[uid]);
const unknownLate = lateRecords.filter((r) => !employeeMap[r.user_id]).map((r) => r.user_id);

console.log("Présents avec user_id inconnu:", unknownPresent);
console.log("Retards avec user_id inconnu:", unknownLate);

  return { data, loading };
}