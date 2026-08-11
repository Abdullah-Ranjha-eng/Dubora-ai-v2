import axios from "axios";

const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

const api = axios.create({
  baseURL: `${apiBase}/api/v1`,
  withCredentials: true,
});

export default api;