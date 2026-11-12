/**
 * Baukasten als Datei und als Sitzungsvorgabe — nach dem Muster der Stromkreise.
 * Alles von außen geht durch `liesBaukasten`: unbekannte Teile und Werte fallen
 * weg, Zahlen werden auf den Bereich ihres Felds begrenzt, Ids neu vergeben.
 * Die Vorgabe liegt in den Sitzungseinstellungen (höchstens 4 kB), darum gibt
 * es eine kompakte Form ohne Ids und Feldnamen.
 */
import type { Punkt } from "../raster/editor";
import { BK_TEILE, editor, type BkArt, type BkTeil, type Baukasten } from "./baukasten";
import type { Draht } from "../raster/editor";
import type { Medium } from "./modell";

export const DATEI_FORMAT = "tt-stroemung";
const MAX_TEILE = 200, MAX_LEITUNGEN = 600, MAX_KOORD = 5000;
const MEDIEN: Medium[] = ["wasser", "oel", "luft"];

export type Ergebnis = { baukasten: Baukasten } | { fehler: string };
const istObjekt = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

function punkt(x: unknown): Punkt | null {
  if (!istObjekt(x) || typeof x.x !== "number" || typeof x.y !== "number" || !Number.isFinite(x.x) || !Number.isFinite(x.y)) return null;
  const p = { x: Math.round(x.x), y: Math.round(x.y) };
  return Math.abs(p.x) <= MAX_KOORD && Math.abs(p.y) <= MAX_KOORD ? p : null;
}

function werte(art: BkArt, x: unknown): Record<string, number> {
  const aus: Record<string, number> = {};
  if (!istObjekt(x)) return aus;
  for (const feld of BK_TEILE[art].felder) {
    const v = x[feld.schluessel];
    if (typeof v === "number" && Number.isFinite(v)) aus[feld.schluessel] = Math.max(feld.min * feld.faktor, Math.min(feld.max * feld.faktor, v));
  }
  return aus;
}

export function liesBaukasten(daten: unknown): Ergebnis {
  if (!istObjekt(daten)) return { fehler: "Das ist kein Rohrnetz (kein JSON-Objekt)." };
  if (daten.version !== undefined && daten.version !== 1) return { fehler: `Unbekannte Version ${String(daten.version)}.` };
  if (!Array.isArray(daten.bauteile) || !Array.isArray(daten.draehte)) return { fehler: "Es fehlen »bauteile« oder »draehte«." };
  if (daten.bauteile.length > MAX_TEILE || daten.draehte.length > MAX_LEITUNGEN) return { fehler: "Das Rohrnetz ist zu groß." };
  const medium = MEDIEN.includes(daten.medium as Medium) ? (daten.medium as Medium) : "wasser";
  let n = 0;
  const bauteile: BkTeil[] = [];
  for (const roh of daten.bauteile) {
    if (!istObjekt(roh) || typeof roh.art !== "string" || !(roh.art in BK_TEILE)) continue;
    const art = roh.art as BkArt, a = punkt(roh.a), b = punkt(roh.b);
    if (!a || !b || (a.x === b.x && a.y === b.y)) continue;
    bauteile.push({ id: `b${++n}`, art, a, b, werte: werte(art, roh.werte) });
  }
  const draehte: Draht[] = [];
  for (const roh of daten.draehte) {
    if (!istObjekt(roh)) continue;
    const a = punkt(roh.a), b = punkt(roh.b);
    if (a && b) draehte.push({ id: `d${++n}`, a, b });
  }
  return { baukasten: editor.normalisiere({ version: 1, medium, bauteile, draehte }) };
}

export const alsDatei = (bk: Baukasten) => JSON.stringify({ format: DATEI_FORMAT, ...bk }, null, 2);

/** Kompakt: m = Medium, t = [art, ax, ay, bx, by, werte?], d = [ax, ay, bx, by]. */
export function kompakt(bk: Baukasten) {
  return {
    v: 1, m: bk.medium,
    t: bk.bauteile.map(b => {
      const z: (string | number | Record<string, number>)[] = [b.art, b.a.x, b.a.y, b.b.x, b.b.y];
      if (Object.keys(b.werte).length) z.push(Object.fromEntries(Object.entries(b.werte).map(([k, v]) => [k, Number(v.toPrecision(4))])));
      return z;
    }),
    d: bk.draehte.map(d => [d.a.x, d.a.y, d.b.x, d.b.y]),
  };
}

export function ausKompakt(k: unknown): Ergebnis {
  if (!istObjekt(k) || !Array.isArray(k.t) || !Array.isArray(k.d)) return { fehler: "Keine gültige Vorgabe." };
  const P = (x: unknown, y: unknown) => ({ x, y });
  return liesBaukasten({
    version: 1, medium: k.m,
    bauteile: k.t.map(z => (Array.isArray(z) ? { art: z[0], a: P(z[1], z[2]), b: P(z[3], z[4]), werte: z[5] } : null)),
    draehte: k.d.map(z => (Array.isArray(z) ? { a: P(z[0], z[1]), b: P(z[2], z[3]) } : null)),
  });
}

export interface Vorgabe { baukasten: Baukasten; aufgabe: string }
export const AUFGABE_MAX = 600;

export const alsVorgabe = (bk: Baukasten, aufgabe: string) => ({ baukasten: kompakt(bk), aufgabe: aufgabe.trim().slice(0, AUFGABE_MAX) });

export function vorgabeAus(settings: unknown): Vorgabe | null {
  if (!istObjekt(settings) || !settings.baukasten) return null;
  const r = ausKompakt(settings.baukasten);
  if (!("baukasten" in r)) return null;
  return { baukasten: r.baukasten, aufgabe: typeof settings.aufgabe === "string" ? settings.aufgabe.slice(0, AUFGABE_MAX) : "" };
}
