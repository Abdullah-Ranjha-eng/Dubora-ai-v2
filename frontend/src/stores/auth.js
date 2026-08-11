import { defineStore } from "pinia";
import { ref } from "vue";
import api from "../api/axios.js";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const register = async (name, email, password) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.post("/register", { name, email, password });
      user.value = data.user;
      return true;
    } catch (err) {
      error.value = err.response?.data?.message || "Registration failed.";
      return false;
    } finally {
      loading.value = false;
    }
  };

  const login = async (email, password) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.post("/login", { email, password });
      user.value = data.user;
      return true;
    } catch (err) {
      error.value = err.response?.data?.message || "Login failed.";
      return false;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    await api.get("/logout");
    user.value = null;
  };

  const fetchProfile = async () => {
    try {
      const { data } = await api.get("/me");
      user.value = data.user;
    } catch {
      user.value = null;
    }
  };

  return { user, loading, error, register, login, logout, fetchProfile };
});