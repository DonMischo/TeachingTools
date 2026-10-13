"use client";
/** Lauf-Zustand der Challenge: info, Brett (wird nach jeder Antwort neu geholt) und Zeitmessung (Lesezeit, Wahlzeit). */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ChallengeAntwort, type ChallengeBrett, type ChallengeInfo } from "@/lib/api";

export function useChallengeLauf(code: string, token?: string | null) {
  const [info, setInfo] = useState<ChallengeInfo | null>(null);
  const [brett, setBrett] = useState<ChallengeBrett | null>(null);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState("");
  const leseStart = useRef(0);
  const wahlStart = useRef<number | null>(null);

  const holeBrett = useCallback(async (spiel?: string) => {
    const b = await api.challenge.start(code, token, spiel);
    setBrett(b);
    return b;
  }, [code, token]);

  useEffect(() => {
    (async () => {
      try {
        const i = await api.challenge.info(code, token);
        setInfo(i);
        // Bei mehreren Spielarten und ohne laufenden Stand wählt die Person erst (spielWechseln)
        if (i.settings.spiele.length <= 1 || i.stand) await holeBrett();
      } catch (e) {
        setFehler((e as Error).message.includes("geschlossen") ? "Diese Challenge ist geschlossen." : "Die Challenge konnte nicht geladen werden.");
      } finally {
        setLaden(false);
      }
    })();
  }, [code, token, holeBrett]);

  const waehle = useCallback((_challengeId: string) => {
    leseStart.current = performance.now();
    wahlStart.current = null;
  }, []);
  const gelegt = useCallback(() => {
    if (wahlStart.current == null) wahlStart.current = performance.now();
  }, []);

  /** Wirft bei Fehlern (z. B. 409); das Brett wird trotzdem still neu geladen. */
  const antworte = useCallback(async (challengeId: string, faktIds: string[], tipp: boolean): Promise<ChallengeAntwort> => {
    const jetzt = performance.now();
    const start = wahlStart.current ?? jetzt;
    try {
      const r = await api.challenge.antwort(code, {
        challenge_id: challengeId, fakt_ids: faktIds, tipp,
        lese_ms: Math.max(0, Math.round(start - leseStart.current)), wahl_ms: Math.max(0, Math.round(jetzt - start)),
      }, token);
      if (r.fertig) setInfo(await api.challenge.info(code, token));
      await holeBrett();
      return r;
    } catch (e) {
      await holeBrett().catch(() => setFehler("Die Challenge konnte nicht geladen werden."));
      throw e;
    }
  }, [code, token, holeBrett]);

  const deckSetzen = useCallback(async (ids: string[]) => {
    setBrett(await api.challenge.deck(code, ids, token));
  }, [code, token]);

  /** false, wenn der Server den Wechsel ablehnt (z. B. 409). */
  const spielWechseln = useCallback(async (spiel: string) => {
    try { await holeBrett(spiel); return true; } catch { return false; }
  }, [holeBrett]);

  return { info, brett, laden, fehler, waehle, gelegt, antworte, deckSetzen, spielWechseln };
}
export type ChallengeLauf = ReturnType<typeof useChallengeLauf>;
