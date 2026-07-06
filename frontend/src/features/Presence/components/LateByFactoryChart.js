import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Factory } from "lucide-react";

const COLORS = ["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#3b82f6", "#60a5fa", "#93c5fd"];

export default function LateByFactoryChart({ data = [], loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-gray-400 text-sm">
        Chargement…
      </div>
    );
  }

  const sortedByLate = [...data].sort((a, b) => b.late - a.late);
  const sortedByRate = [...data].sort((a, b) => b.rate - a.rate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
      {/* Nombre de retards par usine */}
      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Factory className="text-orange-500" size={18} />
          <h3 className="font-semibold text-gray-800">Retards par usine</h3>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={sortedByLate}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="factory" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(v) => [`${v} retards`, ""]} />
            <Bar dataKey="late" radius={[6, 6, 0, 0]}>
              {sortedByLate.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Taux de retard par usine */}
      {/* <div className="bg-white rounded-2xl shadow-sm border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Factory className="text-blue-500" size={18} />
          <h3 className="font-semibold text-gray-800">Taux de retard par usine (%)</h3>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={sortedByRate}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="factory" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
            <YAxis unit="%" allowDecimals={false} />
            <Tooltip formatter={(v, name, props) => [`${v}% (${props.payload.late}/${props.payload.present})`, "Taux"]} />
            <Bar dataKey="rate" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div> */}
    </div>
  );
}