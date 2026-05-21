import { create } from "zustand";
import { api } from "@/lib/api";

interface AuthState {
  token: string | null;
  role: string | null;
  name: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role: string
  ) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  role: null,
  name: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.auth.login(email, password);
    localStorage.setItem("token", res.access_token);
    localStorage.setItem("role", res.role);
    localStorage.setItem("userName", res.name);
    set({
      token: res.access_token,
      role: res.role,
      name: res.name,
      isAuthenticated: true,
    });
  },

  register: async (name, email, password, role) => {
    const res = await api.auth.register(name, email, password, role);
    localStorage.setItem("token", res.access_token);
    localStorage.setItem("role", res.role);
    localStorage.setItem("userName", res.name);
    set({
      token: res.access_token,
      role: res.role,
      name: res.name,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userName");
    set({
      token: null,
      role: null,
      name: null,
      isAuthenticated: false,
    });
  },

  hydrate: () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("userName");
    set({
      token,
      role,
      name,
      isAuthenticated: !!token,
      isLoading: false,
    });
  },
}));
