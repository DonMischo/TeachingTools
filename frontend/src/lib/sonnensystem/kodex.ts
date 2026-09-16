/**
 * Der Kodex: das gesammelte Wissen über die Himmelskörper, geordnet wie das
 * Sonnensystem selbst — Sonne, dann jeder Planet mit seinen Monden darunter.
 * Bildschirm und PDF lesen dieselben Zeilen.
 */
import {
  ART_NAME, ERDE, HAUPTKOERPER, KM_JE_AE, KOERPER_NACH_ID, LICHT_KM_S, mondeVon, satellitenVon, type Koerper,
} from "./daten";
import { umlaufTage } from "./bahnen";
import { dauer, gerundet, km, malErde, tage, zahl, zehnerpotenz } from "./format";

export interface KodexGruppe {
  haupt: Koerper;
  monde: Koerper[];
  /** Nur die Erde hat welche: ISS, Hubble und die anderen. */
  satelliten: Koerper[];
}

/** Sonne, Planeten und Zwergplaneten der Reihe nach, jeweils mit ihren Monden. */
export const KODEX_GRUPPEN: KodexGruppe[] = HAUPTKOERPER.map(haupt => ({
  haupt, monde: mondeVon(haupt.id), satelliten: satellitenVon(haupt.id),
}));

export function artZeile(k: Koerper): string {
  const mutter = k.mutter ? KOERPER_NACH_ID[k.mutter] : null;
  return `${ART_NAME[k.art]}${mutter ? ` von ${mutter.name}` : ""}`;
}

/** Die wichtigsten Zahlen als [Bezeichnung, Wert]. `kurz` lässt Erdvergleiche weg. */
export function datenZeilen(k: Koerper, kurz = false): [string, string][] {
  const z: [string, string][] = [];
  const vergleich = (wert: number, erde: number) => (kurz || k.id === "erde" ? "" : ` (${malErde(wert, erde)} Erde)`);
  if (k.groesse) z.push(["Größe", k.groesse]);
  else z.push(["Durchmesser", `${zahl(k.radiusKm * 2)} km${vergleich(k.radiusKm, ERDE.radiusKm)}`]);
  if (!kurz) {
    z.push(["Masse", k.art === "satellit" ? `${zahl(k.masseKg)} kg` : `${zehnerpotenz(k.masseKg)} kg${vergleich(k.masseKg, ERDE.masseKg)}`]);
  }
  if (k.schwerkraft !== undefined) z.push(["Schwerkraft", `${gerundet(k.schwerkraft)} m/s²`]);
  if (!kurz && k.dichte !== undefined) z.push(["Dichte", `${zahl(k.dichte, 2)} g/cm³`]);
  if (k.rotationStunden !== undefined) {
    z.push(["Eine Drehung", `${tage(k.rotationStunden / 24)}${k.rotationStunden < 0 ? " (rückwärts)" : ""}`]);
  }
  if (k.bahn) {
    z.push(["Ein Jahr", tage(umlaufTage(k.bahn))]);
    z.push(["Abstand zur Sonne", km(k.bahn.a * KM_JE_AE)]);
    if (!kurz) z.push(["Licht von der Sonne", dauer((k.bahn.a * KM_JE_AE) / LICHT_KM_S)]);
  }
  if (k.mondBahn && k.mutter) {
    z.push([`Abstand zu ${KOERPER_NACH_ID[k.mutter].name}`, km(k.mondBahn.aKm)]);
    z.push(["Ein Umlauf", `${tage(Math.abs(k.mondBahn.umlaufTage))}${k.mondBahn.umlaufTage < 0 ? " (rückwärts)" : ""}`]);
  }
  if (k.satBahn && k.mutter) {
    z.push(["Bahnhöhe", `${km(k.satBahn.aKm - KOERPER_NACH_ID[k.mutter].radiusKm)} über der Oberfläche`]);
    z.push(["Ein Umlauf", k.satBahn.umlaufMinuten < 120
      ? `${gerundet(k.satBahn.umlaufMinuten)} Minuten`
      : tage(k.satBahn.umlaufMinuten / 1440)]);
    z.push(["Bahnneigung", `${zahl(k.satBahn.neigung, 1)}° zum Äquator`]);
    if (!kurz && k.betreiber) z.push(["Betrieben von", k.betreiber]);
    if (!kurz && k.start) z.push(["Start", k.start]);
  }
  z.push(["Temperatur", k.temperatur]);
  if (!kurz) z.push(["Atmosphäre", k.atmosphaere]);
  if (k.mondeAnzahl !== undefined) z.push(["Monde", k.mondeAnzahl === 0 ? "keine" : `${k.mondeAnzahl} bekannte`]);
  if (k.entdeckung && !kurz) z.push(["Entdeckt", k.entdeckung]);
  return z;
}
