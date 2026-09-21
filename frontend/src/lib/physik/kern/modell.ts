/**
 * Der Aufbau als Baukasten: Teile und Verbinder, sonst nichts.
 *
 * Bis hierher war jedes Schulgerät eigener Code — Pendel, Hebel, Federpendel,
 * Flaschenzug —, und jede neue Kombination brauchte einen neuen Sonderfall.
 * Jetzt gibt es wenige Grundteile (Brett, Stange, Klotz, Kugel, Scheibe,
 * Massestück) und wenige Verbinder (Achse, Schraube, Feder, Seil). Ein Pendel
 * ist ein Massestück an einem Seil an der Wand, ein Hebel ein Brett auf einer
 * Achse. Gerechnet wird alles von *einem* Löser; was man damit baut, entsteht
 * aus dem Zusammenstecken und nicht aus einer Fallunterscheidung.
 *
 * Die Wand ist kein Teil, sondern das Ende eines Verbinders: ein Brett mit
 * einer Schraube zur Wand hängt dort fest, eines mit einer Achse zur Wand
 * dreht sich darum. So lässt sich *jedes* Teil an die Lochwand setzen.
 *
 * Alles ist reine Daten — speicherbar, teilbar, im Test ohne Löser prüfbar.
 */
import type { Modelltreue, Punkt } from "../typen";

export type TeilArt = "brett" | "stange" | "klotz" | "kugel" | "scheibe" | "zahnrad" | "massestueck";

export interface Teil {
  id: string;
  art: TeilArt;
  /** Lage des Mittelpunkts in Metern, y nach oben. */
  pos: Punkt;
  /** Drehung in rad, gegen den Uhrzeigersinn. */
  winkel: number;
  /** Maße, Werkstoff und dergleichen — was welche Art braucht, steht im Katalog. */
  werte: Record<string, number>;
}

export type VerbinderArt = "achse" | "schraube" | "feder" | "seil";

/**
 * Ein Ende eines Verbinders.
 *
 * `teil: null` ist die Wand. Der Punkt liegt dann in Weltkoordinaten, sonst
 * in den Koordinaten des Teils — so wandert er mit, wenn man das Teil
 * verschiebt oder dreht.
 */
export interface Ende {
  teil: string | null;
  punkt: Punkt;
}

export interface Verbinder {
  id: string;
  art: VerbinderArt;
  a: Ende;
  b: Ende;
  werte: Record<string, number>;
}

export interface Aufbau {
  version: 2;
  titel: string;
  treue: Modelltreue;
  teile: Teil[];
  verbinder: Verbinder[];
}

export const neuerAufbau = (): Aufbau => ({
  version: 2, titel: "Neuer Aufbau", treue: "real", teile: [], verbinder: [],
});

/** Fortlaufende Ids — lesbar im gespeicherten Aufbau und bestimmt im Test. */
function naechsteId(vorhandene: string[], praefix: string): string {
  const hoechste = vorhandene.reduce((max, id) => {
    const rest = id.startsWith(praefix) ? Number(id.slice(praefix.length)) : NaN;
    return Number.isInteger(rest) && rest > max ? rest : max;
  }, 0);
  return `${praefix}${hoechste + 1}`;
}

/** Die Wand als Verbinderende, an einem Weltpunkt. */
export const wand = (punkt: Punkt): Ende => ({ teil: null, punkt });

/** Ein Punkt eines Teils — lokal zu ihm. */
export const amTeil = (teil: string, punkt: Punkt = { x: 0, y: 0 }): Ende => ({ teil, punkt });

export function fuegeTeilHinzu(
  aufbau: Aufbau, art: TeilArt, pos: Punkt, werte: Record<string, number> = {}, winkel = 0,
): { aufbau: Aufbau; id: string } {
  const id = naechsteId(aufbau.teile.map(t => t.id), "t");
  return { aufbau: { ...aufbau, teile: [...aufbau.teile, { id, art, pos, winkel, werte }] }, id };
}

export function verbinde(
  aufbau: Aufbau, art: VerbinderArt, a: Ende, b: Ende, werte: Record<string, number> = {},
): { aufbau: Aufbau; id: string } {
  for (const e of [a, b]) {
    if (e.teil !== null && !aufbau.teile.some(t => t.id === e.teil)) {
      throw new Error(`Kein Teil mit der Id ${e.teil}`);
    }
  }
  if (a.teil === null && b.teil === null) throw new Error("Die Wand lässt sich nicht mit sich selbst verbinden.");
  if (a.teil !== null && a.teil === b.teil) throw new Error("Ein Teil lässt sich nicht mit sich selbst verbinden.");
  const id = naechsteId(aufbau.verbinder.map(v => v.id), "v");
  return { aufbau: { ...aufbau, verbinder: [...aufbau.verbinder, { id, art, a, b, werte }] }, id };
}

/** Nimmt ein Teil weg — und alles, was es mit anderem verband. */
export function entferneTeil(aufbau: Aufbau, id: string): Aufbau {
  return {
    ...aufbau,
    teile: aufbau.teile.filter(t => t.id !== id),
    verbinder: aufbau.verbinder.filter(v => v.a.teil !== id && v.b.teil !== id),
  };
}

export function entferneVerbinder(aufbau: Aufbau, id: string): Aufbau {
  return { ...aufbau, verbinder: aufbau.verbinder.filter(v => v.id !== id) };
}

/** Ein Punkt eines Teils in Weltkoordinaten. */
export function weltpunkt(teil: Teil, lokal: Punkt): Punkt {
  const c = Math.cos(teil.winkel), s = Math.sin(teil.winkel);
  return { x: teil.pos.x + lokal.x * c - lokal.y * s, y: teil.pos.y + lokal.x * s + lokal.y * c };
}

/** Ein Weltpunkt in den Koordinaten eines Teils. */
export function lokalpunkt(teil: Teil, welt: Punkt): Punkt {
  const dx = welt.x - teil.pos.x, dy = welt.y - teil.pos.y;
  const c = Math.cos(-teil.winkel), s = Math.sin(-teil.winkel);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

/** Wo ein Verbinderende in der Welt sitzt. */
export function endeInWelt(aufbau: Aufbau, e: Ende): Punkt {
  if (e.teil === null) return e.punkt;
  const teil = aufbau.teile.find(t => t.id === e.teil);
  return teil ? weltpunkt(teil, e.punkt) : e.punkt;
}
