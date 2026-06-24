// =====================================================
// PATH: src/features/Retard/components/TodayLateList.jsx
// =====================================================
import React from "react";
import { AlertTriangle, Clock, Eye } from "lucide-react";
import { useTodayLate } from "../hook/useTodayLate";

// Extrait "HH:MM" depuis un datetime ISO ou une heure simple
function extractTime(arrival) {
  if (!arrival) return null;
  const timePart = arrival.includes("T")
    ? arrival.split("T")[1]
    : arrival.includes(" ") && arrival.indexOf(" ") === 10
      ? arrival.split(" ")[1]
      : arrival;
  return timePart.slice(0, 5); // → "HH:MM"
}

// Calcule les minutes de retard entre l'arrivée et le seuil "HH:MM"
function calcMinutesLate(arrival, threshold) {
  const time = extractTime(arrival);
  if (!time) return 0;
  const [ah, am] = time.split(":").map(Number);
  const [th, tm] = threshold.split(":").map(Number);
  return Math.max(0, (ah * 60 + am) - (th * 60 + tm));
}

export default function TodayLateList({ todayRecords = [], getEmployeeName, onDetail }) {
  const { lateList, count, threshold } = useTodayLate(todayRecords);

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">

      {/* En-tête */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-orange-50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-orange-500" size={20} />
          <span className="font-semibold text-gray-800">Retards du jour</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
            {count}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock size={13} />
          Seuil : <strong className="ml-1 text-gray-600">{threshold}</strong>
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b text-sm text-gray-500">
            <tr>
              <th className="text-left p-4">Employé</th>
              <th className="text-left p-4">Arrivée</th>
              <th className="text-left p-4">Retard</th>
              {onDetail && <th className="text-left p-4">Action</th>}
            </tr>
          </thead>
          <tbody>
            {lateList.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-400 text-sm">
                  Aucun retard enregistré pour aujourd'hui 🎉
                </td>
              </tr>
            ) : lateList.map((record, i) => {
              const minutes = calcMinutesLate(record.arrival, threshold);
              return (
                <tr key={i} className="border-b hover:bg-orange-50 transition-colors">
                  <td className="p-4 font-medium text-gray-800">
                    {getEmployeeName(record.user_id) || `Utilisateur #${record.user_id}`}
                  </td>
                  <td className="p-4 font-semibold text-orange-600">
                    {extractTime(record.arrival)}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                      +{minutes} min
                    </span>
                  </td>
                  {onDetail && (
                    <td className="p-4">
                      <button onClick={() => onDetail(record)}
                        className="text-gray-400 hover:text-gray-700 transition-colors">
                        <Eye size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
