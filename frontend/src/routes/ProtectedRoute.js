import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useHRAuth } from "../contexts/HRAuthContext";

const ProtectedRoute = ({ children, module }) => {
  const { hrLoading, canSee } = useHRAuth();
  const token = localStorage.getItem("access_token");

  // if (!token) return <Navigate to="/login" replace />;

  const location = useLocation();

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  return children;
};

export default ProtectedRoute;