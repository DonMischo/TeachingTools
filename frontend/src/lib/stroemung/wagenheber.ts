/**
 * Hydraulischer Wagenheber mit Pumphebel: Vorratsbehälter → Saugventil →
 * Pumpkammer → Druckventil → Hubzylinder; Ablassventil zurück in den Vorrat.
 * Das Öl bleibt erhalten: Vorrat + Hubzylinder (+ Blase) ist konstant.
 *
 * Kolbenweg s: 0 = oben, HUB = unten. Hinunter drückt Öl in den Hubzylinder
 * (wenn die Kolbenkraft reicht), hinauf saugt der Kolben Öl aus dem Vorrat nach.
 */
import { P_LUFT } from "./modell";

export const HUB = 0.08;          // m Weg des Pumpkolbens
export const HEBEL = 8;           // Hebelverhältnis: Kraft am Kolben = 8 × Handkraft
export const MAX_HEBUNG = 0.25;   // m
export const BLASE = 2e-6;        // m³ (2 cm³)

export const kreis = (d: number) => Math.PI * d * d / 4;

export interface Einstellung { d1: number; d2: number; last: number; hand: number; blase: boolean }

export class Wagenheber {
  s = 0;                          // Kolbenweg
  hebung = 0;                     // m
  vorrat: number;                 // m³ Öl im Behälter
  blase: number;                  // m³ Luft in der Pumpkammer (0 = keine)
  saugt = false;                  // Saugventil gerade offen
  drueckt = false;                // Druckventil gerade offen
  blockiert = false;              // Kolben kommt nicht weiter, Kraft reicht nicht
  stoesse = 0;
  private e: Einstellung;

  constructor(e: Einstellung) {
    this.e = e;
    this.vorrat = 1.15 * kreis(e.d2) * MAX_HEBUNG;
    this.blase = e.blase ? BLASE : 0;
  }

  get A1() { return kreis(this.e.d1); }
  get A2() { return kreis(this.e.d2); }
  /** Druck, den die Last im Öl erzeugt (Pascal: p = F/A). */
  get druck() { return this.e.last / this.A2; }
  /** Kraft, die der Kolben bekommt — Hebel mal Hand. */
  get kolbenkraft() { return this.e.hand * HEBEL; }
  get noetigeHand() { return (this.druck * this.A1) / HEBEL; }
  get stark() { return this.kolbenkraft >= this.druck * this.A1; }
  /** Öl insgesamt (zum Prüfen der Erhaltung). */
  get oel() { return this.vorrat + this.hebung * this.A2; }

  einstellen(e: Einstellung) {
    this.e = e;
    if (!e.blase) this.blase = 0;
    else if (this.blase === 0) this.blase = BLASE;
  }

  /** Kolben auf s bewegen. Gibt den tatsächlich erreichten Weg zurück. */
  bewege(sNeu: number): number {
    sNeu = Math.max(0, Math.min(HUB, sNeu));
    const ds = sNeu - this.s;
    this.saugt = false; this.drueckt = false; this.blockiert = false;
    if (ds > 0) {
      // Hinunter: erst die Blase zusammendrücken, dann Öl in den Hubzylinder
      const pMax = Math.min(this.druck, this.kolbenkraft / this.A1);     // mehr Druck schafft die Hand nicht
      let verdraengt = ds * this.A1;
      if (this.blase > 0) {
        const kleinst = (BLASE * P_LUFT) / (P_LUFT + pMax);
        const weg = Math.min(verdraengt, Math.max(0, this.blase - kleinst));
        this.blase -= weg;
        verdraengt -= weg;
      }
      if (verdraengt > 0) {
        const platz = (MAX_HEBUNG - this.hebung) * this.A2;
        if (!this.stark || platz <= 0) {
          // Kraft reicht nicht (oder oben angeschlagen): Kolben bleibt stehen
          this.blockiert = true;
          sNeu -= verdraengt / this.A1;
          verdraengt = 0;
        } else {
          const rein = Math.min(verdraengt, platz);
          this.hebung += rein / this.A2;
          if (rein < verdraengt) { this.blockiert = true; sNeu -= (verdraengt - rein) / this.A1; }
          this.drueckt = rein > 0;
        }
      }
      if (this.s < HUB * 0.95 && sNeu >= HUB * 0.95) this.stoesse++;
    } else if (ds < 0) {
      // Hinauf: Blase dehnt sich wieder aus, den Rest saugt der Kolben aus dem Vorrat
      let frei = -ds * this.A1;
      if (this.e.blase) { const dehnt = Math.min(frei, BLASE - this.blase); this.blase += dehnt; frei -= dehnt; }
      const nach = Math.min(frei, this.vorrat);
      this.vorrat -= nach;
      this.saugt = nach > 0;
    }
    this.s = sNeu;
    return sNeu;
  }

  /** Ablassventil offen: Öl läuft zurück, die Last senkt sich (m/s je nach Last). */
  ablassen(dt: number) {
    if (this.hebung <= 0) return;
    const v = Math.min(0.06, 0.01 + this.druck / 4e7);
    const dh = Math.min(this.hebung, v * dt);
    this.hebung -= dh;
    this.vorrat += dh * this.A2;
  }
}
