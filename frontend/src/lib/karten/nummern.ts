/**
 * Kartensätze: Nummern für ausgewählte Objekte (stumme Karte, Test, Arbeitsblatt).
 *
 * Jede Ebene wählt ein Schema — 1 2 3, a b c, A B C oder I II III. Nutzen zwei
 * Ebenen dasselbe Schema, zählt die zweite weiter (Städte 1–5, Seen 6–8),
 * damit jede Marke auf der Karte eindeutig bleibt.
 */
import type { Geometry, Position } from "geojson";

export type Nummerierung = "keine" | "zahl" | "klein" | "gross" | "roemisch";

export type EbenenAuswahl = {
  zeigen: "alle" | "auswahl";
  objekte: string[];
  nummerierung: Nummerierung;
};

export const NUMMERIERUNGEN: { id: Nummerierung; name: string }[] = [
  { id: "keine", name: "keine" },
  { id: "zahl", name: "1, 2, 3" },
  { id: "klein", name: "a, b, c" },
  { id: "gross", name: "A, B, C" },
  { id: "roemisch", name: "I, II, III" },
];

const ROEMISCH: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** Buchstaben wie Tabellenspalten: a … z, aa, ab … */
function buchstaben(n: number): string {
  let s = "";
  for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(97 + ((k - 1) % 26)) + s;
  return s;
}

/** Die n-te Marke (ab 1) im Schema. */
export function marke(schema: Nummerierung, n: number): string {
  switch (schema) {
    case "zahl": return String(n);
    case "klein": return buchstaben(n);
    case "gross": return buchstaben(n).toUpperCase();
    case "roemisch": {
      let rest = n, s = "";
      for (const [wert, zeichen] of ROEMISCH) while (rest >= wert) { s += zeichen; rest -= wert; }
      return s;
    }
    default: return "";
  }
}

/** ebene → (objekt-id → Marke), in der Reihenfolge der Ebenen (Katalog) und der Auswahl. */
export function vergibNummern(auswahl: Record<string, EbenenAuswahl>, reihenfolge: string[]): Record<string, Record<string, string>> {
  const zaehler: Partial<Record<Nummerierung, number>> = {};
  const ergebnis: Record<string, Record<string, string>> = {};
  for (const ebene of reihenfolge) {
    const wahl = auswahl[ebene];
    if (!wahl || wahl.nummerierung === "keine" || !wahl.objekte.length) continue;
    ergebnis[ebene] = {};
    for (const id of wahl.objekte) {
      const n = (zaehler[wahl.nummerierung] ?? 0) + 1;
      zaehler[wahl.nummerierung] = n;
      ergebnis[ebene][id] = marke(wahl.nummerierung, n);
    }
  }
  return ergebnis;
}

// ── Wo die Marke hinkommt ────────────────────────────────────────────

/** Ray casting; Ring als [lon, lat][] */
function imRing([x, y]: Position, ring: Position[]): boolean {
  let drin = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

const imPolygon = (p: Position, poly: Position[][]) => imRing(p, poly[0]) && !poly.slice(1).some((loch) => imRing(p, loch));

function flaeche(ring: Position[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

/** Abstand eines Punkts zum Rand (in Grad, grob — reicht zum Vergleichen) */
function randAbstand(p: Position, poly: Position[][]): number {
  let min = Infinity;
  for (const ring of poly) for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1], [bx, by] = ring[i];
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l)) : 0;
    min = Math.min(min, Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy)));
  }
  return min;
}

/**
 * Marken, die fast aufeinander liegen (Berlin: Stadt und Land), auseinanderrücken.
 * Der Versatz ist in Bildschirm-Pixeln, damit er bei jedem Zoom gleich groß wirkt.
 * Marken von Punkt-Ebenen (vorrang) bleiben auf ihrem Punkt, die anderen weichen
 * im Kreis aus. `naehe` in Grad (Breite); Länge wird mit cos(Breite) gestaucht.
 */
export function spreizen(punkte: { p: Position; vorrang: boolean }[], naehe = 0.35, abstand = 22): [number, number][] {
  const versatz: [number, number][] = punkte.map(() => [0, 0]);
  const reihe = punkte.map((_, i) => i).sort((a, b) => Number(punkte[b].vorrang) - Number(punkte[a].vorrang));
  const kopf: number[] = []; // je Gruppe die Marke, die stehen bleibt
  const belegt = new Map<number, number>(); // Kopf → wie viele schon ausweichen
  for (const i of reihe) {
    const [x, y] = punkte[i].p;
    const k = kopf.find((j) => {
      const [kx, ky] = punkte[j].p;
      return Math.hypot((x - kx) * Math.cos((y * Math.PI) / 180), y - ky) < naehe;
    });
    if (k === undefined) { kopf.push(i); continue; }
    const n = belegt.get(k) ?? 0;
    belegt.set(k, n + 1);
    const winkel = (-45 + n * 72) * (Math.PI / 180); // erst rechts oben, dann im Uhrzeigersinn
    versatz[i] = [Math.round(Math.cos(winkel) * abstand), Math.round(Math.sin(winkel) * abstand)];
  }
  return versatz;
}

/**
 * Ein Punkt für die Marke: Punkte bleiben, wo sie sind. Linien (Flüsse sind
 * MultiLineStrings aus vielen Stücken) bekommen ihren Stützpunkt, der der
 * Mitte am nächsten liegt — er liegt sicher auf dem Fluss. Flächen bekommen
 * den Punkt im größten Teil, der am weitesten vom Rand entfernt ist (Raster-Suche).
 */
export function ankerpunkt(g: Geometry): Position | null {
  switch (g.type) {
    case "Point": return g.coordinates;
    case "LineString":
    case "MultiLineString": {
      const punkte = g.type === "LineString" ? g.coordinates : g.coordinates.flat();
      if (!punkte.length) return null;
      const mx = punkte.reduce((s, p) => s + p[0], 0) / punkte.length;
      const my = punkte.reduce((s, p) => s + p[1], 0) / punkte.length;
      return punkte.reduce((best, p) => (Math.hypot(p[0] - mx, p[1] - my) < Math.hypot(best[0] - mx, best[1] - my) ? p : best));
    }
    case "Polygon":
    case "MultiPolygon": {
      const teile = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      const poly = teile.reduce((a, b) => (flaeche(b[0]) > flaeche(a[0]) ? b : a));
      const xs = poly[0].map((p) => p[0]), ys = poly[0].map((p) => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      let best: Position = poly[0][0], bestAbstand = -1;
      const N = 24;
      for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
        const p = [x0 + ((x1 - x0) * i) / N, y0 + ((y1 - y0) * j) / N];
        if (!imPolygon(p, poly)) continue;
        const d = randAbstand(p, poly);
        if (d > bestAbstand) { bestAbstand = d; best = p; }
      }
      return best;
    }
    default: return null;
  }
}
