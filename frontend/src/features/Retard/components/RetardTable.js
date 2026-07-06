import React, { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import EmployeeRow from "./EmployeRow";
import Pagination from "../../../components/common/Pagination";

const SortTh = ({ label, col, sortBy, sortDir, onToggle, center }) => (
  <th
    className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-800 transition-colors ${center ? "text-center" : "text-left"}`}
    onClick={() => onToggle(col)}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {sortBy === col
        ? <span className="text-blue-500">{sortDir === "desc" ? "↓" : "↑"}</span>
        : <span className="text-gray-300">↕</span>
      }
    </span>
  </th>
);

export default function RetardTable({
  sortedEmployees,
  getEmployeeName,
  sortBy, sortDir, toggleSort,
  minLate, search,
}) {
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset page quand les données changent
  useEffect(() => { setPage(1); }, [sortedEmployees]);

  const start     = (page - 1) * pageSize;
  const paginated = sortedEmployees.slice(start, start + pageSize);

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {sortedEmployees.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
          <TrendingUp size={36} />
          <p className="text-sm">
            {search
              ? "Aucun résultat pour cette recherche."
              : `Aucun employé en retard ≥ ${minLate} fois ce mois-ci. `
            }
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <SortTh label="Employé"  col="user_id"       sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
                  <SortTh label="Retards"  col="late_count"    sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} center />
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Présences</th>
                  <SortTh label="Taux"     col="late_rate_pct" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((emp, i) => (
                  <EmployeeRow
                    key={emp.user_id}
                    emp={emp}
                    rank={start + i + 1}
                    employeeName={getEmployeeName(emp.user_id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={sortedEmployees.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}
