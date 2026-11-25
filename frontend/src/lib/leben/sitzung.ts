/** »Rock your Life« in Dashboard und Auswertung (siehe lib/sitzung/typen.ts). */
import { objekt, type Daten, type SitzungAnsicht } from "@/lib/sitzung/typen";

const MONATE = 60;
const zus = (d: Daten) => objekt(d, "zusammenfassung");
const zahlAus = (d: Daten, k: string): number => Number(zus(d)[k] ?? 0) || 0;
const textAus = (d: Daten, k: string): string | null => {
  const v = zus(d)[k];
  return typeof v === "string" && v ? v : null;
};
const tiefstes = (d: Daten): string | null => {
  const t = Object.entries(objekt(zus(d), "beduerfnisse")).sort((a, b) => Number(a[1]) - Number(b[1]))[0];
  return t ? `${t[0]} ${t[1]}` : null;
};

export function lebenAnsicht(): SitzungAnsicht {
  return {
    spalten: [
      { id: "monat", titel: "Spielmonat", icon: "📅", art: "anteil", max: MONATE, wert: d => Math.min(MONATE, zahlAus(d, "monat")) },
      { id: "job", titel: "Job", icon: "💼", art: "text", wert: d => textAus(d, "job") },
      { id: "wohnung", titel: "Wohnen", icon: "🏠", art: "text", wert: d => textAus(d, "wohnung") },
      { id: "konto", titel: "Konto", icon: "💶", art: "zahl", einheit: "€", wert: d => zahlAus(d, "konto") },
      { id: "sparkonto", titel: "Sparen", icon: "🐷", art: "zahl", einheit: "€", wert: d => zahlAus(d, "sparkonto") },
      { id: "schulden", titel: "Schulden", icon: "📉", art: "zahl", einheit: "€", wert: d => zahlAus(d, "schulden") },
      { id: "abgaben", titel: "Steuern + Sozialversicherung", icon: "🧾", art: "zahl", einheit: "€", wert: d => zahlAus(d, "steuern_gesamt") + zahlAus(d, "sv_gesamt") },
      { id: "befinden", titel: "Niedrigstes Bedürfnis", icon: "🙂", art: "text", wert: tiefstes },
    ],
    fortschritt: d => Math.min(1, zahlAus(d, "monat") / MONATE),
    rang: { titel: "Kontostand", art: "zahl", richtung: "max", wert: d => zahlAus(d, "konto") + zahlAus(d, "sparkonto") - zahlAus(d, "schulden") },
  };
}
