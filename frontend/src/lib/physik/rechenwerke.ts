/**
 * Die Rechenwerke — was in einem Zeitschritt passiert.
 *
 * Jeder Bereich rechnet für sich (Mechanik als Differentialgleichung, der
 * Stromkreis als Knotengleichung, die Optik ganz ohne Zeit) und legt sein
 * Ergebnis als Signal auf den Messbus. Ein gemeinsamer Löser wäre weder
 * möglich noch nötig: zusammen kommen die Bereiche über Ports und Signale.
 *
 * `schritt` ist eine reine Funktion: Zustand rein, neuer Zustand plus
 * Messwerte raus. Damit lässt sich eine Minute Pendelschwingung im Test
 * durchrechnen, ohne Uhr, ohne Bus und ohne Bildschirm — und genau das
 * braucht es, um Messung gegen Formel zu prüfen.
 */
import { G } from "./einheiten";
import { geraetTyp } from "./katalog";
import { mechanikSchritt, type MechanikZustand } from "./mechanik";
import { signalId, type SignalId } from "./messbus";
import { haengtDaran } from "./verbindungen";
import type { Geraet, Szene } from "./typen";

/** Kurvenformen des Funktionsgenerators — im Aufbau als Zahl gespeichert. */
export const SINUS = 0;
export const RECHTECK = 1;
export const DREIECK = 2;

/** Zeitschritt der Simulation. 240 Hz trägt auch ein kurzes, schnelles Pendel. */
export const DT = 1 / 240;

/** Alles, was die Simulation zwischen zwei Schritten behalten muss. */
export interface LaborZustand {
  t: number;
  mechanik: MechanikZustand;
}

export const leererZustand = (): LaborZustand => ({ t: 0, mechanik: {} });

/** Momentanwert des Funktionsgenerators. */
export function generatorWert(form: number, frequenz: number, amplitude: number, t: number): number {
  const phase = 2 * Math.PI * frequenz * t;
  if (form === RECHTECK) return Math.sin(phase) >= 0 ? amplitude : -amplitude;
  // Das Dreieck über den Arkussinus: stetig, ohne Fallunterscheidung und
  // ohne Sprung an den Spitzen.
  if (form === DREIECK) return amplitude * (2 / Math.PI) * Math.asin(Math.sin(phase));
  return amplitude * Math.sin(phase);
}

/**
 * Was ein einzelnes Gerät nach unten zieht, in Newton.
 *
 * Ein Massestück zieht mit seinem Gewicht. Beim Federpendel ist es die
 * Spannung der Feder: im Gleichgewicht genau m·g, beim Schwingen darum herum
 * pendelnd (D·q). Beim Fadenpendel zieht die Fadenspannung — am tiefsten
 * Punkt am größten, weil dort zur Gewichtskraft noch die Zentripetalkraft
 * kommt. Genau das zeigt ein Kraftmesser im echten Versuch auch.
 */
function eigengewicht(g: Geraet, s: { q: number; v: number } | undefined): number {
  const masse = g.werte.masse ?? 0;
  switch (g.typ) {
    case "massestueck":
      return masse * G;
    case "federpendel":
      return masse * G + (g.werte.federkonstante ?? 0) * (s?.q ?? 0);
    case "fadenpendel": {
      const laenge = Math.max(0.01, g.werte.laenge ?? 1);
      const winkel = s?.q ?? 0;
      const winkelTempo = s?.v ?? 0;
      return masse * (G * Math.cos(winkel) + laenge * winkelTempo * winkelTempo);
    }
    default:
      return 0;
  }
}

/**
 * Die Kraft am unteren Haken eines Kraftmessers, in Newton.
 *
 * Gelaufen wird der Verbindungsgraph: alles, was unter dem Haken hängt,
 * zählt — auch ein Massestück am Massestück. (Der erste Wurf sah nur die
 * unmittelbaren Nachbarn und zeigte bei zwei angehängten Stücken nur das
 * obere an.) Gefolgt wird ausschließlich mechanischen Verbindungen; ein
 * Kabel trägt nichts. Der Satz »gesehen« hält Ringe auf und verhindert, dass
 * der Lauf über den Kraftmesser selbst wieder nach oben führt.
 */
export function haengendeKraft(szene: Szene, kraftmesser: string, mechanik: MechanikZustand): number {
  return haengtDaran(szene, kraftmesser, "unten")
    .reduce((summe, g) => summe + eigengewicht(g, mechanik[g.id]), 0);
}

/**
 * Ein Zeitschritt über die ganze Szene.
 *
 * Die Messwerte beschreiben den Zustand *nach* dem Schritt, also zum
 * Zeitpunkt `zustand.t` des Rückgabewerts.
 */
export function schritt(szene: Szene, zustand: LaborZustand, dt: number): {
  zustand: LaborZustand;
  werte: Map<SignalId, number>;
} {
  const t = zustand.t + dt;
  const mechanik = mechanikSchritt(szene, zustand.mechanik, dt);
  const werte = new Map<SignalId, number>();

  for (const g of szene.geraete) {
    if (!geraetTyp(g.typ)?.signale.length) continue;

    switch (g.typ) {
      case "signalgeber":
        werte.set(signalId(g.id, "spannung"), generatorWert(
          g.werte.form ?? SINUS,
          g.werte.frequenz ?? 1,
          g.werte.amplitude ?? 1,
          t,
        ));
        break;

      case "kraftmesser":
        werte.set(signalId(g.id, "kraft"), haengendeKraft(szene, g.id, mechanik));
        break;

      case "fadenpendel": {
        const s = mechanik[g.id];
        if (!s) break;
        werte.set(signalId(g.id, "winkel"), s.q);
        // Bahngeschwindigkeit: der Winkel ändert sich, der Körper legt dabei
        // den Weg L·Δθ zurück.
        werte.set(signalId(g.id, "geschwindigkeit"), s.v * (g.werte.laenge ?? 1));
        break;
      }

      case "federpendel": {
        const s = mechanik[g.id];
        if (!s) break;
        werte.set(signalId(g.id, "auslenkung"), s.q);
        // Hooke: die Feder zieht entgegen der Auslenkung.
        werte.set(signalId(g.id, "kraft"), -(g.werte.federkonstante ?? 10) * s.q);
        break;
      }
    }
  }

  return { zustand: { t, mechanik }, werte };
}
