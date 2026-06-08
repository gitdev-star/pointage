import axios from "axios";

const HR_BASE_URL = process.env.REACT_APP_HR_URL
  ? `${process.env.REACT_APP_HR_URL}/`
  : process.env.REACT_APP_HR_URL + "/";

const hrClient = axios.create({
  baseURL: HR_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

hrClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

hrClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status === 401 && !original._retry) {  // 403 = forbidden (role issue), not a token problem
      original._retry = true;
      try {
        const refresh = localStorage.getItem("refresh_token");
        if (!refresh) throw new Error("No refresh token");
        const res = await axios.post(
          `${process.env.REACT_APP_AUTH_URL}/token/refresh/`,
          { refresh }
        );
        localStorage.setItem("access_token", res.data.access);
        original.headers.Authorization = `Bearer ${res.data.access}`;
        return hrClient(original);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default hrClient;
