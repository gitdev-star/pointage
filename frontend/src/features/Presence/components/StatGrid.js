// import React from "react";
// import {
//   BarChart3,
//   Clock,
//   TrendingUp,
//   Users,
// } from "lucide-react";
// import { formatDateTime } from "../utils/FormatDate";
// export default function StatsGrid({
//   stats,
//   totalRecords,
//   kpi,
//   totalActive,
// }) {

//   const statCards = [
//     { title: "KPI DEMANDEE",    value:  0,          icon: BarChart3  },
//     // { title: "Pointages",        value: stats.total_records || 0,   icon: Clock      },
//     { title: "KPI DEMANDEE",     value:  0,    icon: Users      },
//     { title: "Dernier pointage", value: formatDateTime(stats.latest_punch) || "—",  icon: TrendingUp },
//   ];

//   return (
//     <div className="space-y-5 mb-8">
//       {/* Stats générales */}
//       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
//         {statCards.map((card) => (
//           <div key={card.title} className="bg-white rounded-2xl shadow-sm p-5 border">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-gray-500">{card.title}</p>
//                 <h2 className="text-2xl font-bold mt-2">{card.value}</h2>
//               </div>
//               <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
//                 <card.icon className="text-blue-600" />
//               </div>
//             </div>
//           </div>
//         ))}
//       </div>

//     </div>
//   );
// }





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
    green: { bg: "bg-green-50",  text: "text-green-600",  bar: "bg-green-500",  border: "border-l-green-500"  },
    red:   { bg: "bg-red-50",    text: "text-red-500",    bar: "bg-red-400",    border: "border-l-red-500"    },
    yellow:{ bg: "bg-yellow-50", text: "text-yellow-500", bar: "bg-yellow-400", border: "border-l-yellow-500" },
    blue:  { bg: "bg-blue-50",   text: "text-blue-600",   bar: "bg-blue-400",   border: "border-l-blue-500"   },
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