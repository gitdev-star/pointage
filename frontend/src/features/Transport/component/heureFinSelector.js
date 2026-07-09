import React from "react";

const HEURE_OPTIONS = ["19h00", "21h00"];

export default function HeureFinSelector({ heureFin, setHeureFin, heureCustom, setHeureCustom }) {
  return (
    <div className="mb-4">
      <label className="text-xs font-semibold text-gray-500 mb-2 block">Heure de fin de travail</label>
      <div className="flex gap-2 flex-wrap">
        {HEURE_OPTIONS.map(h => (
          <button
            key={h}
            onClick={() => setHeureFin(h)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              heureFin === h ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {h}
          </button>
        ))}
        <button
          onClick={() => setHeureFin("autre")}
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            heureFin === "autre" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          Autre
        </button>
        {heureFin === "autre" && (
          <input
            type="time"
            value={heureCustom}
            onChange={(e) => setHeureCustom(e.target.value)}
            className="border rounded-lg px-2 py-1 text-sm"
          />
        )}
      </div>
    </div>
  );
}