/**
 * Heizkreis mit drei Heizkörpern in wachsendem Abstand vom Kessel.
 * Hydraulik über den Löser, Wärme je Heizkörper über einen einfachen
 * Wärmeübertrager: T_rück = T_Raum + (T_vor − T_Raum)·e^(−UA/(ṁ·c)).
 * Ohne hydraulischen Abgleich bekommt der nahe Heizkörper zu viel Wasser,
 * der ferne zu wenig — die Voreinstellung der Thermostatventile gleicht aus.
 */
import { Stroemung } from "./loeser";
import type { Knoten, Teil } from "./modell";

export interface Heizung {
  /** Förderdruck der Umwälzpumpe in Pa. */
  pumpe: number;
  /** Vorlauftemperatur in °C. */
  vorlauf: number;
  /** Voreinstellung der Thermostatventile, 1 (fast zu) … 6 (ganz offen). */
  stufen: [number, number, number];
  offen: [boolean, boolean, boolean];
}

export const RAUM = 20;               // °C
export const BEDARF = 1100;           // W je Raum
const UA = 45;                        // W/K je Heizkörper
const C_WASSER = 4186;                // J/(kg·K)
const R_HK = 1e8;                     // Pa·s/m³ Heizkörper
const R_KESSEL = 2e8;
const LAENGEN = [4, 10, 12];          // m Leitung bis zum nächsten Abzweig (hin und zurück je gleich)
const D = 0.012;                      // m Kupferrohr 12 mm

/** Widerstand des Ventils je Stufe: 1 ≈ 3·10⁹, 6 ≈ 6·10⁷ Pa·s/m³. */
export const ventilWiderstand = (stufe: number) => 3e9 * (6e7 / 3e9) ** ((stufe - 1) / 5);

export function waerme(q: number, vorlauf: number) {
  const mc = Math.max(1e-9, q * 1000 * C_WASSER);
  const ruecklauf = RAUM + (vorlauf - RAUM) * Math.exp(-UA / mc);
  return { leistung: q > 0 ? mc * (vorlauf - ruecklauf) : 0, ruecklauf: q > 0 ? ruecklauf : RAUM };
}

export function rechneHeizung(h: Heizung) {
  const knoten: Knoten[] = ["pu", "po", "k", "v1", "v2", "v3", "r1", "r2", "r3", "a1", "a2", "a3"].map(id => ({ id, z: 0 }));
  const rohr = (id: string, a: string, b: string, laenge: number): Teil => ({ id, art: "rohr", a, b, laenge, durchmesser: D, turbulent: true });
  const teile: Teil[] = [
    { id: "pumpe", art: "pumpe", a: "pu", b: "po", foerderdruck: h.pumpe, maxFluss: 0.25e-3 },
    { id: "system", art: "druckquelle", a: "pu", druck: 1.5e5 },
    { id: "kessel", art: "drossel", a: "po", b: "k", widerstand: R_KESSEL },
    rohr("vl1", "k", "v1", LAENGEN[0]), rohr("vl2", "v1", "v2", LAENGEN[1]), rohr("vl3", "v2", "v3", LAENGEN[2]),
    rohr("rl3", "r3", "r2", LAENGEN[2]), rohr("rl2", "r2", "r1", LAENGEN[1]), rohr("rl1", "r1", "pu", LAENGEN[0]),
  ];
  for (let i = 0; i < 3; i++) {
    const n = i + 1;
    teile.push({ id: `ventil${n}`, art: "drossel", a: `v${n}`, b: `a${n}`, widerstand: h.offen[i] ? ventilWiderstand(h.stufen[i]) : Infinity });
    teile.push({ id: `hk${n}`, art: "drossel", a: `a${n}`, b: `r${n}`, widerstand: R_HK });
  }
  const s = new Stroemung({ medium: "wasser", knoten, teile });
  s.schritt(0.01);
  const heizkoerper = [1, 2, 3].map(n => {
    const q = Math.max(0, s.fluss(`hk${n}`));
    return { q, dp: s.druck(`v${n}`) - s.druck(`r${n}`), ...waerme(q, h.vorlauf) };
  });
  const gesamt = s.fluss("pumpe");
  const ruecklauf = gesamt > 0 ? heizkoerper.reduce((a, k) => a + k.q * k.ruecklauf, 0) / gesamt : RAUM;
  return { heizkoerper, gesamt, foerderhoehe: s.druck("po") - s.druck("pu"), ruecklauf, druck: (id: string) => s.druck(id) };
}

/**
 * Hydraulischer Abgleich: die Ventilstufen, bei denen alle Räume möglichst
 * gleich gut versorgt sind (kleinste Abweichung vom Bedarf, dann wenig Drosselung).
 */
export function abgleich(h: Heizung): [number, number, number] {
  let beste: [number, number, number] = h.stufen, wert = Infinity;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
    const stufen: [number, number, number] = [a, b, c];
    const r = rechneHeizung({ ...h, stufen });
    const p = r.heizkoerper.map((k, i) => (h.offen[i] ? k.leistung : BEDARF));
    const mangel = p.reduce((s, x) => s + Math.max(0, BEDARF - x) ** 2, 0);
    const spreizung = Math.max(...p) - Math.min(...p);
    const w = mangel + 0.2 * spreizung ** 2 - (a + b + c);
    if (w < wert) { wert = w; beste = stufen; }
  }
  return beste;
}
