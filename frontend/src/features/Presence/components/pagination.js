import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZES = [10, 25, 50, 100];

export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;

  const goTo = (p) => onPageChange(Math.max(1, Math.min(p, totalPages)));

  const delta = 2;
  const pages = [];
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-sm text-gray-600">

      {/* Infos + taille de page */}
      <div className="flex items-center gap-3">
        <span>
          {total === 0 ? "0" : `${start + 1}–${Math.min(start + pageSize, total)}`}
          {" "}sur{" "}{total}
        </span>
        <select
          value={pageSize}
          onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          className="border rounded-lg px-2 py-1 text-sm bg-white"
        >
          {PAGE_SIZES.map(s => (
            <option key={s} value={s}>{s} / page</option>
          ))}
        </select>
      </div>

      {/* Boutons */}
      <div className="flex items-center gap-1">
        <button onClick={() => goTo(1)} disabled={page === 1}
          className="px-2 py-1 rounded-lg hover:bg-gray-200 disabled:opacity-30">«</button>

        <button onClick={() => goTo(page - 1)} disabled={page === 1}
          className="px-2 py-1 rounded-lg hover:bg-gray-200 disabled:opacity-30">
          <ChevronLeft size={16} />
        </button>

        {pages[0] > 1 && <span className="px-2">…</span>}

        {pages.map(p => (
          <button key={p} onClick={() => goTo(p)}
            className={`px-3 py-1 rounded-lg font-medium ${
              p === page ? "bg-blue-600 text-white" : "hover:bg-gray-200"
            }`}>
            {p}
          </button>
        ))}

        {pages[pages.length - 1] < totalPages && <span className="px-2">…</span>}

        <button onClick={() => goTo(page + 1)} disabled={page === totalPages || totalPages === 0}
          className="px-2 py-1 rounded-lg hover:bg-gray-200 disabled:opacity-30">
          <ChevronRight size={16} />
        </button>

        <button onClick={() => goTo(totalPages)} disabled={page === totalPages || totalPages === 0}
          className="px-2 py-1 rounded-lg hover:bg-gray-200 disabled:opacity-30">»</button>
      </div>

    </div>
  );
}