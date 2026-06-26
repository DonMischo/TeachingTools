"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { api, TeacherOut } from "@/lib/api";

type AuthState = { teacher: TeacherOut; token: string } | null;

const AuthContext = createContext<{
  auth: AuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}>({ auth: null, login: async () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(null);

  // Hydrate from localStorage after mount (client-only, avoids SSR mismatch)
  useEffect(() => {
    const token   = localStorage.getItem("hp_token");
    const teacher = localStorage.getItem("hp_teacher");
    if (token && teacher) setAuth({ token, teacher: JSON.parse(teacher) });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.auth.login(username, password);
    localStorage.setItem("hp_token", res.access_token);
    localStorage.setItem("hp_teacher", JSON.stringify(res.teacher));
    setAuth({ token: res.access_token, teacher: res.teacher });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hp_token");
    localStorage.removeItem("hp_teacher");
    setAuth(null);
  }, []);

  // Clear auth state when apiFetch receives a 401 (token expired/invalid)
  useEffect(() => {
    const handler = () => setAuth(null);
    window.addEventListener("hp:logout", handler);
    return () => window.removeEventListener("hp:logout", handler);
  }, []);

  return <AuthContext.Provider value={{ auth, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
