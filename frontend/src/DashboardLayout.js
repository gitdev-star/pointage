import React from "react";
import { Link, Outlet } from "react-router-dom";
import { logout } from "../api/auth";
import { useNavigate } from "react-router-dom";

// Import the CSS file
import './DashboardLayout.css';  // Adjust the path

const DashboardLayout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <h2>HR System</h2>
        <nav>
          <ul>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li><Link to="/attendance">Attendance</Link></li>
            <li><Link to="/attendance/analysis">Analysis</Link></li> 
            <li><Link to="/devices">Devices</Link></li>
            <li><Link to="/profile">Profile</Link></li>
            <li><button onClick={handleLogout}>Logout</button></li>
          </ul>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet /> {/* Nested route content */}
      </main>
    </div>
  );
};

export default DashboardLayout;
