/**
 * Saugende Kolbenpumpe auf einem Steigrohr: Unten steht das Rohr im Becken,
 * oben sitzt ein Zylinder mit Kolben. Zwischen Rohr und Zylinder ein
 * Saugventil, im Kolben ein Auslassventil ins Freie.
 *
 *  Kolben hoch:   Saugventil auf, die Luft im Rohr dehnt sich in den Zylinder
 *                 (Boyle) — der Druck sinkt, die Außenluft drückt Wasser nach.
 *  Kolben runter: Saugventil zu (die Säule bleibt stehen), die Zylinderluft
 *                 wird zusammengedrückt und entweicht über Luftdruck ins Freie.
 *
 * Gleichgewicht der Säule: p_innen + ρ·g·h = p_außen; p_innen ≥ Dampfdruck.
 * Luftmengen als p·V (Pa·m³), bei gleicher Temperatur.
 */
import { G } from "./modell";

export interface Pumpenmass { rohrFlaeche: number; rohrLaenge: number; zylFlaeche: number; hub: number }

export class Kolbenpumpe {
  h = 0;            // m Säule über dem Beckenspiegel
  s: number;        // m Kolbenstellung über dem Zylinderboden
  nRohr: number;    // Luft im Rohr (p·V)
  nZyl: number;     // Luft im Zylinder (p·V)
  huebe = 0;
  private totraum: number;

  constructor(public m: Pumpenmass, public luft: number, public dichte: number, public dampf: number) {
    this.totraum = 0.002 * m.hub;   // Schadraum: begrenzt, wie gut die Pumpe leer saugt
    this.s = this.totraum;
    this.nRohr = luft * m.rohrFlaeche * m.rohrLaenge;
    this.nZyl = luft * m.zylFlaeche * this.s;
  }

  private vRohr(h: number) { return this.m.rohrFlaeche * (this.m.rohrLaenge - h); }
  get druckRohr() { return Math.max(this.dampf, this.nRohr / Math.max(1e-12, this.vRohr(this.h))); }
  get druckZyl() { return this.nZyl / (this.m.zylFlaeche * this.s); }

  /** Säulenhöhe, bei der Luft n im Volumen (Rohr über der Säule + extra) im Gleichgewicht ist. */
  private saeule(n: number, extra: number): number {
    const f = (h: number) => Math.max(this.dampf, n / (this.vRohr(h) + extra)) + this.dichte * G * h - this.luft;
    if (f(this.m.rohrLaenge) <= 0) return this.m.rohrLaenge;
    let lo = 0, hi = this.m.rohrLaenge;
    if (f(0) >= 0) return 0;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
    return lo;
  }

  /** Kolben auf sNeu (0 … hub) bewegen. */
  bewege(sNeu: number) {
    sNeu = Math.max(this.totraum, Math.min(this.m.hub, sNeu));
    if (sNeu > this.s) {
      const vZyl = this.m.zylFlaeche * sNeu;
      if (this.nZyl / vZyl <= this.druckRohr) {
        // Saugventil offen: Rohr und Zylinder bilden einen Raum
        const n = this.nRohr + this.nZyl;
        // Die Säule fällt nie zurück (Wasser kann nicht durchs Ventil zurück nach oben ausweichen, steigt nur)
        this.h = Math.max(this.h, this.saeule(n, vZyl));
        const p = n / (this.vRohr(this.h) + vZyl);
        this.nRohr = p * this.vRohr(this.h);
        this.nZyl = p * vZyl;
      }
      if (this.s < this.m.hub * 0.9 && sNeu >= this.m.hub * 0.9) this.huebe++;
    } else if (sNeu < this.s) {
      // Saugventil zu; was über Luftdruck kommt, entweicht durchs Kolbenventil
      const vZyl = this.m.zylFlaeche * sNeu;
      this.nZyl = Math.min(this.nZyl, this.luft * vZyl);
    }
    this.s = sNeu;
  }

  /** Belüften: Luft strömt ein, die Säule fällt. */
  belueften() {
    this.h = 0;
    this.nRohr = this.luft * this.vRohr(0);
    this.nZyl = this.luft * this.m.zylFlaeche * this.s;
  }

  /** Höchstmögliche Säule hier: Luftdruck minus Dampfdruck. */
  get grenze() { return Math.min(this.m.rohrLaenge, (this.luft - this.dampf) / (this.dichte * G)); }
}
