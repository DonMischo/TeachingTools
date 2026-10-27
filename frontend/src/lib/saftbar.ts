/**
 * Saftbar — Mischungsrechnung als Bestellung: Kundinnen und Kunden wollen
 * eine Schorle mit genau so viel Prozent Fruchtsaft. Gemischt wird aus
 * Saft (100 %), Nektar (50 %) und Wasser (0 %).
 *
 * Stufe 1: Saft + Wasser.  Stufe 2: mit Nektar.  Stufe 3: ein Glas steht schon
 * da und soll verdünnt oder verstärkt werden — der Grundwert ändert sich.
 */
import { z } from "@/lib/prozent";

export type ZutatId = "saft" | "nektar" | "wasser";
export const ZUTATEN: Record<ZutatId, { name: string; anteil: number; farbe: string; emoji: string }> = {
  saft: { name: "Orangensaft", anteil: 100, farbe: "#f97316", emoji: "🍊" },
  nektar: { name: "Orangennektar (50 % Saft)", anteil: 50, farbe: "#fdba74", emoji: "🧃" },
  wasser: { name: "Wasser", anteil: 0, farbe: "#7dd3fc", emoji: "💧" },
};

export type Glas = { ml: number; prozent: number };
export type Stufe = 1 | 2 | 3;

export type Bestellung = {
  kunde: string;
  text: string;
  stufe: Stufe;
  zutaten: ZutatId[];
  /** steht schon im Glas */
  start: Glas | null;
  ziel: Glas;
  kapazitaet: number;
  /** wie viel ml von welcher Zutat richtig wären */
  loesung: Partial<Record<ZutatId, number>>;
};

type Rnd = () => number;
const wahl = <T,>(rnd: Rnd, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const KUNDEN = ["🧑‍🎓", "👩‍🦰", "🧔", "👵", "👨‍🍳", "🧒", "👩‍💼", "🧑‍🔧"];

const vielfach = (x: number, von: number) => Math.abs(x / von - Math.round(x / von)) < 1e-9;

/** Fassungsvermögen: nächste 100 über 125 % der Zielmenge. */
const glasFuer = (ml: number) => Math.max(300, Math.ceil((ml * 1.25) / 100) * 100);

export function erzeugeBestellung(stufe: Stufe, rnd: Rnd = Math.random): Bestellung {
  const kunde = wahl(rnd, KUNDEN);
  if (stufe === 1) {
    const moeglich: [number, number][] = [];
    for (const ml of [200, 250, 300, 400, 500]) for (const p of [10, 20, 25, 30, 40, 50, 60, 75, 80]) if (vielfach((ml * p) / 100, 10)) moeglich.push([ml, p]);
    const [ml, p] = wahl(rnd, moeglich);
    const saft = (ml * p) / 100;
    return {
      kunde, stufe, start: null, ziel: { ml, prozent: p }, kapazitaet: glasFuer(ml), zutaten: ["saft", "wasser"],
      text: `${ml} ml Saftschorle mit ${p} % Saft, bitte!`, loesung: { saft, wasser: ml - saft },
    };
  }
  if (stufe === 2) {
    if (rnd() < 0.5) {
      const moeglich: [number, number][] = [];
      for (const ml of [200, 250, 300, 400, 500]) for (const p of [10, 20, 25, 30, 40]) if (vielfach((ml * p) / 50, 10)) moeglich.push([ml, p]);
      const [ml, p] = wahl(rnd, moeglich);
      const nektar = (ml * p) / 50;
      return {
        kunde, stufe, start: null, ziel: { ml, prozent: p }, kapazitaet: glasFuer(ml), zutaten: ["nektar", "wasser"],
        text: `Der Saft ist alle! ${ml} ml Schorle mit ${p} % Fruchtsaft — aus Nektar und Wasser.`, loesung: { nektar, wasser: ml - nektar },
      };
    }
    const moeglich: [number, number][] = [];
    for (const ml of [200, 250, 300, 400, 500]) for (const p of [60, 70, 75, 80, 90]) if (vielfach((ml * (p - 50)) / 50, 10)) moeglich.push([ml, p]);
    const [ml, p] = wahl(rnd, moeglich);
    const saft = (ml * (p - 50)) / 50;
    return {
      kunde, stufe, start: null, ziel: { ml, prozent: p }, kapazitaet: glasFuer(ml), zutaten: ["saft", "nektar"],
      text: `${ml} ml mit ${p} % Fruchtsaft, ganz ohne Wasser — aus Saft und Nektar.`, loesung: { saft, nektar: ml - saft },
    };
  }
  // Stufe 3: Glas steht schon da
  if (rnd() < 0.5) {
    const moeglich: [number, number, number][] = [];
    for (const ml of [100, 150, 200, 250, 300]) for (const ps of [40, 50, 60, 80, 100]) for (const pt of [10, 20, 25, 30, 40, 50]) {
      if (pt >= ps) continue;
      const ziel = (ml * ps) / pt;
      if (ziel <= 600 && vielfach(ziel, 10)) moeglich.push([ml, ps, pt]);
    }
    const [ml, ps, pt] = wahl(rnd, moeglich);
    const ziel = (ml * ps) / pt;
    return {
      kunde, stufe, start: { ml, prozent: ps }, ziel: { ml: ziel, prozent: pt }, kapazitaet: glasFuer(ziel), zutaten: ["wasser"],
      text: `Ich hab hier ${ml} ml mit ${ps} % Saft — viel zu süß! Mach bitte ${pt} % draus.`, loesung: { wasser: ziel - ml },
    };
  }
  const moeglich: [number, number, number][] = [];
  for (const ml of [100, 150, 200, 250, 300]) for (const ps of [0, 10, 20, 25, 40]) for (const pt of [20, 25, 40, 50, 60, 75, 80]) {
    if (pt <= ps) continue;
    const wasser = (ml * (100 - ps)) / 100, ziel = wasser / (1 - pt / 100);
    if (ziel <= 600 && vielfach(ziel, 10)) moeglich.push([ml, ps, pt]);
  }
  const [ml, ps, pt] = wahl(rnd, moeglich);
  const ziel = ((ml * (100 - ps)) / 100) / (1 - pt / 100);
  return {
    kunde, stufe, start: { ml, prozent: ps }, ziel: { ml: ziel, prozent: pt }, kapazitaet: glasFuer(ziel), zutaten: ["saft"],
    text: ps === 0
      ? `Hier sind ${ml} ml Wasser. Gieß so viel Saft dazu, dass es ${pt} % Saft hat!`
      : `Meine Schorle (${ml} ml, ${ps} % Saft) schmeckt nach nichts. Bitte auf ${pt} % bringen!`,
    loesung: { saft: ziel - ml },
  };
}

/** Was im Glas ist: Menge und Saftanteil. */
export function mischung(start: Glas | null, teile: Partial<Record<ZutatId, number>>): Glas & { saftMl: number } {
  let ml = start?.ml ?? 0, saftMl = start ? (start.ml * start.prozent) / 100 : 0;
  for (const [id, m] of Object.entries(teile) as [ZutatId, number][]) {
    ml += m;
    saftMl += (m * ZUTATEN[id].anteil) / 100;
  }
  return { ml, saftMl, prozent: ml > 0 ? (saftMl / ml) * 100 : 0 };
}

export type Urteil = { sterne: 0 | 1 | 2 | 3; dMl: number; dP: number; trinkgeld: number; satz: string };

export function bewerte(b: Bestellung, ist: Glas): Urteil {
  const dMl = ist.ml - b.ziel.ml, dP = ist.prozent - b.ziel.prozent;
  const rel = Math.abs(dMl) / b.ziel.ml, ap = Math.abs(dP);
  const sterne = ap <= 1 && rel <= 0.02 ? 3 : ap <= 3 && rel <= 0.05 ? 2 : ap <= 6 && rel <= 0.1 ? 1 : 0;
  const trinkgeld = [0, 0.5, 1, 2][sterne];
  const satz = sterne === 3 ? "Perfekt, genau so!"
    : ap > 3 ? (dP > 0 ? "Puh, viel zu süß." : "Das schmeckt ja nach Wasser.")
    : rel > 0.05 ? (dMl > 0 ? "Das Glas ist ja übervoll!" : "Da fehlt aber was im Glas.")
    : "Fast — danke!";
  return { sterne: sterne as Urteil["sterne"], dMl, dP, trinkgeld, satz };
}

/** Der Rechenweg zur Bestellung, Zeile für Zeile. */
export function rechenweg(b: Bestellung): string[] {
  const { ziel, start, loesung } = b;
  if (!start && b.zutaten.includes("wasser") && b.zutaten.includes("saft")) {
    return [
      `Saft: ${z(ziel.prozent)} % von ${z(ziel.ml)} ml = ${z(loesung.saft!)} ml`,
      `Wasser: der Rest, ${z(ziel.ml)} ml − ${z(loesung.saft!)} ml = ${z(loesung.wasser!)} ml`,
    ];
  }
  if (!start && b.zutaten.includes("nektar") && b.zutaten.includes("wasser")) {
    const saft = (ziel.ml * ziel.prozent) / 100;
    return [
      `Reiner Saft im Glas: ${z(ziel.prozent)} % von ${z(ziel.ml)} ml = ${z(saft)} ml`,
      `Nektar ist nur zur Hälfte Saft → doppelt so viel Nektar: ${z(saft)} ml : 0,5 = ${z(loesung.nektar!)} ml`,
      `Wasser: ${z(ziel.ml)} ml − ${z(loesung.nektar!)} ml = ${z(loesung.wasser!)} ml`,
    ];
  }
  if (!start) {
    const saft = (ziel.ml * ziel.prozent) / 100;
    return [
      `Reiner Saft im Glas: ${z(ziel.prozent)} % von ${z(ziel.ml)} ml = ${z(saft)} ml`,
      `Nur Nektar (${z(ziel.ml)} ml) hätte ${z(ziel.ml / 2)} ml Saft — es fehlen ${z(saft - ziel.ml / 2)} ml.`,
      `Jeder ml Saft statt Nektar bringt 0,5 ml Saft mehr → ${z(saft - ziel.ml / 2)} : 0,5 = ${z(loesung.saft!)} ml Saft`,
      `Nektar: ${z(ziel.ml)} ml − ${z(loesung.saft!)} ml = ${z(loesung.nektar!)} ml`,
    ];
  }
  const saftAlt = (start.ml * start.prozent) / 100;
  if (loesung.wasser !== undefined) {
    return [
      `Im Glas: ${z(start.prozent)} % von ${z(start.ml)} ml = ${z(saftAlt)} ml Saft. Wasser dazu ändert daran nichts!`,
      `${z(saftAlt)} ml sollen ${z(ziel.prozent)} % sein → 1 % ≙ ${z(saftAlt / ziel.prozent, 3)} ml → 100 % ≙ ${z(ziel.ml)} ml`,
      `Wasser dazu: ${z(ziel.ml)} ml − ${z(start.ml)} ml = ${z(loesung.wasser)} ml`,
    ];
  }
  const wasser = start.ml - saftAlt;
  return [
    `Im Glas: ${z(saftAlt)} ml Saft und ${z(wasser)} ml Wasser. Saft dazu ändert am Wasser nichts!`,
    `Das Wasser soll ${z(100 - ziel.prozent)} % sein (100 % − ${z(ziel.prozent)} %) → 1 % ≙ ${z(wasser / (100 - ziel.prozent), 3)} ml → 100 % ≙ ${z(ziel.ml)} ml`,
    `Saft dazu: ${z(ziel.ml)} ml − ${z(start.ml)} ml = ${z(loesung.saft!)} ml`,
  ];
}
