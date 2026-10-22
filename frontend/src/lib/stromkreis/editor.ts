/**
 * Was man mit einer Schaltung tun kann — ohne Bildschirm, darum testbar.
 *
 * Jede Operation gibt eine neue Schaltung zurück (für Rückgängig) und räumt
 * danach auf: Ein Draht, durch dessen Mitte ein Anschluss läuft, wird dort
 * geteilt. Bei Falstad verbindet nur ein Endpunkt — für Schüler·innen sieht ein
 * Anschluss auf dem Draht aber verbunden aus, also ist er es hier auch.
 *
 * Wer ein Bauteil verschiebt oder dreht, nimmt die angeschlossenen Drähte mit:
 * deren Enden wandern mit den Anschlüssen, die Verbindung bleibt.
 */
import { anschluesse, type Bauteil, type BauteilArt, type Draht, type Punkt, type Schaltung } from "./modell";

export type Auswahl = { art: "bauteil" | "draht"; id: string; ende?: "a" | "b" };

export const LEER: Schaltung = { version: 1, bauteile: [], draehte: [] };

export const gleich = (p: Punkt, q: Punkt) => p.x === q.x && p.y === q.y;
const plus = (p: Punkt, dx: number, dy: number): Punkt => ({ x: p.x + dx, y: p.y + dy });

export function neueId(s: Schaltung, praefix: string): string {
  const belegt = new Set([...s.bauteile.map(t => t.id), ...s.draehte.map(d => d.id)]);
  let n = 1;
  while (belegt.has(`${praefix}${n}`)) n++;
  return `${praefix}${n}`;
}

/** Liegt p echt zwischen a und b auf der Strecke (Rasterpunkte, also exakt)? */
function liegtInnen(p: Punkt, a: Punkt, b: Punkt): boolean {
  const bx = b.x - a.x, by = b.y - a.y, px = p.x - a.x, py = p.y - a.y;
  if (bx * py - by * px !== 0) return false;
  const skalar = bx * px + by * py;
  return skalar > 0 && skalar < bx * bx + by * by;
}

/** Teilt Drähte an fremden Endpunkten, wirft Drähte der Länge null und Doppelte weg. */
export function normalisiere(s: Schaltung): Schaltung {
  let draehte = s.draehte.filter(d => !gleich(d.a, d.b));
  for (let runde = 0; runde < 1000; runde++) {
    const punkte = [...s.bauteile.flatMap(anschluesse), ...draehte.flatMap(d => [d.a, d.b])];
    let geteilt = false;
    for (let i = 0; i < draehte.length && !geteilt; i++) {
      const d = draehte[i];
      const p = punkte.find(q => liegtInnen(q, d.a, d.b));
      if (!p) continue;
      const id = neueId({ ...s, draehte }, "d");
      draehte = [...draehte.slice(0, i), { ...d, b: p }, { id, a: p, b: d.b }, ...draehte.slice(i + 1)];
      geteilt = true;
    }
    if (!geteilt) break;
  }
  const gesehen = new Set<string>();
  draehte = draehte.filter(d => {
    const k1 = `${d.a.x},${d.a.y}|${d.b.x},${d.b.y}`, k2 = `${d.b.x},${d.b.y}|${d.a.x},${d.a.y}`;
    if (gesehen.has(k1) || gesehen.has(k2)) return false;
    gesehen.add(k1);
    return true;
  });
  return { ...s, draehte };
}

/** Standardlage eines neuen Bauteils: waagerecht, vier Raster lang. */
export function fuegeBauteilHinzu(s: Schaltung, art: BauteilArt, a: Punkt, b?: Punkt): { schaltung: Schaltung; id: string } {
  const ende = b && !gleich(a, b) ? b : plus(a, 4, 0);
  const id = neueId(s, "b");
  const t: Bauteil = { id, art, a, b: ende, werte: {} };
  return { schaltung: normalisiere({ ...s, bauteile: [...s.bauteile, t] }), id };
}

/** Ein Draht; schräg gezogen wird er zum Winkel (erst waagerecht, dann senkrecht). */
export function fuegeDrahtHinzu(s: Schaltung, a: Punkt, b: Punkt): Schaltung {
  if (gleich(a, b)) return s;
  const stuecke: [Punkt, Punkt][] = a.x !== b.x && a.y !== b.y
    ? [[a, { x: b.x, y: a.y }], [{ x: b.x, y: a.y }, b]]
    : [[a, b]];
  let neu = s;
  for (const [p, q] of stuecke) {
    const d: Draht = { id: neueId(neu, "d"), a: p, b: q };
    neu = { ...neu, draehte: [...neu.draehte, d] };
  }
  return normalisiere(neu);
}

/**
 * Zieht Drahtenden von den alten an die neuen Anschlüsse eines Bauteils mit —
 * aber nur, wo kein anderes Bauteil mehr am alten Punkt hängt: sonst würde es
 * abgerissen.
 */
function mitDraehten(s: Schaltung, id: string, alt: Punkt[], neu: Punkt[]): Draht[] {
  const fremde = s.bauteile.filter(t => t.id !== id).flatMap(anschluesse);
  const ziel = (p: Punkt) => {
    const k = alt.findIndex(q => gleich(q, p));
    return k >= 0 && !fremde.some(q => gleich(q, p)) ? neu[k] : p;
  };
  return s.draehte.map(d => ({ ...d, a: ziel(d.a), b: ziel(d.b) }));
}

function ersetzeBauteil(s: Schaltung, alt: Bauteil, neu: Bauteil): Schaltung {
  const draehte = mitDraehten(s, alt.id, anschluesse(alt), anschluesse(neu));
  return normalisiere({ ...s, bauteile: s.bauteile.map(t => (t.id === alt.id ? neu : t)), draehte });
}

export function verschiebe(s: Schaltung, w: Auswahl, dx: number, dy: number): Schaltung {
  if (!dx && !dy) return s;
  if (w.art === "draht") {
    return normalisiere({ ...s, draehte: s.draehte.map(d => (d.id === w.id ? { ...d, a: plus(d.a, dx, dy), b: plus(d.b, dx, dy) } : d)) });
  }
  const t = s.bauteile.find(x => x.id === w.id);
  return t ? ersetzeBauteil(s, t, { ...t, a: plus(t.a, dx, dy), b: plus(t.b, dx, dy) }) : s;
}

/** Zieht ein Ende auf `p`. Umschalter und Trafo bleiben gerade (nur waagerecht/senkrecht). */
export function verschiebeEnde(s: Schaltung, w: Auswahl, ende: "a" | "b", p: Punkt): Schaltung {
  if (w.art === "draht") {
    const d = s.draehte.find(x => x.id === w.id);
    if (!d || gleich(p, ende === "a" ? d.b : d.a)) return s;
    return normalisiere({ ...s, draehte: s.draehte.map(x => (x.id === w.id ? { ...x, [ende]: p } : x)) });
  }
  const t = s.bauteile.find(x => x.id === w.id);
  if (!t) return s;
  const anderes = ende === "a" ? t.b : t.a;
  if (gleich(p, anderes)) return s;
  if ((t.art === "umschalter" || t.art === "trafo") && p.x !== anderes.x && p.y !== anderes.y) return s;
  return ersetzeBauteil(s, t, { ...t, [ende]: p });
}

/** Dreht um 90° im Uhrzeigersinn um `a`. */
export function drehe(s: Schaltung, w: Auswahl): Schaltung {
  const dreh = (a: Punkt, b: Punkt): Punkt => ({ x: a.x - (b.y - a.y), y: a.y + (b.x - a.x) });
  if (w.art === "draht") {
    return normalisiere({ ...s, draehte: s.draehte.map(d => (d.id === w.id ? { ...d, b: dreh(d.a, d.b) } : d)) });
  }
  const t = s.bauteile.find(x => x.id === w.id);
  return t ? ersetzeBauteil(s, t, { ...t, b: dreh(t.a, t.b) }) : s;
}

export function loesche(s: Schaltung, w: Auswahl): Schaltung {
  return w.art === "draht"
    ? { ...s, draehte: s.draehte.filter(d => d.id !== w.id) }
    : normalisiere({ ...s, bauteile: s.bauteile.filter(t => t.id !== w.id) });
}

export function setzeWert(s: Schaltung, id: string, name: string, wert: number): Schaltung {
  return { ...s, bauteile: s.bauteile.map(t => (t.id === id ? { ...t, werte: { ...t.werte, [name]: wert } } : t)) };
}

function abstandZurStrecke(p: { x: number; y: number }, a: Punkt, b: Punkt): number {
  const bx = b.x - a.x, by = b.y - a.y;
  const l2 = bx * bx + by * by;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * bx + (p.y - a.y) * by) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * bx), p.y - (a.y + t * by));
}

/**
 * Was liegt unter dem Zeiger? `p` in Rasterkoordinaten (Kommazahlen).
 * Bauteile gehen vor Drähten; nahe an einem Ende gibt es das Ende mit dazu.
 */
export function treffer(s: Schaltung, p: { x: number; y: number }, toleranz = 0.45): Auswahl | null {
  const ende = (a: Punkt, b: Punkt): "a" | "b" | undefined =>
    Math.hypot(p.x - a.x, p.y - a.y) < toleranz ? "a" : Math.hypot(p.x - b.x, p.y - b.y) < toleranz ? "b" : undefined;

  let bester: { w: Auswahl; d: number } | null = null;
  for (const t of s.bauteile) {
    const pins = anschluesse(t);
    let d = abstandZurStrecke(p, t.a, t.b);
    if (t.art === "trafo") d = Math.min(d, abstandZurStrecke(p, pins[0], pins[1]), abstandZurStrecke(p, pins[2], pins[3]));
    if (t.art === "umschalter") d = Math.min(d, abstandZurStrecke(p, t.a, pins[2]));
    // Der Körper eines Bauteils ist breiter als ein Draht.
    if (d < toleranz + 0.3 && (!bester || d < bester.d)) {
      const e = t.art === "trafo" || t.art === "umschalter" ? undefined : ende(t.a, t.b);
      bester = { w: { art: "bauteil", id: t.id, ...(e ? { ende: e } : {}) }, d };
    }
  }
  if (bester) return bester.w;
  for (const dr of s.draehte) {
    const d = abstandZurStrecke(p, dr.a, dr.b);
    if (d < toleranz && (!bester || d < bester.d)) {
      const e = ende(dr.a, dr.b);
      bester = { w: { art: "draht", id: dr.id, ...(e ? { ende: e } : {}) }, d };
    }
  }
  return bester?.w ?? null;
}
