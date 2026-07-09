import React from "react";
import { X } from "lucide-react";

export default function SelectedEmployeesList({ selected, onRemove }) {
  if (selected.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-500 mb-2">
        {selected.length} employé(s) sélectionné(s)
      </p>
      <div className="flex flex-wrap gap-2">
        {selected.map(emp => (
          <span
            key={emp.id}
            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full"
          >
            {emp.first_name} {emp.last_name} ({emp.employee_id})
            <button onClick={() => onRemove(emp.id)}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}