import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavItem({ to, label }) {
  const { pathname } = useLocation();
  const isActive = pathname === to;

  return (
    <li>
      <Link
        to={to}
        className={`flex items-center px-5 py-2.5 text-sm border-l-[3px] transition-colors no-underline
          ${isActive
            ? "bg-[#1976d2]/20 text-[#90caf9] border-[#1976d2] font-semibold"
            : "text-white/75 border-transparent hover:bg-white/[0.07] hover:text-white"
          }`}
      >
        {label}
      </Link>
    </li>
  );
}
