/**
 * Die Regeln des Flugs — getrennt von three.js, damit dieselben Formeln die
 * Flugschleife antreiben und die Flugzeit vorausrechnen.
 *
 * Einheiten: eine Flugeinheit sind 1 000 km, Abstände zwischen Himmelskörpern
 * sind 60-fach verkürzt (siehe massstab.ts). Tempo in Einheiten je Sekunde.
 *
 * Grundsatz: das Tempo richtet sich nach dem Abstand. Wer weit weg von allem
 * ist, fliegt schnell; wer auf einen Körper zuhält, wird von selbst langsamer.
 * Deshalb gibt es auch ohne Autopilot keinen Aufprall mit Pulsgeschwindigkeit.
 */
import { LICHT_KM_S } from "./daten";
import { FLUG_ABSTANDSTEILER, FLUG_KM_JE_EINHEIT } from "./massstab";

/** Echte Kilometer, für die eine Flugeinheit zwischen den Planeten steht. */
export const KM_JE_FLUGEINHEIT = FLUG_KM_JE_EINHEIT * FLUG_ABSTANDSTEILER;

/** Pulsantrieb: höchstens 100-fache Lichtgeschwindigkeit. */
export const HOECHSTTEMPO = (100 * LICHT_KM_S) / KM_JE_FLUGEINHEIT;
/** Overdrive: 1000-fache Lichtgeschwindigkeit, für kurze Zeit. */
export const OVERDRIVE_TEMPO = 10 * HOECHSTTEMPO;
export const OVERDRIVE_DAUER = 12;
export const OVERDRIVE_ABKLINGZEIT = 60;

/** Im Pulsantrieb: Tempo = Abstand × Faktor. Daraus folgt das Abbremsen. */
export const PULS_BREMSFAKTOR = 0.8;
/** Außerhalb des Pulsantriebs: Tempo = Abstand × Faktor, höchstens ein Fünftel des Pulstempos. */
export const IMPULS_FAKTOR = 0.9;
/** Wer schneller auf eine Oberfläche trifft, stürzt ab. Mit vollem Schub ist man darüber, mit wenig setzt man sanft auf. */
export const ABSTURZ_TEMPO = 1.2;

/** Hier hält der Autopilot an: ein paar Radien über der Oberfläche. */
export const haltAbstand = (radius: number) => Math.max(radius * 2.5, 6);

export const vielfachesLicht = (tempo: number) => (tempo * KM_JE_FLUGEINHEIT) / LICHT_KM_S;

export interface Antrieb {
  puls: boolean;
  overdrive: boolean;
  /** 0 … 1, nur außerhalb des Pulsantriebs wirksam */
  schub: number;
}

/** Welches Tempo der Antrieb anstrebt, wenn `voraus` Einheiten frei sind. */
export function zielTempo(a: Antrieb, voraus: number): number {
  if (a.puls) {
    const grenze = a.overdrive ? OVERDRIVE_TEMPO : HOECHSTTEMPO;
    return Math.min(Math.max(voraus * PULS_BREMSFAKTOR, 20), grenze);
  }
  return Math.min(a.schub * Math.min(Math.max(voraus * IMPULS_FAKTOR, 1.5), HOECHSTTEMPO / 5), HOECHSTTEMPO);
}

/** Wie schnell das Tempo nachzieht: beschleunigen gemächlich, bremsen kräftig. */
export function tempoRate(vZiel: number, v: number, a: Antrieb): number {
  if (vZiel < v) return 4;
  if (a.overdrive) return 1.3;
  return a.puls ? 0.9 : 2.4;
}

export function naechstesTempo(v: number, vZiel: number, a: Antrieb, dt: number): number {
  return v + (vZiel - v) * (1 - Math.exp(-dt * tempoRate(vZiel, v, a)));
}

/** Ab wann lohnt der Overdrive nicht mehr: das Bremstempo liegt unter dem normalen Puls. */
export const overdriveLohntNicht = (voraus: number) => voraus * PULS_BREMSFAKTOR < HOECHSTTEMPO;

export interface AutopilotEntscheidung { angekommen: boolean; puls: boolean; schub: number }

/** Ein Schritt des Autopiloten: Puls weit weg, Impuls nah, Stopp am Halteabstand. */
export function autopilot(rest: number, halt: number, naechster: number, ausgerichtet: boolean): AutopilotEntscheidung {
  if (rest <= halt * 1.05) return { angekommen: true, puls: false, schub: 0 };
  if (ausgerichtet && rest > halt * 12 && naechster > 30) return { angekommen: false, puls: true, schub: 1 };
  return { angekommen: false, puls: false, schub: ausgerichtet ? Math.min(1, (rest - halt) / Math.max(halt, 1) + 0.15) : 0.1 };
}

export interface FlugLage {
  /** Abstand zur Oberfläche des Ziels */
  abstand: number;
  zielRadius: number;
  /** Abstand zur Oberfläche des nächsten anderen Körpers (Startplanet, Monde) */
  startAbstand: number;
  tempo: number;
  puls: boolean;
  /** Restzeit eines laufenden Overdrives in Sekunden, sonst 0 */
  overdriveRest: number;
  /** Winkel zwischen Blickrichtung und Ziel, Bogenmaß */
  winkel: number;
}

/**
 * Wie lange braucht der Autopilot von hier aus? Gerechnet wird der Flug
 * eindimensional mit genau den Regeln oben: erst ausrichten, dann aus der
 * Nähe des Startkörpers heraus, frei fliegen, vor dem Ziel abbremsen.
 * Umwege um Planeten, die im Weg liegen, kennt die Schätzung nicht.
 */
export function schaetzeFlugzeit(lage: FlugLage): number {
  const halt = haltAbstand(lage.zielRadius);
  if (lage.abstand <= halt * 1.05) return 0;
  const dt = 0.1;
  // Ausrichten: der Autopilot dreht exponentiell mit Rate 2,5 bis unter 0,15 rad.
  const drehzeit = lage.winkel > 0.15 ? Math.log(lage.winkel / 0.15) / 2.5 : 0;
  let rest = lage.abstand;
  let start = lage.startAbstand;
  let v = lage.tempo;
  let overdrive = lage.overdriveRest;
  const a: Antrieb = { puls: lage.puls, overdrive: overdrive > 0, schub: 0 };
  let t = 0;
  while (t < 3600) {
    const naechster = Math.min(rest, start);
    const e = autopilot(rest, halt, naechster, t >= drehzeit);
    if (e.angekommen) break;
    a.puls = e.puls;
    a.schub = e.schub;
    a.overdrive = a.puls && overdrive > 0 && !overdriveLohntNicht(rest);
    if (overdrive > 0) overdrive = a.overdrive ? overdrive - dt : 0;
    v = naechstesTempo(v, zielTempo(a, naechster), a, dt);
    rest -= v * dt;
    start += v * dt;
    t += dt;
  }
  return t;
}
