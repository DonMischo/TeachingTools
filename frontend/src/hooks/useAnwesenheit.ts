"use client";
/**
 * Lernende in einer Werkzeugsitzung: »bin da« an das Dashboard der Lehrkraft,
 * beim Öffnen und danach jede Minute, solange die Seite sichtbar ist. Fasst
 * den gemeldeten Stand nicht an (PUT /api/sitzungen/{code}/da) — so zeigt das
 * Dashboard auch bei Werkzeugen ohne eigenen Stand, wer mitmacht.
 */
import { useEffect } from "react";
import { api, type MausZugang } from "@/lib/api";

const TAKT_MS = 60_000;

export function useAnwesenheit(zugang: MausZugang | undefined) {
  const code = zugang?.code, token = zugang?.token ?? null;
  useEffect(() => {
    if (!code) return;
    const melde = () => { if (document.visibilityState === "visible") api.sitzungen.da({ code, token }).catch(() => { /* nur fürs Dashboard */ }); };
    melde();
    const t = setInterval(melde, TAKT_MS);
    document.addEventListener("visibilitychange", melde);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", melde); };
  }, [code, token]);
}
