// =====================================================
// PATH: src/features/Retard/components/EmployeeRow.jsx
// =====================================================
import React, { useState } from "react";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";

const LateBadge = ({ count }) => {
  const style =
    count >= 10 ? "bg-red-100 text-red-700 border-red-300" :
    count >= 6  ? "bg-orange-100 text-orange-700 border-orange-300" :
    count >= 3  ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
                  "bg-green-100 text-green-700 border-green-300";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${style}`}>
      {count}×
    </span>
  );
};

const RateBar = ({ pct }) => {
  const barColor =
    pct >= 50 ? "bg-red-500" :
    pct >= 25 ? "bg-orange-400" :
                "bg-green-400";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-600 w-9 text-right">{pct}%</span>
    </div>
  );
};

export default function EmployeeRow({ emp, rank, employeeName }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={`cursor-pointer transition-colors hover:bg-gray-50 ${expanded ? "bg-blue-50/50" : ""}`}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Rang */}
        <td className="px-4 py-3 text-sm">
          <span className={`font-bold ${rank <= 3 ? "text-orange-500" : "text-gray-400"}`}>
            #{rank}
          </span>
        </td>

        {/* Employé */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {employeeName ? employeeName.charAt(0).toUpperCase() : "?"}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">
                {employeeName || `Employé #${emp.user_id}`}
              </div>
              <div className="text-xs text-gray-400">ID: {emp.user_id}</div>
            </div>
          </div>
        </td>

        {/* Retards */}
        <td className="px-4 py-3 text-center">
          <LateBadge count={emp.late_count} />
        </td>

        {/* Présences */}
        <td className="px-4 py-3 text-center text-sm text-gray-600">
          {emp.total_days_present}j
        </td>

        {/* Taux */}
        <td className="px-4 py-3">
          <RateBar pct={emp.late_rate_pct} />
        </td>

        {/* Expand */}
        <td className="px-4 py-3 text-gray-400">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </td>
      </tr>

      {/* Détail */}
      {expanded && (
        <tr className="bg-blue-50/30">
          <td colSpan={6} className="px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {emp.late_days.map((ld, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 bg-white rounded-xl border border-blue-100 px-3 py-2 text-xs shadow-sm min-w-[80px]"
                >
                  <div className="font-semibold text-gray-700">
                    {new Date(ld.date + "T00:00:00").toLocaleDateString("fr-FR", {
                      day: "2-digit", month: "short",
                    })}
                  </div>
                  <div className="text-gray-400">{ld.day_name}</div>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock size={10} /> {ld.arrival || "—"}
                  </div>
                  <div className={`font-bold ${ld.minutes_late >= 30 ? "text-red-500" : "text-orange-400"}`}>
                    +{ld.minutes_late} min
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
