/**
 * Der Kodex: das gesammelte Wissen über die Himmelskörper, geordnet wie das
 * Sonnensystem selbst — Sonne, dann jeder Planet mit seinen Monden darunter.
 * Bildschirm und PDF lesen dieselben Zeilen.
 */
import { ART_NAME, ERDE, HAUPTKOERPER, KM_JE_AE, KOERPER_NACH_ID, LICHT_KM_S, mondeVon, type Koerper } from "./daten";
import { umlaufTage } from "./bahnen";
import { dauer, gerundet, km, malErde, tage, zahl, zehnerpotenz } from "./format";

export interface KodexGruppe {
  haupt: Koerper;
  monde: Koerper[];
}

/** Sonne, Planeten und Zwergplaneten der Reihe nach, jeweils mit ihren Monden. */
export const KODEX_GRUPPEN: KodexGruppe[] = HAUPTKOERPER.map(haupt => ({ haupt, monde: mondeVon(haupt.id) }));

export function artZeile(k: Koerper): string {
  const mutter = k.mutter ? KOERPER_NACH_ID[k.mutter] : null;
  return `${ART_NAME[k.art]}${mutter ? ` von ${mutter.name}` : ""}`;
}

/** Die wichtigsten Zahlen als [Bezeichnung, Wert]. `kurz` lässt Erdvergleiche weg. */
export function datenZeilen(k: Koerper, kurz = false): [string, string][] {
  const z: [string, string][] = [];
  const vergleich = (wert: number, erde: number) => (kurz || k.id === "erde" ? "" : ` (${malErde(wert, erde)} Erde)`);
  z.push(["Durchmesser", `${zahl(k.radiusKm * 2)} km${vergleich(k.radiusKm, ERDE.radiusKm)}`]);
  if (!kurz) z.push(["Masse", `${zehnerpotenz(k.masseKg)} kg${vergleich(k.masseKg, ERDE.masseKg)}`]);
  z.push(["Schwerkraft", `${gerundet(k.schwerkraft)} m/s²`]);
  if (!kurz) z.push(["Dichte", `${zahl(k.dichte, 2)} g/cm³`]);
  z.push(["Eine Drehung", `${tage(k.rotationStunden / 24)}${k.rotationStunden < 0 ? " (rückwärts)" : ""}`]);
  if (k.bahn) {
    z.push(["Ein Jahr", tage(umlaufTage(k.bahn))]);
    z.push(["Abstand zur Sonne", km(k.bahn.a * KM_JE_AE)]);
    if (!kurz) z.push(["Licht von der Sonne", dauer((k.bahn.a * KM_JE_AE) / LICHT_KM_S)]);
  }
  if (k.mondBahn && k.mutter) {
    z.push([`Abstand zu ${KOERPER_NACH_ID[k.mutter].name}`, km(k.mondBahn.aKm)]);
    z.push(["Ein Umlauf", `${tage(Math.abs(k.mondBahn.umlaufTage))}${k.mondBahn.umlaufTage < 0 ? " (rückwärts)" : ""}`]);
  }
  z.push(["Temperatur", k.temperatur]);
  if (!kurz) z.push(["Atmosphäre", k.atmosphaere]);
  if (k.mondeAnzahl !== undefined) z.push(["Monde", k.mondeAnzahl === 0 ? "keine" : `${k.mondeAnzahl} bekannte`]);
  if (k.entdeckung && !kurz) z.push(["Entdeckt", k.entdeckung]);
  return z;
}
