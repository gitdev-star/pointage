// utils/exportCsv.js
export function exportLateListCsv(lateRecords, employeeMap, getEmployeeName, filename = "retards_du_jour") {
  const extractTime = (arrival) => {
    if (!arrival) return "";
    const timePart = arrival.includes("T") ? arrival.split("T")[1] : arrival;
    return timePart.slice(0, 5);
  };

  const headers = ["Matricule", "Nom", "Département", "Usine", "Arrivée", "Retard (min)"];
  const rows = lateRecords.map((r) => {
    const emp = employeeMap[r.user_id] || {};
    return [
      emp.empId || "",
      getEmployeeName(r.user_id) || `Utilisateur #${r.user_id}`,
      emp.departmentName || "",
      emp.factoryName || "",
      extractTime(r.arrival),
      r.minutes_late,
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}