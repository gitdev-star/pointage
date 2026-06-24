// =====================================================
// PATH: src/components/layout/DashboardLayout.jsx
// =====================================================
import React, {useState}  from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fa]">

      {/* Sidebar fixe à gauche */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      {/* Zone principale */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar — ne scrolle jamais */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Contenu — seule zone qui scrolle */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>

      </main>
    </div>
  );
}
