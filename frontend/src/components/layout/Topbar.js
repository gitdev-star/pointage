import React from "react";
import NotificationBell from "../hr/NotificationBell";
import { Menu } from "lucide-react";

export default function Topbar({ onMenuClick }) {
  return (
      <div className="flex items-center px-5 py-2 border-b border-white/10 bg-[#1565c0] min-h-[48px] shrink-0 z-10">
        
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>

        <div className="flex-1" />

        <NotificationBell />
      </div>
  );
}
