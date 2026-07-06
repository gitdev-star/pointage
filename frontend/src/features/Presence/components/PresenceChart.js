import React, { useMemo, useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import hrClient from "../../../api/hrClient";

// ─── Donut Présents / Absents / En retard ────────────────────────────────────

const DONUT_COLORS = {
  presents: "#22c55e",
  retards:  "#f59e0b",
  absents:  "#ef4444",
};

function DonutChart({ kpi, totalActive, absentCount }) {
    const retards  = kpi?.late ?? 0;
  const presents = kpi.presents ?? 0;
  const absents  = absentCount ?? 0;

  const total = presents + retards + absents; // ← total réel du donut

  // const absents  = kpi?.presents != null && totalActive != null
  //   ? Math.max(0, totalActive - kpi.presents)
  //   : 0;
  // const retards  = kpi?.late ?? 0;
  // const presents = Math.max(0, (kpi?.presents ?? 0) - retards);
  const data = [
    { name: "À l'heure",  value: presents, color: DONUT_COLORS.presents },
    { name: "En retard",  value: retards,  color: DONUT_COLORS.retards  },
    { name: "Absents",    value: absents,  color: DONUT_COLORS.absents  },
  ].filter(d => d.value > 0);


  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-sm">
        <span style={{ color: d.color }} className="font-semibold">{d.name}</span>
        <div className="text-gray-600">{d.value} employés ({pct}%)</div>
      </div>
    );
  };

  const CustomLabel = ({ cx, cy }) => (
    <>
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-gray-800 text-2xl font-bold" fontSize={24} fontWeight={700}>
        {totalActive}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#9ca3af" fontSize={12}>
      employes
      </text>
    </>
  );

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">
        Répartition du jour
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            labelLine={false}
            label={<CustomLabel />}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-gray-600">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Mini stats sous le donut */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        {[
          { label: "À l'heure", value: presents, color: "#6f8f7c", bg: "bg-[#eef3f0]" },
          { label: "En retard", value: retards,  color: "#b99b5d", bg: "bg-[#f7ecea]" },
          { label: "Absents",   value: absents,  color: "#a45c56",   bg: "bg-[#f8f2e6]"   },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-2 text-center`}>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Présences par jour ───────────────────────────────────────────────────────

function PresenceBarChart({ attendanceData }) {
        const [totalActive, setTotalActive] = useState(0);

  // Fetch une seule fois le vrai total des employés actifs
  useEffect(() => {
    hrClient
      .get("employees/", { params: { status: "ACTIVE", page_size: 1 } })
      .then(r => setTotalActive(r.data.count ?? 0))
      .catch(() => {});
  }, []);

  const chartData = useMemo(() => {
    if (!attendanceData?.length) return [];

    // Compte les présences par date
    const byDate = {};
    attendanceData.forEach(record => {
      const date = record.attendance_date;
      if (!date) return;
      byDate[date] = (byDate[date] || 0) + 1;
    });

    // Trie par date et formate
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date + "T00:00:00").toLocaleDateString("fr-FR", {
          day: "2-digit", month: "2-digit",
        }),
        présences: count,
      }));
  }, [attendanceData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-sm">
        <div className="font-semibold text-gray-700 mb-1">{label}</div>
        <div className="text-blue-600 font-bold">{payload[0].value} présences</div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">
        Présences par jour
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Sur la période filtrée — {chartData.length} jour(s)
      </p>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">
          Aucune donnée à afficher
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barSize={chartData.length > 14 ? 8 : 20}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              interval={chartData.length > 14 ? Math.floor(chartData.length / 7) : 0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={35}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f3f4f6", radius: 4 }} />
            <Bar
              dataKey="présences"
              fill="#5b7a8c"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PresenceCharts({ kpi, totalActive, attendanceData, absentCount  }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
      <DonutChart kpi={kpi} totalActive={totalActive} absentCount={absentCount} />
      <PresenceBarChart attendanceData={attendanceData} />
    </div>
  );
}
