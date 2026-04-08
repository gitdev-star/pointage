import React, { createContext, useContext, useState, useEffect } from "react";
import hrClient from "../api/hrClient";

const HRAuthContext = createContext(null);

export function HRAuthProvider({ children }) {
  const [hrProfile, setHrProfile] = useState(null);
  const [hrLoading, setHrLoading] = useState(true);

  const loadProfile = () => {
    const token = localStorage.getItem("access_token");
    if (!token) { setHrLoading(false); return; }
    hrClient.get("accounts/me/")
      .then(r => setHrProfile(r.data))
      .catch(() => setHrProfile(null))
      .finally(() => setHrLoading(false));
  };

  useEffect(() => { loadProfile(); }, []);

  // Check a specific permission e.g. can("employees_read")
  const can = (perm_key) => {
    if (!hrProfile) return false;
    if (hrProfile.is_director) return true;
    return hrProfile.all_permissions?.[perm_key] === true;
  };

  // Check if user can see a module
  const canSee = (module) => {
    if (!hrProfile) return false;
    if (hrProfile.is_director) return true;
    return hrProfile.visible_modules?.includes(module);
  };

  const reload = () => loadProfile();

  return (
    <HRAuthContext.Provider value={{ hrProfile, hrLoading, can, canSee, reload }}>
      {children}
    </HRAuthContext.Provider>
  );
}

export function useHRAuth() {
  return useContext(HRAuthContext);
}
