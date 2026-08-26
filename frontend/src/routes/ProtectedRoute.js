import React from "react";
import { Navigate } from "react-router-dom";
import { useHRAuth } from "../contexts/HRAuthContext";

const ProtectedRoute = ({ children, module }) => {
  const { hrLoading, canSee } = useHRAuth();
  const token = localStorage.getItem("access_token");

  if (!token) return <Navigate to="/login" replace />;

  if (module) {
    if (hrLoading) return null;
    if (!canSee(module)) return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;