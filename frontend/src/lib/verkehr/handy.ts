/**
 * Das Handy der Figur (»Handy Sim«): eine Karten-App mit Suche (Adressen,
 * Straßen, Läden, Haltestellen, Schule) und dem kürzesten Fußweg über
 * Straßen und Wege. Kein Pixi — die Bühne malt die Route, die Hülle das Handy.
 */
import type { P } from "./geometrie";
import { schulStart, type Stadt } from "./stadt";
import { stadtRaster } from "./wegsuche";

export type Ziel = { name: string; art: "adresse" | "strasse" | "ort" | "halt" | "schule"; p: P; icon: string };

const norm = (s: string) => s.toLowerCase()
  .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/str\.?(\s|$)/g, "strasse$1").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Alles, was man suchen kann, einmal je Stadt. */
export function suchIndex(stadt: Stadt): Ziel[] {
  const aus: Ziel[] = [];
  const gesehen = new Set<string>();
  const dazu = (z: Ziel) => { const k = `${z.art}|${z.name}`; if (!gesehen.has(k)) { gesehen.add(k); aus.push(z); } };
  dazu({ name: "Eugen-Richter-Straße 22 (Schule)", art: "schule", p: schulStart(stadt), icon: "🏫" });
  for (const g of stadt.karte.gebaeude) if (g.adresse && g.umriss.length)
    dazu({ name: g.adresse, art: "adresse", p: mitte(g.umriss), icon: "🏠" });
  for (const p of stadt.karte.punkte) {
    if (p.art === "adresse" && p.name) dazu({ name: p.name, art: "adresse", p: p.p, icon: "🏠" });
    else if (p.art === "ort" && p.name) dazu({ name: p.name, art: "ort", p: p.p, icon: p.shop === "supermarket" ? "🛒" : p.amenity ? "🍽️" : "🏪" });
  }
  for (const h of stadt.halte) dazu({ name: `${h.name} (${h.art === "tramhalt" ? "Tram" : h.art === "bahnhalt" ? "Bahn" : "Bus"})`, art: "halt", p: h.p, icon: "🚏" });
  // Straßen: die Mitte des längsten Stücks
  const laengstes = new Map<string, { l: number; p: P }>();
  for (const s of stadt.strassen) {
    if (!s.name) continue;
    for (let i = 0; i + 1 < s.linie.length; i++) {
      const a = s.linie[i], b = s.linie[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > (laengstes.get(s.name)?.l ?? 0)) laengstes.set(s.name, { l, p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] });
    }
  }
  for (const [name, { p }] of laengstes) dazu({ name, art: "strasse", p, icon: "🛣️" });
  return aus;
}

function mitte(u: P[]): P {
  return [u.reduce((s, p) => s + p[0], 0) / u.length, u.reduce((s, p) => s + p[1], 0) / u.length];
}

/** Suchen: jedes Wort muss vorkommen; Treffer am Anfang und Hausnummern genau zählen mehr. */
export function suche(index: Ziel[], text: string, anzahl = 8): Ziel[] {
  const q = norm(text);
  if (!q) return [];
  const woerter = q.split(" ");
  const treffer: { z: Ziel; w: number }[] = [];
  for (const z of index) {
    const n = norm(z.name);
    if (!woerter.every((w) => n.includes(w))) continue;
    let w = 0;
    if (n.startsWith(woerter[0])) w += 3;
    if (n === q) w += 5;
    // »Straße 12« soll 12 finden, nicht 120
    const zahl = woerter.find((x) => /^\d+[a-z]?$/.test(x));
    if (zahl && new RegExp(`\\b${zahl}\\b`).test(n)) w += 4;
    w -= n.length / 100;
    if (z.art === "schule") w += 1;
    // Ohne Hausnummer gesucht: erst Straßen, Haltestellen und Orte, dann die Hausnummern
    if (!zahl && z.art === "adresse") w -= 2;
    treffer.push({ z, w });
  }
  return treffer.sort((a, b) => b.w - a.w).slice(0, anzahl).map((t) => t.z);
}

/**
 * Fußwege: ein Netz aus Straßen (die Gehwege laufen daneben) und Wegen.
 * Knoten sind die Punkte der Linien; lose Enden werden an den nächsten Punkt
 * in der Nähe angeschlossen (Wege treffen Straßen selten genau).
 */
export class Wegenetz {
  readonly knoten: P[] = [];
  private nachbarn: { k: number; l: number }[][] = [];
  private index = new Map<string, number>();

  constructor(stadt: Stadt) {
    const linien: P[][] = [...stadt.strassen.map((s) => s.linie), ...stadt.karte.wege.map((w) => w.linie)];
    const knoten = (p: P) => {
      const key = `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;
      let i = this.index.get(key);
      if (i === undefined) { i = this.knoten.length; this.knoten.push(p); this.nachbarn.push([]); this.index.set(key, i); }
      return i;
    };
    const enden = new Set<number>();
    for (const l of linien) {
      for (let i = 0; i + 1 < l.length; i++) this.verbinde(knoten(l[i]), knoten(l[i + 1]));
      if (l.length) { enden.add(knoten(l[0])); enden.add(knoten(l[l.length - 1])); }
    }
    // Lose Enden an den nächsten fremden Punkt binden (bis 12 m)
    for (const e of enden) {
      if (this.nachbarn[e].length > 1) continue;
      let best = -1, bd = 12;
      for (let j = 0; j < this.knoten.length; j++) {
        if (j === e || this.nachbarn[e].some((n) => n.k === j)) continue;
        const d = Math.hypot(this.knoten[j][0] - this.knoten[e][0], this.knoten[j][1] - this.knoten[e][1]);
        if (d < bd) { bd = d; best = j; }
      }
      if (best >= 0) this.verbinde(e, best);
    }
  }

  private verbinde(a: number, b: number) {
    if (a === b) return;
    const l = Math.hypot(this.knoten[a][0] - this.knoten[b][0], this.knoten[a][1] - this.knoten[b][1]);
    this.nachbarn[a].push({ k: b, l });
    this.nachbarn[b].push({ k: a, l });
  }

  naechster(p: P): number {
    let best = 0, bd = Infinity;
    this.knoten.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  /** Kürzester Weg von a nach b (Dijkstra), mit a und b an den Enden. */
  route(a: P, b: P): { punkte: P[]; laenge: number } | null {
    const von = this.naechster(a), nach = this.naechster(b);
    const dist = new Float64Array(this.knoten.length).fill(Infinity);
    const vor = new Int32Array(this.knoten.length).fill(-1);
    const fertig = new Uint8Array(this.knoten.length);
    dist[von] = 0;
    // Einfacher Haufen über ein sortiertes Feld reicht für ein paar tausend Knoten
    const offen: number[] = [von];
    while (offen.length) {
      let bi = 0;
      for (let i = 1; i < offen.length; i++) if (dist[offen[i]] < dist[offen[bi]]) bi = i;
      const u = offen[bi];
      offen[bi] = offen[offen.length - 1]; offen.pop();
      if (fertig[u]) continue;
      fertig[u] = 1;
      if (u === nach) break;
      for (const { k, l } of this.nachbarn[u]) {
        if (dist[u] + l < dist[k]) { dist[k] = dist[u] + l; vor[k] = u; offen.push(k); }
      }
    }
    if (!Number.isFinite(dist[nach])) return null;
    const punkte: P[] = [b];
    for (let k = nach; k !== -1; k = vor[k]) punkte.push(this.knoten[k]);
    punkte.push(a);
    punkte.reverse();
    return { punkte, laenge: dist[nach] + Math.hypot(a[0] - this.knoten[von][0], a[1] - this.knoten[von][1]) + Math.hypot(b[0] - this.knoten[nach][0], b[1] - this.knoten[nach][1]) };
  }
}

/**
 * Der Fußweg fürs Handy: wie die Figur beim Klicken läuft — über Gehwege,
 * an Überwegen über die Straße, um Häuser herum. Für weite Wege ein gröberes
 * Raster. Klappt das nicht, der Weg über das Straßennetz.
 */
export function fussweg(stadt: Stadt, netz: Wegenetz, a: P, b: P): { punkte: P[]; laenge: number } | null {
  const spanne = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) + 80;
  const zelle = Math.max(0.5, Math.ceil((spanne / 450) * 2) / 2);
  const weg = stadtRaster(stadt, a, b, 40, zelle).suche(a, b);
  if (weg && weg.length) {
    const punkte: P[] = [a, ...weg];
    let laenge = 0;
    for (let i = 1; i < punkte.length; i++) laenge += Math.hypot(punkte[i][0] - punkte[i - 1][0], punkte[i][1] - punkte[i - 1][1]);
    return { punkte, laenge };
  }
  return netz.route(a, b);
}

/** Gehzeit in Minuten (Kinder gehen etwa 1,2 m/s). */
export const gehMinuten = (m: number) => Math.max(1, Math.round(m / 1.2 / 60));

/** So oft darf man sich je Sitzung irgendwohin beamen. */
export const BEAMEN_JE_SITZUNG = 2;
