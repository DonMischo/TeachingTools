/**
 * Bauen am Aufbau: treffen, setzen, verschieben, rückgängig machen.
 *
 * Reine Funktionen auf dem Aufbau — kein Zeichnen, kein Löser. Dieselbe
 * Trefferprüfung dient dem Bauen (Lage aus dem Aufbau) und dem Versuch (Lage
 * aus der Welt); dafür wird die Lage eines Teils als Funktion hereingereicht.
 */
import type { Blick, Punkt } from "../typen";
import {
  amTeil, endeInWelt, lokalpunkt, verbinde, wand,
  type Aufbau, type Teil, type Verbinder, type VerbinderArt,
} from "./modell";
import { teilTyp, type Form } from "./teile";
import { standardWerteVerbinder } from "./verbinder";

// ── Meter und Pixel ──────────────────────────────────────────────────────────

/** Weltpunkt (Meter, y nach oben) → Bildpunkt (Pixel, y nach unten). */
export function zumBild(p: Punkt, blick: Blick): Punkt {
  return {
    x: blick.breite / 2 + (p.x - blick.mitte.x) * blick.skala,
    y: blick.hoehe / 2 - (p.y - blick.mitte.y) * blick.skala,
  };
}

export function zurWelt(p: Punkt, blick: Blick): Punkt {
  return {
    x: blick.mitte.x + (p.x - blick.breite / 2) / blick.skala,
    y: blick.mitte.y - (p.y - blick.hoehe / 2) / blick.skala,
  };
}

// ── Lage und Treffer ─────────────────────────────────────────────────────────

/** Wo ein Teil gerade ist — im Bauen aus dem Aufbau, im Versuch aus der Welt. */
export type Lage = (t: Teil) => { pos: Punkt; winkel: number };
export const lageImAufbau: Lage = t => ({ pos: t.pos, winkel: t.winkel });

function inForm(f: Form, p: Punkt, toleranz: number): boolean {
  if (f.art === "kasten") {
    return Math.abs(p.x - f.mitte.x) <= f.b / 2 + toleranz && Math.abs(p.y - f.mitte.y) <= f.h / 2 + toleranz;
  }
  if (f.art === "kreis") return Math.hypot(p.x - f.mitte.x, p.y - f.mitte.y) <= f.r + toleranz;
  return abstandZurStrecke(p, f.a, f.b) <= f.r + toleranz;
}

export function abstandZurStrecke(p: Punkt, a: Punkt, b: Punkt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Alle Teile unter einem Weltpunkt — das oberste zuerst.
 *
 * Oben ist, was später hingestellt wurde; so wird es auch gezeichnet.
 */
export function teileUnter(aufbau: Aufbau, p: Punkt, lage: Lage = lageImAufbau, toleranz = 0): Teil[] {
  const treffer: Teil[] = [];
  for (let i = aufbau.teile.length - 1; i >= 0; i--) {
    const t = aufbau.teile[i];
    const typ = teilTyp(t.art);
    if (!typ) continue;
    const l = lage(t);
    const lokal = lokalpunkt({ ...t, pos: l.pos, winkel: l.winkel }, p);
    if (typ.formen(t).some(f => inForm(f, lokal, toleranz))) treffer.push(t);
  }
  return treffer;
}

/** Die beiden Enden eines Verbinders in der Welt, nach der gegebenen Lage. */
export function verbinderEnden(aufbau: Aufbau, v: Verbinder, lage: Lage = lageImAufbau): [Punkt, Punkt] {
  const ende = (e: Verbinder["a"]) => {
    if (e.teil === null) return e.punkt;
    const t = aufbau.teile.find(x => x.id === e.teil);
    if (!t) return e.punkt;
    const l = lage(t);
    return endeInWelt({ ...aufbau, teile: [{ ...t, pos: l.pos, winkel: l.winkel }] }, e);
  };
  return [ende(v.a), ende(v.b)];
}

/** Der Verbinder unter einem Weltpunkt, oder null — auf Wunsch nur bestimmte Arten. */
export function verbinderUnter(
  aufbau: Aufbau, p: Punkt, toleranz: number, lage: Lage = lageImAufbau,
  nur: (v: Verbinder) => boolean = () => true,
): Verbinder | null {
  let bester: Verbinder | null = null;
  let beste = toleranz;
  for (const v of aufbau.verbinder) {
    if (!nur(v)) continue;
    const [a, b] = verbinderEnden(aufbau, v, lage);
    const d = v.art === "seil" || v.art === "feder" ? abstandZurStrecke(p, a, b) : Math.hypot(p.x - a.x, p.y - a.y);
    if (d <= beste) { beste = d; bester = v; }
  }
  return bester;
}

// ── Setzen ───────────────────────────────────────────────────────────────────

/**
 * Setzt Achse oder Schraube an einer Stelle.
 *
 * Wie man es an einer Lochwand tut: man steckt den Stift durch, was dort
 * liegt. Liegen zwei Teile übereinander, verbindet er diese; liegt nur eines
 * dort, verbindet er es mit der Wand. Ohne Teil gibt es nichts zu verbinden.
 */
export function setzeGelenk(
  aufbau: Aufbau, art: Extract<VerbinderArt, "achse" | "schraube">, p: Punkt,
): { aufbau: Aufbau; id: string } | { fehler: string } {
  const unter = teileUnter(aufbau, p);
  if (unter.length === 0) return { fehler: "Hier liegt nichts, das sich befestigen ließe." };
  const [oben, darunter] = unter;
  const a = amTeil(oben.id, lokalpunkt(oben, p));
  const b = darunter ? amTeil(darunter.id, lokalpunkt(darunter, p)) : wand(p);
  return verbinde(aufbau, art, a, b, standardWerteVerbinder(art));
}

/** Ein Ende für Seil oder Feder: das oberste Teil an der Stelle, sonst die Wand. */
export function endeAn(aufbau: Aufbau, p: Punkt): Verbinder["a"] {
  const [oben] = teileUnter(aufbau, p);
  return oben ? amTeil(oben.id, lokalpunkt(oben, p)) : wand(p);
}

export function spanne(
  aufbau: Aufbau, art: Extract<VerbinderArt, "seil" | "feder">, von: Punkt, bis: Punkt,
): { aufbau: Aufbau; id: string } | { fehler: string } {
  const a = endeAn(aufbau, von), b = endeAn(aufbau, bis);
  if (a.teil === null && b.teil === null) return { fehler: "Mindestens ein Ende muss an einem Teil sitzen." };
  if (a.teil !== null && a.teil === b.teil) return { fehler: "Beide Enden sitzen am selben Teil." };
  return verbinde(aufbau, art, a, b, standardWerteVerbinder(art));
}

// ── Verschieben und Drehen ───────────────────────────────────────────────────

/**
 * Setzt ein Teil an eine neue Lage.
 *
 * Achsen und Schrauben zur Wand wandern mit: wer ein angeschraubtes Brett
 * verschiebt, meint das Brett samt Schraube, nicht ein Brett, das sich von
 * seiner Schraube losreißt. Seile und Federn zur Wand bleiben dagegen an
 * ihrem Wandpunkt — sie werden länger oder kürzer.
 */
export function setzeLage(aufbau: Aufbau, id: string, pos: Punkt, winkel?: number): Aufbau {
  const alt = aufbau.teile.find(t => t.id === id);
  if (!alt) return aufbau;
  const neu: Teil = { ...alt, pos, winkel: winkel ?? alt.winkel };
  return {
    ...aufbau,
    teile: aufbau.teile.map(t => (t.id === id ? neu : t)),
    verbinder: aufbau.verbinder.map(v => {
      if (v.art !== "achse" && v.art !== "schraube") return v;
      if (v.a.teil === id && v.b.teil === null) return { ...v, b: wand(endeInWelt({ ...aufbau, teile: [neu] }, v.a)) };
      if (v.b.teil === id && v.a.teil === null) return { ...v, a: wand(endeInWelt({ ...aufbau, teile: [neu] }, v.b)) };
      return v;
    }),
  };
}

export function setzeTeilWerte(aufbau: Aufbau, id: string, werte: Record<string, number>): Aufbau {
  return { ...aufbau, teile: aufbau.teile.map(t => (t.id === id ? { ...t, werte: { ...t.werte, ...werte } } : t)) };
}

export function setzeVerbinderWerte(aufbau: Aufbau, id: string, werte: Record<string, number>): Aufbau {
  return {
    ...aufbau,
    verbinder: aufbau.verbinder.map(v => (v.id === id ? { ...v, werte: { ...v.werte, ...werte } } : v)),
  };
}

// ── Rückgängig ───────────────────────────────────────────────────────────────

/**
 * Der Verlauf fürs Rückgängigmachen.
 *
 * Weil der Aufbau unveränderliche Daten sind, genügt es, die Stände zu
 * merken. Ein Zug beim Ziehen (hunderte Bewegungen) wird zu einem Schritt
 * zusammengefasst: `merke()` beim Anfassen, `setze()` währenddessen.
 */
export interface Verlauf {
  vorher: Aufbau[];
  jetzt: Aufbau;
  nachher: Aufbau[];
}

const GRENZE = 200;

export const neuerVerlauf = (jetzt: Aufbau): Verlauf => ({ vorher: [], jetzt, nachher: [] });

/** Ein neuer Stand, der sich rückgängig machen lässt. */
export function tue(v: Verlauf, neu: Aufbau): Verlauf {
  if (neu === v.jetzt) return v;
  return { vorher: [...v.vorher, v.jetzt].slice(-GRENZE), jetzt: neu, nachher: [] };
}

/** Ein Zwischenstand ohne eigenen Schritt — etwa beim Ziehen. */
export const setze = (v: Verlauf, neu: Aufbau): Verlauf => ({ ...v, jetzt: neu });

/** Merkt den jetzigen Stand als Schritt, bevor eine Serie von `setze` beginnt. */
export const merke = (v: Verlauf): Verlauf => ({ vorher: [...v.vorher, v.jetzt].slice(-GRENZE), jetzt: v.jetzt, nachher: [] });

export function zurueck(v: Verlauf): Verlauf {
  if (!v.vorher.length) return v;
  return { vorher: v.vorher.slice(0, -1), jetzt: v.vorher[v.vorher.length - 1], nachher: [v.jetzt, ...v.nachher] };
}

export function vor(v: Verlauf): Verlauf {
  if (!v.nachher.length) return v;
  return { vorher: [...v.vorher, v.jetzt], jetzt: v.nachher[0], nachher: v.nachher.slice(1) };
}
