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

export const BUS_L = 12, BUS_B = 2.55;
/** Innenraum (ohne Wände). */
const INNEN = { x0: -5.85, x1: 5.85, y0: -1.13, y1: 1.13 };
/** Außenkante auf der Türseite. */
export const AUSSEN_Y = BUS_B / 2;
/** Türmitten längs: vorn beim Fahrer, Mitte, hinten. */
export const TUER_X = [4.85, 0.4, -3.6] as const;
export const TUER_W = 1.2;
/** Der Fahrerplatz vorn links. */
export const FAHRER = { x0: 4.25, x1: 5.85, y0: -1.13, y1: -0.1 };
/** Sondernutzungsfläche gegenüber der Mitteltür. */
export const SNF = { x0: -0.7, x1: 1.6, y0: -1.13, y1: -0.25 };
/** Der Bereich neben dem Bus, den die Szene kennt (Gehweg an der Haltestelle). */
export const RAND = { x0: -7.8, x1: 7.8, y0: INNEN.y0 - 0.2, y1: AUSSEN_Y + 4.2 };

export type Sitz = { id: number; p: P; vorrang: boolean; belegt: string | null };

/** Sitze: links 2er-Reihen, rechts wo keine Tür ist, hinten die Bank. Die vorderen sind Vorrangsitze. */
function baueSitze(): Sitz[] {
  const reihen: { x: number; seite: -1 | 1 }[] = [];
  for (const x of [3.6, 2.8, -1.1, -1.9, -2.7, -3.5, -4.3, -5.0]) reihen.push({ x, seite: -1 });
  for (const x of [3.6, 2.8, 1.8, -1.2, -2.0]) reihen.push({ x, seite: 1 });
  const sitze: Sitz[] = [];
  for (const r of reihen) for (const y of [0.44, 0.88]) sitze.push({ id: sitze.length, p: [r.x, y * r.seite], vorrang: r.x > 2.5, belegt: null });
  for (const y of [-0.88, -0.44, 0, 0.44, 0.88]) sitze.push({ id: sitze.length, p: [-5.55, y], vorrang: false, belegt: null });
  return sitze;
}

/** Haltestangen: an den Türen, an der Sondernutzungsfläche und längs am Gang. */
export const STANGEN: P[] = [
  ...TUER_X.flatMap((x) => [[x - TUER_W / 2 - 0.1, 0.95], [x + TUER_W / 2 + 0.1, 0.95]] as P[]),
  [SNF.x0, -0.3], [SNF.x1, -0.3], [0.45, -0.3], [3.2, -0.3], [3.2, 0.3], [-1.5, -0.3], [-2.3, 0.3], [-3.1, -0.3], [-4.7, -0.3], [-4.7, 0.3], [2.3, 0.3],
];
const HALTEN_NAH = 0.75;
const SITZ_R = 0.12;

const inRechteck = (x: number, y: number, r: { x0: number; x1: number; y0: number; y1: number }, rand = 0) =>
  x > r.x0 - rand && x < r.x1 + rand && y > r.y0 - rand && y < r.y1 + rand;

/** Ist hier eine Wand, ein Sitz oder der Fahrer? `offen`: die Türen sind offen. */
function frei(x: number, y: number, sitze: Sitz[], offen: boolean): boolean {
  if (!inRechteck(x, y, RAND)) return false;
  const drinnen = inRechteck(x, y, INNEN);
  if (drinnen) {
    if (inRechteck(x, y, FAHRER)) return false;
    // Ein Sitzpaar ist ein Block (kein Spalt zwischen Fenster- und Gangsitz).
    return !sitze.some((s) => Math.abs(x - s.p[0]) < 0.21 && Math.abs(y - s.p[1]) < 0.23);
  }
  // Wand: zwischen Innenraum und Außenkante — außer in einer offenen Tür.
  if (y > INNEN.y1 - 0.01 && y < AUSSEN_Y + 0.08) return offen && x > INNEN.x0 && x < INNEN.x1 && TUER_X.some((t) => Math.abs(x - t) < TUER_W / 2 - 0.05);
  // Draußen nur auf der Türseite (die andere ist Fahrbahn).
  return y >= AUSSEN_Y + 0.08;
}

export const drin = (x: number, y: number) => inRechteck(x, y, INNEN, 0.02);

/** Zonen an einer Tür, wie auf dem Schaubild: Fokus zum Einsteigen, seitlich warten, frei halten. */
export function tuerZonen(i: number) {
  const x = TUER_X[i];
  return {
    fokus: { x0: x - TUER_W / 2, x1: x + TUER_W / 2, y0: AUSSEN_Y + 0.05, y1: AUSSEN_Y + 0.85 },
    warten: [[x - 1.75, AUSSEN_Y + 1.1], [x + 1.75, AUSSEN_Y + 1.1]] as P[],
    wartenR: 0.85,
    /** Frei halten: Fächer vor der Tür, so weit wie Aussteigende ihn brauchen. */
    freiMitte: [x, AUSSEN_Y] as P, freiR: 2.6, freiBreite: 0.62,
  };
}

/** Im Fächer vor der Tür (Frei-halten-Zone)? */
export function imFreiraum(i: number, x: number, y: number): boolean {
  const z = tuerZonen(i);
  const dx = x - z.freiMitte[0], dy = y - z.freiMitte[1];
  if (dy < 0.05 || Math.hypot(dx, dy) > z.freiR) return false;
  return Math.abs(Math.atan2(dx, dy)) < z.freiBreite;
}

/** Seitlich neben der Tür, in einer der beiden Wartezonen? */
export function inWartezone(i: number, x: number, y: number): boolean {
  const z = tuerZonen(i);
  return y > AUSSEN_Y && z.warten.some((w) => Math.hypot(x - w[0], y - w[1]) < z.wartenR) && !imFreiraum(i, x, y);
}

/** Drinnen nah an einer Tür (Aussteigende kommen hier durch). */
export function amAusgang(i: number, x: number, y: number) {
  return drin(x, y) && Math.abs(x - TUER_X[i]) < TUER_W / 2 + 0.35 && y > 0.25;
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
  | "tuerBlockiert" | "gutEingestiegen" | "imWeg" | "rausRein" | "platzAngeboten" | "sitzenGeblieben"
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
  /** Rampe an der Mitteltür ist draußen (Rollstuhl). */
  rampe: boolean;
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
  readonly sitze = baueSitze();
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
  private rampeBis = -Infinity;
  private fuellung = 0.5;

  constructor(samen: number, fuellung: number, t: number) {
    this.rnd = zufall(samen);
    this.fuellung = fuellung;
    const z = 0.15;
    const mache = (offen: boolean) => new Raster(RAND.x0, RAND.y0, Math.ceil((RAND.x1 - RAND.x0) / z), Math.ceil((RAND.y1 - RAND.y0) / z), z,
      (x, y) => frei(x, y, this.sitze, offen));
    this.rasterZu = mache(false);
    this.rasterOffen = mache(true);
    this.fuelle(fuellung, t);
  }

  raster(): Raster { return this.phase === "aussteigen" || this.phase === "einsteigen" ? this.rasterOffen : this.rasterZu; }

  /** Stehplätze drinnen: freie Punkte, nicht vor Türen, nicht auf der Sondernutzungsfläche. */
  private stehplatz(auchTuer = false, snf = false): P | null {
    const r = this.rasterZu;
    const alle = [...this.fahrgaeste.filter((f) => f.zustand !== "weg"), this.ich];
    for (let versuch = 0; versuch < 60; versuch++) {
      const x = INNEN.x0 + 0.4 + this.rnd() * (INNEN.x1 - INNEN.x0 - 0.8), y = INNEN.y0 + 0.3 + this.rnd() * (INNEN.y1 - INNEN.y0 - 0.6);
      if (!r.begehbar(x, y)) continue;
      if (!snf && inRechteck(x, y, SNF, 0.2)) continue;
      if (snf && !inRechteck(x, y, SNF, -0.35)) continue;
      if (!auchTuer && TUER_X.some((_, i) => amAusgang(i, x, y))) continue;
      // Nicht in die Beinfreiheit zwischen zwei Sitzreihen
      if (this.sitze.some((s) => Math.abs(s.p[0] - x) < 0.6 && Math.abs(s.p[1] - y) < 0.3)) continue;
      if (alle.some((m) => Math.hypot(m.x - x, m.y - y) < m.r + 0.3)) continue;
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
  private fuelle(fuellung: number, t: number) {
    const anzahl = Math.round(fuellung * 46);
    for (let i = 0; i < anzahl; i++) {
      const art: FahrgastArt = this.rnd() < 0.12 ? "senior" : this.rnd() < 0.3 ? "kind" : "erwachsen";
      const sitz = this.freierSitz(art === "senior");
      if (sitz && this.rnd() < 0.92) {
        const f = this.neuerFahrgast(art, sitz.p[0], sitz.p[1], "drin");
        this.setze(f, sitz);
      } else {
        const p = this.stehplatz(fuellung > 0.7);
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
      // Kinderwagen und Rollstuhl an die Mitteltür, sonst vorn oder Mitte
      f.tuer = f.art === "kinderwagen" || f.art === "rollstuhl" ? 1 : this.rnd() < 0.5 ? 0 : 1;
      const z = tuerZonen(f.tuer);
      const w = z.warten[this.rnd() < 0.5 ? 0 : 1];
      f.x = w[0] + (this.rnd() - 0.5) * 3; f.y = AUSSEN_Y + 2.2 + this.rnd() * 1.5;
      f.draengler = f.art === "erwachsen" && this.rnd() < 0.12;
      this.geh(f, f.draengler ? [TUER_X[f.tuer] + (this.rnd() - 0.5) * 0.4, AUSSEN_Y + 0.55] : [w[0] + (this.rnd() - 0.5) * 0.8, w[1] + this.rnd() * 0.5]);
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
        const tuer = f.x > 3.6 ? 0 : f.x > -1.6 ? 1 : 2;
        f.tuer = tuer;
        f.zustand = "steigtAus";
        const seite = this.rnd() < 0.5 ? -1 : 1;
        // Zur Tür, gerade hinaus (durch den Freihalte-Fächer), dann zur Seite weg.
        const innen: P = [TUER_X[tuer], INNEN.y1 - 0.35];
        f.ziel = [TUER_X[tuer] + seite * 2.8, RAND.y1 - 0.3];
        f.weg = [...(this.rasterZu.suche([f.x, f.y], innen) ?? [innen]), [TUER_X[tuer], AUSSEN_Y + 1.5], f.ziel];
      } else if (f.zustand === "steigtAus" && (f.y > RAND.y1 - 0.6 || (!f.weg.length && f.y > AUSSEN_Y + 1))) {
        f.zustand = "weg";
      } else if (f.zustand === "wartet" && phase === "einsteigen") {
        f.zustand = "steigtEin";
        this.einsteigenLassen(f, t);
      } else if (f.zustand === "steigtEin" && !f.weg.length && drin(f.x, f.y)) {
        f.zustand = "drin";
        const s = f.art === "kinderwagen" || f.art === "rollstuhl" ? null : this.sitzInReichweite(f);
        if (s) this.setze(f, s);
      } else if (f.zustand === "steigtEin" && !f.weg.length && !drin(f.x, f.y) && phase === "einsteigen") {
        this.einsteigenLassen(f, t);
      } else if (f.zustand === "machtPlatz" && phase === "einsteigen" && !f.weg.length) {
        f.zustand = "steigtEin";
        this.geh(f, f.zurueck ?? this.stehplatz(true) ?? [0, 0]);
      }
      // Bus fährt los, wer draußen steht, bleibt da (nächster Bus)
      if ((phase === "faehrt" || phase === "zu") && (f.zustand === "wartet" || f.zustand === "steigtEin" || f.zustand === "machtPlatz") && !drin(f.x, f.y)) {
        if (this.vorPhase === "schliessen") f.zustand = "weg";
      }
      if ((phase === "faehrt" || phase === "zu" || phase === "schliessen") && f.zustand === "steigtEin" && drin(f.x, f.y) && !f.weg.length) f.zustand = "drin";
    }

    // Aussteigen beginnt: wer drinnen an der Tür steht und nicht raus will, macht Platz
    if (phase === "aussteigen" && this.vorPhase !== "aussteigen") {
      for (let i = 0; i < 3; i++) {
        if (!this.fahrgaeste.some((f) => f.zustand === "steigtAus" && f.tuer === i)) continue;
        for (const f of this.fahrgaeste) {
          if (f.zustand !== "drin" || f.sitz !== null || !amAusgang(i, f.x, f.y)) continue;
          const platz = this.fuellung < 0.7 ? this.stehplatz(false) : null;
          if (platz) this.geh(f, platz);
          else {
            // Sehr voll: kurz raussteigen und seitlich warten, danach wieder rein
            f.zurueck = [f.x, f.y];
            f.zustand = "machtPlatz";
            const z = tuerZonen(i);
            this.geh(f, z.warten[f.x < TUER_X[i] ? 0 : 1]);
          }
        }
      }
    }

    // --- Der Spieler ---
    const imBus = drin(ich.x, ich.y);
    ich.drin = imBus;
    if (this.mitIch) {
      const aussteiger = (i: number) => this.fahrgaeste.filter((f) => f.zustand === "steigtAus" && f.tuer === i && (drin(f.x, f.y) || f.y < AUSSEN_Y + 1.2));
      // Draußen während des Aussteigens: im Fächer vor der Tür = blockiert
      if (!imBus && phase === "aussteigen") {
        for (let i = 0; i < 3; i++) {
          if (!aussteiger(i).length) continue;
          if (imFreiraum(i, ich.x, ich.y) && this.dauer(`frei${i}`, true, t) > 0.8) {
            this.einmal(`${hk}:blockiert`, "tuerBlockiert", aus);
            this.rufe(aussteiger(i)[0], RUFE.rausLassen, t);
          } else if (!imFreiraum(i, ich.x, ich.y)) this.dauer(`frei${i}`, false, t);
          if (inWartezone(i, ich.x, ich.y)) this.wartetBeimAussteigen = true;
        }
        if (TUER_X.some((_, i) => inWartezone(i, ich.x, ich.y))) hinweis = "Gut so: seitlich warten, bis alle draußen sind.";
        else if (TUER_X.some((_, i) => imFreiraum(i, ich.x, ich.y))) hinweis = "Du stehst im Weg! Stell dich seitlich neben die Tür (grüne Zone).";
      }
      // Drinnen an der Tür, während andere aussteigen: raus und wieder rein
      if (imBus && phase === "aussteigen") {
        for (let i = 0; i < 3; i++) {
          if (!aussteiger(i).length || !amAusgang(i, ich.x, ich.y)) { this.dauer(`drinnen${i}`, false, t); continue; }
          hinweis = "Du stehst an der Tür im Weg: kurz aussteigen, seitlich warten, dann wieder einsteigen.";
          const d = this.dauer(`drinnen${i}`, !ich.weg.length, t);
          if (d > 1) this.rufe(aussteiger(i)[0], this.fuellung > 0.6 ? RUFE.kurzRaus : RUFE.rausLassen, t);
          if (d > 3.5) this.einmal(`${hk}:imWeg`, "imWeg", aus);
        }
      }
      if (warErDrin && !imBus && phase === "aussteigen" && this.fahrgaeste.some((f) => f.zustand === "steigtAus")) this.rausFuerAndere = true;
      // Einsteigen
      if (!warErDrin && imBus) {
        eingestiegen = TUER_X.findIndex((x) => Math.abs(ich.x - x) < TUER_W);
        if (phase === "aussteigen" && this.fahrgaeste.some((f) => f.zustand === "steigtAus" && drin(f.x, f.y))) {
          this.einmal(`${hk}:blockiert`, "tuerBlockiert", aus);
          this.rufe(this.fahrgaeste.find((f) => f.zustand === "steigtAus"), RUFE.rausLassen, t);
        } else if (this.rausFuerAndere) this.einmal(`${hk}:rausRein`, "rausRein", aus);
        else if (this.wartetBeimAussteigen) this.einmal(`${hk}:gut`, "gutEingestiegen", aus);
        if (eingestiegen === 0) {
          this.fahrkarteSeit = t;
          this.rufe(this.fahrer, RUFE.fahrkarte, t, 3.5);
        }
      }
      if (warErDrin && !imBus && !this.rausFuerAndere) ausgestiegen = true;
      if (this.fahrkarteSeit !== null) {
        hinweis = "E drücken: Fahrkarte zeigen";
        if (t - this.fahrkarteSeit > 8) this.fahrkarteSeit = null;
      }

      // An der Fokuszone: E steigt ein
      if (!imBus && phase === "einsteigen" && TUER_X.some((_, i) => inRechteck(ich.x, ich.y, tuerZonen(i).fokus, 0.3))) hinweis = "E drücken: einsteigen";
      if (!imBus && phase === "aussteigen" && hinweis === null && TUER_X.some((_, i) => inRechteck(ich.x, ich.y, tuerZonen(i).fokus, 0.2))) hinweis = "Erst aussteigen lassen — seitlich warten!";

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
      const ichAufSnf = imBus && inRechteck(ich.x, ich.y, SNF, 0.25);
      if (braucht && ichAufSnf) {
        hinweis = `Der ${braucht.art === "rollstuhl" ? "Rollstuhl" : "Kinderwagen"} braucht den Platz — geh da weg!`;
        const d = this.dauer("snf", true, t);
        if (d > 1) this.rufe(braucht, RUFE.snf, t);
        if (d > 7) this.einmal(`${hk}:snf`, "snfBlockiert", aus);
      } else if (braucht && this.seit.has("snf")) { this.einmal(`${hk}:snfFrei`, "snfFrei", aus); this.dauer("snf", false, t); }

      // Rucksack im vollen Bus
      if (imBus && ich.rucksack && ich.sitz === null && this.fuellung > 0.5) {
        hinweis ??= "B drücken: Rucksack abnehmen (im vollen Bus stößt er alle an)";
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
      if (phase === "schliessen" && ich.y > INNEN.y1 - 0.05 && ich.y < AUSSEN_Y + 0.1 && TUER_X.some((x) => Math.abs(ich.x - x) < TUER_W / 2)) {
        this.einmal(`${hk}:tuerZu`, "tuerZu", aus);
        this.rufe(this.fahrer, RUFE.tuerZu, t);
        ich.y = ich.y < (INNEN.y1 + AUSSEN_Y) / 2 ? INNEN.y1 - 0.3 : AUSSEN_Y + 0.4;
        ich.weg = [];
      }
    }

    // Drängler vor der Tür: die Aussteigenden beschweren sich
    for (const f of this.fahrgaeste) if (f.draengler && phase === "aussteigen" && TUER_X.some((_, i) => imFreiraum(i, f.x, f.y)))
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
    return { meldungen: aus, hinweis: this.mitIch ? hinweis : null, eingestiegen, ausgestiegen, rampe: t < this.rampeBis };
  }

  /** Der Fahrer ruft auch mal etwas (als Fahrgast ohne Bewegung geführt). */
  readonly fahrer: Fahrgast = {
    id: "fahrer", art: "erwachsen", x: 5.15, y: -0.62, r: 0.25, tempo: 0, weg: [], fest: true, farbe: 0x1f3a5f, rucksack: false,
    zustand: "drin", sitz: null, raus: false, tuer: 0,
  };

  private einsteigenLassen(f: Fahrgast, t: number) {
    // Rollstuhl: erst die Rampe
    if (f.art === "rollstuhl" && this.rampeBis < t) this.rampeBis = t + 5;
    const ziel = f.art === "kinderwagen" || f.art === "rollstuhl" ? this.stehplatz(true, true) ?? [0.4, -0.7] as P
      : (f.art === "senior" ? this.freierSitz(true, [TUER_X[f.tuer], 0])?.p : this.rnd() < 0.7 ? this.freierSitz(false, [TUER_X[f.tuer], 0])?.p : null)
        ?? this.stehplatz(this.fuellung > 0.7) ?? [TUER_X[f.tuer], 0.6];
    // Erst an die Tür, dann hinein zum Ziel (bei Sitzen in den Gang daneben)
    const vorSitz: P = this.sitze.some((s) => s.p[0] === ziel[0] && s.p[1] === ziel[1]) ? [ziel[0], 0] : ziel;
    f.ziel = vorSitz;
    f.weg = this.hinein(f.tuer, vorSitz);
  }

  /** Durch Tür `i` hinein und drinnen weiter zum Ziel (der Weg drinnen, als wären die Türen zu). */
  private hinein(i: number, ziel: P): P[] {
    const innen: P = [TUER_X[i], INNEN.y1 - 0.35];
    return [[TUER_X[i], AUSSEN_Y + 0.3], innen, ...(this.rasterZu.suche(innen, ziel) ?? [ziel])];
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
    if (STANGEN.some((s) => Math.hypot(s[0] - m.x, s[1] - m.y) < HALTEN_NAH)) return true;
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
    if (drin(ich.x, ich.y)) {
      const s = this.sitzInReichweite(ich);
      if (s) { s.belegt = "ich"; ich.sitz = s.id; ich.x = s.p[0]; ich.y = s.p[1]; ich.weg = []; ich.fest = true; ich.r = SITZ_R; }
      return null;
    }
    if (this.phase === "einsteigen" && TUER_X.some((_, i) => inRechteck(ich.x, ich.y, tuerZonen(i).fokus, 0.3))) {
      const i = TUER_X.map((x, k) => ({ k, d: Math.abs(x - ich.x) })).sort((a, b) => a.d - b.d)[0].k;
      const ziel = this.stehplatz(true) ?? [TUER_X[i], 0.5];
      ich.ziel = ziel;
      ich.weg = this.hinein(i, ziel);
    }
    return null;
  }

  /** B: Rucksack ab oder auf. Abnehmen im Bus ist richtig. */
  rucksack(): SzenenMeldung | null {
    this.ich.rucksack = !this.ich.rucksack;
    this.ich.r = this.ich.rucksack ? 0.27 : 0.23;
    return !this.ich.rucksack && drin(this.ich.x, this.ich.y) ? "rucksackAb" : null;
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
