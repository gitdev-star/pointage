// =====================================================
// PATH: pointage/frontend/src/api/auth.js
// =====================================================
import axios from "axios";

const AUTH_BASE_URL = process.env.REACT_APP_AUTH_URL;

// Login
export const login = async (username, password) => {
  try {
    const response = await axios.post(`${AUTH_BASE_URL}/login/`, { username, password });
    if (response.data.access) {
      localStorage.setItem("access_token",  response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);
      window.dispatchEvent(new Event("auth:login"));
      return true;
    }
    return false;
  } catch (error) {
    console.error("Login failed:", error.response ? error.response.data : error.message);
    return false;
  }
};

// Refresh token
export const refreshToken = async () => {
  try {
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) return false;
    const response = await axios.post(`${AUTH_BASE_URL}/token/refresh/`, { refresh });
    if (response.data.access) {
      localStorage.setItem("access_token", response.data.access);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Token refresh failed:", error.response ? error.response.data : error.message);
    logout();
    return false;
  }
};

// Logout
export const logout = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.dispatchEvent(new Event("auth:logout"));
};
