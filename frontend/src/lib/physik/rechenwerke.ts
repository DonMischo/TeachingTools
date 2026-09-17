/**
 * Die Rechenwerke — was in einem Zeitschritt passiert.
 *
 * Jeder Bereich rechnet für sich (Mechanik als Differentialgleichung, der
 * Stromkreis als Knotengleichung, die Optik ganz ohne Zeit) und legt sein
 * Ergebnis als Signal auf den Messbus. Ein gemeinsamer Löser wäre weder
 * möglich noch nötig: zusammen kommen die Bereiche über Ports und Signale.
 *
 * Schritt 1b hat zwei Quellen — den Funktionsgenerator (rechnet aus der Zeit)
 * und den Kraftmesser (rechnet aus dem Aufbau). Mehr braucht es nicht, um zu
 * zeigen, dass dasselbe Oszilloskop beides anzeigt, ohne die Herkunft zu
 * kennen. Der Kraftmesser wiegt vorerst nur statisch; die Bewegung kommt mit
 * der Mechanik in Schritt 1c.
 */
import { G } from "./einheiten";
import { geraetTyp } from "./katalog";
import { signalId, type SignalId } from "./messbus";
import type { Szene } from "./typen";

/** Kurvenformen des Funktionsgenerators — im Aufbau als Zahl gespeichert. */
export const SINUS = 0;
export const RECHTECK = 1;
export const DREIECK = 2;

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
 * Gibt die Signalwerte zurück, statt sie selbst zu schreiben — so bleibt der
 * Schritt eine reine Funktion und lässt sich ohne Bus und ohne Uhr prüfen.
 */
export function schritt(szene: Szene, t: number, _dt: number): Map<SignalId, number> {
  const werte = new Map<SignalId, number>();

  for (const g of szene.geraete) {
    const typ = geraetTyp(g.typ);
    if (!typ?.signale.length) continue;

    if (g.typ === "signalgeber") {
      werte.set(signalId(g.id, "spannung"), generatorWert(
        g.werte.form ?? SINUS,
        g.werte.frequenz ?? 1,
        g.werte.amplitude ?? 1,
        t,
      ));
    } else if (g.typ === "kraftmesser") {
      werte.set(signalId(g.id, "kraft"), haengendeLast(szene, g.id) * G);
    }
  }

  return werte;
}

/** Zeitschritt der Simulation. 240 Hz trägt später auch ein schnelles Pendel. */
export const DT = 1 / 240;
