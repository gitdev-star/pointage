import React, { useState, useEffect } from "react";
import { FileSpreadsheet, Pencil, Check, RotateCcw } from "lucide-react";
import * as XLSX from "xlsx";

const STORAGE_KEY = "transport_address_overrides";

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.error("Impossible d'enregistrer les adresses modifiées :", e);
  }
}

export default function GeneratedTransportTable({ generated }) {
  const [overrides, setOverrides] = useState({}); // { matricule: "nouvelle adresse" }
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState("");

  // Charger les adresses modifiées au montage
  useEffect(() => {
    setOverrides(loadOverrides());
  }, []);

  if (!generated) return null;

  const getAdresse = (r) => overrides[r.matricule] ?? r.adresse;

  const startEdit = (r) => {
    setEditingKey(r.matricule);
    setDraft(getAdresse(r));
  };

  const confirmEdit = (matricule) => {
    setOverrides((prev) => {
      const next = { ...prev, [matricule]: draft };
      saveOverrides(next);
      return next;
    });
    setEditingKey(null);
  };

  const resetEdit = (matricule) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[matricule];
      saveOverrides(next);
      return next;
    });
  };

  const exportExcel = () => {
    const wsData = generated.rows.map(r => ({
      "Matricule": r.matricule,
      "Nom": r.nom,
      "Prénom": r.prenom,
      "Fonction": r.fonction,
      "Adresse": getAdresse(r),
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
            {generated.rows.map((r, i) => {
              const isEditing = editingKey === r.matricule;
              const isModified = overrides[r.matricule] !== undefined;
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{r.matricule}</td>
                  <td className="px-3 py-2">{r.nom}</td>
                  <td className="px-3 py-2">{r.prenom}</td>
                  <td className="px-3 py-2">{r.fonction}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && confirmEdit(r.matricule)}
                          className="border rounded px-1.5 py-0.5 text-sm w-full"
                        />
                        <button onClick={() => confirmEdit(r.matricule)} className="text-green-600">
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <span className={isModified ? "text-orange-600 font-medium" : ""}>
                          {getAdresse(r)}
                        </span>
                        <button
                          onClick={() => startEdit(r)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600"
                          title="Modifier pour le transport"
                        >
                          <Pencil size={12} />
                        </button>
                        {isModified && (
                          <button
                            onClick={() => resetEdit(r.matricule)}
                            className="text-gray-400 hover:text-red-500"
                            title="Revenir à l'adresse d'origine"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}