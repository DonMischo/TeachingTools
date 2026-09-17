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
import type { Szene } from "./typen";

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
 * Die Masse, die am unteren Haken eines Kraftmessers hängt, in Kilogramm.
 *
 * Vorerst nur, was unmittelbar daran hängt. Sobald Rollen und Flaschenzüge
 * dazukommen, wird daraus ein Lauf durch den Verbindungsgraphen.
 */
export function haengendeLast(szene: Szene, kraftmesser: string): number {
  let masse = 0;
  for (const v of szene.verbindungen) {
    const enden = [
      [v.von, v.nach],
      [v.nach, v.von],
    ] as const;
    for (const [hier, dort] of enden) {
      if (hier.geraet !== kraftmesser || hier.port !== "unten") continue;
      const anderes = szene.geraete.find(g => g.id === dort.geraet);
      if (anderes?.typ === "massestueck") masse += anderes.werte.masse ?? 0;
    }
  }
  return masse;
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
        werte.set(signalId(g.id, "kraft"), haengendeLast(szene, g.id) * G);
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
