// =====================================================
// PATH: src/components/layout/NavGroupItem.jsx
// =====================================================
import React from "react";

export default function NavGroupItem({ label, open, active, onToggle, children }) {
  return (
    <li>
      <button
        onClick={onToggle}
        className={`flex items-center justify-between w-full px-5 py-2.5 bg-transparent border-none border-l-[3px] border-transparent text-sm font-medium cursor-pointer transition-colors text-left
          ${active
            ? "text-[#90caf9] font-semibold"
            : "text-white/75 hover:bg-white/[0.07] hover:text-white"
          }`}
      >
        <span>{label}</span>
        <span className="text-[0.7rem] opacity-60">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <ul className="list-none p-0 m-0">
          {children}
        </ul>
      )}
    </li>
  );
}
