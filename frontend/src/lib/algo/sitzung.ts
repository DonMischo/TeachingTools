/** »Algorithmen-Werkstatt« in Dashboard und Auswertung (siehe lib/sitzung/typen.ts). */
import { liste, objekt, type Daten, type SitzungAnsicht } from "@/lib/sitzung/typen";
import { AUTOMATEN } from "./automaten";
import { AUFGABEN } from "./fluss";
import { LEVEL } from "./level";

type Wertung = { sterne?: number; punkte?: number };

const wertung = (d: Daten, schluessel: string) => objekt(d, "wertung")[schluessel] as Wertung | undefined;
const sterneVon = (d: Daten, id: string) => (objekt(d, "level")[id] as { sterne?: number } | undefined)?.sterne ?? 0;

const automatFertig = (d: Daten, id: string) => !!wertung(d, `automat:${id}`) || liste(d, "automat").includes(id);
const flussFertig = (d: Daten, id: string) => !!wertung(d, `fluss:${id}`) || liste(d, "fluss").includes(id);

/** Punkte aus allen Reitern: Level plus Wertungen. */
const punkte = (d: Daten): number =>
  Object.values(objekt(d, "level")).reduce<number>((s, l) => s + ((l as { punkte?: number })?.punkte ?? 0), 0)
  + Object.values(objekt(d, "wertung")).reduce<number>((s, w) => s + ((w as Wertung)?.punkte ?? 0), 0);

export function algoAnsicht(): SitzungAnsicht {
  return {
    spalten: [
      { id: "punkte", titel: "Punkte aus allen Reitern", icon: "🏆", art: "zahl", wert: punkte },
      { id: "automaten", titel: "Automaten", icon: "🤖", art: "anteil", max: AUTOMATEN.length, wert: d => AUTOMATEN.filter(a => automatFertig(d, a.id)).length },
      { id: "fluss", titel: "Flussdiagramm-Aufgaben", icon: "🔀", art: "anteil", max: AUFGABEN.length, wert: d => AUFGABEN.filter(a => flussFertig(d, a.id)).length },
      { id: "level", titel: "Level mit Sternen", icon: "⭐", art: "anteil", max: LEVEL.length, wert: d => LEVEL.filter(l => sterneVon(d, l.id) > 0).length },
    ],
    aufgaben: [
      ...AUTOMATEN.map(a => ({ id: `automat:${a.id}`, titel: a.name, icon: a.icon })),
      ...AUFGABEN.map((a, i) => ({ id: `fluss:${a.id}`, titel: a.titel, icon: `F${i + 1}` })),
      ...LEVEL.map(l => ({ id: `level:${l.id}`, titel: `${l.id} ${l.titel}`, icon: l.id })),
    ],
    geschafft: (d, id) => {
      const [art, rest] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
      return art === "automat" ? automatFertig(d, rest) : art === "fluss" ? flussFertig(d, rest) : sterneVon(d, rest) > 0;
    },
    rang: { titel: "Punkte", art: "zahl", richtung: "max", wert: punkte },
  };
}
