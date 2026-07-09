import React, { useState } from "react";
import { Bus } from "lucide-react";
import EmployeeSearchBox from "../component/employeeSearchBox";
import SelectedEmployeesList from "../component/selectedEmployeesList";
import HeureFinSelector from "../component/heureFinSelector";
import GeneratedTransportTable from "../component/generatedTable";
import TransportHistory from "../component/transportHistorique";
import { transportService } from "../api/transportService";

export default function TransportPage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const [selected, setSelected] = useState([]);
  const [heureFin, setHeureFin] = useState("19h00");
  const [heureCustom, setHeureCustom] = useState("");
  const [generated, setGenerated] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const addEmployee = (emp) => {
    setSelected(prev => prev.some(e => e.id === emp.id) ? prev : [...prev, emp]);
  };
  const removeEmployee = (id) => {
    setSelected(prev => prev.filter(e => e.id !== id));
  };

  const heureEffective = heureFin === "autre" ? (heureCustom || "—") : heureFin;

  const handleGenerate = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const saved = await transportService.createTransportList(
        todayStr,
        heureEffective,
        selected.map(e => e.id)
      );
      setGenerated({
        heure: saved.heure_fin,
        rows: saved.items.map(i => ({
          matricule: i.matricule, nom: i.nom, prenom: i.prenom,
          fonction: i.fonction, adresse: i.adresse,
        })),
      });
      setSelected([]);
      setRefreshKey(k => k + 1); // force l'historique à se rafraîchir
    } catch (err) {
      setError("Erreur lors de l'enregistrement de la liste transport.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="bg-white rounded-2xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bus className="text-blue-600" size={20} />
          <h2 className="text-lg font-semibold text-gray-800">Transport employés</h2>
        </div>

        <EmployeeSearchBox onSelect={addEmployee} />
        <SelectedEmployeesList selected={selected} onRemove={removeEmployee} />
        <HeureFinSelector
          heureFin={heureFin} setHeureFin={setHeureFin}
          heureCustom={heureCustom} setHeureCustom={setHeureCustom}
        />

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={selected.length === 0 || saving}
          className="w-full bg-blue-600 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Enregistrement…" : `Générer la liste (${selected.length})`}
        </button>

        {/* <GeneratedTransportTable generated={generated} /> */}
      </div>

      <TransportHistory refreshKey={refreshKey} />
    </div>
  );
}