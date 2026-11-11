/**
 * Druckluftanlage: Kompressor mit Druckschalter, Kessel, Druckregler,
 * 3/2-Wegeventil mit Zu- und Abluftdrossel, einfach wirkender Zylinder mit
 * Rückstellfeder. Netz für den Löser plus die Steuerung (Druckschalter,
 * Dauerbetrieb), damit die Station nur noch zeichnet.
 */
import { Stroemung } from "./loeser";

export const D_KOLBEN = 0.05, A_KOLBEN = Math.PI * D_KOLBEN ** 2 / 4, HUB = 0.2;
export const FEDER = 80;                 // N Rückstellfeder
export const KESSEL = 0.02;              // m³ (20 L)
export const EIN = 6e5, AUS = 8e5;       // Druckschalter
const KOMPRESSOR = 4e-3;                 // m³/s Normluft bei Δp = 0
export const drosselWiderstand = (prozent: number) => 6e8 / Math.max(0.05, prozent / 100);

export interface Einstellung { regler: number; last: number; zuluft: number; abluft: number }

export class Druckluft {
  sim: Stroemung;
  kompressor = true;
  ventil = false;           // true: Druck auf den Zylinder, false: entlüften
  automatik = false;
  huebe = 0;
  verbrauch = 0;            // m³ Normluft durch die Abluft
  private e: Einstellung;

  constructor(e: Einstellung, kesselDruck = 7e5) {
    this.e = e;
    this.sim = new Stroemung({
      medium: "luft",
      knoten: ["ein", "kp", "kk", "ar", "zy"].map(id => ({ id, z: 0 })),
      teile: [
        { id: "ansaug", art: "druckquelle", a: "ein", druck: 0 },
        { id: "kompressor", art: "pumpe", a: "ein", b: "kp", foerderdruck: 10e5, maxFluss: KOMPRESSOR },
        { id: "rv", art: "rueckschlag", a: "kp", b: "kk", widerstand: 1e6 },
        { id: "kessel", art: "kessel", a: "kk", volumen: KESSEL, druck: kesselDruck },
        { id: "regler", art: "druckminderer", a: "kk", b: "ar", druck: e.regler, widerstand: 1e6 },
        { id: "zu", art: "drossel", a: "ar", b: "zy", widerstand: Infinity },
        { id: "abluft", art: "auslass", a: "zy", widerstand: drosselWiderstand(e.abluft) },
        { id: "zylinder", art: "zylinder", a: "zy", flaeche: A_KOLBEN, hub: HUB, kraft: FEDER + e.last, weg: 0 },
      ],
    });
  }

  einstellen(e: Einstellung) {
    this.e = e;
    this.sim.setze("regler", "druck", e.regler);
    this.sim.setze("zylinder", "kraft", FEDER + e.last);
    this.schalte(this.ventil);
  }

  schalte(auf: boolean) {
    this.ventil = auf;
    this.sim.setze("zu", "widerstand", auf ? drosselWiderstand(this.e.zuluft) : Infinity);
    this.sim.setze("abluft", "widerstand", auf ? Infinity : drosselWiderstand(this.e.abluft));
  }

  /** Läuft `sekunden` in Schritten von 10 ms. */
  laufe(sekunden: number) {
    const s = this.sim;
    for (let t = 0; t < sekunden - 1e-9; t += 0.01) {
      const p = s.zustand("kessel");
      if (p < EIN) this.kompressor = true;
      if (p > AUS) this.kompressor = false;
      s.setze("kompressor", "maxFluss", this.kompressor ? KOMPRESSOR : 0);
      const vorher = s.zustand("zylinder");
      s.schritt(0.01);
      this.verbrauch += Math.max(0, s.fluss("abluft")) * 0.01;
      const weg = s.zustand("zylinder");
      if (vorher < HUB && weg >= HUB) this.huebe++;
      if (this.automatik) {
        if (this.ventil && weg >= HUB) this.schalte(false);
        else if (!this.ventil && weg <= 0) this.schalte(true);
      }
    }
  }

  get kesselDruck() { return this.sim.zustand("kessel"); }
  get weg() { return this.sim.zustand("zylinder"); }
}
