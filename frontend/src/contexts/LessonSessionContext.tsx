"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { api, LessonPlanOut, LessonSessionOut, LessonMaterialOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const COLLAPSED_KEY = "lesson-guide-collapsed";

type Ctx = {
  session: LessonSessionOut | null;
  plan: LessonPlanOut | null;
  loading: boolean;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  viewingMaterial: LessonMaterialOut | null;
  setViewingMaterial: (m: LessonMaterialOut | null) => void;
  start: (planId: number) => Promise<void>;
  end: () => Promise<void>;
  refresh: () => Promise<void>;
};

const LessonSessionCtx = createContext<Ctx>({
  session: null, plan: null, loading: true,
  collapsed: false, setCollapsed: () => {},
  viewingMaterial: null, setViewingMaterial: () => {},
  start: async () => {}, end: async () => {}, refresh: async () => {},
});

export function LessonSessionProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const isTeacher = auth?.user_type === "teacher";

  const [session, setSession] = useState<LessonSessionOut | null>(null);
  const [plan, setPlan] = useState<LessonPlanOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsedState] = useState(false);
  const [viewingMaterial, setViewingMaterial] = useState<LessonMaterialOut | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsedState(window.localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    if (typeof window !== "undefined") window.localStorage.setItem(COLLAPSED_KEY, v ? "1" : "0");
  }, []);

  const refresh = useCallback(async () => {
    if (!isTeacher) {
      setSession(null);
      setPlan(null);
      setLoading(false);
      return;
    }
    try {
      const active = await api.stundenplaner.active();
      if (active) {
        setSession(active.session);
        setPlan(active.plan);
      } else {
        setSession(null);
        setPlan(null);
      }
    } catch {
      setSession(null);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [isTeacher]);

  useEffect(() => { refresh(); }, [refresh]);

  const start = useCallback(async (planId: number) => {
    const s = await api.stundenplaner.start(planId);
    setSession(s);
    const p = await api.stundenplaner.get(planId);
    setPlan(p);
  }, []);

  const end = useCallback(async () => {
    if (!session) return;
    await api.stundenplaner.end(session.id);
    setSession(null);
    setPlan(null);
    setViewingMaterial(null);
  }, [session]);

  return (
    <LessonSessionCtx.Provider value={{
      session, plan, loading, collapsed, setCollapsed,
      viewingMaterial, setViewingMaterial, start, end, refresh,
    }}>
      {children}
    </LessonSessionCtx.Provider>
  );
}

export const useLessonSession = () => useContext(LessonSessionCtx);
