/**
 * Kleine Werkzeuge, die alle Teile der Spiel-Logik brauchen: Zufall mit
 * gespeichertem Zustand, Ids, Protokoll, Buchungen, Briefe, Ausstattung.
 *
 * Alle Funktionen verändern den übergebenen Spielstand direkt. Die
 * öffentlichen Aktionen in motor.ts arbeiten auf einer Kopie (`klon`).
 */
import MOEBEL_JSON from "./daten/moebel.json";
import type { Brief, Kategorie, LogArt, Spielstand } from "./typen";
import { alterAm } from "./zeit";

export type MoebelDef = {
  id: string;
  name: string;
  icon: string;
  raum: "schlafen" | "kueche" | "bad" | "wohnen" | "flur" | "technik";
  stufe: "pflicht" | "wichtig" | "komfort" | "luxus";
  neu: { preis: number; laden: string };
  gebraucht: { min: number; max: number; risiko: number; hinweis?: string } | null;
  effekt: Partial<Record<Effekt, number>>;
  strom: number;
  masse: { b: number; t: number };
  aufbau: number;
  hinweis?: string;
};

export type Effekt = "schlaf" | "kochen" | "kuehlen" | "tiefkuehlen" | "waschen" | "trocknen" | "spuelen" | "ordnung"
  | "spass" | "sozial" | "hygiene" | "licht" | "internet" | "komfort";

export const MOEBEL = MOEBEL_JSON as MoebelDef[];
export const MOEBEL_DEF = new Map(MOEBEL.map((m) => [m.id, m]));

export function klon<T>(x: T): T {
  return structuredClone(x);
}

/** Nächste Zufallszahl 0..1 (mulberry32, Zustand im Spielstand). */
export function zufall(s: Spielstand): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function zwischen(s: Spielstand, min: number, max: number): number {
  return min + zufall(s) * (max - min);
}

export function ganz(s: Spielstand, min: number, max: number): number {
  return Math.floor(zwischen(s, min, max + 1));
}

export function uid(s: Spielstand): number {
  return s.naechsteUid++;
}

export function log(s: Spielstand, art: LogArt, text: string, betrag?: number): void {
  s.log.push({ tag: s.tag, stunde: Math.round(s.stunde * 100) / 100, art, text, ...(betrag !== undefined ? { betrag: Math.round(betrag * 100) / 100 } : {}) });
}

export const r2 = (n: number) => Math.round(n * 100) / 100;

export function euro(n: number, vorzeichen = false): string {
  const t = Math.abs(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "−" : vorzeichen && n > 0 ? "+" : ""}${t} €`;
}

/** Geld aufs/vom Konto. Negative Beträge = Ausgabe. Gibt false zurück, wenn der Dispo nicht reicht. */
export function buchen(s: Spielstand, betrag: number, kategorie: Kategorie, text: string, erzwingen = true): boolean {
  const b = r2(betrag);
  if (b < 0 && !erzwingen && s.konto.stand + b < -s.konto.dispo) return false;
  s.konto.stand = r2(s.konto.stand + b);
  s.konto.buchungen.push({ id: uid(s), tag: s.tag, betrag: b, kategorie, text });
  const topf = b >= 0 ? s.laufend.ein : s.laufend.aus;
  topf[kategorie] = r2((topf[kategorie] ?? 0) + Math.abs(b));
  return true;
}

/** Kann ich das bezahlen (Konto + Dispo)? */
export function kannZahlen(s: Spielstand, betrag: number): boolean {
  return s.konto.stand - betrag >= -s.konto.dispo;
}

export function brief(s: Spielstand, von: string, betreff: string, text: string, aktion?: Brief["aktion"]): Brief {
  const b: Brief = { uid: uid(s), tag: s.tag, von, betreff, text, gelesen: false, ...(aktion ? { aktion } : {}) };
  s.post.push(b);
  return b;
}

export function alter(s: Spielstand, tag = s.tag): number {
  return alterAm(s.figur.geburtstag, tag);
}

export function volljaehrig(s: Spielstand): boolean {
  return alter(s) >= 18;
}

/** Beste Ausstattung für einen Effekt (Möbel + Wohnung). */
export function effekt(s: Spielstand, e: Effekt): number {
  let best = 0;
  // Bei den Eltern und im möblierten Zimmer ist das Nötigste da.
  if (s.wohnung.form === "eltern") {
    const basis: Partial<Record<Effekt, number>> = { schlaf: 3, kochen: 3, kuehlen: 1, tiefkuehlen: 1, waschen: 1, spuelen: 1,
      ordnung: 2, licht: 2, internet: 1, hygiene: 2, komfort: 2, spass: 1, sozial: 1 };
    best = basis[e] ?? 0;
  } else {
    if (s.wohnung.ebk && (e === "kochen" || e === "kuehlen")) best = e === "kochen" ? 3 : 1;
    if (s.wohnung.moebliert) {
      const m: Partial<Record<Effekt, number>> = { schlaf: 2, ordnung: 1, licht: 2, komfort: 1, kochen: 2, kuehlen: 1 };
      best = Math.max(best, m[e] ?? 0);
    }
    if (s.wohnung.form === "wg") {
      const wg: Partial<Record<Effekt, number>> = { kochen: 3, kuehlen: 1, waschen: 1, spuelen: 1, internet: 1, licht: 1, sozial: 1 };
      best = Math.max(best, wg[e] ?? 0);
    }
    if (s.wohnung.form === "azubiwohnheim") {
      const h: Partial<Record<Effekt, number>> = { schlaf: 2, kochen: 2, kuehlen: 1, waschen: 1, internet: 1, licht: 2, ordnung: 1 };
      best = Math.max(best, h[e] ?? 0);
    }
  }
  for (const m of s.moebel) {
    if (m.defekt) continue;
    const d = MOEBEL_DEF.get(m.id);
    const w = d?.effekt[e] ?? 0;
    if (w > best) best = w;
  }
  return best;
}

export function hatMoebel(s: Spielstand, id: string): boolean {
  return s.moebel.some((m) => m.id === id && !m.defekt);
}

export function begrenzen(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}
