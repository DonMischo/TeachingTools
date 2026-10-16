"use client";
/** Papierkorb einer Etappe: weggeworfene Fakten-IDs. Nur lokal (nie an den Server, nie gewertet), jederzeit zurückholbar. */
import { useCallback, useEffect, useState } from "react";

export function useAblage(schluessel?: unknown) {
  const [weg, setWeg] = useState<string[]>([]);
  useEffect(() => { setWeg([]); }, [schluessel]);
  const wegwerfen = useCallback((id: string) => setWeg((w) => (w.includes(id) ? w : [...w, id])), []);
  const zurueckholen = useCallback((id: string) => setWeg((w) => w.filter((x) => x !== id)), []);
  const istWeg = useCallback((id: string) => weg.includes(id), [weg]);
  return { weg, wegwerfen, zurueckholen, istWeg };
}
