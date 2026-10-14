"use client";
/** Sammelphase: wird nach `ms` wahr (sofort bei reduzierter Bewegung) und schaltet dann »Alles einsammeln« frei. */
import { useEffect, useState } from "react";
import { wenigerBewegung } from "./bewegung";

export function useUeberspringen(ms = 20000): boolean {
  const [skip, setSkip] = useState(wenigerBewegung);
  useEffect(() => {
    if (skip) return;
    const t = setTimeout(() => setSkip(true), ms);
    return () => clearTimeout(t);
  }, [skip, ms]);
  return skip;
}
