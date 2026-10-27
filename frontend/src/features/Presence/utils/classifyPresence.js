export function classifyPresence(kpi, badgeMap) {
  if (!kpi?.present_ids || !badgeMap) return null;
  const active = new Set(badgeMap.active);
  const fallback = new Set(badgeMap.active_fallback);
  const inactive = new Set(badgeMap.inactive);
  const lateSet = new Set(kpi.late_ids || []);
  const presentSet = new Set(kpi.present_ids);
  const r = {
    presentActive: 0, viaMatricule: 0, inactive: 0, unknown: 0, lateActive: 0,
    totalActive: badgeMap.active_total, unknownIds: [], inactiveIds: [], absentPeople: [],
  };
  for (const id of kpi.present_ids) {
    if (active.has(id) || fallback.has(id)) {
      r.presentActive++;
      if (fallback.has(id)) r.viaMatricule++;
      if (lateSet.has(id)) r.lateActive++;
    } else if (inactive.has(id)) {
      r.inactive++;
      r.inactiveIds.push(id);
    } else {
      r.unknown++;
      r.unknownIds.push(id);
    }
  }
  // Active employees with no punch today (including those with no badge number at all)
  for (const p of badgeMap.active_people || []) {
    let b = p.badge;
    if (b == null) {
      const s = String(p.employee_id || "").trim();
      if (/^\d+$/.test(s) && s.length <= 9) b = parseInt(s, 10);
    }
    if (b == null || !presentSet.has(b)) r.absentPeople.push({ ...p, effectiveBadge: b });
  }
  return r;
}
