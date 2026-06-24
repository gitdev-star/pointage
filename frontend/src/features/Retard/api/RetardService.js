// // =====================================================
// // PATH: src/features/Retard/api/RetardService.js
// // =====================================================
// import axios from "axios";

// const FASTAPI_BASE_URL = process.env.REACT_APP_API_URL
//   ? `${process.env.REACT_APP_API_URL}/`
//   : "http://192.168.8.210";

// const retardClient = axios.create({
//   baseURL: FASTAPI_BASE_URL,
//   headers: { "Content-Type": "application/json" },
// });

// retardClient.interceptors.request.use(
//   (config) => {
//     const token = localStorage.getItem("access_token");
//     if (token) config.headers.Authorization = `Bearer ${token}`;
//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// retardClient.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     const original = error.config;
//     const status   = error.response?.status;
//     const detail   = error.response?.data?.detail;

//     const isExpired =
//       (status === 401 || (status === 403 && detail === "Token expiré.")) &&
//       !original._retry;

//     if (isExpired) {
//       original._retry = true;
//       try {
//         const refresh = localStorage.getItem("refresh_token");
//         if (!refresh) throw new Error("No refresh token");
//         const res = await axios.post(
//           `${process.env.REACT_APP_AUTH_URL || "http://192.168.8.210"}/token/refresh/`,
//           { refresh }
//         );
//         localStorage.setItem("access_token", res.data.access);
//         original.headers.Authorization = `Bearer ${res.data.access}`;
//         return retardClient(original);
//       } catch {
//         localStorage.clear();
//         window.location.href = "/login";
//       }
//     }
//     return Promise.reject(error);
//   }
// );

// const BASE = "attendance/";

// export const retardService = {

//   async getClassifications() {
//     try {
//       const res = await retardClient.get(`${BASE}classifications`);
//       return res.data?.classifications || [];
//     } catch {
//       return [];
//     }
//   },

//   async getLateReport({ year, month, minLate, classification }) {
//     let url = `${BASE}late-report?year=${year}&month=${month}&min_late=${minLate}`;
//     if (classification) url += `&classification=${encodeURIComponent(classification)}`;
//     const res = await retardClient.get(url);
//     return res.data;
//   },

//   async exportLateReport({ year, month, minLate, classification }) {
//     let url = `${FASTAPI_BASE_URL}${BASE}late-report/export?year=${year}&month=${month}&min_late=${minLate}`;
//     if (classification) url += `&classification=${encodeURIComponent(classification)}`;

//     const token = localStorage.getItem("access_token");
//     const res = await fetch(url, {
//       headers: token ? { Authorization: `Bearer ${token}` } : {},
//     });
//     if (!res.ok) throw new Error(`Erreur ${res.status}`);

//     const blob = await res.blob();
//     const a    = document.createElement("a");
//     a.href     = URL.createObjectURL(blob);
//     a.download = `retards_${year}_${String(month).padStart(2, "0")}_min${minLate}.csv`;
//     document.body.appendChild(a);
//     a.click();
//     a.remove();
//     setTimeout(() => URL.revokeObjectURL(a.href), 5000);
//   },
// };




// =====================================================
// PATH: src/features/Retard/api/RetardService.js
// =====================================================
import axios from "axios";

const FASTAPI_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/`
   : `${window.location.origin}/api/fastapi`;   

const retardClient = axios.create({
  baseURL: FASTAPI_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 60_000, // 60s — le rapport peut être lourd
});

retardClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

retardClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status   = error.response?.status;
    const detail   = error.response?.data?.detail;

    // ── Refresh token si 401/403 expiré ──────────────────────────────────────
    const isExpired =
      (status === 401 || (status === 403 && detail === "Token expiré.")) &&
      !original._retry;

    if (isExpired) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("refresh_token");
        if (!refresh) throw new Error("No refresh token");
        const res = await axios.post(
          `${process.env.REACT_APP_AUTH_URL || `${window.location.origin}/api/auth`}/token/refresh/`,
          { refresh }
        );
        localStorage.setItem("access_token", res.data.access);
        original.headers.Authorization = `Bearer ${res.data.access}`;
        return retardClient(original);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
      }
    }

    // ── Messages d'erreur lisibles ────────────────────────────────────────────
    if (error.code === "ECONNABORTED" || status === 504) {
      return Promise.reject(
        new Error("Le serveur met trop de temps à répondre (504). Réessayez dans quelques instants.")
      );
    }
    if (status === 502 || status === 503) {
      return Promise.reject(
        new Error("Le serveur est temporairement indisponible. Réessayez dans quelques instants.")
      );
    }
    if (!error.response) {
      return Promise.reject(
        new Error("Impossible de contacter le serveur. Vérifiez votre connexion.")
      );
    }

    return Promise.reject(error);
  }
);

const BASE = "attendance/";

export const retardService = {

  async getClassifications() {
    try {
      const res = await retardClient.get(`${BASE}classifications`);
      return res.data?.classifications || [];
    } catch {
      return [];
    }
  },

  async getLateReport({ year, month, minLate, classification }) {
    let url = `${BASE}late-report?year=${year}&month=${month}&min_late=${minLate}`;
    if (classification) url += `&classification=${encodeURIComponent(classification)}`;
    const res = await retardClient.get(url);
    return res.data;
  },

  async exportLateReport({ year, month, minLate, classification }) {
    let url = `${FASTAPI_BASE_URL}${BASE}late-report/export?year=${year}&month=${month}&min_late=${minLate}`;
    if (classification) url += `&classification=${encodeURIComponent(classification)}`;

    const token = localStorage.getItem("access_token");
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);

    const blob = await res.blob();
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `retards_${year}_${String(month).padStart(2, "0")}_min${minLate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
};
