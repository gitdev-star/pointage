import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logout } from "../../api/auth";
import { useHRAuth } from "../../contexts/HRAuthContext";
import NavSection from "./NavSection";
import NavItem from "./NavItem";
import RoleBadge from "./RoleBadge";
import {
  X,
  ChevronDown,
  ChevronRight,
  BriefcaseBusiness,
} from "lucide-react";

const POINTAGE_ITEMS = [
  { to: "/", label: "Tableau de bord" },
  { to: "/attendance", label: "Présences" },
  { to: "/attendance/late-report", label: "Retards" },
  { to: "/devices", label: "Appareils" },
];

const RECRUTEMENT_ITEMS = [
  {
    to: "/hr/recrutement",
    label: "Tableau de bord",
    permission: "recruitment_read",
  },
  {
    to: "/hr/recrutement/demande",
    label: "Demande de recrutement",
    permission: "recruitment_requests_read",
  },
  {
    to: "/hr/recrutement/processus",
    label: "Processus de recrutement",
    permission: "recruitment_read",
  },
  {
    to: "/hr/recrutement/comptes-rendus",
    label: "Comptes rendus",
    permission: "recruitment_read",
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    hrProfile,
    can,
    canSee,
  } = useHRAuth();

  const peutVoirRecrutement =
    can("recruitment_read")
    || can("recruitment_requests_read");

  /*
   * Le menu s'ouvre automatiquement lorsque l'utilisateur
   * se trouve sur une page de recrutement.
   */
  const isRecruitmentRoute = location.pathname.startsWith(
    "/hr/recrutement"
  );

  const [recrutementOpen, setRecrutementOpen] = useState(
    isRecruitmentRoute
  );

  const hrMenuItems = [
    {
      to: "/hr/employees",
      label: "Employés",
      module: "employees",
    },
    {
      to: "/hr/leaves",
      label: "Événements",
      module: "leaves",
    },
    {
      to: "/hr/document",
      label: "Document RH",
      module: "contracts",
    },
    {
      to: "/hr/transport",
      label: "Transport",
      module: "transport",
    },
    {
      to: "/hr/cantine",
      label: "Cantine",
      module: "cantine",
    },
    {
      to: "/hr/horaire",
      label: "Assignation horaire",
      module: "horaire",
    },
  ].filter((item) => canSee(item.module));

  const hrAdminItems = [
    {
      to: "/hr/organisation",
      label: "Organisation",
      module: "organisation",
    },
    {
      to: "/hr/audit-logs",
      label: "Journal d'audit",
      module: "audit_logs",
    },
    {
      to: "/hr/notifications",
      label: "Notifications RH",
      module: "alerts",
    },
    {
      to: "/hr/users",
      label: "Utilisateurs RH",
      module: "hr_users",
    },
    {
      to: "/hr/debauche",
      label: "Débauche en masse",
      module: "employees",
    },
  ].filter((item) => canSee(item.module));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleRecruitmentToggle = () => {
    setRecrutementOpen((previousValue) => !previousValue);
  };

  return (
    <>
      {/* Overlay pour mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-screen w-[260px] min-w-[260px] shrink-0
          flex-col overflow-y-auto bg-ink text-white
          transform transition-transform duration-300 ease-in-out
          lg:static
          ${
            isOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-steel/20 px-5 py-6">
          <h2 className="text-lg font-bold tracking-wide">
            Système RH
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-white hover:text-gray-300 lg:hidden"
            aria-label="Fermer le menu"
          >
            <X size={24} />
          </button>
        </div>

        {/* Rôle de l'utilisateur */}
        <RoleBadge hrProfile={hrProfile} />

        {/* Navigation */}
        <nav className="flex-1 pb-6">
          <NavSection title="Pointage">
            {POINTAGE_ITEMS.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                label={item.label}
                onClick={onClose}
              />
            ))}
          </NavSection>

          {hrMenuItems.length > 0 && (
            <NavSection title="RH">
              {hrMenuItems.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  onClick={onClose}
                />
              ))}
            </NavSection>
          )}

          {/* Recrutement et formations */}
{peutVoirRecrutement && (
  <NavSection title="Recrutement et formations">
    <button
      type="button"
      onClick={handleRecruitmentToggle}
      className={`
        flex w-full items-center justify-between
        px-5 py-2.5 text-left text-sm
        transition-colors
        ${
          isRecruitmentRoute
            ? "bg-white/15 text-white"
            : "text-gray-300 hover:bg-white/10 hover:text-white"
        }
      `}
    >
      <span className="flex items-center gap-3">
        <BriefcaseBusiness size={18} />
        Recrutement
      </span>

      {recrutementOpen ? (
        <ChevronDown size={17} />
      ) : (
        <ChevronRight size={17} />
      )}
    </button>

    {recrutementOpen && (
      <div className="ml-7 border-l border-white/20 bg-black/10">
        {RECRUTEMENT_ITEMS
          .filter((item) => can(item.permission))
          .map((item) => {
          const isActive =
            location.pathname === item.to;

          return (
            <button
              type="button"
              key={item.to}
              onClick={() => {
                navigate(item.to);
                onClose?.();
              }}
              className={`
                relative block w-full
                py-2.5 pl-6 pr-3
                text-left text-sm
                transition-colors
                ${
                  isActive
                    ? "bg-white/15 font-medium text-white"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              {isActive && (
                <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r bg-blue-400" />
              )}

              {item.label}
            </button>
          );
        })}
      </div>
    )}
  </NavSection>
)}

          {hrAdminItems.length > 0 && (
            <NavSection title="Administration RH">
              {hrAdminItems.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  onClick={onClose}
                />
              ))}
            </NavSection>
          )}

          <NavSection title="Compte">
            <NavItem
              to="/profile"
              label="Profil"
              onClick={onClose}
            />
          </NavSection>
        </nav>

        {/* Déconnexion */}
        <div className="mt-auto border-t border-steel/20 p-5">
          <button
            type="button"
            onClick={handleLogout}
            className="
              w-full rounded-md border border-steel/40
              bg-white/10 px-4 py-2.5
              text-left text-sm text-white
              transition-colors hover:bg-white/20
            "
          >
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}