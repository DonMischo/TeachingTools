"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/** A signed guest token, valid for one session code, for a fixed 60-minute window.
 * Stored in localStorage under `hp_guest_<code>` and dropped once expired. */
export type GuestSession = { token: string; name: string; expiresAt: number };

/** Guest tokens live 60 min server-side; expire the client copy a hair earlier so
 * we show the hard-block screen before the server would reject a call. */
const CLIENT_TTL_MS = 59 * 60 * 1000;

function load(key: string): GuestSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? "null") as GuestSession | null;
    return s && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

/**
 * Guest identity for one session `code`. `join(tool, name)` calls the backend
 * (which enforces the teacher opt-in) and persists the returned token; `expired`
 * flips to true when the 60-minute window elapses — the caller shows a hard-block
 * "Sitzung abgelaufen" screen and does NOT offer a rejoin.
 */
export function useGuestSession(code: string) {
  const key = `hp_guest_${code}`;
  const [session, setSession] = useState<GuestSession | null>(null);
  const [expired, setExpired] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armExpiry = useCallback((s: GuestSession | null) => {
    if (timer.current) clearTimeout(timer.current);
    if (!s) return;
    const ms = s.expiresAt - Date.now();
    if (ms <= 0) { setExpired(true); return; }
    timer.current = setTimeout(() => setExpired(true), ms);
  }, []);

  useEffect(() => {
    const s = load(key);
    setSession(s);
    setExpired(s === null && localStorage.getItem(key) !== null);
    armExpiry(s);
    setLoaded(true);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [key, armExpiry]);

  const join = useCallback(async (tool: string, name: string) => {
    const res = await api.guest.join(code, tool, name);
    const s: GuestSession = { token: res.token, name: res.name, expiresAt: Date.now() + CLIENT_TTL_MS };
    try { localStorage.setItem(key, JSON.stringify(s)); } catch {}
    setSession(s);
    setExpired(false);
    armExpiry(s);
    return s;
  }, [code, key, armExpiry]);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    try { localStorage.removeItem(key); } catch {}
    setSession(null);
  }, [key]);

  /** Force the hard-block screen (e.g. a WS closed 4001 or a REST call 401'd). */
  const markExpired = useCallback(() => setExpired(true), []);

  return { session, token: session?.token ?? null, expired, loaded, join, clear, markExpired };
}
