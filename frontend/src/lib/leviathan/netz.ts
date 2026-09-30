/**
 * Das Wirkungsnetz als Graph: Knoten und Pfeile für die Netz-Ansicht.
 *
 * Die Pfeile sind die Regeln aus `regeln.ts` plus die Wirkungen, die der
 * Motor außerhalb der Tabelle rechnet (Klima, Bevölkerung, Budget) – hier
 * mit ungefähren Stärken, nur zum Zeigen. Dazu die Entscheidungen
 * (Aktionspunkte → Hebel) und die Ergebnisse (→ Lebensqualität, Leviathan).
 */
import { BEREICH } from "./bereiche";
import { erwerbAnteil, n } from "./hilfen";
import { budget, leviathan } from "./motor";
import { REGELN } from "./regeln";
import { GROESSEN, HEBEL, HOCH_SCHLECHT, type Groesse, type Zustand } from "./typen";

export type Knoten = Groesse | "bevoelkerung" | "aktionspunkte" | "lq" | "leviathan";

export interface Kante {
  von: Knoten;
  nach: Knoten;
  staerke: number;
  verzoegerung: number;
  quelle: string;
  nurUeber50?: boolean;
  art: "regel" | "extra" | "entscheidung" | "ergebnis";
  /** Kurzer Satz für die Erklärung. */
  text?: string;
  /** Weder gut noch schlecht (z. B. Geburtenrate). */
  neutral?: boolean;
}

export const KNOTEN_INFO: Record<Knoten, { name: string; icon: string }> = {
  ...(Object.fromEntries(GROESSEN.map((g) => [g, { name: BEREICH[g].name, icon: BEREICH[g].icon }])) as Record<Groesse, { name: string; icon: string }>),
  bevoelkerung: { name: "Bevölkerung", icon: "👥" },
  aktionspunkte: { name: "Aktionspunkte", icon: "🪙" },
  lq: { name: "Lebensqualität", icon: "❤️" },
  leviathan: { name: "Leviathan", icon: "🐋" },
};

/** Reihenfolge auf dem Kreis (im Uhrzeigersinn ab oben) – so gewählt, dass sich wenig kreuzt. */
export const KREIS: Knoten[] = [
  "aktionspunkte", "wirtschaft", "energie", "klima", "bevoelkerung", "familie", "zusammenhalt", "soziales",
  "gleichheit", "vertrauen", "desinformation", "demokratie", "korruption", "staatskapazitaet", "rechtsstaat", "bildung",
];
export const MITTE: Knoten[] = ["lq", "leviathan"];

const EXTRA: Kante[] = [
  { von: "wirtschaft", nach: "klima", staerke: 1.5, verzoegerung: 0, quelle: "armstrongMcKay2022", art: "extra", text: "Mehr Produktion stößt mehr CO₂ aus – je weniger Energiewende, desto mehr." },
  { von: "energie", nach: "klima", staerke: -1.5, verzoegerung: 0, quelle: "way2022", art: "extra", text: "Erneuerbare senken die Klimalast." },
  { von: "wirtschaft", nach: "vertrauen", staerke: 1.0, verzoegerung: 0, quelle: "algan2017", art: "extra", text: "Schrumpft die Wirtschaft, steigt die Arbeitslosigkeit – das Vertrauen sinkt." },
  { von: "bildung", nach: "bevoelkerung", staerke: -1.5, verzoegerung: 2, quelle: "lutz2014", art: "extra", neutral: true, text: "Mehr Bildung, vor allem für Frauen, senkt die Geburtenrate." },
  { von: "familie", nach: "bevoelkerung", staerke: 0.6, verzoegerung: 1, quelle: "lancet2024", art: "extra", neutral: true, text: "Familienförderung hebt die Geburtenrate ein wenig; Integration hält Zugewanderte." },
  { von: "soziales", nach: "bevoelkerung", staerke: 0.6, verzoegerung: 0, quelle: "wpp2024", art: "extra", neutral: true, text: "Gute Versorgung: Menschen leben länger, weniger Kinder sterben." },
  { von: "klima", nach: "bevoelkerung", staerke: -0.8, verzoegerung: 0, quelle: "lancetCountdown2025", art: "extra", nurUeber50: true, text: "Hitze tötet vor allem Alte und Säuglinge." },
  { von: "wirtschaft", nach: "aktionspunkte", staerke: 2.0, verzoegerung: 0, quelle: "annahme", art: "extra", text: "Steuern aus der Wirtschaft sind der größte Teil des Haushalts." },
  { von: "bevoelkerung", nach: "aktionspunkte", staerke: 1.0, verzoegerung: 0, quelle: "wpp2024", art: "extra", text: "Viele Erwerbstätige zahlen Steuern; viele Ältere kosten Rente." },
  { von: "staatskapazitaet", nach: "aktionspunkte", staerke: 1.0, verzoegerung: 0, quelle: "korridor", art: "extra", text: "Ein handlungsfähiger Staat treibt Steuern ein und setzt Beschlüsse um." },
  { von: "korruption", nach: "aktionspunkte", staerke: -1.5, verzoegerung: 0, quelle: "cpi2025", art: "extra", text: "Korruption frisst einen Teil jedes Aktionspunkts." },
];

const ENTSCHEIDUNGEN: Kante[] = HEBEL.map((h) => ({
  von: "aktionspunkte", nach: h, staerke: 2, verzoegerung: 0, quelle: "annahme", art: "entscheidung",
  text: "Deine Entscheidung: Aktionspunkte in diesen Bereich stecken.",
}));

const LQ_GEWICHTE: [Groesse, number][] = [
  ["wirtschaft", 0.2], ["soziales", 0.2], ["zusammenhalt", 0.15], ["gleichheit", 0.1], ["klima", -0.1],
  ["vertrauen", 0.08], ["demokratie", 0.1], ["bildung", 0.07],
];
const ERGEBNISSE: Kante[] = [
  ...LQ_GEWICHTE.map(([g, s]): Kante => ({ von: g, nach: "lq", staerke: s * 10, verzoegerung: 0, quelle: "annahme", art: "ergebnis" })),
  { von: "staatskapazitaet", nach: "leviathan", staerke: 1, verzoegerung: 0, quelle: "korridor", art: "ergebnis", neutral: true, text: "Die Macht des Staates." },
  { von: "demokratie", nach: "leviathan", staerke: -1, verzoegerung: 0, quelle: "korridor", art: "ergebnis", neutral: true, text: "Die Macht der Gesellschaft hält den Staat in Schach." },
  { von: "zusammenhalt", nach: "leviathan", staerke: -1, verzoegerung: 0, quelle: "korridor", art: "ergebnis", neutral: true, text: "Die Macht der Gesellschaft hält den Staat in Schach." },
  { von: "desinformation", nach: "leviathan", staerke: 1, verzoegerung: 0, quelle: "korridor", art: "ergebnis", neutral: true, text: "Desinformation schwächt die Gesellschaft gegenüber dem Staat." },
];

export const KANTEN: Kante[] = [
  ...REGELN.map((r): Kante => ({ ...r, art: "regel" })),
  ...EXTRA,
  ...ENTSCHEIDUNGEN,
  ...ERGEBNISSE,
];

/** Welche Pfeile eine Rückkopplungsschleife bilden. */
export const SCHLEIFEN_KANTEN: Record<string, [Knoten, Knoten][]> = {
  R1: [["wirtschaft", "vertrauen"], ["vertrauen", "demokratie"], ["demokratie", "wirtschaft"]],
  R2: [["gleichheit", "vertrauen"], ["vertrauen", "gleichheit"], ["gleichheit", "korruption"], ["korruption", "gleichheit"], ["korruption", "vertrauen"]],
  R3: [["vertrauen", "desinformation"], ["desinformation", "vertrauen"]],
  R4: [["demokratie", "desinformation"], ["desinformation", "demokratie"], ["demokratie", "korruption"], ["korruption", "vertrauen"], ["vertrauen", "demokratie"]],
  R5: [["aktionspunkte", "energie"], ["energie", "klima"], ["energie", "wirtschaft"], ["wirtschaft", "aktionspunkte"]],
  R6: [["wirtschaft", "klima"], ["klima", "wirtschaft"], ["klima", "soziales"], ["wirtschaft", "aktionspunkte"], ["aktionspunkte", "energie"]],
  B1: [["aktionspunkte", "bildung"], ["bildung", "bevoelkerung"], ["bevoelkerung", "aktionspunkte"]],
  B2: [["aktionspunkte", "bildung"], ["bildung", "desinformation"], ["desinformation", "vertrauen"]],
  B3: [["zusammenhalt", "soziales"], ["zusammenhalt", "vertrauen"], ["zusammenhalt", "demokratie"]],
  B4: [["rechtsstaat", "demokratie"], ["demokratie", "wirtschaft"], ["wirtschaft", "aktionspunkte"]],
};

/** Wert eines Knotens auf 0…100 für den Ring, dazu die Beschriftung. */
export function knotenWert(z: Zustand, k: Knoten): { ring: number; text: string } {
  if (k === "bevoelkerung") {
    return { ring: Math.min(100, (erwerbAnteil(z.bev) / 0.7) * 100), text: `${z.bev.tfr.toLocaleString("de-DE", { maximumFractionDigits: 1 })} K.` };
  }
  if (k === "aktionspunkte") {
    const ap = budget(z).gesamt;
    return { ring: Math.min(100, (ap / 15) * 100), text: `${ap} AP` };
  }
  if (k === "lq") return { ring: z.lq, text: String(Math.round(z.lq)) };
  if (k === "leviathan") {
    const l = leviathan(z.w);
    return { ring: 50 + l.position, text: l.zone === "gefesselt" ? "Korridor" : l.zone };
  }
  return { ring: z.w[k], text: String(Math.round(z.w[k])) };
}

/** Wie stark ein Pfeil gerade drückt (je Runde, grob). */
export function druck(z: Zustand, k: Kante): number {
  if (k.art === "entscheidung" || k.art === "ergebnis") return k.staerke;
  let x: number;
  if (k.von === "bevoelkerung") x = (erwerbAnteil(z.bev) - 0.55) / 0.15;
  else if (k.von === "aktionspunkte" || k.von === "lq" || k.von === "leviathan") x = 0;
  else x = n(z.w[k.von]);
  if (k.nurUeber50) x = Math.max(0, x);
  if (k.von === "wirtschaft" && k.nach === "klima") x = (z.w.wirtschaft / 100) * (1 - z.w.energie / 100) * 2 - 0.3;
  return k.staerke * x;
}

const hochSchlecht = (k: Knoten) => HOCH_SCHLECHT.has(k as Groesse);

/**
 * Tut der Pfeil dem Ziel gut? `wert` ist die Richtung, in die er drückt
 * (Regelstärke für die Regelansicht, aktueller Druck für die Live-Ansicht).
 */
export function gutFuerZiel(k: Kante, wert: number): boolean | null {
  if (k.neutral || k.art === "entscheidung") return null;
  const steigt = wert > 0;
  return hochSchlecht(k.nach) ? !steigt : steigt;
}
