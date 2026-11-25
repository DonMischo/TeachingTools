"use client";
/**
 * Lernende: den eigenen Stand an die Sitzung melden (api/routers/sitzungen.py),
 * gebündelt — erst 800 ms nach der letzten Änderung, still bei Fehlern (der
 * Stand liegt ohnehin im Browser, die Meldung ist nur für das Dashboard).
 */
import { useEffect } from "react";
import { api, type MausZugang } from "@/lib/api";

export function useMeinStand(zugang: MausZugang | undefined, daten: Record<string, unknown> | null,
  aktuell?: string | null, fertig = false) {
  const code = zugang?.code, token = zugang?.token ?? null;
  // Als Text vergleichen: ein neues, gleiches Objekt löst keine Meldung aus.
  const inhalt = daten ? JSON.stringify(daten) : null;
  useEffect(() => {
    if (!code || inhalt == null) return;
    const t = setTimeout(() => {
      api.sitzungen.stand({ code, token }, { daten: JSON.parse(inhalt), aktuell: aktuell?.slice(0, 120) ?? null, fertig })
        .catch(() => { /* nur für das Dashboard */ });
    }, 800);
    return () => clearTimeout(t);
  }, [code, token, inhalt, aktuell, fertig]);
}
