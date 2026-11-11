/**
 * Erfolge der »Geschichte der Medien« — abgeleitet aus dem Fortschritt:
 * Stationen, ganze Epochen, das Flop-Museum, gelöste Mitmach-Demos und die
 * Bestwerte der Spiele. Gezeigt im Reiter »Erfolge« und auf /erfolge.
 */
import { EPOCHEN, MEDIEN } from "./medien";
import { ERPROBT } from "./erprobt";
import { AUFTRAEGE } from "./spiele";
import type { Fortschritt } from "./fortschritt";

export interface MedienErfolg {
  id: string;
  icon: string;
  name: string;
  text: string;
  gruppe: "Zeitreise" | "Epochen" | "Ausprobiert" | "Spiele";
  ziel: number;
  wert: (f: Fortschritt) => number;
}

const zahl = (f: Fortschritt) => f.geschafft.length;
const EILBOTE_MAX = AUFTRAEGE.length * 100;
const FLOPS = MEDIEN.filter(m => m.flop).map(m => m.id);

export const ERFOLGE: MedienErfolg[] = [
  { id: "erste-station", icon: "🕰️", name: "Zeitreisende", text: "Schaff deine erste Station.", gruppe: "Zeitreise", ziel: 1, wert: zahl },
  { id: "zehn", icon: "🧭", name: "Unterwegs", text: "Schaff 10 Stationen.", gruppe: "Zeitreise", ziel: 10, wert: zahl },
  { id: "viertel", icon: "🗺️", name: "Viertel der Geschichte", text: `Schaff ${Math.ceil(MEDIEN.length / 4)} Stationen.`, gruppe: "Zeitreise", ziel: Math.ceil(MEDIEN.length / 4), wert: zahl },
  { id: "haelfte", icon: "⏳", name: "Halbzeit", text: `Schaff ${Math.ceil(MEDIEN.length / 2)} Stationen.`, gruppe: "Zeitreise", ziel: Math.ceil(MEDIEN.length / 2), wert: zahl },
  { id: "alle", icon: "🏆", name: "In der Gegenwart angekommen", text: `Schaff alle ${MEDIEN.length} Stationen.`, gruppe: "Zeitreise", ziel: MEDIEN.length, wert: zahl },
  { id: "flops", icon: "🪦", name: "Museumsführer", text: `Schaff alle ${FLOPS.length} Stationen, die im Flop-Museum liegen.`, gruppe: "Zeitreise", ziel: FLOPS.length, wert: f => FLOPS.filter(id => f.geschafft.includes(id)).length },
  ...EPOCHEN.map((e): MedienErfolg => {
    const ids = MEDIEN.filter(m => m.epoche === e.id).map(m => m.id);
    return { id: `epoche-${e.id}`, icon: e.icon, name: e.name, text: `Schaff alle ${ids.length} Stationen der Epoche ${e.name}.`, gruppe: "Epochen", ziel: ids.length, wert: f => ids.filter(id => f.geschafft.includes(id)).length };
  }),
  ...ERPROBT.map((d): MedienErfolg => ({ id: `demo-${d.id}`, icon: d.icon, name: d.name, text: d.text, gruppe: "Ausprobiert", ziel: 1, wert: f => (f.erprobt.includes(d.id) ? 1 : 0) })),
  { id: "alles-ausprobiert", icon: "🧰", name: "Alles ausprobiert", text: `Lös alle ${ERPROBT.length} Mitmach-Aufgaben.`, gruppe: "Ausprobiert", ziel: ERPROBT.length, wert: f => ERPROBT.filter(d => f.erprobt.includes(d.id)).length },
  { id: "eilbote", icon: "🏃", name: "Eilbote", text: `Hol im Spiel »Eilbote« mindestens ${EILBOTE_MAX / 2} Punkte.`, gruppe: "Spiele", ziel: EILBOTE_MAX / 2, wert: f => f.eilbote },
  { id: "meisterkurier", icon: "🥇", name: "Meisterkurier", text: `Hol im »Eilboten« ${Math.round(EILBOTE_MAX * 0.9)} von ${EILBOTE_MAX} Punkten.`, gruppe: "Spiele", ziel: Math.round(EILBOTE_MAX * 0.9), wert: f => f.eilbote },
  { id: "sortieren-3", icon: "🧩", name: "Zeitgefühl", text: "Schaff bei »Wer war zuerst?« 3 Runden ohne Fehler hintereinander.", gruppe: "Spiele", ziel: 3, wert: f => f.sortieren },
  { id: "sortieren-10", icon: "🧠", name: "Lebende Zeitleiste", text: "Schaff bei »Wer war zuerst?« 10 Runden ohne Fehler hintereinander.", gruppe: "Spiele", ziel: 10, wert: f => f.sortieren },
];

/** Ids der erreichten Erfolge */
export const erreichte = (f: Fortschritt) => new Set(ERFOLGE.filter(e => e.wert(f) >= e.ziel).map(e => e.id));
