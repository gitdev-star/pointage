import * as XLSX from "xlsx";

export default function useExportPresence() {

  const exportToExcel = ({ attendanceData, kpi, totalActive, stats, getEmployeeName, filters }) => {
    const wb = XLSX.utils.book_new();

    // ── Feuille 1 : Résumé KPI ──────────────────────────────────────────────
    const today = new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const absents = kpi?.presents != null && totalActive != null
      ? Math.max(0, totalActive - kpi.presents)
      : "—";

      

    const resumeData = [
      ["RAPPORT DE PRÉSENCE JOURNALIER"],
      [today],
      [],
      ["KPI DU JOUR"],
      ["Indicateur",              "Valeur"],
      ["Employés actifs",         totalActive ?? "—"],
      ["Présents",                kpi?.presents ?? "—"],
      ["Absents",                 absents],
      ["En retard",               kpi?.late ?? "—"],
      ["Seuil de retard",         kpi?.late_threshold ?? "—"],
      [],
      ["STATISTIQUES GÉNÉRALES"],
      ["Indicateur",              "Valeur"],
      ["Total pointages",         stats?.total_records ?? "—"],
      ["Utilisateurs uniques",    stats?.unique_users ?? "—"],
      ["Dernier pointage",        stats?.latest_punch ?? "—"],
      [],
      ["Période analysée"],
      ["Date début",              filters?.date_from ?? "—"],
      ["Date fin",                filters?.date_to ?? "—"],
    ];

    const wsResume = XLSX.utils.aoa_to_sheet(resumeData);

    // Largeurs colonnes
    wsResume["!cols"] = [{ wch: 30 }, { wch: 25 }];

    // Fusion titre
    wsResume["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    XLSX.utils.book_append_sheet(wb, wsResume, "Résumé");

    // ── Feuille 2 : Détail des présences ────────────────────────────────────
    const headers = ["ID Employé", "Nom", "Date", "Arrivée", "Départ", "Nb Pointages"];

    const rows = attendanceData.map(record => [
      record.user_id,
      getEmployeeName(record.user_id) || `Employé #${record.user_id}`,
      record.attendance_date,
      record.arrival  || "—",
      record.departure || "—",
      record.punch_count,
    ]);

    const wsDetail = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    wsDetail["!cols"] = [
      { wch: 12 }, // ID
      { wch: 30 }, // Nom
      { wch: 14 }, // Date
      { wch: 12 }, // Arrivée
      { wch: 12 }, // Départ
      { wch: 14 }, // Pointages
    ];

    XLSX.utils.book_append_sheet(wb, wsDetail, "Détail présences");

    // ── Téléchargement ──────────────────────────────────────────────────────
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `rapport_presence_${dateStr}.xlsx`);
  };

  return { exportToExcel };
}
