import React from "react";
import { AlertTriangle, Clock, Download } from "lucide-react";
import { useTodayLate } from "../hook/useTodayLate";
import { exportLateListCsv } from "../utils/exportCsv"; // adapte le chemin selon ton arborescence

function extractTime(arrival) {
  if (!arrival) return null;
  const timePart = arrival.includes("T") ? arrival.split("T")[1] : arrival;
  return timePart.slice(0, 5);
}

export default function TodayLateList({
  lateRecords = [], kpi = {}, getEmployeeName, employeeMap = {},
  countOverride = null,
}) {
  const { lateList, count: kpiCount, threshold } = useTodayLate(lateRecords, kpi);
  const count = countOverride !== null ? countOverride : kpiCount;

  const handleExport = () => {
    exportLateListCsv(lateRecords, employeeMap, getEmployeeName);
  };

  console.log("employe en reatrd:", lateRecords)
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">
      <div className="flex items-center justify-between px-5 py-4 border-b bg-orange-50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-orange-500" size={20} />
          <span className="font-semibold text-gray-800">Retards du jour</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
            {count}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={lateRecords.length === 0}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            Exporter CSV
          </button>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock size={13} />
            Seuil : <strong className="ml-1 text-gray-600">{threshold}</strong>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b text-sm text-gray-500">
            <tr>
              <th className="text-left p-4">Employé</th>
              <th className="text-left p-4">Arrivée</th>
              <th className="text-left p-4">Retard</th>
            </tr>
          </thead>

          <tbody>
            {lateRecords.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-400 text-sm">
                  Aucun retard enregistré pour aujourd'hui 🎉
                </td>
              </tr>
            ) : (
              lateRecords.map((record) => (
                <tr
                  key={record.user_id}
                  className="border-b hover:bg-orange-50 transition-colors"
                >
                  <td className="p-4 font-medium text-gray-800">
                    {getEmployeeName(record.user_id) ||
                      `Utilisateur #${record.user_id}`}
                  </td>

                  <td className="p-4 font-semibold text-orange-600">
                    {extractTime(record.arrival)}
                  </td>

                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                      +{record.minutes_late} min
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}