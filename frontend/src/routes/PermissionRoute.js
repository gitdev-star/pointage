import React from "react";
import {
  Navigate,
} from "react-router-dom";

import {
  useHRAuth,
} from "../contexts/HRAuthContext";


export default function PermissionRoute({
  permission,
  children,
}) {
  const {
    can,
    hrLoading,
  } = useHRAuth();

  if (hrLoading) {
    return null;
  }

  if (!can(permission)) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}