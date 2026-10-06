/**
 * Code-Abenteuer — die Spielwelt und der Interpreter für die Programme.
 *
 * Reine Rechnung ohne DOM: eine Karte aus Zeichen, eine Figur mit Blickrichtung,
 * Gegner auf festen Streifen und ein Programm als Baum aus Befehlen. `fuehreAus`
 * spielt ein Programm ganz durch und liefert jeden Zwischenstand, die Oberfläche
 * zeigt sie nur nacheinander. Die Direktsteuerung (Pfeiltasten) benutzt dieselbe
 * `Welt`, damit beide Wege exakt dieselben Regeln haben.
 *
 * Kartenzeichen:  #  Wand     .  Boden   a  Ding A (Kristall, Donut …)
 *                 b  Ding B   x  Gefahr  Z  Ziel     ^ > v <  Start mit Blickrichtung
 */

/** 0 = hoch, 1 = rechts, 2 = runter, 3 = links */
export type Richtung = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const PFEIL = ["↑", "→", "↓", "←"] as const;
const START_ZEICHEN = "^>v<";

export type BedingungArt = "frei" | "frei_links" | "frei_rechts" | "ding" | "ziel" | "gegner";
export interface Bedingung { art: BedingungArt; nicht?: boolean }

/** `id` ordnet einen Schritt seinem Baustein zu (zum Aufleuchten im Editor). */
export type Befehl = { id?: string } & (
  | { t: "geh"; r: Richtung }
  | { t: "vor" }
  | { t: "links" }
  | { t: "rechts" }
  | { t: "nimm" }
  | { t: "warte" }
  | { t: "wiederhole"; n: number; k: Befehl[] }
  | { t: "bis"; b: Bedingung; k: Befehl[] }
  | { t: "wenn"; b: Bedingung; k: Befehl[]; sonst?: Befehl[] }
  | { t: "rufe" }
);
export type BefehlTyp = Befehl["t"];

export interface Programm { haupt: Befehl[]; fn: Befehl[] }
export const LEER: Programm = { haupt: [], fn: [] };

export interface Gegner {
  /** Felder, die der Gegner der Reihe nach abläuft — am Ende kehrt er um. */
  weg: [number, number][];
  /** `kreis`: vom letzten Feld direkt wieder zum ersten statt umzukehren. */
  kreis?: boolean;
}

export interface Karte {
  zeilen: string[];
  gegner?: Gegner[];
  /** Ding B darf erst genommen werden, wenn kein Ding A mehr liegt (»Nachtisch zuletzt«). */
  bZuletzt?: boolean;
}

export type FehlerArt = "ausfuehrbar" | "endlich" | "gefahr" | "gegner" | "reihenfolge" | "unfertig";
export interface Fehler { art: FehlerArt; text: string }

export interface Zustand {
  x: number;
  y: number;
  r: Richtung;
  /** genommene Dinge als "x,y" */
  genommen: string[];
  /** je Gegner der Index auf seinem Weg */
  gegner: number[];
  /** Id des Bausteins, der diesen Stand erzeugt hat */
  aktiv?: string;
}

export type Ergebnis = { ok: true } | { ok: false; fehler: Fehler };
export interface Lauf { schritte: Zustand[]; ergebnis: Ergebnis }

/** Höchstzahl an Arbeitsschritten (Befehle + Prüfungen) — darüber gilt das Programm als endlos. */
export const MAX_ARBEIT = 3000;
const MAX_TIEFE = 30;

export function gegnerFeld(g: Gegner, i: number): [number, number] {
  return g.weg[i];
}

function naechsterGegnerIndex(g: Gegner, i: number, rueck: boolean): { i: number; rueck: boolean } {
  if (g.weg.length < 2) return { i, rueck };
  if (g.kreis) return { i: (i + 1) % g.weg.length, rueck };
  if (!rueck && i === g.weg.length - 1) return { i: i - 1, rueck: true };
  if (rueck && i === 0) return { i: 1, rueck: false };
  return { i: rueck ? i - 1 : i + 1, rueck };
}

export function startVon(karte: Karte): Zustand {
  for (let y = 0; y < karte.zeilen.length; y++) {
    const zeile = karte.zeilen[y];
    for (let x = 0; x < zeile.length; x++) {
      const r = START_ZEICHEN.indexOf(zeile[x]);
      if (r >= 0) return { x, y, r: r as Richtung, genommen: [], gegner: (karte.gegner ?? []).map(() => 0) };
    }
  }
  throw new Error("Karte ohne Startfeld");
}

export class FehlerStopp extends Error {
  constructor(public fehler: Fehler) { super(fehler.text); }
}
class GewonnenStopp extends Error {}

/** Die laufende Welt — veränderlich, eine je Lauf. */
export class Welt {
  z: Zustand;
  private rueck: boolean[];
  private arbeit = 0;
  readonly schritte: Zustand[] = [];
  readonly gesamtA: number;
  readonly gesamtB: number;
  readonly hatZiel: boolean;

  constructor(readonly karte: Karte) {
    this.z = startVon(karte);
    this.rueck = (karte.gegner ?? []).map(() => false);
    let a = 0, b = 0, ziel = false;
    for (const zeile of karte.zeilen) for (const c of zeile) {
      if (c === "a") a++;
      else if (c === "b") b++;
      else if (c === "Z") ziel = true;
    }
    this.gesamtA = a;
    this.gesamtB = b;
    this.hatZiel = ziel;
    this.schritte.push(kopie(this.z));
  }

  zeichen(x: number, y: number): string {
    const c = this.karte.zeilen[y]?.[x];
    if (c === undefined) return "#";
    if ((c === "a" || c === "b") && this.z.genommen.includes(`${x},${y}`)) return ".";
    return c;
  }

  begehbar(x: number, y: number): boolean {
    return this.zeichen(x, y) !== "#";
  }

  private gegnerAuf(x: number, y: number): boolean {
    return (this.karte.gegner ?? []).some((g, i) => {
      const [gx, gy] = gegnerFeld(g, this.z.gegner[i]);
      return gx === x && gy === y;
    });
  }

  /** Alles eingesammelt und (falls es eins gibt) auf dem Ziel. */
  gewonnen(): boolean {
    if (this.z.genommen.length < this.gesamtA + this.gesamtB) return false;
    return !this.hatZiel || this.zeichen(this.z.x, this.z.y) === "Z";
  }

  pruefe(b: Bedingung): boolean {
    this.arbeite();
    const { x, y, r } = this.z;
    const frei = (rr: number) => {
      const nx = x + DX[rr], ny = y + DY[rr];
      return this.begehbar(nx, ny) && this.zeichen(nx, ny) !== "x";
    };
    let w: boolean;
    switch (b.art) {
      case "frei": w = frei(r); break;
      case "frei_links": w = frei((r + 3) % 4); break;
      case "frei_rechts": w = frei((r + 1) % 4); break;
      case "ding": { const c = this.zeichen(x, y); w = c === "a" || c === "b"; break; }
      case "ziel": w = this.gewonnen(); break;
      case "gegner": w = this.gegnerAuf(x + DX[r], y + DY[r]); break;
    }
    return b.nicht ? !w : w;
  }

  private arbeite() {
    if (++this.arbeit > MAX_ARBEIT) {
      throw new FehlerStopp({ art: "endlich", text: "Das Programm hört nicht auf — es ist nicht endlich." });
    }
  }

  /** Ein sichtbarer Schritt: Figur handelt, dann ziehen die Gegner. */
  handle(t: "geh" | "vor" | "links" | "rechts" | "nimm" | "warte", r?: Richtung, id?: string) {
    this.arbeite();
    const z = this.z;
    if (t === "links") z.r = ((z.r + 3) % 4) as Richtung;
    else if (t === "rechts") z.r = ((z.r + 1) % 4) as Richtung;
    else if (t === "geh" || t === "vor") {
      if (t === "geh") z.r = r!;
      const nx = z.x + DX[z.r], ny = z.y + DY[z.r];
      if (!this.begehbar(nx, ny)) {
        this.merke(id);
        throw new FehlerStopp({ art: "ausfuehrbar", text: "Da ist eine Wand — dieser Schritt ist nicht ausführbar." });
      }
      const vorher = this.gegnerFelder();
      z.x = nx; z.y = ny;
      if (this.zeichen(nx, ny) === "x") {
        this.merke(id);
        throw new FehlerStopp({ art: "gefahr", text: "Autsch — mitten in die Gefahr gelaufen." });
      }
      this.bewegeGegner();
      this.pruefeGegner(vorher, id);
      this.merke(id);
      if (this.gewonnen()) throw new GewonnenStopp();
      return;
    } else if (t === "nimm") {
      const c = this.zeichen(z.x, z.y);
      if (c !== "a" && c !== "b") {
        this.merke(id);
        throw new FehlerStopp({ art: "ausfuehrbar", text: "Hier liegt nichts — dieser Schritt ist nicht ausführbar." });
      }
      if (c === "b" && this.karte.bZuletzt && this.restA() > 0) {
        this.merke(id);
        throw new FehlerStopp({ art: "reihenfolge", text: "Das kommt zuletzt — erst alles andere einsammeln!" });
      }
      z.genommen = [...z.genommen, `${z.x},${z.y}`];
    }
    const vorher = this.gegnerFelder();
    this.bewegeGegner();
    this.pruefeGegner(vorher, id);
    this.merke(id);
    if (this.gewonnen()) throw new GewonnenStopp();
  }

  restA(): number {
    return this.gesamtA - this.z.genommen.filter(k => this.karte.zeilen[+k.split(",")[1]][+k.split(",")[0]] === "a").length;
  }

  private gegnerFelder(): [number, number][] {
    return (this.karte.gegner ?? []).map((g, i) => gegnerFeld(g, this.z.gegner[i]));
  }

  private bewegeGegner() {
    (this.karte.gegner ?? []).forEach((g, i) => {
      const n = naechsterGegnerIndex(g, this.z.gegner[i], this.rueck[i]);
      this.z.gegner = this.z.gegner.map((v, j) => (j === i ? n.i : v));
      this.rueck[i] = n.rueck;
    });
  }

  /**
   * Erwischt, wenn der Gegner vor oder nach seinem Zug auf unserem Feld steht —
   * man darf also weder auf ihn treten noch ihn auf sich treten lassen.
   */
  private pruefeGegner(vorher: [number, number][], id?: string) {
    const { x, y } = this.z;
    const nachher = this.gegnerFelder();
    const erwischt = [...vorher, ...nachher].some(([gx, gy]) => gx === x && gy === y);
    if (erwischt) {
      this.merke(id);
      throw new FehlerStopp({ art: "gegner", text: "Erwischt! Der Gegner war schneller." });
    }
  }

  private merke(id?: string) {
    this.schritte.push({ ...kopie(this.z), aktiv: id });
  }

  fuehre(liste: Befehl[], prog: Programm, tiefe = 0) {
    if (tiefe > MAX_TIEFE) {
      throw new FehlerStopp({ art: "endlich", text: "Das Unterprogramm ruft sich immer wieder selbst auf — nicht endlich." });
    }
    for (const b of liste) {
      switch (b.t) {
        case "geh": this.handle("geh", b.r, b.id); break;
        case "vor": case "links": case "rechts": case "nimm": case "warte": this.handle(b.t, undefined, b.id); break;
        case "wiederhole":
          for (let i = 0; i < b.n; i++) { this.arbeite(); this.fuehre(b.k, prog, tiefe); }
          break;
        case "bis":
          while (!this.pruefe(b.b)) this.fuehre(b.k, prog, tiefe);
          break;
        case "wenn":
          if (this.pruefe(b.b)) this.fuehre(b.k, prog, tiefe);
          else if (b.sonst) this.fuehre(b.sonst, prog, tiefe);
          break;
        case "rufe": this.arbeite(); this.fuehre(prog.fn, prog, tiefe + 1); break;
      }
    }
  }
}

function kopie(z: Zustand): Zustand {
  return { x: z.x, y: z.y, r: z.r, genommen: [...z.genommen], gegner: [...z.gegner] };
}

/**
 * Spielt ein Programm auf einer Karte vollständig durch. Gewonnen ist sofort,
 * wenn alles eingesammelt (und das Ziel erreicht) ist — danach läuft nichts mehr.
 */
export function fuehreAus(karte: Karte, prog: Programm): Lauf {
  const w = new Welt(karte);
  try {
    if (w.gewonnen()) return { schritte: w.schritte, ergebnis: { ok: true } };
    w.fuehre(prog.haupt, prog);
  } catch (e) {
    if (e instanceof GewonnenStopp) return { schritte: w.schritte, ergebnis: { ok: true } };
    if (e instanceof FehlerStopp) return { schritte: w.schritte, ergebnis: { ok: false, fehler: e.fehler } };
    throw e;
  }
  return { schritte: w.schritte, ergebnis: { ok: false, fehler: unfertig(w) } };
}

function unfertig(w: Welt): Fehler {
  const rest = w.gesamtA + w.gesamtB - w.z.genommen.length;
  if (rest > 0) return { art: "unfertig", text: `Das Programm ist zu Ende, aber es fehlt noch ${rest === 1 ? "ein Ding" : `${rest} Dinge`}.` };
  return { art: "unfertig", text: "Das Programm ist zu Ende, aber das Ziel ist noch nicht erreicht." };
}

/** Ein einzelner Schritt der Direktsteuerung. Gibt den neuen Lauf-Ausschnitt zurück. */
export function direktSchritt(w: Welt, t: "geh" | "nimm", r?: Richtung): Ergebnis | null {
  try {
    w.handle(t, r);
    return null;
  } catch (e) {
    if (e instanceof GewonnenStopp) return { ok: true };
    if (e instanceof FehlerStopp) return { ok: false, fehler: e.fehler };
    throw e;
  }
}

/** Bausteine zählen: jeder Befehl eins, Behälter samt Inhalt; das Unterprogramm zählt mit. */
export function zaehle(liste: Befehl[]): number {
  let n = 0;
  for (const b of liste) {
    n++;
    if (b.t === "wiederhole" || b.t === "bis") n += zaehle(b.k);
    if (b.t === "wenn") n += zaehle(b.k) + zaehle(b.sonst ?? []);
  }
  return n;
}
export const bausteine = (p: Programm) => zaehle(p.haupt) + zaehle(p.fn);

/** Sterne: 3 bis zur Bestzahl, 2 bis zwei darüber, sonst 1. */
export function sterne(anzahl: number, optimal: number): 1 | 2 | 3 {
  if (anzahl <= optimal) return 3;
  if (anzahl <= optimal + 2) return 2;
  return 1;
}

let naechsteId = 0;
/** Vergibt fehlende Ids (für das Aufleuchten), ohne vorhandene zu ändern. */
export function mitIds(liste: Befehl[]): Befehl[] {
  return liste.map(b => {
    const id = b.id ?? `b${++naechsteId}`;
    if (b.t === "wiederhole" || b.t === "bis") return { ...b, id, k: mitIds(b.k) };
    if (b.t === "wenn") return { ...b, id, k: mitIds(b.k), ...(b.sonst ? { sonst: mitIds(b.sonst) } : {}) };
    return { ...b, id };
  });
}
