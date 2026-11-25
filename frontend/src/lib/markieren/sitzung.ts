/** »Markieren & Bearbeiten« in Dashboard und Auswertung (siehe lib/sitzung/typen.ts). */
import { liste, objekt, type Daten, type SitzungAnsicht, type Spalte } from "@/lib/sitzung/typen";
import { LEKTIONEN, MODI, type Modus } from "./aufgaben";
import { faelle } from "./quellen";

const bestzeit = (d: Daten, m: Modus): number | null => {
  const c = objekt(objekt(d, "challenge"), m) as { best_ms?: number | null };
  return typeof c.best_ms === "number" ? c.best_ms : null;
};

export function markierAnsicht(): SitzungAnsicht {
  const quellen = faelle().length;
  const spalten: Spalte[] = [
    { id: "techniken", titel: "Geschaffte Techniken", icon: "📘", art: "anteil", max: LEKTIONEN.length, wert: d => liste(d, "lektionen").length },
    ...(Object.keys(MODI) as Modus[]).map((m): Spalte => ({
      id: `beste-${m}`, titel: `Bestzeit ${MODI[m].titel}`, icon: MODI[m].icon, art: "zeit", wert: d => bestzeit(d, m),
    })),
    { id: "quellen", titel: "Richtig zitierte Quellen", icon: "📚", art: "anteil", max: quellen, wert: d => Object.keys(objekt(d, "quellen")).length },
  ];
  return {
    spalten,
    aufgaben: LEKTIONEN.map(l => ({ id: l.id, titel: l.titel, icon: l.icon })),
    geschafft: (d, id) => liste(d, "lektionen").includes(id),
    rang: { titel: "Bestzeit Gemischt", art: "zeit", richtung: "min", wert: d => bestzeit(d, "gemischt") },
  };
}
