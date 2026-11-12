/** Beispielnetze für den Baukasten — gebaut mit dem Editor, damit sie normalisiert sind. */
import { LEER, editor, type Baukasten, type BkArt } from "./baukasten";
import type { Medium } from "./modell";

type T = [BkArt, number, number, number, number, Record<string, number>?];

function baue(medium: Medium, teile: T[], leitungen: number[][]): Baukasten {
  let bk: Baukasten = { ...LEER, medium };
  for (const [art, ax, ay, bx, by, werte] of teile) {
    const r = editor.fuegeBauteilHinzu(bk, art, { x: ax, y: ay }, { x: bx, y: by });
    bk = r.schaltung;
    for (const [k, v] of Object.entries(werte ?? {})) bk = editor.setzeWert(bk, r.id, k, v);
  }
  for (const zug of leitungen) {
    for (let i = 2; i < zug.length; i += 2) bk = editor.fuegeDrahtHinzu(bk, { x: zug[i - 2], y: zug[i - 1] }, { x: zug[i], y: zug[i + 1] });
  }
  return bk;
}

export const BEISPIELE: { id: string; name: string; idee: string; baukasten: Baukasten }[] = [
  {
    id: "verbunden", name: "Verbundene Gefäße",
    idee: "Drei Behälter, verschieden breit und hoch: Nach einer Weile steht das Wasser überall gleich hoch. Gieße um, indem du die »Füllung beim Start« änderst.",
    baukasten: baue("wasser", [
      ["behaelter", 2, 8, 2, 2, { flaeche: 0.05, fuellung: 0.9 }],
      ["behaelter", 10, 8, 10, 4, { flaeche: 0.2, fuellung: 0.1 }],
      ["behaelter", 18, 8, 18, 0, { flaeche: 0.02, fuellung: 0.4 }],
      ["rohr", 2, 8, 10, 8, { durchmesser: 0.03, laenge: 2 }],
      ["rohr", 10, 8, 18, 8, { durchmesser: 0.03, laenge: 2 }],
    ], []),
  },
  {
    id: "kreislauf", name: "Pumpenkreislauf mit zwei Zweigen",
    idee: "Die Pumpe treibt das Wasser im Kreis. Der dünne Zweig mit Ventil bekommt weniger ab — dreh am Ventil und sieh, wie sich der Durchfluss auf beide Zweige verteilt.",
    baukasten: baue("wasser", [
      ["pumpe", 2, 10, 2, 4, { foerderdruck: 0.6e5, maxFluss: 1.5e-3 }],
      ["quelle", 2, 10, 2, 13, { druck: 1e5 }],
      ["manometer", 6, 4, 6, 2],
      ["rohr", 6, 4, 16, 4, { durchmesser: 0.02, laenge: 10 }],
      ["ventil", 6, 7, 9, 7, { oeffnung: 0.6 }],
      ["rohr", 9, 7, 16, 7, { durchmesser: 0.012, laenge: 10 }],
      ["durchfluss", 16, 10, 10, 10],
      ["manometer", 16, 10, 16, 12],
    ], [[2, 4, 6, 4], [6, 4, 6, 7], [16, 4, 16, 10], [10, 10, 2, 10]]),
  },
  {
    id: "turm", name: "Wasserturm und zwei Zapfstellen",
    idee: "Der Turm steht 5 m über der Mitte. Die untere Zapfstelle liegt 10 m tiefer als die obere — dort ist der Druck um rund 1 bar höher, und es läuft mehr.",
    baukasten: baue("wasser", [
      ["behaelter", 2, -10, 2, -16, { flaeche: 5, fuellung: 0.8 }],
      ["hahn", 12, 10, 12, 12],
      ["hahn", 12, -0, 12, 2],
      ["manometer", 12, 10, 14, 10],
      ["manometer", 12, 0, 14, 0],
      ["rohr", 2, 10, 12, 10, { durchmesser: 0.025, laenge: 10 }],
      ["rohr", 2, 0, 12, 0, { durchmesser: 0.025, laenge: 10 }],
    ], [[2, -10, 2, 10]]),
  },
  {
    id: "haus", name: "Hausanschluss mit Druckminderer",
    idee: "Das Netz liefert 6 bar, der Druckminderer hält dahinter 3 bar. Öffne beide Hähne: Hinter dem Minderer bleibt es bei 3 bar, solange vorne genug ankommt.",
    baukasten: baue("wasser", [
      ["quelle", 0, 6, 0, 8, { druck: 6e5 }],
      ["durchfluss", 2, 6, 6, 6],
      ["rueckschlag", 6, 6, 9, 6],
      ["druckminderer", 9, 6, 13, 6, { druck: 3e5 }],
      ["manometer", 13, 6, 13, 4],
      ["hahn", 20, 6, 20, 8, { oeffnung: 1 }],
      ["rohr", 16, 6, 16, -2, { durchmesser: 0.015, laenge: 6 }],
      ["hahn", 16, -2, 18, -2, { oeffnung: 0.5 }],
      ["manometer", 16, -2, 16, -4],
    ], [[0, 6, 2, 6], [13, 6, 20, 6]]),
  },
  {
    id: "druckluft", name: "Druckluft mit Kessel und Zylinder",
    idee: "Der Kompressor füllt den Kessel, der Druckminderer gibt 6 bar weiter. Ventil auf: Der Zylinder fährt aus, wenn p·A die Last schafft. Ventil zu und Ablass auf: Die Last drückt ihn zurück.",
    baukasten: baue("luft", [
      ["quelle", 0, 6, 0, 8, { druck: 0 }],
      ["pumpe", 0, 6, 4, 6, { foerderdruck: 8e5, maxFluss: 3e-3 }],
      ["rueckschlag", 4, 6, 7, 6],
      ["kessel", 7, 6, 7, 2, { volumen: 0.02, druck: 0 }],
      ["druckminderer", 9, 6, 13, 6, { druck: 6e5 }],
      ["manometer", 13, 6, 13, 4],
      ["ventil", 13, 6, 16, 6, { oeffnung: 0.3 }],
      ["zylinder", 16, 6, 22, 6, { durchmesser: 0.05, hub: 0.2, last: 500 }],
      ["hahn", 16, 6, 16, 8, { oeffnung: 0 }],
    ], [[7, 6, 9, 6]]),
  },
  {
    id: "presse", name: "Hydraulische Hebebühne",
    idee: "Mit Öl: Die Pumpe schafft 20 bar, der Kolben mit 10 cm Durchmesser braucht für 10 kN nur knapp 13 bar (p = F/A). Erhöhe die Last, bis er stehen bleibt.",
    baukasten: baue("oel", [
      ["quelle", 0, 6, 0, 8, { druck: 0 }],
      ["pumpe", 0, 6, 4, 6, { foerderdruck: 20e5, maxFluss: 2 / 60000 }],
      ["rueckschlag", 4, 6, 8, 6],
      ["manometer", 8, 6, 8, 4],
      ["zylinder", 10, 6, 10, -2, { durchmesser: 0.1, hub: 0.5, last: 10000 }],
      ["hahn", 8, 6, 8, 8, { oeffnung: 0 }],
    ], [[8, 6, 10, 6]]),
  },
  {
    id: "heber", name: "Saugheber über eine Mauer",
    idee: "Der Schlauch führt 5 m hoch über die Mauer und dann hinunter ins tiefere Becken. Oben zeigt das Manometer Unterdruck — und trotzdem fließt es, solange unten tiefer ist als der Spiegel oben.",
    baukasten: baue("wasser", [
      ["behaelter", 2, 0, 2, -4, { flaeche: 0.1, fuellung: 0.8 }],
      ["behaelter", 20, 8, 20, 4, { flaeche: 0.1, fuellung: 0.1 }],
      ["manometer", 10, -10, 10, -12],
      ["rohr", 14, -10, 14, 8, { durchmesser: 0.015, laenge: 9 }],
    ], [[2, 0, 6, 0, 6, -10, 14, -10], [14, 8, 20, 8]]),
  },
];
