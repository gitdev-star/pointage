import React from "react";
import { FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

export default function GeneratedTransportTable({ generated }) {
  if (!generated) return null;

  const exportExcel = () => {
    const wsData = generated.rows.map(r => ({
      "Matricule": r.matricule,
      "Nom": r.nom,
      "Prénom": r.prenom,
      "Fonction": r.fonction,
      "Adresse": r.adresse,
      "Heure de fin": generated.heure,
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transport");
    XLSX.writeFile(wb, `transport_${generated.heure.replace(/[^0-9a-z]/gi, "")}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Liste générée — fin à {generated.heure}
        </h3>
        <button onClick={exportExcel} className="flex items-center gap-1 text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg">
          <FileSpreadsheet size={14} /> Excel
        </button>
      </div>
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">Matricule</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">Nom</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">Prénom</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">Fonction</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">Adresse</th>
            </tr>
          </thead>
          <tbody>
            {generated.rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2">{r.matricule}</td>
                <td className="px-3 py-2">{r.nom}</td>
                <td className="px-3 py-2">{r.prenom}</td>
                <td className="px-3 py-2">{r.fonction}</td>
                <td className="px-3 py-2">{r.adresse}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}