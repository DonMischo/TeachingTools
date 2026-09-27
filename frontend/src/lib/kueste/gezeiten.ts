// Reine Logik zur Gezeitensimulation (Tiden) an deutschen Küstenorten.
// Keine React-Abhängigkeiten.

export const TIDE_STUNDEN = 12 + 25 / 60; // halbtägige Tide: 12 h 25 min
export const SYNODISCH_TAGE = 29.53; // Mondphasen-Periode in Tagen

export type Meer = "Nordsee" | "Ostsee";

export interface Ort {
  id: string;
  name: string;
  meer: Meer;
  hub: number; // mittlerer Tidenhub in m
}

export const ORTE: Ort[] = [
  { id: "wilhelmshaven", name: "Wilhelmshaven", meer: "Nordsee", hub: 3.8 },
  { id: "husum", name: "Husum", meer: "Nordsee", hub: 3.5 },
  { id: "cuxhaven", name: "Cuxhaven", meer: "Nordsee", hub: 3.0 },
  { id: "helgoland", name: "Helgoland", meer: "Nordsee", hub: 2.4 },
  { id: "westerland", name: "Sylt (Westerland)", meer: "Nordsee", hub: 1.8 },
  { id: "warnemuende", name: "Warnemünde", meer: "Ostsee", hub: 0.1 },
  { id: "kiel", name: "Kiel", meer: "Ostsee", hub: 0.1 },
];

/**
 * Springtide/Nipptide-Faktor abhängig vom Tag im synodischen Monat.
 * tag = 0 → Neumond (Springtide, Faktor 1.2)
 * tag = SYNODISCH_TAGE/2 (~14.77) → Vollmond (ebenfalls Springtide, Faktor 1.2)
 * dazwischen (Halbmond) → Nipptide, Faktor 0.8
 */
export function springFaktor(tag: number): number {
  return 1 + 0.2 * Math.cos((2 * Math.PI * tag) / (SYNODISCH_TAGE / 2));
}

/**
 * Wasserstand in m relativ zum Mittelwasser.
 * stunde 0 = Hochwasser bei Neumond.
 */
export function pegel(hub: number, stunde: number): number {
  const tag = stunde / 24;
  return (hub / 2) * springFaktor(tag) * Math.cos((2 * Math.PI * stunde) / TIDE_STUNDEN);
}

export type Phase = "Flut" | "Ebbe" | "Hochwasser" | "Niedrigwasser";

const EXTREM_FENSTER_STUNDEN = 20 / 60; // ±20 Minuten um einen Extremwert

/**
 * Ableitung des Pegels näherungsweise über eine kleine Zeitdifferenz.
 */
function pegelAbleitung(hub: number, stunde: number): number {
  const dt = 1 / 60; // 1 Minute
  return (pegel(hub, stunde + dt) - pegel(hub, stunde - dt)) / (2 * dt);
}

export function phase(hub: number, stunde: number): Phase {
  // Abstand zum nächsten Extremwert (Vielfaches von TIDE_STUNDEN/2, versetzt um 0)
  const halbePeriode = TIDE_STUNDEN / 2;
  const rest = stunde % halbePeriode;
  const restNormiert = rest < 0 ? rest + halbePeriode : rest;
  const abstandZumExtrem = Math.min(restNormiert, halbePeriode - restNormiert);

  if (abstandZumExtrem <= EXTREM_FENSTER_STUNDEN) {
    const wert = pegel(hub, stunde);
    const mittel = pegel(hub, stunde - EXTREM_FENSTER_STUNDEN * 2);
    return wert >= mittel ? "Hochwasser" : "Niedrigwasser";
  }

  const ableitung = pegelAbleitung(hub, stunde);
  return ableitung > 0 ? "Flut" : "Ebbe";
}

export interface Extremwert {
  stunde: number;
  art: "HW" | "NW";
  pegel: number;
}

/**
 * Liefert die Liste der Extremwerte (Hoch-/Niedrigwasser) im angegebenen Zeitfenster.
 * Hochwasser liegt bei stunde = k * TIDE_STUNDEN (k ganzzahlig, da stunde=0 HW ist),
 * Niedrigwasser dazwischen bei stunde = (k + 0.5) * TIDE_STUNDEN.
 */
export function extremwerte(hub: number, vonStunde: number, bisStunde: number): Extremwert[] {
  const halbePeriode = TIDE_STUNDEN / 2;
  const ergebnisse: Extremwert[] = [];

  const startIndex = Math.floor(vonStunde / halbePeriode) - 1;
  const endIndex = Math.ceil(bisStunde / halbePeriode) + 1;

  for (let k = startIndex; k <= endIndex; k++) {
    const stunde = k * halbePeriode;
    if (stunde < vonStunde || stunde > bisStunde) continue;
    const art: "HW" | "NW" = k % 2 === 0 ? "HW" : "NW";
    ergebnisse.push({ stunde, art, pegel: pegel(hub, stunde) });
  }

  return ergebnisse;
}

export function uhrzeit(stunde: number): string {
  const tag = Math.floor(stunde / 24) + 1;
  const restStunden = ((stunde % 24) + 24) % 24;
  const std = Math.floor(restStunden);
  const min = Math.round((restStunden - std) * 60);
  const stdKorrigiert = min === 60 ? std + 1 : std;
  const minKorrigiert = min === 60 ? 0 : min;
  const stdStr = String(stdKorrigiert % 24).padStart(2, "0");
  const minStr = String(minKorrigiert).padStart(2, "0");
  return `Tag ${tag}, ${stdStr}:${minStr}`;
}
