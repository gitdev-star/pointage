// import React from "react";
// import { useNavigate } from "react-router-dom";
// import { logout } from "../../api/auth";
// import { useHRAuth } from "../../contexts/HRAuthContext";
// import NavSection from "./NavSection";
// import NavItem from "./NavItem";
// import RoleBadge from "./RoleBadge";
// import { X } from "lucide-react";
// import DocumentsRH from "../hr/DocumentsRH";

// const POINTAGE_ITEMS = [
//   { to: "/",  label: "Tableau de bord" },
//   { to: "/attendance", label: "Présences" },
//   { to: "/attendance/late-report", label: "Retards" },
//   { to: "/devices",    label: "Appareils" },
// ];

// export default function Sidebar({isOpen, onClose}) {
//   const navigate  = useNavigate();
//   const { hrProfile, canSee } = useHRAuth();

//   const hrMenuItems = [
//     { to: "/hr/employees",           label: "Employés",              module: "employees"    },
//     { to: "/hr/leaves",              label: "Événements",            module: "leaves"       },
//     { to: "/hr/payroll",             label: "Fiches de paie",        module: "payroll"      },
//     // { to: "/hr/reports",             label: "Rapports (a supprimer)",              module: "reports"      },
//     // { to: "/hr/cdd-alerts",          label: "Alertes CDD (a supprimer)",           module: "alerts"       },
//     // { to: "/hr/work-schedules",      label: "Horaires de travail (a supprimer)",   module: "employees"    },
//     // { to: "/hr/schedule-assignment", label: "Assignation horaires (a supprimer)",  module: "employees"    },
//     { to: "/hr/document", label: "Document RH",  module: <DocumentsRH/>    },

//   ].filter(item => canSee(item.module));

//   const hrAdminItems = [
//     { to: "/hr/organisation",  label: "Organisation",     module: "organisation" },
//     { to: "/hr/notifications", label: "Notifications RH", module: "alerts"       },
//     { to: "/hr/users",         label: "Utilisateurs RH",  module: "hr_users"     },
//     { to: "/hr/permissions",   label: "Permissions",      module: "hr_users"     },
//   ].filter(item => canSee(item.module));

//   const handleLogout = () => { logout(); navigate("/login"); };

//   return (
// <>

//     {/* Overlay pour mobile */}
//       {isOpen && (
//         <div
//           className="fixed inset-0 bg-black/50 z-40 lg:hidden"
//           onClick={onClose}
//         />
//       )}

//       <aside
//         className={`
//           fixed lg:static inset-y-0 left-0 z-50
//           w-[260px] min-w-[260px] h-screen 
//           bg-[#1a2236] text-white 
//           transform transition-transform duration-300 ease-in-out
//           ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
//           flex flex-col overflow-y-auto shrink-0
//         `}
//       >
//         {/* Header */}
//         <div className="flex items-center justify-between px-5 py-6 border-b border-white/10">
//           <h2 className="text-lg font-bold tracking-wide">Systeme RH</h2>
//           <button
//             onClick={onClose}
//             className="lg:hidden text-white hover:text-gray-300"
//           >
//             <X size={24} />
//           </button>
//         </div>

//         {/* Role Badge */}
//         <RoleBadge hrProfile={hrProfile} />

//         {/* Navigation */}
//         <nav className="flex-1 pb-6">
//           <NavSection title="Pointage">
//             {POINTAGE_ITEMS.map(item => (
//               <NavItem key={item.to} to={item.to} label={item.label} onClick={onClose} />
//             ))}
//           </NavSection>

//           {hrMenuItems.length > 0 && (
//             <NavSection title="RH">
//               {hrMenuItems.map(item => (
//                 <NavItem key={item.to} to={item.to} label={item.label} onClick={onClose} />
//               ))}
//             </NavSection>
//           )}

//           {hrAdminItems.length > 0 && (
//             <NavSection title="Administration RH">
//               {hrAdminItems.map(item => (
//                 <NavItem key={item.to} to={item.to} label={item.label} onClick={onClose} />
//               ))}
//             </NavSection>
//           )}

//           <NavSection title="Compte">
//             <NavItem to="/profile" label="Profil" onClick={onClose} />
//           </NavSection>
//         </nav>

//         {/* Logout */}
//         <div className="mt-auto p-5 border-t border-white/10">
//           <button
//             onClick={handleLogout}
//             className="w-full px-4 py-2.5 text-sm text-left bg-red-500/15 text-red-300 border border-red-500/30 rounded-md hover:bg-red-500/30 hover:text-white transition-colors"
//           >
//             Déconnexion
//           </button>
//         </div>
//       </aside>
//       </>
//   );
// }










import React from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../api/auth";
import { useHRAuth } from "../../contexts/HRAuthContext";
import NavSection from "./NavSection";
import NavItem from "./NavItem";
import RoleBadge from "./RoleBadge";
import { X } from "lucide-react";
import DocumentsRH from "../hr/DocumentsRH";
import TransportPage from "../../features/Transport/page/TransportPage";

const POINTAGE_ITEMS = [
  { to: "/",  label: "Tableau de bord" },
  { to: "/attendance", label: "Présences" },
  { to: "/attendance/late-report", label: "Retards" },
  { to: "/devices",    label: "Appareils" },
];

export default function Sidebar({isOpen, onClose}) {
  const navigate  = useNavigate();
  const { hrProfile, canSee } = useHRAuth();

  const hrMenuItems = [
    { to: "/hr/employees",           label: "Employés",              module: "employees"    },
    { to: "/hr/leaves",              label: "Événements",            module: "leaves"       },
    { to: "/hr/payroll",             label: "Fiches de paie",        module: "payroll"      },
    { to: "/hr/document", label: "Document RH",  module: <DocumentsRH/>    },
    { to: "/hr/transport", label: "Transport",  module: <TransportPage/>    },

  ].filter(item => canSee(item.module));

  const hrAdminItems = [
    { to: "/hr/organisation",  label: "Organisation",     module: "organisation" },
    { to: "/hr/notifications", label: "Notifications RH", module: "alerts"       },
    { to: "/hr/users",         label: "Utilisateurs RH",  module: "hr_users"     },
    { to: "/hr/permissions",   label: "Permissions",      module: "hr_users"     },
  ].filter(item => canSee(item.module));

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
<>

    {/* Overlay pour mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[260px] min-w-[260px] h-screen 
          bg-ink text-white 
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col overflow-y-auto shrink-0
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-6 border-b border-steel/20">
          <h2 className="text-lg font-bold tracking-wide">Systeme RH</h2>
          <button
            onClick={onClose}
            className="lg:hidden text-white hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Role Badge */}
        <RoleBadge hrProfile={hrProfile} />

        {/* Navigation */}
        <nav className="flex-1 pb-6">
          <NavSection title="Pointage">
            {POINTAGE_ITEMS.map(item => (
              <NavItem key={item.to} to={item.to} label={item.label} onClick={onClose} />
            ))}
          </NavSection>

          {hrMenuItems.length > 0 && (
            <NavSection title="RH">
              {hrMenuItems.map(item => (
                <NavItem key={item.to} to={item.to} label={item.label} onClick={onClose} />
              ))}
            </NavSection>
          )}

          {hrAdminItems.length > 0 && (
            <NavSection title="Administration RH">
              {hrAdminItems.map(item => (
                <NavItem key={item.to} to={item.to} label={item.label} onClick={onClose} />
              ))}
            </NavSection>
          )}

          <NavSection title="Compte">
            <NavItem to="/profile" label="Profil" onClick={onClose} />
          </NavSection>
        </nav>

        {/* Logout */}
        <div className="mt-auto p-5 border-t border-steel/20">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 text-sm text-left bg-white/10 text-white border border-steel/40 rounded-md hover:bg-white/20 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </aside>
      </>
  );
}
