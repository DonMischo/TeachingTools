"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { api, TeacherOut, StudentOut } from "@/lib/api";

export type AuthUser = {
  user_type: "teacher" | "student";
  role: "admin" | "teacher" | "student";
  teacher?: TeacherOut;
  student?: StudentOut;
};

const AuthContext = createContext<{
  auth: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}>({ auth: null, login: async () => {}, logout: async () => {} });

function _buildAuthUser(res: { user_type: string; teacher?: TeacherOut; student?: StudentOut }): AuthUser {
  const user_type = res.user_type as "teacher" | "student";
  const role = user_type === "student"
    ? "student"
    : ((res.teacher?.role ?? "teacher") as "admin" | "teacher");
  return { user_type, role, teacher: res.teacher, student: res.student };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthUser | null>(null);

  // Hydrate from server cookie via /me on mount
  useEffect(() => {
    api.auth.me()
      .then(res => setAuth(_buildAuthUser(res)))
      .catch(() => setAuth(null));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await api.auth.login(username, password);
    const me = await api.auth.me();
    setAuth(_buildAuthUser(me));
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setAuth(null);
  }, []);

  // Clear state on 401 events dispatched by apiFetch
  useEffect(() => {
    const handler = () => setAuth(null);
    window.addEventListener("hp:logout", handler);
    return () => window.removeEventListener("hp:logout", handler);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
