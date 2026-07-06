import axios from "axios";

const FASTAPI_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/`
  : `${window.location.origin}/api/fastapi`;

const fastapiClient = axios.create({
  baseURL: FASTAPI_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attache le token à chaque requête
fastapiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Refresh automatique si 401
fastapiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status === 401 && !original._retry) {
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
        return fastapiClient(original);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ─── Service ───────────────────────────────────────────────────────────────

const ATTENDANCE = "attendance/";

export const attendanceService = {
  async getGrouped(params, signal) {
    const res = await fastapiClient.get(`${ATTENDANCE}grouped?${params}`, { signal });
    console.log("attendance grouped:", res)
    return res.data;
  },

  async getStats(params) {
    try {
      const res = await fastapiClient.get(`${ATTENDANCE}stats?${params}`);
      return res.data;
    } catch {
      return {};
    }
  },

  async getKpi(date) {
    try {
      const res = await fastapiClient.get(`${ATTENDANCE}kpi?target_date=${date}`);
      return res.data;
    } catch {
      return {};
    }
  },

  async getAnalysis(userId, dateFrom, dateTo) {
    try {
      const res = await fastapiClient.get(
        `${ATTENDANCE}analysis/${userId}?date_from=${dateFrom}&date_to=${dateTo}`
      );
      return res.data;
    } catch {
      return null;
    }
  },

async getLateToday(date, skip = 0, limit = 50) {
  try {
    const res = await fastapiClient.get(
      `${ATTENDANCE}late-today?target_date=${date}&skip=${skip}&limit=${limit}`
    );
    console.log("getLateToday response:", res.data, res.headers);
    const totalCount = parseInt(res.headers["x-total-count"] || "0", 10);
    return { data: res.data, totalCount };
  } catch (err) {
    console.error("getLateToday ERROR:", err.response?.status, err.response?.data || err.message);
    return { data: [], totalCount: 0 };
  }
},

  async getAvailableIps() {
    try {
      const res = await fastapiClient.get(`${ATTENDANCE}available-ips`);
      return res.data;
    } catch {
      return [];
    }
  },

  // Ajouter dans attendanceService, après getGrouped
async getGroupedWithCount(params, signal) {
  const res = await fastapiClient.get(`${ATTENDANCE}grouped?${params}`, { signal });
  const totalCount = parseInt(res.headers["x-total-count"] || "0", 10);
  console.log("totalCount parsé:", totalCount);
  return { data: res.data, totalCount };
},

async getPresentToday(date) {
  try {
    const res = await fastapiClient.get(`${ATTENDANCE}present-today?target_date=${date}`);
    return res.data;
  } catch {
    return [];
  }
},
};

