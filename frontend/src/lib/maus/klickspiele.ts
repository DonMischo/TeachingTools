/**
 * Die beiden Klickspiele des Maus-Führerscheins — Rechnung ohne Bildschirm.
 *
 * Gemessen wird je Ziel die Zeit vom Erscheinen bis zum Treffer und ob
 * daneben geklickt wurde. Die Stufe passt sich an:
 *
 *   hoch   — unter den letzten fünf Versuchen höchstens ein Fehlgriff, und der
 *            Median der Trefferzeiten liegt unter 60 % der Zeitgrenze
 *   runter — zwei Fehlgriffe (daneben oder Zeit abgelaufen) unter den letzten fünf
 *
 * Der Median statt des Mittels, weil ein Kind, das einmal zur Seite schaut,
 * sonst eine ganze Runde lang als langsam gälte. Gezählt wird nur seit dem
 * letzten Wechsel (der Aufrufer leert den Verlauf) — sonst spränge die Stufe
 * gleich weiter, weil die schnellen Treffer der leichteren Stufe noch im
 * Fenster lägen.
 */

export type Versuch = { treffer: boolean; ms: number };
export type Spielstufe = { spalten: number; zeilen: number };
export type Klickspiel = {
  ziele: number;
  /** Zeit fürs erste Tier; mit jedem Treffer mal `faktor`, nie unter `mindestMs`. */
  startMs: number;
  mindestMs: number;
  faktor: number;
  stufen: Spielstufe[];
};

export const FENSTER = 5;
export const SCHNELL_ANTEIL = 0.6;

/**
 * Stufe 1: das Raster wird kleiner. 3×3 füllt die Fläche mit großen Feldern,
 * 6×5 ist die Größe der Tierauswahl beim Beitreten — dort soll es enden.
 * Die Zeit je Tier beginnt großzügig und wird mit jedem Treffer etwas
 * knapper: 6 s, nach 20 Treffern rund 2 s.
 */
export const KLICK: Klickspiel = {
  ziele: 20,
  startMs: 6000,
  mindestMs: 2000,
  faktor: 0.94,
  stufen: [
    { spalten: 3, zeilen: 3 },
    { spalten: 4, zeilen: 4 },
    { spalten: 5, zeilen: 5 },
    { spalten: 6, zeilen: 5 },
  ],
};

/**
 * Stufe 2: das Raster bleibt. Die Zeit wird mit jedem Treffer knapper
 * (7 s bis 2,5 s); die Stufe hebt hier nur den Punkte-Faktor.
 */
export const DOPPELKLICK: Klickspiel = {
  ziele: 15,
  startMs: 7000,
  mindestMs: 2500,
  faktor: 0.93,
  stufen: [
    { spalten: 6, zeilen: 5 },
    { spalten: 6, zeilen: 5 },
    { spalten: 6, zeilen: 5 },
  ],
};

/** Die Zeitgrenze für das nächste Tier, nach so vielen Treffern. */
export function zeitFuer(spiel: Klickspiel, treffer: number): number {
  return Math.max(spiel.mindestMs, Math.round(spiel.startMs * spiel.faktor ** treffer));
}

/**
 * So lange darf zwischen zwei Klicks vergehen, damit Windows sie als
 * Doppelklick zählt (Werkseinstellung). Der Browser übernimmt den Wert des
 * Systems; hier dient er nur dazu, einen misslungenen Versuch zu erklären.
 */
export const DOPPELKLICK_MS = 500;

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** −1, 0 oder +1 — der Aufrufer klemmt auf die vorhandenen Stufen. */
export function stufenWechsel(verlauf: Versuch[], zeitMs: number): -1 | 0 | 1 {
  const letzte = verlauf.slice(-FENSTER);
  const fehl = letzte.filter(v => !v.treffer).length;
  if (fehl >= 2) return -1;
  if (letzte.length < FENSTER) return 0;
  const zeiten = letzte.filter(v => v.treffer).map(v => v.ms);
  return median(zeiten) < SCHNELL_ANTEIL * zeitMs ? 1 : 0;
}

export const PUNKTE_TREFFER = 50;
export const PUNKTE_TEMPO = 250;

/**
 * 50 für den Treffer, bis zu 250 fürs Tempo — mal der Stufe.
 *
 * Gemessen an der Startzeit des Spiels, nicht an der gerade gültigen Grenze:
 * dieselbe Klickzeit ist immer gleich viel wert. Quadratisch, damit sich
 * schnell wirklich lohnt — 0,5 s bringen gut dreimal so viel wie 4 s.
 */
export function trefferPunkte(stufe: number, ms: number, bezugMs: number): number {
  const rest = Math.max(0, Math.min(1, 1 - ms / bezugMs));
  return Math.round((PUNKTE_TREFFER + PUNKTE_TEMPO * rest * rest) * (stufe + 1));
}

export function hoechstPunkte(spiel: Klickspiel): number {
  return spiel.ziele * (PUNKTE_TREFFER + PUNKTE_TEMPO) * spiel.stufen.length;
}

/**
 * Warum aus zwei Klicks kein Doppelklick wurde.
 *
 * Kam der zweite Klick rechtzeitig und zählte trotzdem nicht, hat sich die
 * Maus dazwischen bewegt — Windows verwirft den Doppelklick schon nach wenigen
 * Pixeln. Das ist bei Kindern der häufigste Grund, und er ist unsichtbar.
 */
export function einzelklickGrund(abstandMs: number): "zu-langsam" | "verwackelt" {
  return abstandMs > DOPPELKLICK_MS ? "zu-langsam" : "verwackelt";
}

/** n verschiedene Einträge in zufälliger Reihenfolge. */
export function ziehe<T>(liste: readonly T[], n: number, zufall = Math.random): T[] {
  const kopie = [...liste];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie.slice(0, n);
}

/** Zusammenfassung für den Führerschein. */
export function auswertung(verlauf: Versuch[]) {
  const treffer = verlauf.filter(v => v.treffer);
  return {
    quote: verlauf.length ? treffer.length / verlauf.length : 0,
    medianMs: median(treffer.map(v => v.ms)),
  };
}
