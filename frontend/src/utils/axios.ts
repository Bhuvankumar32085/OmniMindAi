import axios from "axios";

export const gatwayApi = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL,
  withCredentials: true,
});

gatwayApi.interceptors.request.use(
  (config) => {
    const sessionId = localStorage.getItem("session_id");
    if (sessionId) {
      config.headers.Authorization = `Bearer ${sessionId}`;
      config.headers["x-session-id"] = sessionId;
    }
    return config;
  },
  (error) => Promise.reject(error),
);