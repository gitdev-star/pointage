import React, {useState, useMemo} from "react";
import { AlertTriangle, Download, Loader, Search } from "lucide-react";
import useRetard from "../hook/useRetard";
import useTodayAttendance from "../hook/useTodayAttendance";
import RetardFilters  from "../components/RetardFiltre";
import RetardStatsBar from "../components/RetardStatusBar";
import RetardTable    from "../components/RetardTable";
import TodayLateList  from "../components/TodayLateList";

export default function RetardPage() {
  const {
    filters, setYear, setMonth, setMinLate, setClassification,
    classifications,
    data, sortedEmployees, getEmployeeName,
    exporting, error,
    search, setSearch,
    sortBy, sortDir, toggleSort,
    fetchReport, exportReport, employeeMap
  } = useRetard();

  // Pointages du jour uniquement — pas de stats/kpi/employeeMap dupliqué
  // const { allLateRecords, kpi, loading, page, setPage } = useTodayAttendance();
  const { allLateRecords, kpi, loading } = useTodayAttendance();
  const [selectedFactory, setSelectedFactory] = useState("ALL");
  // const PAGE_SIZE = 10;

const factories = useMemo(() => {
  const set = new Set();
  allLateRecords.forEach((r) => {
    const emp = employeeMap[r.user_id];
    const name = emp ? (emp.factoryName || "Sans usine") : "Employé inconnu";
    set.add(name);
  });
  return ["ALL", ...Array.from(set).sort()];
}, [allLateRecords, employeeMap]);


  // lateRecords filtrés
const filteredLateRecords = useMemo(() => {
  if (selectedFactory === "ALL") return allLateRecords;
  return allLateRecords.filter((r) => {
    const emp = employeeMap[r.user_id];
    const name = emp ? (emp.factoryName || "Sans usine") : "Employé inconnu";
    return name === selectedFactory;
  });
}, [allLateRecords, selectedFactory, employeeMap]);

// const totalPages = Math.max(1, Math.ceil(filteredLateRecords.length / PAGE_SIZE));

// const paginatedRecords = useMemo(() => {
//   const start = (page - 1) * PAGE_SIZE;
//   return filteredLateRecords.slice(start, start + PAGE_SIZE);
// }, [filteredLateRecords, page]);

const handleFactoryChange = (factory) => {
  setSelectedFactory(factory);
  // setPage(1); // reset page quand on change de filtre
};
console.log("allLateRecords sample:", allLateRecords.slice(0, 5));
console.log("employeeMap sample PBI1:", 
  Object.entries(employeeMap)
    .filter(([, v]) => v.factoryName === "PBI1")
    .slice(0, 3)
);

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rapport de retards</h1>
            <p className="text-sm text-gray-500">
              Employés en retard ≥ N fois sur un mois donné
            </p>
          </div>
        </div>

        {data && (
          <button
            onClick={exportReport}
            disabled={exporting}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
          >
            {exporting
              ? <><Loader size={14} className="animate-spin" /> Export…</>
              : <><Download size={14} /> Exporter CSV</>
            }
          </button>
        )}
      </div>


      {/* ── Filtres ── */}
      <RetardFilters
        filters={filters}
        setYear={setYear}
        setMonth={setMonth}
        setMinLate={setMinLate}
        setClassification={setClassification}
        classifications={classifications}
        loading={loading}
        onSearch={fetchReport}
      />

      {/* ── Erreur ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* ── Stats ── */}
      <RetardStatsBar data={data} classification={filters.classification} />

      {/* ── Recherche ── */}
      {data && data.employees.length > 0 && (
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {sortedEmployees.length !== data.employees.length && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {sortedEmployees.length} / {data.employees.length}
            </span>
          )}
        </div>
      )}

             {/* ── Table rapport mensuel ── */}
      {data && (
        <RetardTable
          sortedEmployees={sortedEmployees}
          getEmployeeName={getEmployeeName}
          sortBy={sortBy}
          sortDir={sortDir}
          toggleSort={toggleSort}
          minLate={filters.minLate}
          search={search}
        />
      )}
      {/* ── État vide ── */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center gap-4 py-20 text-center text-gray-400">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-400">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-1">
            <p className="text-base font-medium text-gray-600">
              Choisissez un mois, une année et un seuil, puis cliquez sur{" "}
              <strong>Analyser</strong>.
            </p>
            <p className="text-sm">
              Le rapport identifie tous les employés dont le nombre de retards
              dépasse le seuil sur la période sélectionnée.
            </p>
            <p className="text-sm">
              Par défaut, les <strong>HC (managers)</strong> sont exclus. Utilisez
              le filtre <em>Classification</em> pour les inclure.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Filtrer par usine :</label>
        <select
          value={selectedFactory}
          onChange={(e) => handleFactoryChange(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {factories.map((f) => (
            <option key={f} value={f}>
              {f === "ALL" ? "Toutes les usines" : f}
            </option>
          ))}
        </select>
        {selectedFactory !== "ALL" && (
          <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded-full">
            {filteredLateRecords.length} retard(s)
          </span>
        )}
      </div>
            {/* ── Retards du jour ── */}
        {/* <TodayLateList
          lateRecords={paginatedRecords}
          kpi={kpi}
          getEmployeeName={getEmployeeName}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          countOverride={selectedFactory === "ALL" ? null : filteredLateRecords.length}
        /> */}

        <TodayLateList
          lateRecords={filteredLateRecords}
          kpi={kpi}
          getEmployeeName={getEmployeeName}
          countOverride={
            selectedFactory === "ALL"
              ? null
              : filteredLateRecords.length
          }
        />
    </div>
  );
}
