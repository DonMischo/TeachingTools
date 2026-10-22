/**
 * Der Löser: aus einer Schaltung werden Spannungen und Ströme, Schritt für Schritt.
 *
 * Knotenpotenzialverfahren (MNA) wie bei Falstad und SPICE: Drähte verschmelzen
 * Rasterpunkte zu Knoten, jedes Bauteil stempelt Leitwerte und Stromquellen in
 * ein Gleichungssystem, eine Unbekannte je Knoten. Spannungsquellen stehen als
 * Ersatzstromquelle mit Innenwiderstand darin — ein Schulnetzgerät hat einen,
 * und so bleibt das System rein knotenweise.
 *
 * Was Zeit braucht, rechnet mit Begleitmodellen nach der Trapezregel:
 * Kondensator, Spule und Trafo werden je Schritt zu Leitwert + Stromquelle,
 * die die Vorgeschichte tragen. Dioden sind nichtlinear und werden je Schritt
 * mit Newton gelöst, mit der Spannungsbegrenzung aus SPICE (pnjlim), damit die
 * Exponentialfunktion nicht davonläuft.
 *
 * Vorzeichen, einmal für alles: **U = V(a) − V(b)**, **I fließt positiv von a
 * nach b durch das Bauteil**, P = U·I ist aufgenommene Leistung. Eine Batterie
 * hat ihren Pluspol bei `b`; liefert sie, ist P < 0. Wer »abgegeben« anzeigen
 * will, dreht das Zeichen — das tut die Anzeige, nicht die Rechnung.
 */
import { Knotenzaehler, loeseLGS } from "./lgs";
import { anschluesse, schluessel, type Bauteil, type Punkt, type Schaltung } from "./modell";
import { TEILE, TRAFO_L_JE_WINDUNG2 } from "./teile";

/** Geschlossener Schalter, Strommesser, Sicherung: fast nichts, aber nicht null. */
const R_KLEIN = 1e-3;
/** Offener Kontakt, durchgebranntes Bauteil. */
const G_OFFEN = 1e-9;
/** Hält jeden Knoten an Masse fest, auch wenn er in der Luft hängt (offener Schalter, Trafo-Sekundärseite). */
const STUETZE = 1e-12;
const R_VOLTMETER = 1e7;
/** Temperaturspannung bei Raumtemperatur. */
const VT = 0.025852;
const GMIN = 1e-12;

export interface Messung {
  /** U = V(a) − V(b) in Volt; beim Trafo die Primärseite. */
  spannung: number;
  /** I von a nach b durch das Bauteil, in Ampere. */
  strom: number;
  /** Aufgenommene Leistung in Watt. */
  leistung: number;
  /** Lämpchen und LED: 0 (aus) bis 1 (Nennbetrieb), darüber gedeckelt. */
  helligkeit?: number;
  /** Motor: Winkelgeschwindigkeit in rad/s und aufsummierter Winkel. */
  drehzahl?: number;
  winkel?: number;
  /** Durchgebrannt: Lämpchen, Sicherung, LED. */
  kaputt?: boolean;
  /** Trafo: Sekundärseite. */
  spannung2?: number;
  strom2?: number;
}

interface Teil {
  t: Bauteil;
  w: Record<string, number>;
  /** Knotennummer je Anschluss, Reihenfolge wie `anschluesse()`. */
  k: number[];
  /** Spule: Knoten zwischen Wicklungswiderstand und Induktivität, sonst -1. */
  innen: number;
  // Vorgeschichte für die Begleitmodelle
  v: number; i: number; v2: number; i2: number;
  /** Linearisierung aus dem letzten Stempeln: I = G·U + J (Trafo: Matrix H). */
  G: number; J: number; H: [number, number, number, number]; J2: number;
  /** Diode: Spannung, um die zuletzt linearisiert wurde. */
  vd: number;
  omega: number; winkel: number;
  /** Geglättete Last (Lampe: Leistung, LED: Strom, Sicherung: (I/In)²). */
  last: number;
  kaputt: boolean;
  m: Messung;
}

const LEER: Messung = { spannung: 0, strom: 0, leistung: 0 };

/** SPICE-Begrenzung: ein Newton-Schritt darf die Diodenspannung nur logarithmisch heben. */
function pnjlim(vneu: number, valt: number, nvt: number, vkrit: number): number {
  if (vneu > vkrit && Math.abs(vneu - valt) > 2 * nvt) {
    if (valt > 0) {
      const arg = 1 + (vneu - valt) / nvt;
      return arg > 0 ? valt + nvt * Math.log(arg) : vkrit;
    }
    return nvt * Math.log(vneu / nvt);
  }
  return vneu;
}

function diodenKenn(p: Teil) {
  const led = p.t.art === "led";
  const nvt = (led ? 2 : p.w.emission) * VT;
  const iref = led ? p.w.nennstrom : 0.01;
  const is = iref / (Math.exp(p.w.durchlass / nvt) - 1);
  return { nvt, is, vkrit: nvt * Math.log(nvt / (Math.SQRT2 * is)) };
}

export class Simulation {
  zeit = 0;
  private teile: Teil[] = [];
  private nachId = new Map<string, Teil>();
  private knotenVon: Map<string, number>;
  private anzahl: number;
  private pot: number[];
  private draehte: Schaltung["draehte"];
  private drahtStroeme: Map<string, number> | null = null;

  constructor(schaltung: Schaltung) {
    const zaehler = new Knotenzaehler();
    for (const t of schaltung.bauteile) for (const p of anschluesse(t)) zaehler.melde(schluessel(p));
    for (const d of schaltung.draehte) {
      zaehler.melde(schluessel(d.a)); zaehler.melde(schluessel(d.b));
      zaehler.verbinde(schluessel(d.a), schluessel(d.b));
    }
    // Masse ist der Minuspol der ersten Quelle — an den kommt im Versuch das schwarze Kabel.
    const quelle = schaltung.bauteile.find(t => t.art === "batterie")
      ?? schaltung.bauteile.find(t => t.art === "wechselquelle");
    this.knotenVon = zaehler.nummern(quelle ? schluessel(quelle.a) : undefined);
    let anzahl = new Set(this.knotenVon.values()).size || 1;

    for (const t of schaltung.bauteile) {
      const w = { ...TEILE[t.art].werte, ...t.werte };
      const k = anschluesse(t).map(p => this.knotenVon.get(schluessel(p))!);
      const innen = t.art === "spule" && w.widerstand > 0 ? anzahl++ : -1;
      const p: Teil = {
        t, w, k, innen, v: 0, i: 0, v2: 0, i2: 0, G: 0, J: 0, H: [0, 0, 0, 0], J2: 0,
        vd: 0, omega: 0, winkel: 0, last: 0, kaputt: false, m: LEER,
      };
      this.teile.push(p);
      this.nachId.set(t.id, p);
    }
    this.anzahl = anzahl;
    this.pot = new Array(anzahl).fill(0);
    this.draehte = schaltung.draehte;
  }

  /** Rückt die Zeit um `dt` Sekunden vor. */
  schritt(dt: number) {
    if (!(dt > 0)) return;
    const n = this.anzahl - 1;
    const tNeu = this.zeit + dt;
    const dioden = this.teile.filter(p => (p.t.art === "diode" || p.t.art === "led") && !p.kaputt);

    for (let runde = 0; runde < 100; runde++) {
      const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
      const rechts = new Array<number>(n).fill(0);
      for (let i = 0; i < n; i++) A[i][i] += STUETZE;

      const leit = (a: number, b: number, g: number) => {
        const ia = a - 1, ib = b - 1;
        if (ia >= 0) A[ia][ia] += g;
        if (ib >= 0) A[ib][ib] += g;
        if (ia >= 0 && ib >= 0) { A[ia][ib] -= g; A[ib][ia] -= g; }
      };
      /** Strom j fließt durch das Bauteil von a nach b. */
      const strom = (a: number, b: number, j: number) => {
        if (a > 0) rechts[a - 1] -= j;
        if (b > 0) rechts[b - 1] += j;
      };
      /** Strom g·(V(c) − V(d)) fließt von a nach b. */
      const gesteuert = (a: number, b: number, c: number, d: number, g: number) => {
        for (const [zeile, s] of [[a, 1], [b, -1]] as const) {
          if (zeile <= 0) continue;
          if (c > 0) A[zeile - 1][c - 1] += s * g;
          if (d > 0) A[zeile - 1][d - 1] -= s * g;
        }
      };

      for (const p of this.teile) this.stempel(p, dt, tNeu, leit, strom, gesteuert);

      const x = loeseLGS(A, rechts);
      if (!x) { this.pot.fill(0); break; }
      this.pot[0] = 0;
      for (let i = 0; i < n; i++) this.pot[i + 1] = x[i];

      let fertig = true;
      for (const p of dioden) {
        const { nvt, vkrit } = diodenKenn(p);
        const vneu = this.pot[p.k[0]] - this.pot[p.k[1]];
        if (Math.abs(vneu - p.vd) > 1e-7 + 1e-6 * Math.abs(vneu)) fertig = false;
        p.vd = pnjlim(vneu, p.vd, nvt, vkrit);
      }
      if (fertig) break;
    }

    this.zeit = tNeu;
    for (const p of this.teile) this.nachher(p, dt);
    this.drahtStroeme = null;
  }

  /** Rechnet `sekunden` in Schritten von `dt`. */
  laufe(sekunden: number, dt: number) {
    const schritte = Math.round(sekunden / dt);
    for (let s = 0; s < schritte; s++) this.schritt(dt);
  }

  messung(id: string): Messung {
    return this.nachId.get(id)?.m ?? LEER;
  }

  potenzial(p: Punkt): number {
    const k = this.knotenVon.get(schluessel(p));
    return k === undefined ? 0 : this.pot[k];
  }

  /** Ändert einen Wert, ohne die Schaltung neu aufzubauen (Schalter umlegen, Spannung drehen). */
  setzeWert(id: string, name: string, wert: number) {
    const p = this.nachId.get(id);
    if (p) p.w[name] = wert;
  }

  repariere(id: string) {
    const p = this.nachId.get(id);
    if (p) { p.kaputt = false; p.last = 0; }
  }

  /** Strom durch einen Draht von a nach b. */
  drahtStrom(id: string): number {
    if (!this.drahtStroeme) this.drahtStroeme = this.rechneDraehte();
    return this.drahtStroeme.get(id) ?? 0;
  }

  private stempel(
    p: Teil, dt: number, t: number,
    leit: (a: number, b: number, g: number) => void,
    strom: (a: number, b: number, j: number) => void,
    gesteuert: (a: number, b: number, c: number, d: number, g: number) => void,
  ) {
    const [a, b] = p.k;
    const w = p.w;
    let G = 0, J = 0;
    switch (p.t.art) {
      case "widerstand": G = 1 / Math.max(1e-6, w.widerstand); break;
      case "lampe": G = p.kaputt ? G_OFFEN : w.nennleistung / (w.nennspannung * w.nennspannung); break;
      case "sicherung": G = p.kaputt ? G_OFFEN : 1 / R_KLEIN; break;
      case "amperemeter": G = 1 / R_KLEIN; break;
      case "voltmeter": G = 1 / R_VOLTMETER; break;
      case "schalter": G = w.geschlossen >= 0.5 ? 1 / R_KLEIN : G_OFFEN; break;
      case "umschalter": {
        G = 1 / R_KLEIN;
        leit(a, p.k[w.stellung >= 0.5 ? 2 : 1], G);
        p.G = G; p.J = 0;
        return;
      }
      case "batterie":
      case "wechselquelle": {
        const e = p.t.art === "batterie"
          ? w.spannung
          : w.spannung * Math.SQRT2 * Math.sin(2 * Math.PI * w.frequenz * t);
        G = 1 / Math.max(1e-3, w.innenwiderstand);
        J = G * e;
        break;
      }
      case "motor":
        G = 1 / Math.max(1e-3, w.ankerwiderstand);
        J = -w.konstante * p.omega * G;
        break;
      case "kondensator":
        G = 2 * w.kapazitaet / dt;
        J = -G * p.v - p.i;
        break;
      case "spule": {
        G = dt / (2 * w.induktivitaet);
        J = p.i + G * p.v;
        if (p.innen >= 0) {
          leit(a, p.innen, 1 / w.widerstand);
          leit(p.innen, b, G);
          strom(p.innen, b, J);
          p.G = G; p.J = J;
          return;
        }
        break;
      }
      case "trafo": {
        const l1 = TRAFO_L_JE_WINDUNG2 * w.windungen1 ** 2;
        const l2 = TRAFO_L_JE_WINDUNG2 * w.windungen2 ** 2;
        const k = Math.min(0.9999, w.kopplung);
        const m = k * Math.sqrt(l1 * l2);
        const det = l1 * l2 - m * m;
        // H = dt/2 · L⁻¹
        const f = dt / 2 / det;
        const H: [number, number, number, number] = [f * l2, -f * m, -f * m, f * l1];
        const [, , c, d] = p.k;
        p.H = H;
        p.J = p.i + H[0] * p.v + H[1] * p.v2;
        p.J2 = p.i2 + H[2] * p.v + H[3] * p.v2;
        leit(a, b, H[0]);
        gesteuert(a, b, c, d, H[1]);
        leit(c, d, H[3]);
        gesteuert(c, d, a, b, H[2]);
        strom(a, b, p.J);
        strom(c, d, p.J2);
        return;
      }
      case "diode":
      case "led": {
        if (p.kaputt) { G = G_OFFEN; break; }
        const { nvt, is } = diodenKenn(p);
        const e = Math.exp(Math.min(p.vd / nvt, 80));
        G = is * e / nvt + GMIN;
        J = is * (e - 1) + GMIN * p.vd - G * p.vd;
        break;
      }
    }
    p.G = G; p.J = J;
    leit(a, b, G);
    if (J) strom(a, b, J);
  }

  /** Nach dem Schritt: Ströme ablesen, Vorgeschichte und Zustände fortschreiben. */
  private nachher(p: Teil, dt: number) {
    const V = this.pot, w = p.w;
    const [a, b] = p.k;
    const u = V[a] - V[b];
    let i: number;

    if (p.t.art === "umschalter") {
      i = p.G * (V[a] - V[p.k[w.stellung >= 0.5 ? 2 : 1]]);
    } else if (p.t.art === "trafo") {
      const [, , c, d] = p.k;
      const u2 = V[c] - V[d];
      i = p.H[0] * u + p.H[1] * u2 + p.J;
      const i2 = p.H[2] * u + p.H[3] * u2 + p.J2;
      p.v = u; p.i = i; p.v2 = u2; p.i2 = i2;
      p.m = { spannung: u, strom: i, leistung: u * i + u2 * i2, spannung2: u2, strom2: i2 };
      return;
    } else if (p.t.art === "spule" && p.innen >= 0) {
      const ul = V[p.innen] - V[b];
      i = p.G * ul + p.J;
      p.v = ul; p.i = i;
    } else {
      i = p.G * u + p.J;
    }

    const m: Messung = { spannung: u, strom: i, leistung: u * i };
    const glaette = (tau: number, ziel: number) => { p.last += (ziel - p.last) * Math.min(1, dt / tau); };

    switch (p.t.art) {
      case "kondensator":
        p.v = u; p.i = i;
        break;
      case "spule":
        if (p.innen < 0) { p.v = u; p.i = i; }
        break;
      case "motor":
        p.omega += dt * (w.konstante * i - w.reibung * p.omega) / w.traegheit;
        p.winkel += p.omega * dt;
        m.drehzahl = p.omega;
        m.winkel = p.winkel;
        break;
      case "lampe":
        glaette(0.05, u * i);
        if (p.last > 3 * w.nennleistung) p.kaputt = true;
        m.helligkeit = p.kaputt ? 0 : Math.min(1.5, p.last / w.nennleistung);
        break;
      case "sicherung":
        glaette(0.1, (i / w.nennstrom) ** 2);
        if (p.last > 1) p.kaputt = true;
        break;
      case "led":
        glaette(0.02, Math.max(0, i));
        if (p.last > w.hoechststrom) p.kaputt = true;
        m.helligkeit = p.kaputt ? 0 : Math.min(1.5, p.last / w.nennstrom);
        break;
    }
    if (p.t.art === "lampe" || p.t.art === "sicherung" || p.t.art === "led") m.kaputt = p.kaputt;
    p.m = m;
  }

  /** Strom, der an jedem Anschluss ins Bauteil hineinfließt. */
  private anschlussStroeme(p: Teil): number[] {
    const { strom, strom2 } = p.m;
    if (p.t.art === "umschalter") {
      return p.w.stellung >= 0.5 ? [strom, 0, -strom] : [strom, -strom, 0];
    }
    if (p.t.art === "trafo") return [strom, -strom, strom2 ?? 0, -(strom2 ?? 0)];
    return [strom, -strom];
  }

  /**
   * Ströme in den Drähten — fürs Bild, die Rechnung braucht sie nicht.
   *
   * Ein Knoten aus mehreren Drähten ist elektrisch ein Punkt; wie sich der
   * Strom darin auf die Drähte verteilt, sagt das Knotenpotenzial nicht. Also
   * wird jeder Knoten für sich als Netz aus gleichen Widerständen gelöst, in das
   * die Bauteile an ihren Anschlusspunkten Strom einspeisen. Ein Baum hat damit
   * genau eine Lösung, eine Masche aus Drähten teilt sich gleichmäßig auf.
   */
  private rechneDraehte(): Map<string, number> {
    const aus = new Map<string, number>();
    const einspeisung = new Map<string, number>();
    for (const p of this.teile) {
      const ps = anschluesse(p.t), is = this.anschlussStroeme(p);
      ps.forEach((pt, j) => {
        const s = schluessel(pt);
        einspeisung.set(s, (einspeisung.get(s) ?? 0) - is[j]);
      });
    }

    const jeKnoten = new Map<number, typeof this.draehte>();
    for (const d of this.draehte) {
      const k = this.knotenVon.get(schluessel(d.a))!;
      if (!jeKnoten.has(k)) jeKnoten.set(k, []);
      jeKnoten.get(k)!.push(d);
    }

    for (const ds of jeKnoten.values()) {
      const index = new Map<string, number>();
      for (const d of ds) for (const pt of [d.a, d.b]) {
        const s = schluessel(pt);
        if (!index.has(s)) index.set(s, index.size);
      }
      // Punkt 0 ist der Bezug und fällt heraus.
      const n = index.size - 1;
      const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
      const rechts = new Array<number>(n).fill(0);
      for (const d of ds) {
        const i = index.get(schluessel(d.a))! - 1, j = index.get(schluessel(d.b))! - 1;
        if (i === j) continue;
        if (i >= 0) A[i][i] += 1;
        if (j >= 0) A[j][j] += 1;
        if (i >= 0 && j >= 0) { A[i][j] -= 1; A[j][i] -= 1; }
      }
      for (const [s, i] of index) if (i > 0) rechts[i - 1] = einspeisung.get(s) ?? 0;
      const x = loeseLGS(A, rechts) ?? new Array<number>(n).fill(0);
      const v = (pt: Punkt) => { const i = index.get(schluessel(pt))!; return i ? x[i - 1] : 0; };
      for (const d of ds) aus.set(d.id, v(d.a) - v(d.b));
    }
    return aus;
  }
}
