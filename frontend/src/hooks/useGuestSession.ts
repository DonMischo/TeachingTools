"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/** A signed guest token, valid for one session code, for one guest window.
 * Stored in localStorage under `hp_guest_<code>` and dropped once expired. */
export type GuestSession = { token: string; name: string; expiresAt: number };

/** Wie lang das Fenster ist, sagt der Server beim Beitritt (schulweit unter
 * Admin › Gastzugang eingestellt) — der Browser rät die Zahl nicht selbst, sonst
 * zeigt er den Abgelaufen-Schirm, während das Token noch gilt, oder umgekehrt.
 * Die Kopie im Browser läuft eine Minute früher ab, damit der Schirm kommt,
 * bevor der Server anfängt, Aufrufe abzuweisen. */
const CLIENT_SKEW_MS = 60 * 1000;

/** Fällt der Server aus, bevor er die Zahl nennt: das alte Fenster als Rückfall. */
const RUECKFALL_MINUTEN = 90;

function clientTtlMs(minutes: number | undefined): number {
  // Ohne brauchbare Zahl (ein Backend, das sie noch nicht mitschickt) wäre die
  // Rechnung NaN — und ein NaN-Ablauf gilt sofort als abgelaufen: jeder Gast
  // sähe »Sitzung abgelaufen«, obwohl sein Token gilt.
  const m = Number.isFinite(minutes) ? (minutes as number) : RUECKFALL_MINUTEN;
  return Math.max(m * 60 * 1000 - CLIENT_SKEW_MS, 30 * 1000);
}

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
 * flips to true when the guest window elapses and the caller shows the
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

  /** `fortsetzen`: Spielstand nach Namen (wie beim Maus-Führerschein) — wer mit
   * demselben Namen wieder beitritt, spielt unter seiner alten Gast-Id weiter.
   * Das letzte Token je Name bleibt dafür auch nach Ablauf liegen. */
  const join = useCallback(async (tool: string, name: string, { fortsetzen = false } = {}) => {
    const namenKey = `hp_guest_namen_${code}`;
    const n = name.trim().toLowerCase().replace(/\s+/g, " ");
    let namen: Record<string, string> = {};
    if (fortsetzen) try { namen = JSON.parse(localStorage.getItem(namenKey) ?? "{}") ?? {}; } catch {}
    const res = fortsetzen ? await api.guest.join(code, tool, name, namen[n]) : await api.guest.join(code, tool, name);
    if (fortsetzen) try { localStorage.setItem(namenKey, JSON.stringify({ ...namen, [n]: res.token })); } catch {}
    const s: GuestSession = {
      token: res.token,
      name: res.name,
      expiresAt: Date.now() + clientTtlMs(res.expires_in_minutes),
    };
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
