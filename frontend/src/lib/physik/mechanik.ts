/**
 * Die Mechanik — ein Schwinger je Gerät, nicht eine Physik-Engine.
 *
 * Pendel, Federpendel (und später Hebel und Rollen) sind Systeme mit genau
 * einem Freiheitsgrad: eine Zahl `q` sagt, wie weit ausgelenkt ist, `v`, wie
 * schnell sich das ändert. Beim Fadenpendel ist `q` der Winkel im Bogenmaß,
 * beim Federpendel die Auslenkung in Metern — dieselbe Form, zwei Bedeutungen.
 *
 * Bewusst *kein* Starrkörper-Löser: impulsbasierte Verfahren (Box2D und
 * Verwandte) verlieren sichtbar Energie. Ein Pendel, das von allein kleiner
 * wird, und ein Hebel, der nie genau balanciert, taugen zum Spielen, aber
 * nicht zum Messen — und gemessen werden soll hier die Formel, die die Klasse
 * gerade herleitet.
 *
 * Gerechnet wird die echte Gleichung θ″ = −(g/L)·sin θ, nicht ihre Näherung
 * für kleine Winkel. Dadurch stimmt 2π√(L/g) bei kleinem Ausschlag und weicht
 * bei großem ab — was kein Fehler ist, sondern der Unterrichtsstoff.
 */
import { G } from "./einheiten";
import type { Szene } from "./typen";

/** Ein Freiheitsgrad: Auslenkung, Geschwindigkeit — und womit gestartet wurde. */
export interface Schwinger {
  q: number;
  v: number;
  /** Der Startwert, mit dem dieser Schwinger losgelassen wurde. Ändert ihn
   *  jemand am Regler, wird neu losgelassen statt weiterzuschwingen. */
  start: number;
}

export type MechanikZustand = Record<string, Schwinger>;

/** Welche Gerätetypen die Mechanik rechnet. */
const SCHWINGER: Record<string, { startWert: string }> = {
  fadenpendel: { startWert: "startwinkel" },
  federpendel: { startWert: "startauslenkung" },
};

export const istSchwinger = (typ: string) => typ in SCHWINGER;

/** Anfangszustand aus den eingestellten Werten — losgelassen, also in Ruhe. */
export function anfang(typ: string, werte: Record<string, number>): Schwinger {
  const start = werte[SCHWINGER[typ]?.startWert ?? ""] ?? 0;
  return { q: start, v: 0, start };
}

/**
 * Die Beschleunigung bei Auslenkung `q` und Geschwindigkeit `v`.
 *
 * `real` schaltet die Reibung zu. Ohne sie schwingt das Pendel ewig — das ist
 * das Schulbuchmodell und genau so gewollt.
 */
export function beschleunigung(
  typ: string,
  werte: Record<string, number>,
  q: number,
  v: number,
  real: boolean,
): number {
  const reibung = real ? (werte.daempfung ?? 0) * v : 0;
  if (typ === "fadenpendel") {
    const laenge = Math.max(0.01, werte.laenge ?? 1);
    return -(G / laenge) * Math.sin(q) - reibung;
  }
  if (typ === "federpendel") {
    const masse = Math.max(0.001, werte.masse ?? 0.1);
    return -((werte.federkonstante ?? 10) / masse) * q - reibung;
  }
  return 0;
}

/**
 * Ein Schritt nach Runge-Kutta vierter Ordnung.
 *
 * Das Eulerverfahren würde bei 240 Hz binnen Sekunden Energie dazuerfinden und
 * das Pendel immer weiter ausschlagen lassen; RK4 hält es über Minuten stabil.
 */
export function rk4(
  s: Schwinger,
  dt: number,
  a: (q: number, v: number) => number,
): { q: number; v: number } {
  const k1q = s.v,                  k1v = a(s.q, s.v);
  const k2q = s.v + (dt / 2) * k1v, k2v = a(s.q + (dt / 2) * k1q, s.v + (dt / 2) * k1v);
  const k3q = s.v + (dt / 2) * k2v, k3v = a(s.q + (dt / 2) * k2q, s.v + (dt / 2) * k2v);
  const k4q = s.v + dt * k3v,       k4v = a(s.q + dt * k3q, s.v + dt * k3v);
  return {
    q: s.q + (dt / 6) * (k1q + 2 * k2q + 2 * k3q + k4q),
    v: s.v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
  };
}

/**
 * Ein Zeitschritt über alle mechanischen Geräte der Szene.
 *
 * Rein: nimmt den Zustand entgegen und gibt den neuen zurück. Geräte, die
 * weggeräumt wurden, fallen dabei heraus; neu aufgestellte fangen bei ihrer
 * Anfangsauslenkung an.
 */
export function mechanikSchritt(szene: Szene, zustand: MechanikZustand, dt: number): MechanikZustand {
  const neu: MechanikZustand = {};

  for (const g of szene.geraete) {
    if (!istSchwinger(g.typ)) continue;
    const startWert = g.werte[SCHWINGER[g.typ].startWert] ?? 0;
    const alt = zustand[g.id];

    // Kein Zustand, oder jemand hat den Startwert verstellt: neu loslassen.
    if (!alt || alt.start !== startWert) {
      neu[g.id] = anfang(g.typ, g.werte);
      continue;
    }

    const real = (g.treue ?? szene.treue) === "real";
    const schritt = rk4(alt, dt, (q, v) => beschleunigung(g.typ, g.werte, q, v, real));
    neu[g.id] = { ...schritt, start: alt.start };
  }

  return neu;
}
