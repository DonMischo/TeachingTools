"use client";
/** Meldet einen laufenden Spielwert (Edelsteine, Gold, Hinweise …) gedrosselt an den Server und beim Abbau ein letztes Mal. */
import { useEffect, useRef } from "react";
import type { ChallengeLauf } from "./useChallengeLauf";

export function useSpielwert(lauf: ChallengeLauf, spiel: string, etappe: number, wert: number, max: number, ms = 1500) {
  const neuer = useRef({ lauf, spiel, etappe, wert, max });
  neuer.current = { lauf, spiel, etappe, wert, max };
  const gesendet = useRef(0);
  const uhr = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sende = async () => {
    const n = neuer.current;
    if (n.wert === gesendet.current) return;
    gesendet.current = n.wert;
    try { await n.lauf.spielwert(n.spiel, n.etappe, n.wert, n.max); } catch { /* der Wert ist nur Zugabe */ }
  };
  useEffect(() => {
    if (wert === 0 || uhr.current) return;
    uhr.current = setTimeout(() => { uhr.current = undefined; void sende(); }, ms);
  }, [wert]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { clearTimeout(uhr.current); void sende(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
