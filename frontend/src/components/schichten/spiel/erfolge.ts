"use client";
/**
 * Erfolge im Browser merken. Jede Änderung liest den Speicher frisch, rechnet
 * und schreibt sofort zurück — nie über einen Speicher-Effekt. So können sich
 * Mission und Fehlersuche nicht gegenseitig überschreiben, und StrictMode
 * (doppeltes Montieren) löscht nichts.
 */
import { useEffect, useState } from "react";
import { LEER, ausSpeicher, type ErfolgsStand } from "@/lib/schichten/wertung";

const SCHLUESSEL = "hp_schichten_erfolge";
const EREIGNIS = "schichten-erfolge";

export function ladeErfolge(): ErfolgsStand {
  try {
    return ausSpeicher(JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "null"));
  } catch {
    return LEER;
  }
}

export function aendereErfolge<T extends { stand: ErfolgsStand }>(f: (alt: ErfolgsStand) => T): T {
  const r = f(ladeErfolge());
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(r.stand));
  } catch {
    // privates Fenster o. Ä.: dann gilt der Stand nur bis zum Neuladen
  }
  window.dispatchEvent(new Event(EREIGNIS));
  return r;
}

export function useErfolge(): ErfolgsStand {
  const [stand, setStand] = useState(ladeErfolge);
  useEffect(() => {
    const neu = () => setStand(ladeErfolge());
    window.addEventListener(EREIGNIS, neu);
    return () => window.removeEventListener(EREIGNIS, neu);
  }, []);
  return stand;
}
