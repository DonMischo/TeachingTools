/**
 * Spiel »Feuerwehr« der Sim quadratisch: Der Löschstrahl ist eine Wurfparabel.
 *
 * - Düsendruck p → Austrittsgeschwindigkeit nach Bernoulli: v = √(2p/ρ), ρ = 1000 kg/m³
 * - Strahl aus der Düse bei (xF | DUESE_Y) unter dem Winkel α:
 *   y = a(x + d)² + e mit a = −g / (2v²cos²α), S(xF + v²·sinα·cosα/g | DUESE_Y + v²·sin²α/(2g))
 * - Hitze: Jedes Feuer strahlt mit der Leistung P; am Standort kommt E = P / (4πr²) an.
 *   Mehr als E_MAX hält die Schutzkleidung nicht lange aus – daraus folgt der Mindestabstand.
 *   Ist ein Feuer gelöscht, strahlt es nicht mehr, man darf näher heran.
 */
import { G } from "./wurfphysik";
import { glatt, type SPF } from "./quadratisch";

export const RHO = 1000;
export const DUESE_Y = 1.3;
export const E_MAX = 5;          // kW/m², Grenze für kurzen Einsatz mit Schutzkleidung
export const DUESE_D = 0.012;    // 12 mm Mundstück
export const WASSER_START = 150; // Liter im Tank

export type Brand = { y0: number; y1: number; leistung: number };   // Fensteröffnung in der Fassade, Leistung in kW bei voller Glut
export type Hindernis = { x0: number; x1: number; y0: number; y1: number; name: string };
export type FLevel = { hausX: number; dach: number; braende: Brand[]; hindernisse: Hindernis[]; pMax: number; text: string };

export const FLEVELS: FLevel[] = [
  { hausX: 22, dach: 7, braende: [{ y0: 1.2, y1: 2.6, leistung: 1500 }], hindernisse: [], pMax: 1.5, text: "Brand im Erdgeschoss." },
  { hausX: 24, dach: 10, braende: [{ y0: 4.4, y1: 5.8, leistung: 2000 }], hindernisse: [], pMax: 2, text: "Feuer im ersten Stock – der Strahl muss nach oben." },
  { hausX: 24, dach: 10, braende: [{ y0: 1.2, y1: 2.6, leistung: 1500 }, { y0: 7.4, y1: 8.8, leistung: 2500 }], hindernisse: [], pMax: 2.5, text: "Zwei Brände: Erst unten löschen, dann darfst du näher ran." },
  { hausX: 26, dach: 10, braende: [{ y0: 4.4, y1: 5.8, leistung: 2500 }], hindernisse: [{ x0: 17, x1: 20, y0: 0, y1: 7, name: "Baum" }], pMax: 2.5, text: "Ein Baum steht im Weg – über die Krone hinweg!" },
  { hausX: 26, dach: 14, braende: [{ y0: 10.4, y1: 11.8, leistung: 3500 }, { y0: 4.4, y1: 5.8, leistung: 2000 }], hindernisse: [{ x0: 12, x1: 15, y0: 0, y1: 3.2, name: "Auto" }], pMax: 3, text: "Dachgeschoss und zweiter Stock brennen." },
];

/** Austrittsgeschwindigkeit in m/s bei p bar Düsendruck (Bernoulli). */
export const austritt = (pBar: number) => Math.sqrt((2 * pBar * 1e5) / RHO);

/** Wasserstrom in Litern pro Sekunde: Q = A · v. */
export const durchfluss = (pBar: number) => Math.PI * (DUESE_D / 2) ** 2 * austritt(pBar) * 1000;

/** Der Löschstrahl in Scheitelpunktform; gerundet nur fürs Anzeigen (glatt), a bleibt genau. */
export function strahl(xF: number, pBar: number, winkelGrad: number): SPF {
  const v = austritt(pBar), al = (winkelGrad * Math.PI) / 180;
  const c = Math.cos(al), s = Math.sin(al);
  return { a: -G / (2 * v * v * c * c), d: glatt(-(xF + (v * v * s * c) / G)), e: glatt(DUESE_Y + (v * v * s * s) / (2 * G)) };
}

/** Mitte einer Fensteröffnung */
export const brandMitte = (lv: FLevel, b: Brand) => ({ x: lv.hausX, y: (b.y0 + b.y1) / 2 });

/** Wärmestrahlung in kW/m² am Standort xF (Kopfhöhe 1,7 m); glut je Brand 0…1. */
export function hitze(lv: FLevel, glut: number[], xF: number): number {
  return lv.braende.reduce((sum, b, i) => {
    const m = brandMitte(lv, b), r2 = (m.x - xF) ** 2 + (m.y - 1.7) ** 2;
    return sum + (b.leistung * glut[i]) / (4 * Math.PI * r2);
  }, 0);
}

/** Wie nah darf man ran? Größtes xF (auf 0,1 m), an dem die Hitze noch ≤ E_MAX ist. */
export function naechsterStandort(lv: FLevel, glut: number[]): number {
  for (let x = Math.floor((lv.hausX - 1) * 10) / 10; x > 0; x = glatt(x - 0.1)) if (hitze(lv, glut, x) <= E_MAX) return x;
  return 0;
}

/** Trifft die Strahl-Parabel (ohne Streuung) die Fensteröffnung, ohne vorher an ein Hindernis zu stoßen? */
export function strahlTrifft(lv: FLevel, b: Brand, xF: number, pBar: number, winkel: number): boolean {
  const s = strahl(xF, pBar, winkel), f = (x: number) => s.a * (x + s.d) ** 2 + s.e;
  for (let x = xF; x < lv.hausX; x += 0.05) {
    const y = f(x);
    if (y < 0) return false;
    if (lv.hindernisse.some(h => x >= h.x0 && x <= h.x1 && y <= h.y1)) return false;
  }
  const y = f(lv.hausX);
  return y > b.y0 + 0.1 && y < b.y1 - 0.1;
}
