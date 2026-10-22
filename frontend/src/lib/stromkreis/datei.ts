/**
 * Schaltungen als Datei und als Sitzungsvorgabe.
 *
 * Alles, was von außen kommt (hochgeladene Datei, Vorgabe der Lehrkraft), geht
 * durch `liesSchaltung`: unbekannte Bauteile und Werte fallen weg, Zahlen werden
 * auf ihren Bereich begrenzt, doppelte Ids neu vergeben. Was danach übrig ist,
 * kann der Löser sicher rechnen.
 *
 * Die Sitzungsvorgabe ist öffentlich lesbar und auf wenige Kilobyte begrenzt,
 * darum gibt es dafür eine kompakte Form ohne Ids und Feldnamen.
 */
import type { Bauteil, BauteilArt, Draht, Punkt, Schaltung } from "./modell";
import { normalisiere } from "./editor";
import { TEILE } from "./teile";

export const DATEI_FORMAT = "tt-stromkreis";
const MAX_BAUTEILE = 300, MAX_DRAEHTE = 800, MAX_KOORD = 5000;

export type Ergebnis = { schaltung: Schaltung } | { fehler: string };

const istObjekt = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

function punkt(x: unknown): Punkt | null {
  if (!istObjekt(x)) return null;
  const px = x.x, py = x.y;
  if (typeof px !== "number" || typeof py !== "number" || !Number.isFinite(px) || !Number.isFinite(py)) return null;
  const p = { x: Math.round(px), y: Math.round(py) };
  return Math.abs(p.x) <= MAX_KOORD && Math.abs(p.y) <= MAX_KOORD ? p : null;
}

/** Nur bekannte Werte, begrenzt auf den Bereich ihres Eingabefelds. */
function werte(art: BauteilArt, x: unknown): Record<string, number> {
  const aus: Record<string, number> = {};
  if (!istObjekt(x)) return aus;
  const info = TEILE[art];
  for (const k of Object.keys(info.werte)) {
    const v = x[k];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const feld = info.felder?.find(f => f.schluessel === k);
    // Grenzen stehen in Anzeigeeinheiten (µF, mH), der Wert in SI
    aus[k] = feld ? Math.max(feld.min * feld.faktor, Math.min(feld.max * feld.faktor, v)) : v;
  }
  return aus;
}

export function liesSchaltung(daten: unknown): Ergebnis {
  if (!istObjekt(daten)) return { fehler: "Das ist keine Schaltung (kein JSON-Objekt)." };
  if (daten.version !== undefined && daten.version !== 1) return { fehler: `Unbekannte Version ${String(daten.version)}.` };
  if (!Array.isArray(daten.bauteile) || !Array.isArray(daten.draehte)) return { fehler: "Es fehlen »bauteile« oder »draehte«." };
  if (daten.bauteile.length > MAX_BAUTEILE || daten.draehte.length > MAX_DRAEHTE) return { fehler: "Die Schaltung ist zu groß." };

  const ids = new Set<string>();
  const id = (wunsch: unknown, praefix: string) => {
    let k = typeof wunsch === "string" && /^[\w-]{1,40}$/.test(wunsch) && !ids.has(wunsch) ? wunsch : "";
    for (let n = ids.size + 1; !k; n++) if (!ids.has(`${praefix}${n}`)) k = `${praefix}${n}`;
    ids.add(k);
    return k;
  };

  const bauteile: Bauteil[] = [];
  for (const roh of daten.bauteile) {
    if (!istObjekt(roh) || typeof roh.art !== "string" || !(roh.art in TEILE)) continue;
    const art = roh.art as BauteilArt;
    const a = punkt(roh.a), b = punkt(roh.b);
    if (!a || !b || (a.x === b.x && a.y === b.y)) continue;
    // Umschalter und Trafo liegen immer waagerecht oder senkrecht
    if ((art === "umschalter" || art === "trafo") && a.x !== b.x && a.y !== b.y) continue;
    bauteile.push({ id: id(roh.id, "b"), art, a, b, werte: werte(art, roh.werte) });
  }
  const draehte: Draht[] = [];
  for (const roh of daten.draehte) {
    if (!istObjekt(roh)) continue;
    const a = punkt(roh.a), b = punkt(roh.b);
    if (!a || !b) continue;
    draehte.push({ id: id(roh.id, "d"), a, b });
  }
  return { schaltung: normalisiere({ version: 1, bauteile, draehte }) };
}

/** Für die Datei: lesbar, mit Kennung. */
export function alsDatei(s: Schaltung): string {
  return JSON.stringify({ format: DATEI_FORMAT, ...s }, null, 2);
}

/** Kompakte Form für die Sitzungsvorgabe: [art, ax, ay, bx, by, werte?] und [ax, ay, bx, by]. */
export interface Kompakt {
  v: 1;
  t: (string | number | Record<string, number>)[][];
  d: number[][];
}

export function kompakt(s: Schaltung): Kompakt {
  return {
    v: 1,
    t: s.bauteile.map(b => {
      const z: (string | number | Record<string, number>)[] = [b.art, b.a.x, b.a.y, b.b.x, b.b.y];
      if (Object.keys(b.werte).length) z.push(b.werte);
      return z;
    }),
    d: s.draehte.map(d => [d.a.x, d.a.y, d.b.x, d.b.y]),
  };
}

export function ausKompakt(k: unknown): Ergebnis {
  if (!istObjekt(k) || !Array.isArray(k.t) || !Array.isArray(k.d)) return { fehler: "Keine gültige Vorgabe." };
  const P = (x: unknown, y: unknown) => ({ x, y });
  return liesSchaltung({
    version: 1,
    bauteile: k.t.map(z => (Array.isArray(z) ? { art: z[0], a: P(z[1], z[2]), b: P(z[3], z[4]), werte: z[5] } : null)),
    draehte: k.d.map(z => (Array.isArray(z) ? { a: P(z[0], z[1]), b: P(z[2], z[3]) } : null)),
  });
}

/** Was die Lehrkraft der Klasse mitgibt: eine Schaltung und auf Wunsch einen Arbeitsauftrag. */
export interface Vorgabe { schaltung: Schaltung; aufgabe: string }

export const AUFGABE_MAX = 600;

export function alsVorgabe(s: Schaltung, aufgabe: string): Record<string, unknown> {
  return { schaltung: kompakt(s), aufgabe: aufgabe.trim().slice(0, AUFGABE_MAX) };
}

/** Liest die Sitzungseinstellungen; ohne gültige Schaltung gibt es keine Vorgabe. */
export function vorgabeAus(settings: unknown): Vorgabe | null {
  if (!istObjekt(settings) || !settings.schaltung) return null;
  const r = ausKompakt(settings.schaltung);
  if (!("schaltung" in r)) return null;
  const aufgabe = typeof settings.aufgabe === "string" ? settings.aufgabe.slice(0, AUFGABE_MAX) : "";
  return { schaltung: r.schaltung, aufgabe };
}
