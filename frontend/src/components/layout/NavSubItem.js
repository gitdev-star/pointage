import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavSubItem({ to, label }) {
  const { pathname } = useLocation();
  const isActive = pathname.startsWith(to);

  return (
    <li>
      <Link
        to={to}
        className={`flex items-center pl-8 pr-5 py-[7px] text-[0.85rem] border-l-[3px] transition-colors no-underline relative
          before:content-['·'] before:absolute before:left-5 before:text-white/30
          ${isActive
            ? "bg-[#1976d2]/20 text-[#90caf9] border-[#1976d2] font-semibold"
            : "text-white/60 border-transparent hover:bg-white/[0.07] hover:text-white"
          }`}
      >
        {label}
      </Link>
    </li>
  );
}
