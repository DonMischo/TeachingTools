/**
 * Löser für Rohrnetze — dieselbe Knotenrechnung wie im Stromkreis:
 * Gesamtdruck P ≙ Potenzial, Volumenstrom Q ≙ Strom, Widerstand ≙ R.
 *
 * Jedes Teil wird im aktuellen Arbeitspunkt linearisiert zu
 *   Q = g · (P_a − P_b) + c        (zweipolig, a → b)
 *   Q = g · (P_a − P_ref) + c      (einpolig, in das Teil hinein)
 * und dann über die Knotenregel (Σ Q = 0) gelöst. Nichtlineares —
 * turbulente Reibung, Rückschlagventil, Kolben am Anschlag, Gas — wird
 * je Zeitschritt nachiteriert. Speicher (Behälter, Kessel, Polster) gehen
 * mit dem impliziten Euler ein: g = C/dt, P_ref = Druck vom letzten Schritt.
 *
 * Bei Luft zählt Q als Normvolumenstrom (bei Luftdruck gemessen), damit die
 * Knotenregel trotz Verdichtung gilt.
 */
import { loeseLGS } from "../stromkreis/lgs";
import { G, MEDIEN, P_LUFT, querschnitt, type Netz, type Teil } from "./modell";

/** Hält Knoten ohne Verbindung auf Luftdruck, ohne messbar zu stören. */
const G_MIN = 1e-20;
/** Steife Anbindung des Kolbens (m³/(s·Pa)) — weicher, damit er pro Schritt nicht über den Anschlag schießt. */
const G_STEIF = 1e-2;
/** Netzanschluss und Überlauf: praktisch ideal. */
const G_QUELLE = 1e2;
/** Rohrreibungszahl für turbulente Strömung in glatten Rohren. */
const LAMBDA = 0.03;

/**
 * Linearisiertes Teil. Normal: Q = g·(P_i − P_j) + c (j = −1: P_ref statt P_j).
 * `geregelt`: Q = g·(P_ref − P_j) fließt von i nach j — so hält ein Druckminderer
 * den Druck hinter sich, egal wie hoch er vor ihm ist.
 */
interface Linear { teil: string; i: number; j: number; pRef: number; g: number; c: number; geregelt?: boolean }

export class Stroemung {
  readonly medium: Netz["medium"];
  private teile: Teil[];
  private idx = new Map<string, number>();
  private z: number[];
  private P: number[];
  private rho: number;
  private eta: number;
  private gas: boolean;
  private fluesse = new Map<string, number>();
  /** Füllhöhe (Behälter), Normvolumen Gas (Kessel), Wasser im Polster, Kolbenweg. */
  private speicher = new Map<string, number>();
  zeit = 0;

  constructor(netz: Netz) {
    this.medium = netz.medium;
    const m = MEDIEN[netz.medium];
    this.rho = m.dichte;
    this.eta = m.zaehigkeit;
    this.gas = netz.medium === "luft";
    netz.knoten.forEach((k, i) => this.idx.set(k.id, i));
    this.z = netz.knoten.map(k => k.z);
    this.P = this.z.map(z => this.rho * G * z);
    this.teile = netz.teile.map(t => ({ ...t }));
    for (const t of this.teile) {
      if (t.art === "behaelter") this.speicher.set(t.id, t.fuellung);
      if (t.art === "kessel") this.speicher.set(t.id, t.volumen * (t.druck + P_LUFT) / P_LUFT);
      // Polster bei Luft: einfach ein Kessel; bei Wasser zählt das hineingedrückte Wasser.
      if (t.art === "polster") this.speicher.set(t.id, this.gas ? t.volumen * (t.vordruck + P_LUFT) / P_LUFT : 0);
      if (t.art === "zylinder") this.speicher.set(t.id, t.weg);
    }
  }

  // ── Ablesen ──

  /** Überdruck am Knoten in Pa. */
  druck(knoten: string): number {
    const i = this.knoten(knoten);
    return this.P[i] - this.rho * G * this.z[i];
  }
  /** Volumenstrom durchs Teil in m³/s (a → b bzw. ins Teil hinein); bei Luft Normvolumen. */
  fluss(teil: string): number {
    return this.fluesse.get(teil) ?? 0;
  }
  /** Füllhöhe (Behälter, m), Überdruck (Kessel, Polster, Pa) oder Kolbenweg (Zylinder, m). */
  zustand(teil: string): number {
    const t = this.teil(teil);
    const s = this.speicher.get(teil) ?? 0;
    if (t.art === "kessel") return P_LUFT * s / t.volumen - P_LUFT;
    if (t.art === "polster") return this.polsterDruck(t, s);
    return s;
  }
  /** Mittlere Fließgeschwindigkeit im Rohr in m/s. */
  geschwindigkeit(rohr: string): number {
    const t = this.teil(rohr);
    if (t.art !== "rohr") return 0;
    let q = this.fluss(rohr);
    if (this.gas) q *= P_LUFT / this.mittlererAbsDruck(t.a, t.b);
    return q / querschnitt(t.durchmesser);
  }

  /** Stand der Speicher (Füllhöhe, Gasmenge, Kolbenweg …) je Teil — zum Übernehmen in ein neu gebautes Netz. */
  stand(): Map<string, number> { return new Map(this.speicher); }
  /** Übernimmt Speicherstände für Teile, die es hier gibt (gleiche Id und Art vorausgesetzt). */
  setzeStand(stand: Map<string, number>, ausser: Set<string> = new Set()) {
    for (const [id, v] of stand) if (this.speicher.has(id) && !ausser.has(id)) this.speicher.set(id, v);
  }

  /** Kenngröße eines Teils ändern (Regler), ohne die Speicher zurückzusetzen. */
  setze(teil: string, name: string, wert: number) {
    const t = this.teil(teil) as unknown as Record<string, number>;
    t[name] = wert;
  }

  // ── Rechnen ──

  laufe(sekunden: number, dt: number) {
    const n = Math.round(sekunden / dt);
    for (let k = 0; k < n; k++) this.schritt(dt);
  }

  schritt(dt: number) {
    const n = this.z.length;
    let P = this.P;
    let lin: Linear[] = [];
    for (let iter = 0; iter < 60; iter++) {
      lin = this.linearisiere(P, dt);
      const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
      const b = new Array<number>(n).fill(0);
      for (let i = 0; i < n; i++) { A[i][i] += G_MIN; b[i] += G_MIN * this.rho * G * this.z[i]; }
      for (const l of lin) {
        if (l.geregelt) {
          A[l.i][l.j] -= l.g; b[l.i] -= l.g * l.pRef;
          A[l.j][l.j] += l.g; b[l.j] += l.g * l.pRef;
          continue;
        }
        A[l.i][l.i] += l.g;
        b[l.i] -= l.c;
        if (l.j >= 0) {
          A[l.i][l.j] -= l.g; A[l.j][l.j] += l.g; A[l.j][l.i] -= l.g;
          b[l.j] += l.c;
        } else {
          b[l.i] += l.g * l.pRef;
        }
      }
      const neu = loeseLGS(A, b);
      if (!neu) break;
      const abw = Math.max(0, ...neu.map((x, i) => Math.abs(x - P[i])));
      const gross = Math.max(1, ...neu.map(Math.abs));
      // Ab und zu schaukeln Ventil und Kolben — dann gedämpft weiter.
      P = iter > 10 ? neu.map((x, i) => (x + P[i]) / 2) : neu;
      if (abw < 1e-9 * gross + 1e-6) { P = neu; lin = this.linearisiere(P, dt); break; }
    }
    this.P = P;

    this.fluesse.clear();
    for (const l of lin) {
      const q = l.geregelt ? l.g * (l.pRef - P[l.j]) : l.g * (P[l.i] - (l.j >= 0 ? P[l.j] : l.pRef)) + l.c;
      this.fluesse.set(l.teil, q);
    }
    for (const t of this.teile) this.speichere(t, this.fluss(t.id), dt);
    this.zeit += dt;
  }

  private linearisiere(P: number[], dt: number): Linear[] {
    const aus: Linear[] = [];
    const rg = this.rho * G;
    for (const t of this.teile) {
      const i = this.knoten(t.a);
      const zwei = (g: number, c = 0) => aus.push({ teil: t.id, i, j: this.knoten((t as { b: string }).b), pRef: 0, g, c });
      const eins = (g: number, pRef: number) => aus.push({ teil: t.id, i, j: -1, pRef, g, c: 0 });
      const gasFaktor = () => (this.gas && "b" in t ? this.mittlererAbsDruck(t.a, t.b, P) / P_LUFT : 1);

      switch (t.art) {
        case "rohr": {
          const dp = Math.abs(P[i] - P[this.knoten(t.b)]);
          zwei(this.rohrLeitwert(t, dp) * gasFaktor());
          break;
        }
        case "drossel":
          if (Number.isFinite(t.widerstand)) zwei(gasFaktor() / t.widerstand);
          break;
        case "druckminderer": {
          const j = this.knoten(t.b);
          const soll = t.druck + rg * this.z[j];
          if (P[i] >= soll) {
            // Genug Vordruck: regelt — hinten genau der Sollwert, solange dort etwas abgenommen wird.
            if (P[j] <= soll) aus.push({ teil: t.id, i, j, pRef: soll, g: G_QUELLE, c: 0, geregelt: true });
          } else if (P[i] > P[j]) zwei(gasFaktor() / t.widerstand);   // zu wenig Vordruck: steht ganz offen
          break;
        }
        case "rueckschlag":
          if (P[i] > P[this.knoten(t.b)]) zwei(gasFaktor() / t.widerstand);
          break;
        case "pumpe": {
          const gi = t.maxFluss / t.foerderdruck;
          zwei(gi, t.maxFluss);
          break;
        }
        case "druckquelle":
          eins(G_QUELLE, t.druck + rg * this.z[i]);
          break;
        case "auslass":
          // Aus dem Hahn kommt nur etwas heraus — liegt der Druck unter der Luft, fließt nichts.
          if (P[i] <= rg * this.z[i]) break;
          eins((this.gas ? this.mittlererAbsDruck(t.a, t.a, P) / P_LUFT : 1) / t.widerstand, rg * this.z[i]);
          break;
        case "behaelter": {
          if (this.gas) { eins(G_QUELLE, rg * this.z[i]); break; }
          const h = this.speicher.get(t.id)!;
          const pTank = rg * (this.z[i] + h);
          if (h <= 0 && P[i] < pTank) break;                         // leer: nichts kommt mehr
          if (h >= t.hoehe && P[i] > pTank) { eins(G_QUELLE, pTank); break; } // läuft über
          eins(t.flaeche / rg / dt, pTank);
          break;
        }
        case "kessel":
        case "polster": {
          if (t.art === "kessel" || this.gas) {
            if (!this.gas) break;                                     // starr und voll Wasser: nichts passt hinein
            const v = t.volumen, n = this.speicher.get(t.id)!;
            eins(v / P_LUFT / dt, P_LUFT * n / v - P_LUFT + rg * this.z[i]);
            break;
          }
          const w = this.speicher.get(t.id)!;
          const p = this.polsterDruck(t, w);
          if (w <= 0 && P[i] < p + rg * this.z[i]) break;            // Vordruck noch nicht erreicht
          const vGas = t.volumen - w;
          eins(vGas / (p + P_LUFT) / dt, p + rg * this.z[i]);
          break;
        }
        case "zylinder": {
          const pRef = t.kraft / t.flaeche + rg * this.z[i];
          const x = this.speicher.get(t.id)!;
          if ((x >= t.hub && P[i] >= pRef) || (x <= 0 && P[i] <= pRef)) break; // am Anschlag
          eins(G_STEIF, pRef);
          break;
        }
      }
    }
    return aus;
  }

  /** Speicher nach dem Schritt fortschreiben. */
  private speichere(t: Teil, q: number, dt: number) {
    const s = this.speicher.get(t.id);
    if (s === undefined) return;
    switch (t.art) {
      case "behaelter":
        if (!this.gas) this.speicher.set(t.id, Math.min(t.hoehe, Math.max(0, s + q * dt / t.flaeche)));
        break;
      case "kessel":
        if (this.gas) this.speicher.set(t.id, Math.max(0, s + q * dt));
        break;
      case "polster":
        if (this.gas) this.speicher.set(t.id, Math.max(0, s + q * dt));
        else this.speicher.set(t.id, Math.min(0.95 * t.volumen, Math.max(0, s + q * dt)));
        break;
      case "zylinder": {
        const vol = this.gas ? q * P_LUFT / (this.druck(t.a) + P_LUFT) : q;
        this.speicher.set(t.id, Math.min(t.hub, Math.max(0, s + vol * dt / t.flaeche)));
        break;
      }
    }
  }

  /** Q/Δp eines Rohrs bei der Druckdifferenz dp: laminar plus turbulent, Q aus der quadratischen Gleichung. */
  private rohrLeitwert(t: Extract<Teil, { art: "rohr" }>, dp: number): number {
    const d = t.durchmesser, A = querschnitt(d);
    const R = 128 * this.eta * t.laenge / (Math.PI * d ** 4);
    if (!t.turbulent || dp < 1e-9) return 1 / R;
    const k = LAMBDA * t.laenge * this.rho / (2 * d * A * A);
    const q = (-R + Math.sqrt(R * R + 4 * k * dp)) / (2 * k);
    return q / dp;
  }

  private polsterDruck(t: Extract<Teil, { art: "polster" }>, wasser: number): number {
    if (this.gas) return P_LUFT * wasser / t.volumen - P_LUFT;
    return (t.vordruck + P_LUFT) * t.volumen / (t.volumen - wasser) - P_LUFT;
  }

  private mittlererAbsDruck(a: string, b: string, P = this.P): number {
    const ia = this.knoten(a), ib = this.knoten(b);
    const pa = P[ia] - this.rho * G * this.z[ia], pb = P[ib] - this.rho * G * this.z[ib];
    return Math.max(0.05 * P_LUFT, P_LUFT + (pa + pb) / 2);
  }

  private knoten(id: string): number {
    const i = this.idx.get(id);
    if (i === undefined) throw new Error(`Unbekannter Knoten ${id}`);
    return i;
  }
  private teil(id: string): Teil {
    const t = this.teile.find(x => x.id === id);
    if (!t) throw new Error(`Unbekanntes Teil ${id}`);
    return t;
  }
}
