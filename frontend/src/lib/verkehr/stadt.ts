/**
 * Die Stadt der Verkehrs-Simulation: die OSM-Karte aus `karte.json`, aufbereitet
 * für Abfragen (»worauf stehe ich?«, »stoße ich an ein Haus?«).
 *
 * Koordinaten in Metern um die Schule, x nach Osten, y nach Süden.
 */
import roh from "./karte.json";
import { abstandZuStrecke, boxVon, imVieleck, naechsterRandpunkt, Raster, type P } from "./geometrie";

export type StrassenArt = "secondary" | "tertiary" | "residential" | "unclassified" | "living_street" | "service" | "primary";
export type WegArt = "geh" | "rad" | "geh_rad" | "treppe" | "feldweg" | "querung";
export type PunktArt =
  | "ampel" | "ampelUebergang" | "zebra" | "querung" | "bushalt" | "tramhalt" | "bahnhalt"
  | "bahnuebergang" | "stopp" | "vorfahrtAchten" | "baum" | "laterne" | "ort";

export type KartenStrasse = {
  art: StrassenArt; linie: P[]; name?: string; spuren?: number; einbahn?: boolean;
  gehweg?: string; radstreifen?: boolean; tempo?: number;
};
export type KartenPunkt = { art: PunktArt; p: P; name?: string; shop?: string; amenity?: string };
export type Karte = {
  nachweis: string; stand: string; mitte: { lat: number; lon: number }; radius: number;
  strassen: KartenStrasse[];
  wege: { art: WegArt; linie: P[] }[];
  gleise: { art: "tram" | "bahn"; linie: P[] }[];
  gebaeude: { umriss: P[]; name?: string; art?: string; etagen?: number }[];
  flaechen: { art: string; umriss: P[] }[];
  punkte: KartenPunkt[];
  /** Bus- und Tramlinien aus OSM, je Richtung die Haltestellen in Fahrtreihenfolge. */
  linien?: Linie[];
};

export type Linie = {
  art: "bus" | "tram"; nr: string; betreiber: string;
  richtungen: { ziel: string; halte: string[] }[];
};

export const KARTE = roh as unknown as Karte;

export type Strasse = KartenStrasse & { breite: number; gehwegBreite: number };

/** Fahrbahnbreite in Metern — aus den Spuren, sonst eine übliche Breite je Straßenart. */
export function fahrbahnBreite(s: KartenStrasse): number {
  if (s.spuren) return s.spuren * 3.25;
  switch (s.art) {
    case "primary": return 7.5;
    case "secondary": return 7;
    case "tertiary": return 6.5;
    case "residential": case "unclassified": return 5.5;
    case "living_street": return 4.5;
    default: return s.einbahn ? 3 : 4;
  }
}

/** Innerorts haben Wohn- und Durchgangsstraßen Gehwege, Zufahrten und Spielstraßen nicht. */
export function gehwegBreite(s: KartenStrasse): number {
  if (s.gehweg === "no" || s.gehweg === "none" || s.gehweg === "separate") return 0;
  if (s.art === "service" || s.art === "living_street") return 0;
  return 2.5;
}

export type Untergrund =
  | { art: "haus" }
  | { art: "fahrbahn"; strasse: Strasse; querung?: KartenPunkt }
  | { art: "gleis"; gleis: "tram" | "bahn" }
  | { art: "radweg" }
  | { art: "gehweg" }
  | { art: "bahnsteig" }
  | { art: "gelaende" };

export type Halt = { art: "bushalt" | "tramhalt" | "bahnhalt"; name: string; p: P; winkel: number; fiktiv?: boolean };

type Stueck = { a: P; b: P; halb: number };
type Haus = { umriss: P[]; name?: string };

/** Wie weit um einen Übergangspunkt die Fahrbahn als Übergang zählt (Meter längs der Straße). */
const QUERUNG_HALB = 2.5;

export class Stadt {
  readonly strassen: Strasse[];
  readonly halte: Halt[];
  readonly bahnsteige: P[][];
  /** Wartefläche an jeder Bushaltestelle — auch dort, wo die Karte keinen Gehweg an der Straße hat. */
  readonly wartebereiche: P[][];
  private strassenRaster = new Raster<{ s: Strasse; st: Stueck }>(20);
  private wegRaster = new Raster<{ art: WegArt; st: Stueck }>(20);
  private gleisRaster = new Raster<{ art: "tram" | "bahn"; st: Stueck }>(20);
  private hausRaster = new Raster<Haus>(20);
  private querungRaster = new Raster<KartenPunkt>(20);
  private bahnsteigRaster = new Raster<P[]>(20);
  private warteRaster = new Raster<P[]>(20);

  constructor(readonly karte: Karte = KARTE) {
    this.strassen = karte.strassen.map((s) => ({ ...s, breite: fahrbahnBreite(s), gehwegBreite: gehwegBreite(s) }));
    for (const s of this.strassen) this.einsortieren(s.linie, s.breite / 2 + s.gehwegBreite, (st) => this.strassenRaster.fuege({ s, st }, boxVon([st.a, st.b]), st.halb));
    for (const w of karte.wege) this.einsortieren(w.linie, w.art === "rad" || w.art === "geh_rad" ? 1.25 : 1, (st) => this.wegRaster.fuege({ art: w.art, st }, boxVon([st.a, st.b]), st.halb));
    for (const g of karte.gleise) this.einsortieren(g.linie, 1.5, (st) => this.gleisRaster.fuege({ art: g.art, st }, boxVon([st.a, st.b]), st.halb));
    for (const h of karte.gebaeude) if (h.umriss.length >= 3) this.hausRaster.fuege(h, boxVon(h.umriss));
    for (const p of karte.punkte)
      if (p.art === "zebra" || p.art === "ampelUebergang" || p.art === "querung") this.querungRaster.fuege(p, boxVon([p.p]), 12);

    this.halte = this.baueHalte();
    this.bahnsteige = [
      ...karte.flaechen.filter((f) => f.art === "bahnsteig").map((f) => f.umriss),
      ...this.halte.filter((h) => h.fiktiv).map((h) => bahnsteigUm(h)),
    ];
    for (const b of this.bahnsteige) this.bahnsteigRaster.fuege(b, boxVon(b));
    this.wartebereiche = this.halte.filter((h) => h.art === "bushalt").flatMap((h) => {
      const w = this.warteflaeche(h);
      return w ? [w] : [];
    });
    for (const w of this.wartebereiche) this.warteRaster.fuege(w, boxVon(w));
  }

  /** `halb` im Stück ist die Halbbreite, bis zu der ein Treffer zählt. */
  private einsortieren(linie: P[], halb: number, fuege: (st: Stueck) => void) {
    for (let i = 0; i + 1 < linie.length; i++) fuege({ a: linie[i], b: linie[i + 1], halb });
  }

  /** Bushalte aus der Karte (samt Richtung der nächsten Straße) plus je ein ausgedachter Tram- und Bahnhalt auf echten Gleisen. */
  private baueHalte(): Halt[] {
    const halte: Halt[] = [];
    for (const p of this.karte.punkte) {
      if (p.art !== "bushalt" && p.art !== "tramhalt" && p.art !== "bahnhalt") continue;
      const naechste = this.naechsteStrasse(p.p[0], p.p[1], 30);
      halte.push({ art: p.art, name: p.name ?? "Haltestelle", p: p.p, winkel: naechste ? winkelVon(naechste.st) : 0 });
    }
    // Im 750-m-Kreis gibt es keinen echten Tram- oder Bahnhalt — die Gleise
    // sind echt, die zwei Halte darauf ausgedacht (und so beschriftet).
    const erstesGleis = (art: "tram" | "bahn", nahe: P): Halt | null => {
      let best: { st: Stueck; d: number } | null = null;
      for (const g of this.karte.gleise.filter((g) => g.art === art))
        for (let i = 0; i + 1 < g.linie.length; i++) {
          const st = { a: g.linie[i], b: g.linie[i + 1], halb: 0 };
          const { d } = abstandZuStrecke(nahe[0], nahe[1], st.a, st.b);
          if (!best || d < best.d) best = { st, d };
        }
      if (!best) return null;
      const { a, b } = best.st;
      return {
        art: art === "tram" ? "tramhalt" : "bahnhalt",
        name: art === "tram" ? "Straßenbahn-Halt (fiktiv)" : "Bahn-Haltepunkt (fiktiv)",
        p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], winkel: winkelVon(best.st), fiktiv: true,
      };
    };
    if (!halte.some((h) => h.art === "tramhalt")) { const h = erstesGleis("tram", [-713, 230]); if (h) halte.push(h); }
    if (!halte.some((h) => h.art === "bahnhalt")) { const h = erstesGleis("bahn", [561, -283]); if (h) halte.push(h); }
    return halte;
  }

  /** 16 m lange, 2,5 m tiefe Fläche an der Bordsteinkante, auf der Seite der Haltestelle. */
  private warteflaeche(h: Halt): P[] | null {
    const n = this.naechsteStrasse(h.p[0], h.p[1], 30);
    if (!n) return null;
    const { a, b } = n.st;
    const w = winkelVon(n.st), c = Math.cos(w), s = Math.sin(w);
    const q0: P = [a[0] + (b[0] - a[0]) * n.t, a[1] + (b[1] - a[1]) * n.t];
    const seite = -(h.p[0] - q0[0]) * s + (h.p[1] - q0[1]) * c >= 0 ? 1 : -1;
    const innen = n.s.breite / 2, aussen = innen + 2.5;
    const punkt = (l: number, q: number): P => [q0[0] + c * l - s * q * seite, q0[1] + s * l + c * q * seite];
    return [punkt(-8, innen), punkt(8, innen), punkt(8, aussen), punkt(-8, aussen)];
  }

  naechsteStrasse(x: number, y: number, maxD = 15): { s: Strasse; st: Stueck; d: number; t: number } | null {
    let best: { s: Strasse; st: Stueck; d: number; t: number } | null = null;
    const g = 20;
    for (let dx = -g; dx <= g; dx += g) for (let dy = -g; dy <= g; dy += g)
      for (const e of this.strassenRaster.bei(x + dx, y + dy)) {
        const { d, t } = abstandZuStrecke(x, y, e.st.a, e.st.b);
        if (d <= maxD && (!best || d < best.d)) best = { ...e, d, t };
      }
    return best;
  }

  imHaus(x: number, y: number): Haus | null {
    for (const h of this.hausRaster.bei(x, y)) if (imVieleck(x, y, h.umriss)) return h;
    return null;
  }

  untergrund(x: number, y: number): Untergrund {
    if (this.imHaus(x, y)) return { art: "haus" };
    for (const b of this.bahnsteigRaster.bei(x, y)) if (imVieleck(x, y, b)) return { art: "bahnsteig" };
    for (const e of this.gleisRaster.bei(x, y))
      if (abstandZuStrecke(x, y, e.st.a, e.st.b).d <= 1.5) return { art: "gleis", gleis: e.art };
    // Fahrbahn: die breiteste Straße, auf der der Punkt liegt.
    let fahrbahn: Strasse | null = null;
    for (const e of this.strassenRaster.bei(x, y))
      if (abstandZuStrecke(x, y, e.st.a, e.st.b).d <= e.s.breite / 2 && (!fahrbahn || e.s.breite > fahrbahn.breite)) fahrbahn = e.s;
    if (fahrbahn) {
      let querung: KartenPunkt | undefined;
      for (const q of this.querungRaster.bei(x, y)) {
        // Ein Übergang ist ein Streifen quer über die Straße: nah am Punkt längs
        // der Fahrbahn, egal wie weit quer.
        if (Math.hypot(q.p[0] - x, q.p[1] - y) <= fahrbahn.breite / 2 + QUERUNG_HALB) { querung = q; break; }
      }
      return { art: "fahrbahn", strasse: fahrbahn, querung };
    }
    for (const w of this.warteRaster.bei(x, y)) if (imVieleck(x, y, w)) return { art: "gehweg" };
    for (const e of this.wegRaster.bei(x, y))
      if (abstandZuStrecke(x, y, e.st.a, e.st.b).d <= e.st.halb) return e.art === "rad" ? { art: "radweg" } : { art: "gehweg" };
    for (const e of this.strassenRaster.bei(x, y))
      if (e.s.gehwegBreite > 0 && abstandZuStrecke(x, y, e.st.a, e.st.b).d <= e.st.halb) return { art: "gehweg" };
    return { art: "gelaende" };
  }

  /** Schiebt einen Kreis mit Radius `r` aus allen Häusern heraus. */
  ausHaeusern(x: number, y: number, r: number): P {
    let px = x, py = y;
    for (let runde = 0; runde < 3; runde++) {
      let bewegt = false;
      for (const h of this.hausRaster.bei(px, py)) {
        const drin = imVieleck(px, py, h.umriss);
        const { p, d } = naechsterRandpunkt(px, py, h.umriss);
        if (!drin && d >= r) continue;
        const nx = (px - p[0]) / (d || 1), ny = (py - p[1]) / (d || 1);
        const richtung = drin ? -1 : 1;
        px = p[0] + nx * richtung * r;
        py = p[1] + ny * richtung * r;
        bewegt = true;
      }
      if (!bewegt) break;
    }
    return [px, py];
  }
}

export function winkelVon(st: { a: P; b: P }) {
  return Math.atan2(st.b[1] - st.a[1], st.b[0] - st.a[0]);
}

/** Abstand der Bahnsteigkante von der Gleismitte. */
export const BAHNSTEIG_AB = 2.2;

/** Ein 40 m (Bahn: 60 m) langer, 3 m breiter Bahnsteig neben dem Gleis. */
export function bahnsteigUm(h: Halt): P[] {
  const c = Math.cos(h.winkel), s = Math.sin(h.winkel);
  const laenge = h.art === "bahnhalt" ? 30 : 20, ab = BAHNSTEIG_AB, breit = 3;
  const punkt = (l: number, q: number): P => [h.p[0] + c * l - s * q, h.p[1] + s * l + c * q];
  return [punkt(-laenge, ab), punkt(laenge, ab), punkt(laenge, ab + breit), punkt(-laenge, ab + breit)];
}

let _stadt: Stadt | null = null;
export function stadt(): Stadt {
  return (_stadt ??= new Stadt());
}

/** Der nächste Gehweg-Punkt an der Schule — dort beginnt jeder. */
export function startpunkt(s: Stadt, nahe: P = [0, 0]): P {
  for (let r = 0; r <= 200; r += 2)
    for (let i = 0; i < Math.max(1, r * 2); i++) {
      const w = (i / Math.max(1, r * 2)) * Math.PI * 2;
      const x = nahe[0] + Math.cos(w) * r, y = nahe[1] + Math.sin(w) * r;
      if (s.untergrund(x, y).art === "gehweg") return [x, y];
    }
  return nahe;
}

/** Die Schule (Eugen-Richter-Straße 22): Mitte der Schulgebäude um den Kartenmittelpunkt. */
export function schulMitte(s: Stadt): P {
  const teile = s.karte.gebaeude.filter((g) => g.art === "school" && Math.hypot(g.umriss[0][0], g.umriss[0][1]) < 120);
  if (!teile.length) return [0, 0];
  const pk = teile.flatMap((g) => g.umriss);
  return [pk.reduce((a, p) => a + p[0], 0) / pk.length, pk.reduce((a, p) => a + p[1], 0) / pk.length];
}

/**
 * Start vor der Schule: auf dem Gehweg der Eugen-Richter-Straße, an der
 * Stelle, die der Schule am nächsten ist, auf der Schulseite.
 */
export function schulStart(s: Stadt): P {
  const [mx, my] = schulMitte(s);
  let best: { p: P; d: number; halb: number } | null = null;
  for (const st of s.strassen) {
    if (st.name !== "Eugen-Richter-Straße") continue;
    for (let i = 0; i + 1 < st.linie.length; i++) {
      const a = st.linie[i], b = st.linie[i + 1];
      const { d, t } = abstandZuStrecke(mx, my, a, b);
      if (!best || d < best.d) best = { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d, halb: st.breite / 2 };
    }
  }
  if (!best) return startpunkt(s, [mx, my]);
  const [px, py] = best.p;
  const f = (best.halb + 1.3) / (Math.hypot(mx - px, my - py) || 1);
  const ziel: P = [px + (mx - px) * f, py + (my - py) * f];
  return s.untergrund(ziel[0], ziel[1]).art === "gehweg" ? ziel : startpunkt(s, ziel);
}
