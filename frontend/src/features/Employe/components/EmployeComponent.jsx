import React from "react";
import { Chip } from "@mui/material";
import { EMPLOYEE_STATUSES, CONTRACT_TYPES } from "../constants/Employe.constant";

export function StatusBadge({ value }) {
  const s = EMPLOYEE_STATUSES[value];
  if (!s) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.tw.bg} ${s.tw.text}`}>
      {s.label}
    </span>
  );
}

export function StatusChip({ value, ...props }) {
  const s = EMPLOYEE_STATUSES[value];
  if (!s) return null;
  return <Chip label={s.label} color={s.chipColor} {...props} />;
}


export function ContractBadge({ value }) {
  const s = CONTRACT_TYPES[value];
  if (!s) return <span className="text-gray-400 text-xs">{value || "—"}</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.tw.bg} ${s.tw.text}`}>
      {s.label}
    </span>
  );
}


export function InfoRow({ label, value }) {
  return (
    <div className="flex items-start py-2 border-b border-gray-100 last:border-0">
      <span className="w-44 shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || "—"}</span>
    </div>
  );
}


export function SectionDivider({ label }) {
  return (
    <div className="col-span-full flex items-center gap-3 mt-3 mb-1">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

export function TabSpinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function EmptyTableRow({ colSpan, message = "Aucun résultat" }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-sm text-gray-400">
        {message}
      </td>
    </tr>
  );
}


export function OutlineButton({ icon, onClick, disabled, children, color = "default", size = "sm" }) {
  const colorClasses = {
    default: "border-gray-300 text-gray-700 hover:bg-gray-50",
    success: "border-green-500 text-green-700 hover:bg-green-50",
    error:   "border-red-400   text-red-700   hover:bg-red-50",
    primary: "border-blue-500  text-blue-700  hover:bg-blue-50",
  };
  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-1.5 text-sm",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center gap-1.5 rounded border font-medium transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${colorClasses[color] ?? colorClasses.default}
        ${sizeClasses[size]  ?? sizeClasses.sm}
      `}
    >
      {icon && <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      {children}
    </button>
  );
}
