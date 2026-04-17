import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { logout } from "../api/auth";
import { useNavigate } from "react-router-dom";
import { useHRAuth } from "../contexts/HRAuthContext";
import "./DashboardLayout.css";
import NotificationBell from "./hr/NotificationBell";

const DashboardLayout = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { hrProfile, canSee } = useHRAuth();

  const [analysesOpen, setAnalysesOpen] = useState(
    location.pathname.startsWith("/attendance/analysis") ||
    location.pathname.startsWith("/attendance/late-report")
  );

  const handleLogout = () => { logout(); navigate("/login"); };

  const hrMenuItems = [
    { to: "/hr/employees",           label: "Employés",              module: "employees" },
    { to: "/hr/leaves",              label: "Événements",            module: "leaves" },
    { to: "/hr/payroll",             label: "Fiches de paie",        module: "payroll" },
    { to: "/hr/reports",             label: "Rapports",              module: "reports" },
    { to: "/hr/shifts",              label: "Shifts & Événements",   module: "shifts" },
    { to: "/hr/events",              label: "Événements RH",         module: "sanctions" },
    { to: "/hr/sanctions",           label: "Sanctions",             module: "sanctions" },
    { to: "/hr/cdd-alerts",          label: "Alertes CDD",           module: "alerts" },
    { to: "/hr/work-schedules",      label: "Horaires de travail",   module: "employees" },
    { to: "/hr/schedule-assignment", label: "Assignation horaires",  module: "employees" },
  ].filter(item => canSee(item.module));

  const hrAdminItems = [
    { to: "/hr/organisation",  label: "Organisation",     module: "organisation" },
    { to: "/hr/notifications", label: "Notifications RH", module: "alerts" },
    { to: "/hr/users",         label: "Utilisateurs RH",  module: "hr_users" },
    { to: "/hr/permissions",   label: "Permissions",      module: "hr_users" },
  ].filter(item => canSee(item.module));

  const analysesItems = [
    { to: "/attendance/analysis",    label: "Présences" },
    { to: "/attendance/late-report", label: "Retards" },
  ];

  const isAnalysesActive = analysesItems.some(i => location.pathname.startsWith(i.to));

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <h2>HR System</h2>

        {hrProfile && (
          <div className="role-badge" style={{
            borderColor: hrProfile.is_director ? "#f44336" : "#1976d2"
          }}>
            <span className="role-dot" style={{
              backgroundColor: hrProfile.is_director ? "#f44336" : "#1976d2"
            }} />
            <span>{hrProfile.username}</span>
            <small>{hrProfile.is_director ? "Directeur RH" : hrProfile.job_title || "RH"}</small>
          </div>
        )}

        <nav>
          <div className="nav-section">
            <div className="nav-section-title">Pointage</div>
            <ul>
              {[
                { to: "/dashboard",  label: "Dashboard" },
                { to: "/attendance", label: "Présences" },
                { to: "/devices",    label: "Appareils" },
              ].map(item => (
                <li key={item.to}>
                  <Link to={item.to} className={location.pathname === item.to ? "active" : ""}>
                    {item.label}
                  </Link>
                </li>
              ))}

              {/* Analyses collapsible group */}
              <li>
                <button
                  className={`nav-group-btn ${isAnalysesActive ? "active" : ""}`}
                  onClick={() => setAnalysesOpen(v => !v)}
                >
                  <span>Analyses</span>
                  <span className="nav-group-arrow">{analysesOpen ? "▾" : "▸"}</span>
                </button>
                {analysesOpen && (
                  <ul className="nav-sub-list">
                    {analysesItems.map(item => (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          className={`nav-sub-link ${location.pathname.startsWith(item.to) ? "active" : ""}`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            </ul>
          </div>

          {hrMenuItems.length > 0 && (
            <div className="nav-section">
              <div className="nav-section-title">RH</div>
              <ul>
                {hrMenuItems.map(item => (
                  <li key={item.to}>
                    <Link to={item.to} className={location.pathname.startsWith("/hr/employees") && item.to === "/hr/employees"
                      ? "active"
                      : location.pathname === item.to ? "active" : ""}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hrAdminItems.length > 0 && (
            <div className="nav-section">
              <div className="nav-section-title">Administration RH</div>
              <ul>
                {hrAdminItems.map(item => (
                  <li key={item.to}>
                    <Link to={item.to} className={location.pathname === item.to ? "active" : ""}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="nav-section">
            <div className="nav-section-title">Compte</div>
            <ul>
              <li>
                <Link to="/profile" className={location.pathname === "/profile" ? "active" : ""}>
                  Profil
                </Link>
              </li>
            </ul>
          </div>

          <div className="nav-section">
            <ul>
              <li><button onClick={handleLogout} className="logout-btn">Déconnexion</button></li>
            </ul>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <NotificationBell />
        </div>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
