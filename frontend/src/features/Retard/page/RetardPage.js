// // =====================================================
// // PATH: src/features/Retard/page/RetardPage.jsx
// // =====================================================
// import React from "react";
// import { AlertTriangle, Download, Loader, Search } from "lucide-react";
// import useRetard from "../hook/useRetard";
// import RetardFilters from "../components/RetardFiltre";
// import RetardStatsBar from "../components/RetardStatusBar";
// import RetardTable from "../components/RetardTable";

// export default function RetardPage() {
//   const {
//     filters, setYear, setMonth, setMinLate, setClassification,
//     classifications,
//     data, sortedEmployees, getEmployeeName,
//     loading, exporting, error,
//     search, setSearch,
//     sortBy, sortDir, toggleSort,
//     fetchReport, exportReport,
//   } = useRetard();

//   return (
//     <div className="min-h-screen bg-gray-50 p-6 space-y-6">

//       {/* ── Header ── */}
//       <div className="flex items-center justify-between">
//         <div className="flex items-center gap-3">
//           <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
//             <AlertTriangle size={20} />
//           </div>
//           <div>
//             <h1 className="text-2xl font-bold text-gray-900">Rapport de retards</h1>
//             <p className="text-sm text-gray-500">
//               Employés en retard ≥ N fois sur un mois donné
//             </p>
//           </div>
//         </div>

//         {data && (
//           <button
//             onClick={exportReport}
//             disabled={exporting}
//             className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
//           >
//             {exporting
//               ? <><Loader size={14} className="animate-spin" /> Export…</>
//               : <><Download size={14} /> Exporter CSV</>
//             }
//           </button>
//         )}
//       </div>

//       {/* ── Filtres ── */}
//       <RetardFilters
//         filters={filters}
//         setYear={setYear}
//         setMonth={setMonth}
//         setMinLate={setMinLate}
//         setClassification={setClassification}
//         classifications={classifications}
//         loading={loading}
//         onSearch={fetchReport}
//       />

//       {/* ── Erreur ── */}
//       {error && (
//         <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
//           <AlertTriangle size={15} />
//           {error}
//         </div>
//       )}

//       {/* ── Stats ── */}
//       <RetardStatsBar data={data} classification={filters.classification} />

//       {/* ── Recherche dans les résultats ── */}
//       {data && data.employees.length > 0 && (
//         <div className="relative">
//           <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
//           <input
//             type="text"
//             placeholder="Rechercher par nom ou ID…"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
//           />
//           {sortedEmployees.length !== data.employees.length && (
//             <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
//               {sortedEmployees.length} / {data.employees.length}
//             </span>
//           )}
//         </div>
//       )}

//       {/* ── Table ── */}
//       {data && (
//         <RetardTable
//           sortedEmployees={sortedEmployees}
//           getEmployeeName={getEmployeeName}
//           sortBy={sortBy}
//           sortDir={sortDir}
//           toggleSort={toggleSort}
//           minLate={filters.minLate}
//           search={search}
//         />
//       )}

//       {/* ── État vide avant recherche ── */}
//       {!data && !loading && !error && (
//         <div className="flex flex-col items-center gap-4 py-20 text-center text-gray-400">
//           <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-400">
//             <AlertTriangle size={32} />
//           </div>
//           <div className="space-y-1">
//             <p className="text-base font-medium text-gray-600">
//               Choisissez un mois, une année et un seuil, puis cliquez sur{" "}
//               <strong>Analyser</strong>.
//             </p>
//             <p className="text-sm">
//               Le rapport identifie tous les employés dont le nombre de retards
//               dépasse le seuil sur la période sélectionnée.
//             </p>
//             <p className="text-sm">
//               Par défaut, les <strong>HC (managers)</strong> sont exclus. Utilisez
//               le filtre <em>Classification</em> pour les inclure.
//             </p>
//           </div>
//         </div>
//       )}

//     </div>
//   );
// }






// =====================================================
// PATH: src/features/Retard/page/RetardPage.jsx
// =====================================================
// =====================================================
// PATH: src/features/Retard/page/RetardPage.jsx
// =====================================================
import React from "react";
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
    loading, exporting, error,
    search, setSearch,
    sortBy, sortDir, toggleSort,
    fetchReport, exportReport,
  } = useRetard();

  // Pointages du jour uniquement — pas de stats/kpi/employeeMap dupliqué
  const { todayRecords } = useTodayAttendance();

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
            {/* ── Retards du jour ── */}
      <TodayLateList
        todayRecords={todayRecords}
        getEmployeeName={getEmployeeName}
      />
    </div>
  );
}
