/**
 * Die Stadt der Verkehrs-Simulation: die OSM-Karte aus `karte.json`, aufbereitet
 * für Abfragen (»worauf stehe ich?«, »stoße ich an ein Haus?«).
 *
 * Koordinaten in Metern um die Schule, x nach Osten, y nach Süden.
 */
import roh from "./karte.json";
import ergaenzung from "./ergaenzungen.json";
import { abstandZuStrecke, boxVon, imVieleck, naechsterRandpunkt, Raster, type P } from "./geometrie";

export type StrassenArt = "secondary" | "tertiary" | "residential" | "unclassified" | "living_street" | "service" | "primary";
/**
 * Wege: rad = Radweg (Zeichen 237), geh_rad = gemeinsamer Geh- und Radweg (240),
 * geh_rad_getrennt = getrennter Geh- und Radweg (241), geh_radfrei = Gehweg mit
 * »Radfahrer frei« (239 + Zusatz, Rad nur im Schritttempo).
 */
export type WegArt = "geh" | "rad" | "geh_rad" | "geh_rad_getrennt" | "geh_radfrei" | "treppe" | "feldweg" | "querung";
/** Blaue Radwegschilder (237, 240, 241): Radfahrer müssen sie benutzen. */
export const RADWEG_PFLICHT: ReadonlySet<WegArt> = new Set(["rad", "geh_rad", "geh_rad_getrennt"]);
export type PunktArt =
  | "ampel" | "ampelUebergang" | "zebra" | "querung" | "bushalt" | "tramhalt" | "bahnhalt"
  | "bahnuebergang" | "stopp" | "vorfahrtAchten" | "baum" | "laterne" | "ort" | "adresse" | "radstaender";

export type KartenStrasse = {
  art: StrassenArt; linie: P[]; name?: string; spuren?: number; einbahn?: boolean;
  /** Spuren in Richtung der Linie / dagegen (OSM lanes:forward/backward). */
  spurenHin?: number; spurenRueck?: number;
  gehweg?: string; radstreifen?: boolean; tempo?: number;
  /** Tore an beiden Enden, offen von–bis (volle Stunden). */
  tore?: { offenVon: number; offenBis: number };
};
export type KartenPunkt = { art: PunktArt; p: P; name?: string; shop?: string; amenity?: string };
export type Karte = {
  nachweis: string; stand: string; mitte: { lat: number; lon: number }; radius: number;
  /** Das Kartengebiet in Metern (seit die Innenstadt dazugehört ein Rechteck). */
  bereich?: { x0: number; x1: number; y0: number; y1: number };
  strassen: KartenStrasse[];
  wege: { art: WegArt; linie: P[] }[];
  gleise: { art: "tram" | "bahn"; linie: P[] }[];
  /** `adresse`: Straße und Hausnummer (für die Suche im Handy). */
  gebaeude: { umriss: P[]; name?: string; art?: string; etagen?: number; adresse?: string }[];
  flaechen: { art: string; umriss: P[] }[];
  punkte: KartenPunkt[];
  /** Bus- und Tramlinien aus OSM, je Richtung die Haltestellen in Fahrtreihenfolge. */
  linien?: Linie[];
};

export type Linie = {
  art: "bus" | "tram"; nr: string; betreiber: string;
  /**
   * `spur`: der echte Fahrweg im Kartenquadrat (abgeschnittene Stücke),
   * `steige`: die Bussteige dieser Richtung in Fahrtreihenfolge.
   */
  richtungen: { ziel: string; halte: string[]; spur?: P[][]; steige?: { name: string; p: P }[] }[];
};

/**
 * Spuren einer Straße in einer Richtung (`hin` = in Richtung der Linie): wie
 * weit jede Spurmitte rechts von der Linie liegt, von innen nach außen. Bei
 * Gegenverkehr liegt die Trennlinie `mitte` rechts der Linie (0, wenn beide
 * Richtungen gleich viele Spuren haben).
 */
export function spurLagen(s: KartenStrasse & { breite: number }, hin: boolean): { lagen: number[]; breite: number; mitte: number } {
  const alle = s.spuren ?? (s.einbahn ? 1 : 2);
  if (s.einbahn) {
    const n = Math.max(1, alle), w = s.breite / n;
    return { lagen: Array.from({ length: n }, (_, i) => -s.breite / 2 + w * (i + 0.5)), breite: w, mitte: -s.breite / 2 };
  }
  const nh = Math.max(1, s.spurenHin ?? (s.spurenRueck ? alle - s.spurenRueck : Math.floor(alle / 2)));
  const nr = Math.max(1, s.spurenRueck ?? alle - nh);
  const w = s.breite / (nh + nr);
  // Trennlinie rechts der Linie, aus Sicht der Hin-Richtung
  const trenn = (nr - nh) * w / 2;
  const [n, mitte] = hin ? [nh, trenn] : [nr, -trenn];
  return { lagen: Array.from({ length: n }, (_, i) => mitte + w * (i + 0.5)), breite: w, mitte };
}

/**
 * Die Karte aus OSM plus das, was dort (noch) fehlt: die Tore der Spielstraße
 * (`ergaenzungen.json`, nach Angaben der Schule). Die Ergänzung liegt
 * getrennt, damit sie ein Neuladen der OSM-Daten übersteht.
 */
export const KARTE: Karte = (() => {
  const k = roh as unknown as Karte;
  const e = ergaenzung as unknown as Pick<Karte, "strassen" | "punkte" | "flaechen"> & {
    tore?: { strasse: string; offenVon: number; offenBis: number }[];
  };
  // Tore an Straßen aus OSM, nach Namen
  const tore = new Map((e.tore ?? []).map((t) => [t.strasse, { offenVon: t.offenVon, offenBis: t.offenBis }]));
  // Ergänzte Straßen nur, solange OSM sie nicht (wieder) unter dem Namen führt
  const dazu = e.strassen.filter((x) => !x.name || !k.strassen.some((s) => s.name === x.name));
  const strassen = [...k.strassen, ...dazu].map((s) => (s.name && tore.has(s.name) ? { ...s, tore: tore.get(s.name) } : s));
  // In OSM zerfällt eine Straße in Stücke (etwa am Überweg), nicht jedes trägt den Namen:
  // namenlose Stücke gleicher Art, die an ein Stück mit Toren anschließen, gehören dazu.
  const gleich = (p: P, q: P) => p[0] === q[0] && p[1] === q[1];
  for (let dazu = true; dazu;) {
    dazu = false;
    strassen.forEach((s, i) => {
      if (s.tore || s.name) return;
      const nachbar = strassen.find((x) => x.tore && x.art === s.art && x.linie.some((q) => gleich(q, s.linie[0]) || gleich(q, s.linie[s.linie.length - 1])));
      if (nachbar) { strassen[i] = { ...s, tore: nachbar.tore }; dazu = true; }
    });
  }
  return { ...k, strassen, punkte: [...k.punkte, ...e.punkte], flaechen: [...k.flaechen, ...e.flaechen] };
})();

export type Strasse = KartenStrasse & { breite: number; gehwegBreite: number };

/** Das Kartengebiet in Metern; ältere Karten hatten nur einen Radius. */
export function bereichVon(k: Karte): { x0: number; x1: number; y0: number; y1: number } {
  return k.bereich ?? { x0: -k.radius, x1: k.radius, y0: -k.radius, y1: k.radius };
}

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
  /** Verkehrsberuhigter Bereich: Autos im Schritttempo, Kinder dürfen hier laufen und spielen. */
  | { art: "spielstrasse"; strasse: Strasse }
  | { art: "gleis"; gleis: "tram" | "bahn" }
  | { art: "radweg" }
  /** `rad`: auf diesem Gehweg dürfen auch Räder fahren — gemeinsam (240), getrennt (241) oder »frei« im Schritttempo. */
  | { art: "gehweg"; rad?: "gemeinsam" | "getrennt" | "frei" }
  | { art: "bahnsteig" }
  | { art: "gelaende" };

export type Halt = { art: "bushalt" | "tramhalt" | "bahnhalt"; name: string; p: P; winkel: number; fiktiv?: boolean };

/** `schule`: Stück einer Zufahrt auf dem Schulgelände — kein Autoverkehr, sicher wie der Schulhof. */
type Stueck = { a: P; b: P; halb: number; schule?: boolean };
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
  /** Schulgelände (amenity=school). Die Zufahrt darauf ist nur eine Einfahrt hinter einem Tor. */
  readonly schulgelaende: P[][];
  /** Tore: wo eine Zufahrt das Schulgelände verlässt. */
  readonly tore: { p: P; winkel: number; zeiten?: { offenVon: number; offenBis: number } }[] = [];
  /** Zufahrtsstücke auf dem Schulgelände (zum Zeichnen als Pflaster). */
  readonly schulZufahrten: { a: P; b: P; breite: number }[] = [];

  constructor(readonly karte: Karte = KARTE) {
    this.strassen = anschliessen(karte.strassen).map((s) => ({ ...s, breite: fahrbahnBreite(s), gehwegBreite: gehwegBreite(s) }));
    this.schulgelaende = karte.flaechen.filter((f) => f.art === "schulhof" && f.umriss.length >= 3).map((f) => f.umriss);
    const aufSchule = (p: P) => this.schulgelaende.some((u) => imVieleck(p[0], p[1], u));
    for (const s of this.strassen) this.einsortieren(s.linie, s.breite / 2 + s.gehwegBreite, (st) => {
      if (s.art === "service") {
        const drinA = aufSchule(st.a), drinB = aufSchule(st.b);
        const m: P = [(st.a[0] + st.b[0]) / 2, (st.a[1] + st.b[1]) / 2];
        st.schule = aufSchule(m);
        if (st.schule) this.schulZufahrten.push({ a: st.a, b: st.b, breite: s.breite });
        // Tor dort, wo die Zufahrt die Grenze kreuzt (Halbierungssuche).
        if (drinA !== drinB) {
          let lo = 0, hi = 1;
          for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2;
            const q: P = [st.a[0] + (st.b[0] - st.a[0]) * mid, st.a[1] + (st.b[1] - st.a[1]) * mid];
            if (aufSchule(q) === drinA) lo = mid; else hi = mid;
          }
          this.tore.push({ p: [st.a[0] + (st.b[0] - st.a[0]) * lo, st.a[1] + (st.b[1] - st.a[1]) * lo], winkel: winkelVon(st) });
        }
      }
      this.strassenRaster.fuege({ s, st }, boxVon([st.a, st.b]), st.halb);
    });
    for (const w of karte.wege) this.einsortieren(w.linie, w.art === "geh_rad_getrennt" ? 1.5 : w.art === "rad" || w.art === "geh_rad" ? 1.25 : 1, (st) => this.wegRaster.fuege({ art: w.art, st }, boxVon([st.a, st.b]), st.halb));
    for (const g of karte.gleise) this.einsortieren(g.linie, 1.5, (st) => this.gleisRaster.fuege({ art: g.art, st }, boxVon([st.a, st.b]), st.halb));
    for (const h of karte.gebaeude) if (h.umriss.length >= 3) this.hausRaster.fuege(h, boxVon(h.umriss));
    for (const p of karte.punkte)
      if (p.art === "zebra" || p.art === "ampelUebergang" || p.art === "querung") this.querungRaster.fuege(p, boxVon([p.p]), 12);

    // Tore an den äußeren Enden einer Straße mit Toren (in OSM oft mehrere Stücke).
    const gleich = (p: P, q: P) => p[0] === q[0] && p[1] === q[1];
    for (const s of this.strassen) if (s.tore) {
      const geschwister = this.strassen.filter((x) => x !== s && x.tore);
      const innen = (p: P) => geschwister.some((x) => x.linie.some((q) => gleich(p, q)));
      const [a, b] = [s.linie[0], s.linie[s.linie.length - 1]];
      const [a2, b2] = [s.linie[1], s.linie[s.linie.length - 2]];
      // etwas hinein ins Gelände, nicht mitten auf die Hauptstraße
      const hinein = (p: P, q: P): P => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; const f = Math.min(1, 8 / l); return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; };
      if (!innen(a)) this.tore.push({ p: hinein(a, a2), winkel: winkelVon({ a, b: a2 }), zeiten: s.tore });
      if (!innen(b)) this.tore.push({ p: hinein(b, b2), winkel: winkelVon({ a: b2, b }), zeiten: s.tore });
    }
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

  /**
   * Gibt es in `r` Metern einen Radweg mit blauem Schild (237, 240, 241)? Mit
   * `winkel` nur einen, der in diese Richtung verläuft (daneben, nicht quer).
   */
  radwegNah(x: number, y: number, r = 10, winkel?: number): boolean {
    for (let dx = -20; dx <= 20; dx += 20) for (let dy = -20; dy <= 20; dy += 20)
      for (const e of this.wegRaster.bei(x + dx, y + dy)) {
        if (!RADWEG_PFLICHT.has(e.art) || abstandZuStrecke(x, y, e.st.a, e.st.b).d > r) continue;
        if (winkel === undefined || Math.abs(Math.cos(winkel - winkelVon(e.st))) > 0.85) return true;
      }
    return false;
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
    let schulZufahrt = false;
    for (const e of this.strassenRaster.bei(x, y)) {
      if (abstandZuStrecke(x, y, e.st.a, e.st.b).d > e.s.breite / 2) continue;
      if (e.st.schule) { schulZufahrt = true; continue; }
      if (!fahrbahn || e.s.breite > fahrbahn.breite) fahrbahn = e.s;
    }
    // Die Einfahrt auf dem Schulgelände ist Schulhof, keine Fahrbahn.
    if (!fahrbahn && schulZufahrt) return { art: "gehweg" };
    if (fahrbahn) {
      let querung: KartenPunkt | undefined;
      for (const q of this.querungRaster.bei(x, y)) {
        // Ein Übergang ist ein Streifen quer über die Straße: nah am Punkt längs
        // der Fahrbahn, egal wie weit quer.
        if (Math.hypot(q.p[0] - x, q.p[1] - y) <= fahrbahn.breite / 2 + QUERUNG_HALB) { querung = q; break; }
      }
      if (fahrbahn.art === "living_street") return { art: "spielstrasse", strasse: fahrbahn };
      return { art: "fahrbahn", strasse: fahrbahn, querung };
    }
    for (const w of this.warteRaster.bei(x, y)) if (imVieleck(x, y, w)) return { art: "gehweg" };
    for (const e of this.wegRaster.bei(x, y))
      if (abstandZuStrecke(x, y, e.st.a, e.st.b).d <= e.st.halb) {
        if (e.art === "rad") return { art: "radweg" };
        return e.art === "geh_rad" ? { art: "gehweg", rad: "gemeinsam" } : e.art === "geh_rad_getrennt" ? { art: "gehweg", rad: "getrennt" }
          : e.art === "geh_radfrei" ? { art: "gehweg", rad: "frei" } : { art: "gehweg" };
      }
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

const BEFAHRBAR = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "living_street"]);

/**
 * Lose Enden anschließen: endet eine befahrbare Straße frei, aber keine 10 m
 * neben dem Punkt einer anderen, wird das Ende dorthin gelegt. In OSM beginnt
 * die Spielstraße an der Schule etwa auf dem Radweg, 7 m vor der Fahrbahn der
 * Eugen-Richter-Straße — ohne Anschluss käme kein Auto hinein.
 */
export function anschliessen(strassen: KartenStrasse[]): KartenStrasse[] {
  const key = (p: P) => `${p[0]},${p[1]}`;
  const zahl = new Map<string, number>();
  for (const s of strassen) if (BEFAHRBAR.has(s.art)) for (const p of s.linie) zahl.set(key(p), (zahl.get(key(p)) ?? 0) + 1);
  // Der Reihe nach, mit mitgezählten Anschlüssen: treffen sich zwei lose
  // Enden, wandert nur das erste — das zweite ist danach schon verbunden.
  const aus = [...strassen];
  aus.forEach((s, i) => {
    if (!BEFAHRBAR.has(s.art)) return;
    let linie = s.linie;
    for (const ende of [0, s.linie.length - 1]) {
      const p = linie[ende];
      if ((zahl.get(key(p)) ?? 0) > 1) continue;
      // Liegt das Ende genau auf einer anderen Straße (zwischen zwei Stützpunkten), wird es dort ein Knoten
      const auf = aus.findIndex((o, j) => j !== i && BEFAHRBAR.has(o.art) && o.linie.some((q, k) => k + 1 < o.linie.length
        && abstandZuStrecke(p[0], p[1], q, o.linie[k + 1]).d < 1 && Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.5 && Math.hypot(o.linie[k + 1][0] - p[0], o.linie[k + 1][1] - p[1]) > 0.5));
      if (auf >= 0) {
        const o = aus[auf];
        const k = o.linie.findIndex((q, k) => k + 1 < o.linie.length && abstandZuStrecke(p[0], p[1], q, o.linie[k + 1]).d < 1);
        aus[auf] = { ...o, linie: [...o.linie.slice(0, k + 1), p, ...o.linie.slice(k + 1)] };
        zahl.set(key(p), (zahl.get(key(p)) ?? 0) + 1);
        continue;
      }
      let best: { q: P; d: number } | null = null;
      for (const o of aus) {
        if (o === aus[i] || !BEFAHRBAR.has(o.art)) continue;
        for (const q of o.linie) {
          const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (d > 0 && d <= 10 && (!best || d < best.d)) best = { q, d };
        }
      }
      if (best) {
        if (linie === s.linie) linie = [...s.linie];
        linie[ende] = best.q;
        zahl.set(key(p), (zahl.get(key(p)) ?? 1) - 1);
        zahl.set(key(best.q), (zahl.get(key(best.q)) ?? 0) + 1);
      }
    }
    if (linie !== s.linie) aus[i] = { ...s, linie };
  });
  return aus;
}
