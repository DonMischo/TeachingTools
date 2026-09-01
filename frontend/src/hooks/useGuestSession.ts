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
 * flips to true when the 60-minute window elapses and the caller shows the
 * "Sitzung abgelaufen" screen.
 *
 * Dieser Bildschirm ist eine Sackgasse *auf Zeit*, keine dauerhafte Sperre:
 * `rejoin()` wirft den abgelaufenen Eintrag weg und lädt die Seite neu, sodass
 * der Gast wieder ganz normal beitreten kann. Ohne das blieb der abgelaufene
 * localStorage-Eintrag für immer liegen — und weil die Codes zustandsloser
 * Werkzeuge absichtlich stabil sind (ein gedruckter QR soll weiter gelten),
 * war dasselbe Gerät danach dauerhaft ausgesperrt, auch wenn die Lehrkraft
 * erneut geteilt hatte. Das Tor bleibt der Server: `guest/join` prüft weiter
 * das Gast-Opt-in und ob die Sitzung offen ist.
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
    // Ein beim Seitenaufruf schon abgelaufener Eintrag wird weggeworfen, statt
    // den Abgelaufen-Bildschirm zu zeigen: wer den Link in der naechsten Stunde
    // erneut oeffnet, soll einfach wieder beitreten koennen. Der Bildschirm
    // gehoert dem Fall, dass das Fenster *waehrend* der Nutzung ablaeuft — dort
    // muss die Nutzung stoppen und erklaert werden.
    if (s === null) {
      try { localStorage.removeItem(key); } catch {}
    }
    setSession(s);
    setExpired(false);
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
    setExpired(false);
  }, [key]);

  /** Force the hard-block screen (e.g. a WS closed 4001 or a REST call 401'd). */
  const markExpired = useCallback(() => setExpired(true), []);

  /**
   * Abgelaufenes Gastfenster verwerfen und von vorn beginnen.
   *
   * Der Neuaufbau der Seite ist Absicht: die Werkzeugseiten halten eigenen
   * Zustand (Phase, WebSocket, Karte). Ein Reload setzt alles davon sauber auf
   * den Beitrittsweg zurück und holt nebenbei den aktuellen Sitzungsstatus —
   * die Lehrkraft kann inzwischen geschlossen oder Gäste abgeschaltet haben.
   */
  const rejoin = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    try { localStorage.removeItem(key); } catch {}
    setSession(null);
    setExpired(false);
    if (typeof window !== "undefined") window.location.reload();
  }, [key]);

  return { session, token: session?.token ?? null, expired, loaded, join, clear, markExpired, rejoin };
}
