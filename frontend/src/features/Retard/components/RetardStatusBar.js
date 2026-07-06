// =====================================================
// PATH: src/features/Retard/components/RetardStatsBar.jsx
// =====================================================
import React from "react";
import { Users, AlertTriangle, BarChart2, Calendar, Tag } from "lucide-react";
import { CLASS_DEFAULT, CLASS_ALL } from "../hook/useRetard";

const MONTH_NAMES = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const StatCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    teal:   "bg-teal-50 text-teal-700 border-teal-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  const iconColors = {
    blue: "text-blue-500", orange: "text-orange-500",
    red: "text-red-500",   teal: "text-teal-500", purple: "text-purple-500",
  };

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${colors[color]}`}>
      <div className={`shrink-0 ${iconColors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-xs font-medium opacity-70">{label}</div>
        <div className="text-lg font-bold leading-tight">{value}</div>
      </div>
    </div>
  );
};

export default function RetardStatsBar({ data, classification }) {
  if (!data) return null;

  const classLabel =
    classification === CLASS_DEFAULT ? "Non-HC (défaut)" :
    classification === CLASS_ALL     ? "Tous les employés" :
    classification;

  const taux = data.total_employees_analyzed
    ? `${Math.round(data.total_late_employees / data.total_employees_analyzed * 100)}%`
    : "—";

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <StatCard icon={Users}         label="Employés analysés"            value={data.total_employees_analyzed} color="blue"   />
      <StatCard icon={AlertTriangle} label={`En retard ≥ ${data.min_late}×`} value={data.total_late_employees}  color="orange" />
      <StatCard icon={BarChart2}     label="Taux"                         value={taux}                          color="red"    />
      <StatCard icon={Calendar}      label="Période"                      value={`${MONTH_NAMES[data.month]} ${data.year}`} color="teal" />
      <StatCard icon={Tag}           label="Périmètre"                    value={classLabel}                    color="purple" />
    </div>
  );
}
