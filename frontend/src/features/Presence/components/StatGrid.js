import React from "react";
import { Clock, TrendingDown, TrendingUp, UserCheck } from "lucide-react";
import { formatDateTime } from "../utils/FormatDate";

export default function StatsGrid({ stats, kpi, totalActive, absentCount }) {
  const presents = kpi?.presents ?? 0;
  const late     = kpi?.late     ?? 0;
  // const onTime   = Math.max(0, presents - late);

  const tauxPresence = totalActive > 0
    ? Math.round((presents / totalActive) * 100)
    : null;

  const tauxAbsence = totalActive > 0
    ? Math.round((absentCount / totalActive) * 100)
    : null;

  const tauxRetard = presents > 0
    ? Math.round((late / presents) * 100)
    : null;

  const kpiCards = [
    {
      title:   "Taux de présence",
      value:   presents,
      sub:     `sur ${totalActive ?? "—"} actifs`,
      percent: tauxPresence,
      icon:    UserCheck,
      color:   "green",
    },
    {
      title:   "Taux d'absence",
      value:   absentCount,
      sub:     `sur ${totalActive ?? "—"} actifs`,
      percent: tauxAbsence,
      icon:    TrendingDown,
      color:   "red",
    },
    {
      title:   "Taux de retard",
      value:   late,
      sub:     `sur ${presents} présents`,
      percent: tauxRetard,
      icon:    Clock,
      color:   "yellow",
    },
    {
      title:   "Dernier pointage",
      value:   formatDateTime(stats?.latest_punch) || "—",
      sub:     null,
      percent: null,
      icon:    TrendingUp,
      color:   "blue",
    },
  ];

const colorMap = {
  green:  { bg: "bg-[#eef3f0]", text: "text-[#4a6656]", bar: "bg-[#6f8f7c]", border: "border-l-[#6f8f7c]" },
  red:    { bg: "bg-[#f7ecea]", text: "text-[#7c433d]", bar: "bg-[#a45c56]", border: "border-l-[#a45c56]" },
  yellow: { bg: "bg-[#f8f2e6]", text: "text-[#8a723f]", bar: "bg-[#b99b5d]", border: "border-l-[#b99b5d]" },
  blue:   { bg: "bg-[#eaeef0]", text: "text-[#3f5462]", bar: "bg-[#5b7a8c]", border: "border-l-[#5b7a8c]" },
};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
      {kpiCards.map((card) => {
        const c = colorMap[card.color];
        return (
          <div
            key={card.title}
            className={`bg-white rounded-2xl shadow-sm p-5 border border-l-4 ${c.border}`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{card.title}</p>
              <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                <card.icon className={c.text} size={20} />
              </div>
            </div>

            <h2 className={`text-3xl font-bold ${c.text}`}>{card.value}</h2>

            {card.percent != null && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{card.sub}</span>
                  <span className={`font-semibold ${c.text}`}>{card.percent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`${c.bar} h-1.5 rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(card.percent, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {card.percent == null && card.sub && (
              <p className="text-xs text-gray-400 mt-2">{card.sub}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}