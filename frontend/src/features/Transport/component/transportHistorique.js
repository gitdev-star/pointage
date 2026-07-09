import React, { useState, useEffect } from "react";
import { transportService } from "../api/transportService";
import GeneratedTransportTable from "../component/generatedTable"

export default function TransportHistory({ refreshKey }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(todayStr);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    transportService.getTransportLists(date)
      .then(data => setLists(data || []))
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
  }, [date, refreshKey]);

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Historique transport</h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded-lg px-2 py-1 text-sm"
          />
        </div>
      </div>

      {loading && <div className="text-sm text-gray-400">Chargement…</div>}
      {!loading && lists.length === 0 && (
        <div className="text-sm text-gray-400">Aucune liste transport pour cette date.</div>
      )}

      {!loading && lists.map(list => (
        <div key={list.id} className="mb-6 last:mb-0">
          <GeneratedTransportTable
            generated={{
              heure: list.heure_fin,
              rows: list.items.map(i => ({
                matricule: i.matricule,
                nom: i.nom,
                prenom: i.prenom,
                fonction: i.fonction,
                adresse: i.adresse,
              })),
            }}
          />
        </div>
      ))}
    </div>
  );
}
