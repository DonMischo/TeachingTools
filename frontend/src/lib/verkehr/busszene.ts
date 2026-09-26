/**
 * Die Bus-Szene: ein Stadtbus ohne Dach, ganz nah. Drinnen Sitze, Stangen,
 * der Platz für Kinderwagen und Rollstuhl (Sondernutzungsfläche); draußen am
 * Bordstein warten Leute. An jedem Halt steigen welche aus und ein — mit
 * allem, was dabei passiert: Wer im Weg steht, wird geschoben oder muss kurz
 * raus, Ältere brauchen einen Sitz, der Kinderwagen den freien Platz, beim
 * Bremsen fällt um, wer sich nicht festhält. Leute rufen, was zu tun ist.
 *
 * Alles in Bus-Koordinaten: x nach vorn (Front bei +6), y nach rechts (die
 * Türseite, draußen der Gehweg). Kein Pixi; zufällig, aber aus einem Samen.
 */
import type { P } from "./geometrie";
import { gedraenge, Raster, type Mensch } from "./wegsuche";
import type { TuerPhase } from "./tueren";

export const BUS_B = 2.55;
/** Außenkante auf der Türseite. */
export const AUSSEN_Y = BUS_B / 2;
export const TUER_W = 1.2;

type Rechteck = { x0: number; x1: number; y0: number; y1: number };
export type Bustyp = "solo" | "gelenk" | "tram";

/**
 * Wie ein Bus innen aussieht: Türen (die erste vorn beim Fahrer), Fahrerplatz,
 * Sondernutzungsflächen (je gegenüber einer Tür), beim Gelenkbus die Drehscheibe.
 */
export type Layout = {
  typ: Bustyp; name: string; laenge: number;
  innen: Rechteck; tuerX: number[]; fahrer: Rechteck; fahrerSitz: P;
  snf: (Rechteck & { tuer: number })[];
  gelenk?: { x0: number; x1: number };
  rand: Rechteck;
  sitze: Sitz[]; stangen: P[];
};

export type Sitz = { id: number; p: P; vorrang: boolean; belegt: string | null };

function baueLayout(typ: Bustyp, name: string, laenge: number, tuerX: number[], snf: { tuer: number; x0: number; x1: number }[],
  links: number[], rechts: number[], vorrangAb: number, gelenk?: { x0: number; x1: number }): Layout {
  const h = laenge / 2;
  const innen = { x0: -h + 0.15, x1: h - 0.15, y0: -1.13, y1: 1.13 };
  // Sitze: 2er-Reihen links und rechts, hinten die Bank; vorn Vorrangsitze
  const sitze: Sitz[] = [];
  const reihe = (x: number, seite: -1 | 1) => { for (const y of [0.44, 0.88]) sitze.push({ id: sitze.length, p: [x, y * seite], vorrang: x > vorrangAb, belegt: null }); };
  links.forEach((x) => reihe(x, -1));
  rechts.forEach((x) => reihe(x, 1));
  for (const y of [-0.88, -0.44, 0, 0.44, 0.88]) sitze.push({ id: sitze.length, p: [innen.x0 + 0.3, y], vorrang: false, belegt: null });
  const flaechen = snf.map((f) => ({ ...f, y0: -1.13, y1: -0.25 }));
  // Haltestangen: an den Türen, an den Sondernutzungsflächen und am Gelenk; im Gang halten die Sitzgriffe
  const stangen: P[] = [
    ...tuerX.flatMap((x) => [[x - TUER_W / 2 - 0.1, 0.95], [x + TUER_W / 2 + 0.1, 0.95]] as P[]),
    ...flaechen.flatMap((f) => [[f.x0, -0.3], [f.x1, -0.3], [(f.x0 + f.x1) / 2, -0.3]] as P[]),
    ...(gelenk ? [[gelenk.x0 - 0.1, -0.35], [gelenk.x0 - 0.1, 0.35], [gelenk.x1 + 0.1, -0.35], [gelenk.x1 + 0.1, 0.35]] as P[] : []),
    [innen.x1 - 2.6, -0.3], [innen.x1 - 2.6, 0.3], [innen.x0 + 1.2, -0.3], [innen.x0 + 1.2, 0.3],
  ];
  return {
    typ, name, laenge, innen, tuerX,
    fahrer: { x0: h - 1.75, x1: innen.x1, y0: -1.13, y1: -0.1 }, fahrerSitz: [h - 0.85, -0.62],
    snf: flaechen, gelenk,
    rand: { x0: -h - 1.8, x1: h + 1.8, y0: innen.y0 - 0.2, y1: AUSSEN_Y + 6 },
    sitze, stangen,
  };
}

export const LAYOUTS = {
  // Stadtbus, 12 m: vorn, Mitte (mit Platz für Kinderwagen und Rollstuhl), hinten
  solo: baueLayout("solo", "Stadtbus", 12, [4.85, 0.4, -3.6], [{ tuer: 1, x0: -0.7, x1: 1.6 }],
    [3.6, 2.8, -1.1, -1.9, -2.7, -3.5, -4.3, -5.0], [3.6, 2.8, 1.8, -1.2, -2.0], 2.5),
  // »Schlenky«: Gelenkbus, 18 m, mit Drehscheibe; an beiden Türen hinter dem Fahrer Platz für Kinderwagen und Rollstuhl
  gelenk: baueLayout("gelenk", "Schlenky (Gelenkbus)", 18, [7.85, 3.2, -4.0],
    [{ tuer: 1, x0: 2.1, x1: 4.4 }, { tuer: 2, x0: -5.1, x1: -2.8 }],
    [6.6, 5.8, 1.5, -1.3, -2.1, -6.0, -6.8, -7.6], [6.6, 5.8, 5.0, 1.6, 0.8, -1.3, -2.1, -2.9, -5.6, -6.4, -7.2], 5.5,
    { x0: -0.6, x1: 0.5 }),
} as Record<Bustyp, Layout>;

/**
 * Straßenbahn »Tramlink« der EVAG: rund 42 m, sieben Türen rechts (Einrichtungswagen,
 * Erfurt wendet in Schleifen), zwei Rollstuhlplätze und Flächen für Kinderwagen.
 */
function tramLayout(): Layout {
  const tueren = [17.6, 11.8, 6.0, 0.2, -5.6, -11.4, -17.2];
  const snf = [{ tuer: 1, x0: 10.6, x1: 13.0 }, { tuer: 3, x0: -1.0, x1: 1.4 }, { tuer: 5, x0: -12.6, x1: -10.2 }];
  const links: number[] = [], rechts: number[] = [];
  for (let x = -19.9; x < 18.6; x += 0.8) {
    if (!snf.some((f) => x > f.x0 - 0.25 && x < f.x1 + 0.25)) links.push(Math.round(x * 10) / 10);
    if (!tueren.some((t) => Math.abs(x - t) < 1.0)) rechts.push(Math.round(x * 10) / 10);
  }
  return baueLayout("tram", "Straßenbahn (Tramlink)", 42, tueren, snf, links, rechts, 16.5);
}

LAYOUTS.tram = tramLayout();

// Der Stadtbus, wie bisher (Tests, einfache Nutzer)
const SOLO = LAYOUTS.solo;
export const BUS_L = SOLO.laenge;
export const TUER_X = SOLO.tuerX;
export const FAHRER = SOLO.fahrer;
export const SNF = SOLO.snf[0];
export const RAND = SOLO.rand;
export const STANGEN = SOLO.stangen;
const HALTEN_NAH = 0.75;
const SITZ_R = 0.12;

const inRechteck = (x: number, y: number, r: Rechteck, rand = 0) =>
  x > r.x0 - rand && x < r.x1 + rand && y > r.y0 - rand && y < r.y1 + rand;

/** Ist hier eine Wand, ein Sitz oder der Fahrer? `offen`: die Türen sind offen. */
function frei(x: number, y: number, sitze: Sitz[], offen: boolean, l: Layout): boolean {
  if (!inRechteck(x, y, l.rand)) return false;
  const drinnen = inRechteck(x, y, l.innen);
  if (drinnen) {
    if (inRechteck(x, y, l.fahrer)) return false;
    // Ein Sitzpaar ist ein Block (kein Spalt zwischen Fenster- und Gangsitz).
    return !sitze.some((s) => Math.abs(x - s.p[0]) < 0.21 && Math.abs(y - s.p[1]) < 0.23);
  }
  // Wand: zwischen Innenraum und Außenkante — außer in einer offenen Tür.
  if (y > l.innen.y1 - 0.01 && y < AUSSEN_Y + 0.08) return offen && x > l.innen.x0 && x < l.innen.x1 && l.tuerX.some((t) => Math.abs(x - t) < TUER_W / 2 - 0.05);
  // Draußen nur auf der Türseite (die andere ist Fahrbahn).
  return y >= AUSSEN_Y + 0.08;
}

export const drin = (x: number, y: number, l: Layout = SOLO) => inRechteck(x, y, l.innen, 0.02);

/** Zonen an einer Tür, wie auf dem Schaubild: Fokus zum Einsteigen, seitlich warten, frei halten. */
export function tuerZonen(i: number, l: Layout = SOLO) {
  const x = l.tuerX[i];
  return {
    fokus: { x0: x - TUER_W / 2, x1: x + TUER_W / 2, y0: AUSSEN_Y + 0.05, y1: AUSSEN_Y + 0.85 },
    warten: [[x - 1.75, AUSSEN_Y + 1.1], [x + 1.75, AUSSEN_Y + 1.1]] as P[],
    wartenR: 0.85,
    /** Frei halten: Fächer vor der Tür, so weit wie Aussteigende ihn brauchen. */
    freiMitte: [x, AUSSEN_Y] as P, freiR: 2.6, freiBreite: 0.62,
  };
}

/** Im Fächer vor der Tür (Frei-halten-Zone)? */
export function imFreiraum(i: number, x: number, y: number, l: Layout = SOLO): boolean {
  const z = tuerZonen(i, l);
  const dx = x - z.freiMitte[0], dy = y - z.freiMitte[1];
  if (dy < 0.05 || Math.hypot(dx, dy) > z.freiR) return false;
  return Math.abs(Math.atan2(dx, dy)) < z.freiBreite;
}

/** Seitlich neben der Tür, in einer der beiden Wartezonen? */
export function inWartezone(i: number, x: number, y: number, l: Layout = SOLO): boolean {
  const z = tuerZonen(i, l);
  return y > AUSSEN_Y && z.warten.some((w) => Math.hypot(x - w[0], y - w[1]) < z.wartenR) && !imFreiraum(i, x, y, l);
}

/** Drinnen nah an einer Tür (Aussteigende kommen hier durch). */
export function amAusgang(i: number, x: number, y: number, l: Layout = SOLO) {
  return drin(x, y, l) && Math.abs(x - l.tuerX[i]) < TUER_W / 2 + 0.35 && y > 0.25;
}

export type FahrgastArt = "erwachsen" | "kind" | "senior" | "kinderwagen" | "rollstuhl";
export type Zustand = "wartet" | "steigtEin" | "drin" | "steigtAus" | "machtPlatz" | "weg";

export type Fahrgast = Mensch & {
  art: FahrgastArt; farbe: number; rucksack: boolean;
  zustand: Zustand;
  sitz: number | null;
  /** Will an diesem Halt raus. */
  raus: boolean;
  /** Die Tür, die er nimmt. */
  tuer: number;
  /** Wo er vorher stand (zum Zurückgehen nach dem Platzmachen). */
  zurueck?: P;
  /** Drängler: stellt sich vor die Tür (schlechtes Beispiel). */
  draengler?: boolean;
  ruf?: { text: string; bis: number };
};

export type SzenenMeldung =
  | "tuerBlockiert" | "gutEingestiegen" | "eingestiegen" | "imWeg" | "rausRein" | "platzAngeboten" | "sitzenGeblieben"
  | "snfFrei" | "snfBlockiert" | "nichtFestgehalten" | "rucksackAb" | "rucksackAuf" | "fahrkarte" | "tuerZu";

export type Lage = {
  t: number; dt: number;
  /** Türen des Busses; "faehrt", wenn er nicht hält. */
  phase: TuerPhase | "faehrt";
  /** Wechselt mit jedem Halt (etwa Fahrzeug@Haltestelle). */
  halt: string | null;
  /** Bremsen (> 0) oder Anfahren (< 0) in m/s². */
  beschleunigung: number;
  /** Wie voll der Bus ist (0–1), aus der Uhrzeit. */
  fuellung: number;
};

export type Ausgang = {
  meldungen: SzenenMeldung[];
  /** Kurzer Hinweis für die Figur, was sie jetzt tun kann. */
  hinweis: string | null;
  /** Die Figur ist gerade eingestiegen / ausgestiegen. */
  eingestiegen?: number;
  ausgestiegen?: boolean;
  /** An dieser Tür ist die Rampe draußen (Rollstuhl), sonst null. */
  rampe: number | null;
};

/** Kleiner Zufall mit Samen. */
function zufall(samen: number) {
  let a = samen >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FARBEN = [0x8e44ad, 0x16a085, 0xd35400, 0x2c3e50, 0xc0392b, 0x27ae60, 0x2980b9, 0x7f8c8d, 0xf39c12, 0x6d4c41];
const TEMPO: Record<FahrgastArt, number> = { erwachsen: 1.25, kind: 1.35, senior: 0.65, kinderwagen: 0.9, rollstuhl: 0.8 };
const RADIUS: Record<FahrgastArt, number> = { erwachsen: 0.23, kind: 0.19, senior: 0.23, kinderwagen: 0.42, rollstuhl: 0.42 };

const RUFE = {
  rausLassen: ["Lass mich mal raus!", "Erst aussteigen lassen!", "Darf ich mal durch?", "Platz da, ich muss raus!"],
  kurzRaus: ["Kannst du kurz rausgehen? Wir müssen raus!", "Geh mal kurz raus, dann wieder rein!"],
  durchgehen: ["Bitte durchgehen!", "Geht doch weiter nach hinten!"],
  aufstehen: ["Würdest du bitte für die Dame aufstehen?", "Steh doch mal auf, die Frau braucht einen Platz!"],
  snf: ["Bitte den Platz für den Kinderwagen frei machen!", "Da muss der Rollstuhl hin — mach mal Platz!"],
  rucksack: ["Nimm doch bitte den Rucksack ab!", "Autsch, dein Rucksack!"],
  fahrkarte: ["Fahrkarte, bitte!"],
  danke: ["Danke dir!", "Wie nett, danke!"],
  draengler: ["Hey, erst aussteigen lassen!", "Nicht vor die Tür stellen!"],
  tuerZu: ["Achtung, Türen schließen!"],
  festhalten: ["Festhalten!", "Hoppla — halt dich fest!"],
} as const;

export class Busszene {
  /** Wie dieser Bus innen aussieht (Stadtbus oder Gelenkbus). */
  readonly l: Layout;
  readonly sitze: Sitz[];
  readonly fahrgaeste: Fahrgast[] = [];
  /** Die Spielfigur in Bus-Koordinaten. */
  readonly ich: Mensch & { sitz: number | null; rucksack: boolean; drin: boolean } =
    { id: "ich", x: 0, y: AUSSEN_Y + 2.5, r: 0.23, tempo: 1.5, weg: [], sitz: null, rucksack: true, drin: false };
  /** Nimmt die Szene die Figur gerade (sonst läuft sie frei in der Stadt). */
  mitIch = false;
  private rasterZu: Raster;
  private rasterOffen: Raster;
  private rnd: () => number;
  private naechsteId = 0;
  private halt: string | null = null;
  private phase: Lage["phase"] = "faehrt";
  private vorPhase: Lage["phase"] = "faehrt";
  /** Einmal-Meldungen je Halt/Fahrt. */
  private schonGemeldet = new Set<string>();
  private seit = new Map<string, number>();
  private festhaltenGemeldet = -Infinity;
  private fahrkarteSeit: number | null = null;
  private wartetBeimAussteigen = false;
  private rausFuerAndere = false;
  /** Die Figur ist an diesem Halt aus dem Bus gestiegen (Halt-Schlüssel) — ob für immer oder nur kurz, zeigt sich noch. */
  private selbstRaus: string | null = null;
  /** Ausgestiegen und noch nicht gemeldet: gilt, sobald der Bus fährt oder die Figur weggeht. */
  rausGekommen = false;
  private rampeBis = -Infinity;
  private rampeTuer: number | null = null;
  private fuellung = 0.5;

  constructor(samen: number, fuellung: number, t: number, typ: Bustyp = "solo") {
    this.l = LAYOUTS[typ];
    this.sitze = this.l.sitze.map((x) => ({ ...x, belegt: null }));
    this.fahrer.x = this.l.fahrerSitz[0]; this.fahrer.y = this.l.fahrerSitz[1];
    this.rnd = zufall(samen);
    this.fuellung = fuellung;
    const z = 0.15;
    const mache = (offen: boolean) => new Raster(this.l.rand.x0, this.l.rand.y0, Math.ceil((this.l.rand.x1 - this.l.rand.x0) / z), Math.ceil((this.l.rand.y1 - this.l.rand.y0) / z), z,
      (x, y) => frei(x, y, this.sitze, offen, this.l));
    this.rasterZu = mache(false);
    this.rasterOffen = mache(true);
    this.fuelle(fuellung, t);
  }

  raster(): Raster { return this.phase === "aussteigen" || this.phase === "einsteigen" ? this.rasterOffen : this.rasterZu; }

  /** Stehplätze drinnen: freie Punkte, nicht vor Türen, nicht auf der Sondernutzungsfläche. */
  /** `dicht`: Schulter an Schulter (voller Bus), sonst mit etwas Abstand. */
  private stehplatz(auchTuer = false, snf?: Rechteck, dicht = false): P | null {
    const r = this.rasterZu;
    const alle = [...this.fahrgaeste.filter((f) => f.zustand !== "weg"), this.ich];
    // Kandidaten auf einem feinen Raster, zufällig gemischt — so findet sich auch im vollen Bus noch die letzte Lücke
    const kandidaten: P[] = [];
    const I = this.l.innen;
    for (let x = I.x0 + 0.3; x < I.x1 - 0.3; x += 0.2) for (let y = I.y0 + 0.25; y < I.y1 - 0.2; y += 0.2) kandidaten.push([x + (this.rnd() - 0.5) * 0.1, y]);
    for (let i = kandidaten.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [kandidaten[i], kandidaten[j]] = [kandidaten[j], kandidaten[i]]; }
    for (const [x, y] of kandidaten) {
      if (!r.begehbar(x, y)) continue;
      if (!snf && this.l.snf.some((f) => inRechteck(x, y, f, 0.2))) continue;
      if (snf && !inRechteck(x, y, snf, -0.35)) continue;
      if (!auchTuer && this.l.tuerX.some((_, i) => amAusgang(i, x, y, this.l))) continue;
      if (this.l.gelenk && x > this.l.gelenk.x0 - 0.2 && x < this.l.gelenk.x1 + 0.2 && !snf && !dicht) continue;
      // Nicht in die Beinfreiheit zwischen zwei Sitzreihen
      if (this.sitze.some((s) => Math.abs(s.p[0] - x) < 0.6 && Math.abs(s.p[1] - y) < 0.3)) continue;
      if (alle.some((m) => Math.hypot(m.x - x, m.y - y) < m.r + (dicht ? 0.24 : 0.3))) continue;
      return [x, y];
    }
    return null;
  }

  private freierSitz(vorrang = false, nahe?: P): Sitz | null {
    const frei = this.sitze.filter((s) => !s.belegt && (!vorrang || s.vorrang));
    if (!frei.length) return vorrang ? this.freierSitz(false, nahe) : null;
    if (nahe) frei.sort((a, b) => Math.hypot(a.p[0] - nahe[0], a.p[1] - nahe[1]) - Math.hypot(b.p[0] - nahe[0], b.p[1] - nahe[1]));
    return frei[nahe ? 0 : Math.floor(this.rnd() * frei.length)];
  }

  private neuerFahrgast(art: FahrgastArt, x: number, y: number, zustand: Zustand): Fahrgast {
    const f: Fahrgast = {
      id: `f${this.naechsteId++}`, art, x, y, r: RADIUS[art], tempo: TEMPO[art] * (0.9 + this.rnd() * 0.2), weg: [],
      farbe: FARBEN[Math.floor(this.rnd() * FARBEN.length)], rucksack: art === "kind" || (art === "erwachsen" && this.rnd() < 0.25),
      zustand, sitz: null, raus: false, tuer: 1,
    };
    this.fahrgaeste.push(f);
    return f;
  }

  /** Den Bus beim ersten Sehen füllen: Sitze zuerst, dann Stehplätze (bei voll auch an den Türen). */
  /**
   * Den Bus beim ersten Sehen füllen: erst die Sitze, ab halber Füllung stehen
   * Leute — voll heißt richtig voll, Schulter an Schulter (auch an den Türen).
   */
  private fuelle(fuellung: number, t: number) {
    const sitzend = Math.round(this.sitze.length * Math.min(1, fuellung * 1.6));
    const stehplaetze = Math.round(this.l.laenge * 3.4);
    const stehend = Math.round(Math.max(0, (fuellung - 0.5) / 0.5) * stehplaetze);
    for (let i = 0; i < sitzend + stehend; i++) {
      const art: FahrgastArt = this.rnd() < 0.12 ? "senior" : this.rnd() < 0.3 ? "kind" : "erwachsen";
      const sitz = i < sitzend ? this.freierSitz(art === "senior") : null;
      if (sitz) {
        const f = this.neuerFahrgast(art, sitz.p[0], sitz.p[1], "drin");
        this.setze(f, sitz);
      } else {
        const p = this.stehplatz(fuellung > 0.7, undefined, fuellung > 0.7);
        if (!p) break;
        const f = this.neuerFahrgast(art === "senior" ? "erwachsen" : art, p[0], p[1], "drin");
        f.rucksack = f.rucksack && this.rnd() < 0.5;
      }
    }
    void t;
  }

  private setze(f: Fahrgast, s: Sitz) {
    // Wer sitzt, steckt im Sitz und ragt nicht in den Gang.
    f.sitz = s.id; s.belegt = f.id; f.fest = true; f.x = s.p[0]; f.y = s.p[1]; f.weg = []; f.r = SITZ_R;
    f.winkel = 0;
  }

  private aufstehen(m: Fahrgast | Busszene["ich"]) {
    if (m.sitz === null) return;
    const s = this.sitze[m.sitz];
    s.belegt = null;
    m.sitz = null;
    m.fest = false;
    m.r = "art" in m ? RADIUS[m.art] : m.rucksack ? 0.27 : 0.23;
    // In den Gang (y ≈ 0), neben den Sitz
    m.x = s.p[0]; m.y = Math.max(-0.05, Math.min(0.05, s.p[1] * 0.1));
    if (!this.rasterZu.begehbar(m.x, m.y)) {
      const k = this.rasterZu.naechsteFreie(m.x, m.y);
      if (k >= 0) [m.x, m.y] = this.rasterZu.mitte(k);
    }
  }

  private geh(m: Mensch, ziel: P) {
    m.ziel = ziel;
    m.weg = this.raster().suche([m.x, m.y], ziel) ?? [ziel];
  }

  private rufe(f: Fahrgast | undefined, liste: readonly string[], t: number, dauer = 2.6) {
    if (!f || (f.ruf && f.ruf.bis > t)) return;
    f.ruf = { text: liste[Math.floor(this.rnd() * liste.length)], bis: t + dauer };
  }

  /** Einmal je Schlüssel melden (Halt oder Fahrt gehören in den Schlüssel). */
  private einmal(key: string, m: SzenenMeldung, aus: SzenenMeldung[]) {
    if (this.schonGemeldet.has(key)) return;
    this.schonGemeldet.add(key);
    aus.push(m);
  }

  /** Wie lange gilt eine Bedingung schon (0, wenn sie gerade nicht gilt)? */
  private dauer(key: string, gilt: boolean, t: number): number {
    if (!gilt) { this.seit.delete(key); return 0; }
    if (!this.seit.has(key)) this.seit.set(key, t);
    return t - this.seit.get(key)!;
  }

  /** Neuer Halt: wer raus will, wer draußen wartet, was heute passiert. */
  private neuerHalt(t: number) {
    const drinnen = this.fahrgaeste.filter((f) => f.zustand === "drin");
    for (const f of drinnen) f.raus = this.rnd() < 0.3;
    // Draußen: ein paar Wartende, dazu seltene Ereignisse
    const wartende = Math.floor(this.rnd() * (2 + this.fuellung * 5));
    const neu: Fahrgast[] = [];
    for (let i = 0; i < wartende; i++) neu.push(this.neuerFahrgast(this.rnd() < 0.3 ? "kind" : "erwachsen", 0, 0, "wartet"));
    if (this.rnd() < 0.3) neu.push(this.neuerFahrgast("senior", 0, 0, "wartet"));
    if (this.rnd() < 0.1) neu.push(this.neuerFahrgast("kinderwagen", 0, 0, "wartet"));
    if (this.rnd() < 0.05) neu.push(this.neuerFahrgast("rollstuhl", 0, 0, "wartet"));
    for (const f of neu) {
      // Kinderwagen und Rollstuhl an eine Tür mit Platz für sie, sonst irgendeine
      const snfTueren = this.l.snf.map((x) => x.tuer);
      f.tuer = f.art === "kinderwagen" || f.art === "rollstuhl" ? snfTueren[Math.floor(this.rnd() * snfTueren.length)]
        : Math.floor(this.rnd() * this.l.tuerX.length);
      const z = tuerZonen(f.tuer, this.l);
      const w = z.warten[this.rnd() < 0.5 ? 0 : 1];
      f.x = w[0] + (this.rnd() - 0.5) * 3; f.y = AUSSEN_Y + 2.2 + this.rnd() * 1.5;
      f.draengler = f.art === "erwachsen" && this.rnd() < 0.12;
      this.geh(f, f.draengler ? [this.l.tuerX[f.tuer] + (this.rnd() - 0.5) * 0.4, AUSSEN_Y + 0.55] : [w[0] + (this.rnd() - 0.5) * 0.8, w[1] + this.rnd() * 0.5]);
    }
    this.wartetBeimAussteigen = false;
    this.rausFuerAndere = false;
    void t;
  }

  /** Einen Takt weiter. `ichBewegt`: Spieler steuert gerade selbst (dann schiebt ihn keiner weg). */
  schritt(l: Lage): Ausgang {
    const { t, dt } = l;
    const aus: SzenenMeldung[] = [];
    let hinweis: string | null = null;
    let eingestiegen: number | undefined, ausgestiegen = false;
    this.fuellung = l.fuellung;
    this.vorPhase = this.phase;
    this.phase = l.phase;
    if (l.halt && l.halt !== this.halt) { this.halt = l.halt; this.neuerHalt(t); }
    const hk = this.halt ?? "fahrt";
    const ich = this.ich;
    const warErDrin = ich.drin;

    // --- Die Fahrgäste: was jeder gerade will ---
    const phase = l.phase;
    for (const f of this.fahrgaeste) {
      if (f.zustand === "weg") continue;
      if (f.zustand === "drin" && f.raus && phase === "aussteigen") {
        // Zum Ausgang: Mitte oder hinten, vorn nur wer vorn sitzt
        if (f.sitz !== null) this.aufstehen(f);
        const tuer = this.l.tuerX.map((x, i) => ({ i, d: Math.abs(x - f.x) + (i === 0 ? 1.5 : 0) })).sort((a, b) => a.d - b.d)[0].i;
        f.tuer = tuer;
        f.zustand = "steigtAus";
        const seite = this.rnd() < 0.5 ? -1 : 1;
        // Zur Tür, gerade hinaus (durch den Freihalte-Fächer), dann zur Seite weg.
        const innen: P = [this.l.tuerX[tuer], this.l.innen.y1 - 0.35];
        f.ziel = [this.l.tuerX[tuer] + seite * 2.8, this.l.rand.y1 - 0.3];
        f.weg = [...(this.rasterZu.suche([f.x, f.y], innen) ?? [innen]), [this.l.tuerX[tuer], AUSSEN_Y + 1.5], f.ziel];
      } else if (f.zustand === "steigtAus" && (f.y > this.l.rand.y1 - 0.6 || (!f.weg.length && f.y > AUSSEN_Y + 1))) {
        f.zustand = "weg";
      } else if (f.zustand === "wartet" && phase === "einsteigen") {
        f.zustand = "steigtEin";
        this.einsteigenLassen(f, t);
      } else if (f.zustand === "steigtEin" && !f.weg.length && drin(f.x, f.y, this.l)) {
        f.zustand = "drin";
        const s = f.art === "kinderwagen" || f.art === "rollstuhl" ? null : this.sitzInReichweite(f);
        if (s) this.setze(f, s);
      } else if (f.zustand === "steigtEin" && !f.weg.length && !drin(f.x, f.y, this.l) && phase === "einsteigen") {
        this.einsteigenLassen(f, t);
      } else if (f.zustand === "machtPlatz" && phase === "einsteigen" && !f.weg.length) {
        f.zustand = "steigtEin";
        this.geh(f, f.zurueck ?? this.stehplatz(true) ?? [0, 0]);
      }
      // Bus fährt los, wer draußen steht, bleibt da (nächster Bus)
      if ((phase === "faehrt" || phase === "zu") && (f.zustand === "wartet" || f.zustand === "steigtEin" || f.zustand === "machtPlatz") && !drin(f.x, f.y, this.l)) {
        if (this.vorPhase === "schliessen") f.zustand = "weg";
      }
      if ((phase === "faehrt" || phase === "zu" || phase === "schliessen") && f.zustand === "steigtEin" && drin(f.x, f.y, this.l) && !f.weg.length) f.zustand = "drin";
      // Nicht mehr rausgekommen, Türen zu: bleibt drin und steigt am nächsten Halt aus
      if ((phase === "faehrt" || phase === "zu") && f.zustand === "steigtAus" && drin(f.x, f.y, this.l)) { f.zustand = "drin"; f.weg = []; f.ziel = undefined; }
    }

    // Aussteigen beginnt: wer drinnen an der Tür steht und nicht raus will, macht Platz
    if (phase === "aussteigen" && this.vorPhase !== "aussteigen") {
      for (let i = 0; i < this.l.tuerX.length; i++) {
        if (!this.fahrgaeste.some((f) => f.zustand === "steigtAus" && f.tuer === i)) continue;
        for (const f of this.fahrgaeste) {
          if (f.zustand !== "drin" || f.sitz !== null || !amAusgang(i, f.x, f.y, this.l)) continue;
          const platz = this.fuellung < 0.7 ? this.stehplatz(false) : null;
          if (platz) this.geh(f, platz);
          else {
            // Sehr voll: kurz raussteigen und seitlich warten, danach wieder rein
            f.zurueck = [f.x, f.y];
            f.zustand = "machtPlatz";
            const z = tuerZonen(i, this.l);
            this.geh(f, z.warten[f.x < this.l.tuerX[i] ? 0 : 1]);
          }
        }
      }
    }

    // --- Der Spieler ---
    const imBus = drin(ich.x, ich.y, this.l);
    ich.drin = imBus;
    if (this.mitIch) {
      const aussteiger = (i: number) => this.fahrgaeste.filter((f) => f.zustand === "steigtAus" && f.tuer === i && (drin(f.x, f.y, this.l) || f.y < AUSSEN_Y + 1.2));
      // Wer selbst gerade aus dem Bus kam, geht durch den Fächer — das ist richtig so.
      const selbstRaus = this.selbstRaus === hk;
      if (!imBus && selbstRaus && phase !== "faehrt")
        hinweis = "Ausgestiegen. Weggehen — oder, wenn du nur Platz gemacht hast: seitlich warten und wieder einsteigen.";
      // Draußen während des Aussteigens: im Fächer vor der Tür = blockiert
      if (!imBus && phase === "aussteigen" && !selbstRaus) {
        for (let i = 0; i < this.l.tuerX.length; i++) {
          // Seitlich warten zählt immer — auch wenn an dieser Tür gerade keiner aussteigt
          if (inWartezone(i, ich.x, ich.y, this.l)) this.wartetBeimAussteigen = true;
          if (!aussteiger(i).length) continue;
          if (imFreiraum(i, ich.x, ich.y, this.l) && this.dauer(`frei${i}`, true, t) > 0.8) {
            this.einmal(`${hk}:blockiert`, "tuerBlockiert", aus);
            this.rufe(aussteiger(i)[0], RUFE.rausLassen, t);
          } else if (!imFreiraum(i, ich.x, ich.y, this.l)) this.dauer(`frei${i}`, false, t);
        }
        if (this.l.tuerX.some((_, i) => inWartezone(i, ich.x, ich.y, this.l))) hinweis = "Gut so: seitlich warten, bis alle draußen sind.";
        else if (this.l.tuerX.some((_, i) => imFreiraum(i, ich.x, ich.y, this.l))) hinweis = "Du stehst im Weg! Stell dich seitlich neben die Tür (grüne Zone).";
      }
      // Drinnen an der Tür, während andere aussteigen: raus und wieder rein
      if (imBus && phase === "aussteigen") {
        for (let i = 0; i < this.l.tuerX.length; i++) {
          if (!aussteiger(i).length || !amAusgang(i, ich.x, ich.y, this.l)) { this.dauer(`drinnen${i}`, false, t); continue; }
          hinweis = "Du stehst an der Tür im Weg: kurz aussteigen, seitlich warten, dann wieder einsteigen.";
          const d = this.dauer(`drinnen${i}`, !ich.weg.length, t);
          if (d > 1) this.rufe(aussteiger(i)[0], this.fuellung > 0.6 ? RUFE.kurzRaus : RUFE.rausLassen, t);
          if (d > 3.5) this.einmal(`${hk}:imWeg`, "imWeg", aus);
        }
      }
      if (warErDrin && !imBus) {
        this.selbstRaus = hk;
        this.rausGekommen = true;
        if (phase === "aussteigen" && this.fahrgaeste.some((f) => f.zustand === "steigtAus")) this.rausFuerAndere = true;
      }
      // Einsteigen
      if (!warErDrin && imBus) {
        eingestiegen = this.l.tuerX.findIndex((x) => Math.abs(ich.x - x) < TUER_W);
        if (phase === "aussteigen" && this.fahrgaeste.some((f) => f.zustand === "steigtAus" && drin(f.x, f.y, this.l))) {
          this.einmal(`${hk}:blockiert`, "tuerBlockiert", aus);
          this.rufe(this.fahrgaeste.find((f) => f.zustand === "steigtAus"), RUFE.rausLassen, t);
        } else if (this.rausFuerAndere && this.selbstRaus === hk) this.einmal(`${hk}:rausRein`, "rausRein", aus);
        else if (this.wartetBeimAussteigen) this.einmal(`${hk}:gut`, "gutEingestiegen", aus);
        else this.einmal(`${hk}:ein`, "eingestiegen", aus);
        // Fahrkarte zeigen nur vorn im Bus (in der Straßenbahn gibt es Automaten)
        if (eingestiegen === 0 && this.l.typ !== "tram") {
          this.fahrkarteSeit = t;
          this.rufe(this.fahrer, RUFE.fahrkarte, t, 3.5);
        }
      }
      // Wieder drin: war nur Platz machen. Draußen geblieben, bis der Bus fährt: ausgestiegen.
      if (!warErDrin && imBus) this.rausGekommen = false;
      if (this.rausGekommen && !imBus && phase === "faehrt") { ausgestiegen = true; this.rausGekommen = false; }
      if (this.fahrkarteSeit !== null) {
        hinweis = "E drücken: Fahrkarte zeigen";
        if (t - this.fahrkarteSeit > 8) this.fahrkarteSeit = null;
      }

      // An der Fokuszone: E steigt ein
      if (!imBus && phase === "einsteigen" && this.l.tuerX.some((_, i) => inRechteck(ich.x, ich.y, tuerZonen(i, this.l).fokus, 0.3))) hinweis = "E drücken: einsteigen";
      if (!imBus && phase === "aussteigen" && hinweis === null && this.l.tuerX.some((_, i) => inRechteck(ich.x, ich.y, tuerZonen(i, this.l).fokus, 0.2))) hinweis = "Erst aussteigen lassen — seitlich warten!";

      // Sitzen, Aufstehen
      if (imBus && ich.sitz === null && !this.fahrkarteSeit && this.sitzInReichweite(ich)) hinweis ??= "E drücken: hinsetzen";
      if (ich.sitz !== null) hinweis ??= "E drücken: aufstehen";

      // Ältere ohne Sitz
      const senior = this.fahrgaeste.find((f) => f.art === "senior" && f.zustand === "drin" && f.sitz === null);
      if (senior && ich.sitz !== null) {
        const d = this.dauer("senior", true, t);
        hinweis = "Eine ältere Dame braucht einen Platz — E drücken: aufstehen";
        if (d > 2.5) this.rufe(this.naechsterSitzender(senior), RUFE.aufstehen, t, 3.5);
        if (d > 14) {
          this.einmal(`${hk}:sitzen`, "sitzenGeblieben", aus);
          // Dann steht eben ein anderer auf
          const anderer = this.naechsterSitzender(senior);
          if (anderer?.sitz != null) { const s = this.sitze[anderer.sitz]; this.aufstehen(anderer); this.setze(senior, s); this.rufe(senior, RUFE.danke, t); }
        }
      } else this.dauer("senior", false, t);

      // Sondernutzungsfläche frei machen
      const braucht = this.fahrgaeste.find((f) => (f.art === "kinderwagen" || f.art === "rollstuhl") && (f.zustand === "steigtEin" || f.zustand === "wartet") && phase !== "faehrt");
      const ichAufSnf = imBus && this.l.snf.some((f) => inRechteck(ich.x, ich.y, f, 0.25));
      if (braucht && ichAufSnf) {
        hinweis = `Der ${braucht.art === "rollstuhl" ? "Rollstuhl" : "Kinderwagen"} braucht den Platz — geh da weg!`;
        const d = this.dauer("snf", true, t);
        if (d > 1) this.rufe(braucht, RUFE.snf, t);
        if (d > 7) this.einmal(`${hk}:snf`, "snfBlockiert", aus);
      } else if (braucht && this.seit.has("snf")) { this.einmal(`${hk}:snfFrei`, "snfFrei", aus); this.dauer("snf", false, t); }

      // Rucksack im Gedränge: nur, wenn wirklich Leute dicht um einen stehen
      const nachbarn = this.fahrgaeste.filter((f) => f.zustand !== "weg" && f.sitz === null && Math.hypot(f.x - ich.x, f.y - ich.y) < 1.1).length;
      if (imBus && ich.rucksack && ich.sitz === null && nachbarn >= 3) {
        hinweis ??= "B drücken: Rucksack abnehmen (im Gedränge stößt er alle an)";
        const d = this.dauer("rucksack", true, t);
        if (d > 6) this.rufe(this.naechster(ich), RUFE.rucksack, t);
        if (d > 16) this.einmal(`${hk}:rucksack`, "rucksackAuf", aus);
      } else this.dauer("rucksack", false, t);

      // Bremsen und Anfahren: wer steht und sich nicht festhält, fällt
      if (imBus && ich.sitz === null && Math.abs(l.beschleunigung) > 2.2 && !this.haeltSich(ich) && t - this.festhaltenGemeldet > 20) {
        this.festhaltenGemeldet = t;
        aus.push("nichtFestgehalten");
        this.rufe(this.naechster(ich), RUFE.festhalten, t);
        const r = this.raster(), stoss = Math.sign(l.beschleunigung) * 0.9;
        for (let s = stoss; Math.abs(s) > 0.1; s *= 0.7) if (r.begehbar(ich.x + s, ich.y)) { ich.x += s; break; }
        ich.weg = [];
      }
      if (imBus && ich.sitz === null && l.phase === "faehrt") hinweis ??= this.haeltSich(ich) ? "Du hältst dich an der Stange fest. 👍" : "Halt dich fest! Stell dich an eine gelbe Stange oder setz dich.";
      // Tür schließt: wer in der Tür steht, wird hinein- oder hinausgeschoben
      if (phase === "schliessen" && ich.y > this.l.innen.y1 - 0.05 && ich.y < AUSSEN_Y + 0.1 && this.l.tuerX.some((x) => Math.abs(ich.x - x) < TUER_W / 2)) {
        this.einmal(`${hk}:tuerZu`, "tuerZu", aus);
        this.rufe(this.fahrer, RUFE.tuerZu, t);
        ich.y = ich.y < (this.l.innen.y1 + AUSSEN_Y) / 2 ? this.l.innen.y1 - 0.3 : AUSSEN_Y + 0.4;
        ich.weg = [];
      }
    }

    // Drängler vor der Tür: die Aussteigenden beschweren sich
    for (const f of this.fahrgaeste) if (f.draengler && phase === "aussteigen" && this.l.tuerX.some((_, i) => imFreiraum(i, f.x, f.y, this.l)))
      this.rufe(this.fahrgaeste.find((a) => a.zustand === "steigtAus" && Math.hypot(a.x - f.x, a.y - f.y) < 2.5), RUFE.draengler, t);

    // --- Gedränge: alle zusammen, der Spieler nur, wenn die Szene ihn hat ---
    const menschen: Mensch[] = this.fahrgaeste.filter((f) => f.zustand !== "weg");
    if (this.mitIch) menschen.push(ich);
    ich.fest = ich.sitz !== null;
    const schuebe = gedraenge(menschen, dt, this.raster(), t);
    // Wer den Spieler schiebt, sagt was
    for (const s of schuebe) if (s.geschoben === "ich") {
      const f = this.fahrgaeste.find((x) => x.id === s.schieber);
      this.rufe(f, f?.zustand === "steigtAus" ? RUFE.rausLassen : RUFE.durchgehen, t);
    }
    // Weg ist weg
    for (let i = this.fahrgaeste.length - 1; i >= 0; i--) if (this.fahrgaeste[i].zustand === "weg") {
      const f = this.fahrgaeste[i];
      if (f.sitz !== null) this.sitze[f.sitz].belegt = null;
      this.fahrgaeste.splice(i, 1);
    }
    return { meldungen: aus, hinweis: this.mitIch ? hinweis : null, eingestiegen, ausgestiegen, rampe: t < this.rampeBis ? this.rampeTuer : null };
  }

  /** Der Fahrer ruft auch mal etwas (als Fahrgast ohne Bewegung geführt). */
  readonly fahrer: Fahrgast = {
    id: "fahrer", art: "erwachsen", x: 5.15, y: -0.62, r: 0.25, tempo: 0, weg: [], fest: true, farbe: 0x1f3a5f, rucksack: false,
    zustand: "drin", sitz: null, raus: false, tuer: 0,
  };

  private einsteigenLassen(f: Fahrgast, t: number) {
    // Rollstuhl: erst die Rampe
    if (f.art === "rollstuhl" && this.rampeBis < t) { this.rampeBis = t + 5; this.rampeTuer = f.tuer; }
    const flaeche = this.l.snf.find((x) => x.tuer === f.tuer) ?? this.l.snf[0];
    const ziel = f.art === "kinderwagen" || f.art === "rollstuhl" ? this.stehplatz(true, flaeche) ?? [(flaeche.x0 + flaeche.x1) / 2, -0.7] as P
      : (f.art === "senior" ? this.freierSitz(true, [this.l.tuerX[f.tuer], 0])?.p : this.rnd() < 0.7 ? this.freierSitz(false, [this.l.tuerX[f.tuer], 0])?.p : null)
        ?? this.stehplatz(this.fuellung > 0.7) ?? [this.l.tuerX[f.tuer], 0.6];
    // Erst an die Tür, dann hinein zum Ziel (bei Sitzen in den Gang daneben)
    const vorSitz: P = this.sitze.some((s) => s.p[0] === ziel[0] && s.p[1] === ziel[1]) ? [ziel[0], 0] : ziel;
    f.ziel = vorSitz;
    f.weg = this.hinein(f.tuer, vorSitz);
  }

  /** Durch Tür `i` hinein und drinnen weiter zum Ziel (der Weg drinnen, als wären die Türen zu). */
  private hinein(i: number, ziel: P): P[] {
    const innen: P = [this.l.tuerX[i], this.l.innen.y1 - 0.35];
    return [[this.l.tuerX[i], AUSSEN_Y + 0.3], innen, ...(this.rasterZu.suche(innen, ziel) ?? [ziel])];
  }

  private sitzInReichweite(m: Mensch): Sitz | null {
    let best: Sitz | null = null, bd = 0.95;
    for (const s of this.sitze) {
      if (s.belegt) continue;
      const d = Math.hypot(s.p[0] - m.x, s.p[1] - m.y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  private naechsterSitzender(nahe: Mensch): Fahrgast | undefined {
    return this.fahrgaeste.filter((f) => f.sitz !== null && f.art !== "senior").sort((a, b) => Math.hypot(a.x - nahe.x, a.y - nahe.y) - Math.hypot(b.x - nahe.x, b.y - nahe.y))[0];
  }

  private naechster(nahe: Mensch): Fahrgast | undefined {
    return this.fahrgaeste.filter((f) => f.zustand !== "weg").sort((a, b) => Math.hypot(a.x - nahe.x, a.y - nahe.y) - Math.hypot(b.x - nahe.x, b.y - nahe.y))[0];
  }

  haeltSich(m: Mensch): boolean {
    if (this.l.stangen.some((s) => Math.hypot(s[0] - m.x, s[1] - m.y) < HALTEN_NAH)) return true;
    // Im Gang zwischen Sitzreihen hält man sich an den Griffen der Sitze
    return Math.abs(m.y) < 0.3 && this.sitze.some((s) => Math.abs(s.p[0] - m.x) < 0.5 && Math.abs(s.p[1]) < 0.5);
  }

  // --- Was der Spieler tut ---

  /** E: Fahrkarte zeigen, hinsetzen, aufstehen oder (an der Fokuszone) einsteigen. */
  aktion(t: number): SzenenMeldung | null {
    const ich = this.ich;
    if (this.fahrkarteSeit !== null) { this.fahrkarteSeit = null; this.fahrer.ruf = { text: "Danke, gute Fahrt!", bis: t + 2 }; return "fahrkarte"; }
    if (ich.sitz !== null) {
      const senior = this.fahrgaeste.find((f) => f.art === "senior" && f.zustand === "drin" && f.sitz === null);
      const s = this.sitze[ich.sitz];
      this.aufstehen(ich);
      if (senior) {
        this.setze(senior, s);
        this.rufe(senior, RUFE.danke, t);
        this.seit.delete("senior");
        return "platzAngeboten";
      }
      return null;
    }
    if (drin(ich.x, ich.y, this.l)) {
      const s = this.sitzInReichweite(ich);
      if (s) { s.belegt = "ich"; ich.sitz = s.id; ich.x = s.p[0]; ich.y = s.p[1]; ich.weg = []; ich.fest = true; ich.r = SITZ_R; }
      return null;
    }
    if (this.phase === "einsteigen" && this.l.tuerX.some((_, i) => inRechteck(ich.x, ich.y, tuerZonen(i, this.l).fokus, 0.3))) {
      const i = this.l.tuerX.map((x, k) => ({ k, d: Math.abs(x - ich.x) })).sort((a, b) => a.d - b.d)[0].k;
      const ziel = this.stehplatz(true) ?? [this.l.tuerX[i], 0.5];
      ich.ziel = ziel;
      ich.weg = this.hinein(i, ziel);
    }
    return null;
  }

  /** B: Rucksack ab oder auf. Abnehmen im Bus ist richtig. */
  rucksack(): SzenenMeldung | null {
    this.ich.rucksack = !this.ich.rucksack;
    this.ich.r = this.ich.rucksack ? 0.27 : 0.23;
    return !this.ich.rucksack && drin(this.ich.x, this.ich.y, this.l) ? "rucksackAb" : null;
  }

  /** Mausklick in der Szene: dorthin gehen (Wegsuche um Sitze, Leute und Wände). */
  gehZu(x: number, y: number) {
    if (this.ich.sitz !== null) this.aufstehen(this.ich);
    this.geh(this.ich, [x, y]);
  }

  /** Tasten/Stick: ein kleines Stück in Richtung (dx, dy) laufen. */
  laufe(dx: number, dy: number, tempo: number) {
    if (this.ich.sitz !== null) return;
    const l = Math.hypot(dx, dy);
    if (l < 0.01) { if (this.ich.weg.length === 1 && this.ich.ziel === undefined) this.ich.weg = []; return; }
    this.ich.tempo = tempo;
    this.ich.ziel = undefined;
    this.ich.weg = [[this.ich.x + (dx / l) * 0.35, this.ich.y + (dy / l) * 0.35]];
  }
}
