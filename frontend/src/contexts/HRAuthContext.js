// =====================================================
// PATH: pointage/frontend/src/contexts/HRAuthContext.js
// =====================================================
import React, { createContext, useContext, useState, useEffect } from "react";
import hrClient from "../api/hrClient";

const HRAuthContext = createContext(null);

export function HRAuthProvider({ children }) {
  const [hrProfile, setHrProfile] = useState(null);
  const [hrLoading, setHrLoading] = useState(true);

  const loadProfile = () => {
    const token = localStorage.getItem("access_token");
    if (!token) { setHrLoading(false); return; }
    setHrLoading(true);
    hrClient.get("accounts/me/")
      .then(r => setHrProfile(r.data))
      .catch(() => setHrProfile(null))
      .finally(() => setHrLoading(false));
  };

  const resetProfile = () => {
    setHrProfile(null);
    loadProfile();
  };

  // Load profile on mount
  useEffect(() => { loadProfile(); }, []);

  // Listen for login/logout events fired by auth.js
  useEffect(() => {
    const onLogin  = () => resetProfile();
    const onLogout = () => setHrProfile(null);
    window.addEventListener("auth:login",  onLogin);
    window.addEventListener("auth:logout", onLogout);
    return () => {
      window.removeEventListener("auth:login",  onLogin);
      window.removeEventListener("auth:logout", onLogout);
    };
  }, []);

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
    <HRAuthContext.Provider value={{ hrProfile, hrLoading, can, canSee, reload, resetProfile }}>
      {children}
    </HRAuthContext.Provider>
  );
}

export function useHRAuth() {
  return useContext(HRAuthContext);
}
