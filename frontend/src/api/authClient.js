import axios from "axios";

const AUTH_BASE_URL = process.env.REACT_APP_AUTH_URL
  ? `${process.env.REACT_APP_AUTH_URL}/`
    : `${window.location.origin}/api/auth/`;

const authClient = axios.create({
  baseURL: AUTH_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

authClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

export default authClient;
