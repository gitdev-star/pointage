import React from "react";
import { Navigate } from "react-router-dom";
import { useHRAuth } from "../contexts/HRAuthContext";

const ProtectedRoute = ({ children, module }) => {
  const token = localStorage.getItem("access_token");
  if (!token) return <Navigate to="/login" replace />;

  const { hrProfile, hrLoading, canSee } = useHRAuth();

  if (module) {
    if (hrLoading) return null; // or a loading spinner
    if (!canSee(module)) return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;