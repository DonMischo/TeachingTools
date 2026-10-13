"use client";
/** Lauf-Zustand der Challenge: info, Brett (wird nach jeder Antwort neu geholt) und Zeitmessung (Lesezeit, Wahlzeit). */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ChallengeAntwort, type ChallengeAntwortIn, type ChallengeBrett, type ChallengeInfo } from "@/lib/api";

/** Woher der Lauf seine Daten holt: Sitzung (Code) oder eine Boss-Folie im TaskCrawler. */
export type ChallengeQuelle = {
  /** Für Effekt-Abhängigkeiten (das Quelle-Objekt selbst ist bei jedem Render neu). */
  schluessel: string;
  /** true: sofort start() statt Spielauswahl (der Lauf steht auf dem Server). */
  direkt?: boolean;
  info(): Promise<ChallengeInfo>;
  start(spiel?: string): Promise<ChallengeBrett>;
  antwort(body: ChallengeAntwortIn): Promise<ChallengeAntwort>;
  deck(ids: string[]): Promise<ChallengeBrett>;
};

export const sitzungsQuelle = (code: string, token?: string | null): ChallengeQuelle => ({
  schluessel: `sitzung:${code}:${token ?? ""}`,
  info: () => api.challenge.info(code, token),
  start: (spiel) => api.challenge.start(code, token, spiel),
  antwort: (body) => api.challenge.antwort(code, body, token),
  deck: (ids) => api.challenge.deck(code, ids, token),
});

export function useChallengeLauf(q: ChallengeQuelle | string, token?: string | null) {
  const quelle = typeof q === "string" ? sitzungsQuelle(q, token) : q;
  const qRef = useRef(quelle);
  qRef.current = quelle;
  const key = quelle.schluessel;
  const [info, setInfo] = useState<ChallengeInfo | null>(null);
  const [brett, setBrett] = useState<ChallengeBrett | null>(null);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState("");
  const leseStart = useRef(0);
  const wahlStart = useRef<number | null>(null);

  const holeBrett = useCallback(async (spiel?: string) => {
    const b = await qRef.current.start(spiel);
    setBrett(b);
    return b;
  }, [key]);

  useEffect(() => {
    (async () => {
      try {
        const i = await qRef.current.info();
        setInfo(i);
        // Bei mehreren Spielarten und ohne laufenden Stand wählt die Person erst (spielWechseln)
        if (qRef.current.direkt || i.settings.spiele.length <= 1 || i.stand) await holeBrett();
      } catch (e) {
        setFehler((e as Error).message.includes("geschlossen") ? "Diese Challenge ist geschlossen." : "Die Challenge konnte nicht geladen werden.");
      } finally {
        setLaden(false);
      }
    })();
  }, [key, holeBrett]);

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
      const r = await qRef.current.antwort({
        challenge_id: challengeId, fakt_ids: faktIds, tipp,
        lese_ms: Math.max(0, Math.round(start - leseStart.current)), wahl_ms: Math.max(0, Math.round(jetzt - start)),
      });
      if (r.fertig) setInfo(await qRef.current.info());
      await holeBrett();
      return r;
    } catch (e) {
      await holeBrett().catch(() => setFehler("Die Challenge konnte nicht geladen werden."));
      throw e;
    }
  }, [holeBrett]);

  const deckSetzen = useCallback(async (ids: string[]) => {
    setBrett(await qRef.current.deck(ids));
  }, []);

  /** false, wenn der Server den Wechsel ablehnt (z. B. 409). */
  const spielWechseln = useCallback(async (spiel: string) => {
    try { await holeBrett(spiel); return true; } catch { return false; }
  }, [holeBrett]);

  return { info, brett, laden, fehler, waehle, gelegt, antworte, deckSetzen, spielWechseln };
}
export type ChallengeLauf = ReturnType<typeof useChallengeLauf>;
