/** »Maus-Führerschein« in Dashboard und Auswertung (siehe lib/sitzung/typen.ts). */
import { objekt, liste, type Daten, type SitzungAnsicht } from "@/lib/sitzung/typen";
import { ALLE_TEILE, TEILE, type StufeId } from "./ergebnis";

export const STUFEN_ICON: Record<StufeId, string> = {
  klick: "👆", doppelklick: "✌️", rechtsklick: "📋", ziehen: "✋", markieren: "🖍️", kopieren: "📄",
  scrollen: "🖱️", tastatur: "⌨️", explorer: "📁", fenster: "🪟", datei: "💽", screenshot: "📸",
  suche: "🔍", apps: "🧰", aussehen: "🎨", bedienhilfe: "🔎", taskleiste: "📌", profil: "🔒",
  handy: "📱", appstore: "🛍️", berechtigungen: "🔐", privatsphaere: "🛡️", risiken: "⚠️",
};

const stufe = (d: Daten, id: string) => objekt(d, "stufen")[id] as { punkte?: number; sterne?: number } | undefined;
const sterneGesamt = (d: Daten) =>
  Object.values(objekt(d, "stufen")).reduce<number>((s, x) => s + ((x as { sterne?: number })?.sterne ?? 0), 0);

export function mausAnsicht(): SitzungAnsicht {
  const ids = ALLE_TEILE.flatMap(t => TEILE[t]);
  return {
    spalten: [
      { id: "sterne", titel: "Sterne", icon: "⭐", art: "zahl", wert: sterneGesamt },
      { id: "teile", titel: "Bestandene Prüfungen", icon: "🎓", art: "anteil", max: ALLE_TEILE.length, wert: d => liste(d, "bestanden").length },
      { id: "hilfe", titel: "Hilfsmodus", icon: "🤝", art: "text", wert: d => (d.hilfe ? "🤝" : null) },
    ],
    aufgaben: ids.map(id => ({ id, titel: id, icon: STUFEN_ICON[id] })),
    geschafft: (d, id) => (stufe(d, id)?.punkte ?? 0) > 0,
    rang: { titel: "Sterne", art: "zahl", richtung: "max", wert: sterneGesamt },
  };
}
