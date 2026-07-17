"use client";
import { useCallback, useEffect, useState } from "react";

export type SavedPlayer = {
  name: string;
  avatar: string;
  /** anon token (bingo) or participant id (caputh) — game-specific */
  token?: string;
  participantId?: number;
};

/**
 * Per-game persisted player identity (name, avatar, rejoin credentials)
 * stored in localStorage under `<prefix>_<code>`.
 */
export function useSavedPlayer(prefix: string, code: string) {
  const key = `${prefix}_${code}`;
  const [saved, setSaved] = useState<SavedPlayer | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem(key) ?? "null")); } catch { setSaved(null); }
    setLoaded(true);
  }, [key]);

  const save = useCallback((p: SavedPlayer) => {
    setSaved(p);
    try { localStorage.setItem(key, JSON.stringify(p)); } catch {}
  }, [key]);

  const clear = useCallback(() => {
    setSaved(null);
    try { localStorage.removeItem(key); } catch {}
  }, [key]);

  return { saved, save, clear, loaded };
}

export function newAnonToken(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}
