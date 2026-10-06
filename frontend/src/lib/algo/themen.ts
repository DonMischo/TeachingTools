/**
 * Themen des Code-Abenteuers — nur Haut und Wörter, die Regeln sind überall gleich.
 *
 * Leveltexte enthalten Platzhalter wie `{held}` oder `{aPl}`; `fuelle` setzt die
 * Wörter des gewählten Themas ein. Ein Großbuchstabe am Platzhalteranfang
 * (`{Held}`) macht auch den eingesetzten Anfang groß — für Satzanfänge.
 */
export type ThemaId = "cyber" | "verlies" | "mars" | "mampfi";

export interface Thema {
  id: ThemaId;
  name: string;
  untertitel: string;
  /** Emoji der Figur; `null` = eigene Zeichnung (Mampfi) */
  figur: string | null;
  a: string;
  b: string;
  gegner: string;
  gefahr: string;
  ziel: string;
  /** Beschriftung des Aktions-Bausteins */
  verb: string;
  woerter: Record<string, string>;
  farben: { grund: string; boden: string; wand: string; wandKante: string; linie: string; text: string; akzent: string };
}

export const THEMEN: Thema[] = [
  {
    id: "cyber",
    name: "Bug-Jagd",
    untertitel: "Cyberpunk: Als Debug-Drohne durch den Server",
    figur: "🤖",
    a: "💎", b: "🐛", gegner: "👾", gefahr: "🔥", ziel: "🌀",
    verb: "scannen",
    woerter: {
      held: "die Debug-Drohne", a: "Datenkristall", aAkk: "den Datenkristall", aPl: "Datenkristalle",
      b: "Kernel-Bug", bAkk: "den Kernel-Bug", gegner: "das Virus", gegnerPl: "Viren",
      gefahr: "Firewall", gefahrPl: "Firewalls", ziel: "das Portal", welt: "der Server",
    },
    farben: { grund: "#0b1020", boden: "#141b38", wand: "#2e1065", wandKante: "#a855f7", linie: "#22d3ee", text: "#e0f2fe", akzent: "#22d3ee" },
  },
  {
    id: "verlies",
    name: "Verlies-Abenteuer",
    untertitel: "Rollenspiel: Mit der Heldin durch das Verlies",
    figur: "🧙",
    a: "💎", b: "🏆", gegner: "👻", gefahr: "🌋", ziel: "🚪",
    verb: "aufheben",
    woerter: {
      held: "die Heldin", a: "Edelstein", aAkk: "den Edelstein", aPl: "Edelsteine",
      b: "goldener Kelch", bAkk: "den goldenen Kelch", gegner: "der Geist", gegnerPl: "Geister",
      gefahr: "Lavafeld", gefahrPl: "Lavafelder", ziel: "die Tür", welt: "das Verlies",
    },
    farben: { grund: "#1c1917", boden: "#44403c", wand: "#0c0a09", wandKante: "#a16207", linie: "#57534e", text: "#fef3c7", akzent: "#f59e0b" },
  },
  {
    id: "mars",
    name: "Mars-Mission",
    untertitel: "Weltraum: Mit dem Rover Proben sammeln",
    figur: "🚙",
    a: "🪨", b: "🧊", gegner: "🌪️", gefahr: "🕳️", ziel: "🏠",
    verb: "einsammeln",
    woerter: {
      held: "der Rover", a: "Gesteinsprobe", aAkk: "die Gesteinsprobe", aPl: "Gesteinsproben",
      b: "Eisprobe", bAkk: "die Eisprobe", gegner: "der Staubteufel", gegnerPl: "Staubteufel",
      gefahr: "Krater", gefahrPl: "Krater", ziel: "die Station", welt: "der Mars",
    },
    farben: { grund: "#431407", boden: "#c2703d", wand: "#7c2d12", wandKante: "#fdba74", linie: "#9a4a20", text: "#fff7ed", akzent: "#fb923c" },
  },
  {
    id: "mampfi",
    name: "Labyrinthien",
    untertitel: "Klassiker: Mampfi hat Hunger",
    figur: null,
    a: "🍩", b: "🍓", gegner: "👻", gefahr: "🌵", ziel: "🏠",
    verb: "essen",
    woerter: {
      held: "Mampfi", a: "Donut", aAkk: "den Donut", aPl: "Donuts",
      b: "Erdbeere", bAkk: "die Erdbeere", gegner: "der Geist", gegnerPl: "Geister",
      gefahr: "Kaktus", gefahrPl: "Kakteen", ziel: "das Haus", welt: "Labyrinthien",
    },
    farben: { grund: "#f8fafc", boden: "#ffffff", wand: "#1d4ed8", wandKante: "#93c5fd", linie: "#e2e8f0", text: "#0f172a", akzent: "#eab308" },
  },
];

export const thema = (id: string): Thema => THEMEN.find(t => t.id === id) ?? THEMEN[0];

export function fuelle(text: string, t: Thema): string {
  return text.replace(/\{(\w+)\}/g, (ganz, k: string) => {
    const klein = k[0].toLowerCase() + k.slice(1);
    const w = klein === "verb" ? t.verb : t.woerter[klein];
    if (w === undefined) return ganz;
    return k[0] === k[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w;
  });
}
