/**
 * Wo ein Aufbau liegt, solange er niemandem geschickt wurde.
 *
 * Wie beim Sonnensystem: nur im Browser, je Konto bzw. je Sitzungscode. Das
 * Teilen über einen Beitritts-Code kommt in Phase 5 — dann wandert dieselbe
 * JSON-Zeichenkette über `REF_TOOLS` in die Sitzung, ohne dass sich hier
 * etwas ändern muss.
 */
import { alsJSON, ausJSON, neueSzene } from "./szene";
import type { Szene } from "./typen";

const name = (schluessel: string) => `physik-aufbau-v1:${schluessel}`;

export function ladeSzene(schluessel: string): Szene {
  try {
    const roh = localStorage.getItem(name(schluessel));
    return roh ? ausJSON(roh) : neueSzene();
  } catch {
    return neueSzene();
  }
}

export function speichereSzene(schluessel: string, szene: Szene) {
  try {
    localStorage.setItem(name(schluessel), alsJSON(szene));
  } catch { /* privater Modus: dann eben nur für diese Sitzung */ }
}
