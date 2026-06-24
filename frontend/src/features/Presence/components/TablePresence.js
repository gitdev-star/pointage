import React, { useState, useEffect } from "react";
import Pagination from "../../../components/common/Pagination";
import { Eye } from "lucide-react";
import { formatDateTime } from "../utils/FormatDate";

export default function AttendanceTable({ data, getEmployeeName, handleDetail }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => { setPage(1); }, [data]);

  const start = (page - 1) * pageSize;
  const paginated = data.slice(start, start + pageSize);
  // console.log("employer", paginated)

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">

      <div className="overflow-x-auto">
        <table className="w-full">

          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4">Employé</th>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Arrivée</th>
              <th className="text-left p-4">Départ</th>
              <th className="text-left p-4">Pointages</th>
              <th className="text-left p-4">Action</th>
            </tr>
          </thead>

          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  Aucune donnée
                </td>
              </tr>
            ) : (
              paginated.map((record, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  {/* <td className="p-4 font-medium">
                    {getEmployeeName(record.user_id)}
                  </td> */}
                  <td className="p-4 font-medium">
                    {console.log("ID:", record.user_id, "Nom:", getEmployeeName(record.user_id))}
                    {getEmployeeName(record.user_id) || `Utilisateur #${record.user_id}`}
                  </td>
                  <td className="p-4">{record.attendance_date}</td>
                  <td className="p-4 text-green-600 font-semibold">
                    {formatDateTime(record.arrival) || "—"}
                  </td>
                  <td className="p-4 text-red-500 font-semibold">
                    {formatDateTime(record.departure )|| "—"}
                  </td>
                  <td className="p-4">{record.punch_count}</td>
                  <td className="p-4" onClick={()=>{handleDetail(record)}}><Eye/></td>
                </tr>
              ))
            )}
          </tbody>

        </table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={data.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

    </div>
  );
}