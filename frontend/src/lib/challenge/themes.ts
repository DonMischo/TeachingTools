/** Themes der Challenge (ids wie api/challenge_engine.THEMES); Grafik liegt in public/challenge/pixel. */
import type { Frame } from "@/components/challenge/pixel/Sprite";

const P = "/challenge/pixel";

export type ThemeDef = {
  name: string;
  hintergrund: { src: string; tile: number; cols: number; muster: { boden: number[]; wand: number[]; deko: number[] } } | null;
  farben: { himmel: string; boden: string; akzent: string; text: string };
  spieler: { src: string; frameW: number; frameH: number; laufen: { links: Frame[]; rechts: Frame[] }; stehen: Frame };
};

const reihe = (y: number, w: number, h: number, n = 4): Frame[] => Array.from({ length: n }, (_, i) => ({ x: i * w, y, w, h }));
// character.png: 16x32, Laufreihen unten/links/oben/rechts = 0..3
const figur: ThemeDef["spieler"] = {
  src: `${P}/gfx/character.png`, frameW: 16, frameH: 32,
  laufen: { links: reihe(32, 16, 32), rechts: reihe(96, 16, 32) }, stehen: { x: 0, y: 0, w: 16, h: 32 },
};
// ninja/player-walk.png: 16x16, Reihen unten/oben/links/rechts
const ninja: ThemeDef["spieler"] = {
  src: `${P}/ninja/player-walk.png`, frameW: 16, frameH: 16,
  laufen: { links: reihe(32, 16, 16), rechts: reihe(48, 16, 16) }, stehen: { x: 0, y: 0, w: 16, h: 16 },
};

export const THEMES: Record<string, ThemeDef> = {
  klassisch: { name: "Klassisch", hintergrund: null, farben: { himmel: "transparent", boden: "transparent", akzent: "var(--color-accent)", text: "inherit" }, spieler: figur },
  wald: {
    name: "Wald", spieler: figur, farben: { himmel: "#c8f872", boden: "#35a541", akzent: "#1e7cb8", text: "#1b2a1e" },
    hintergrund: { src: `${P}/gfx/Overworld.png`, tile: 16, cols: 40, muster: { boden: [1215, 642], wand: [283], deko: [161] } },
  },
  ninja: {
    name: "Ninja-Dorf", spieler: ninja, farben: { himmel: "#71ddee", boden: "#adbc3a", akzent: "#bc84b5", text: "#2a2430" },
    hintergrund: { src: `${P}/ninja/overworld.png`, tile: 16, cols: 24, muster: { boden: [911], wand: [1504], deko: [743] } },
  },
  verlies: {
    name: "Verlies", spieler: figur, farben: { himmel: "#201729", boden: "#6f504a", akzent: "#165c88", text: "#f1e6dc" },
    hintergrund: { src: `${P}/gfx/cave.png`, tile: 16, cols: 40, muster: { boden: [127, 162], wand: [42], deko: [321] } },
  },
  antike: {
    name: "Antike", spieler: figur, farben: { himmel: "#f3e8c3", boden: "#bab27b", akzent: "#a77747", text: "#3a2d1a" },
    hintergrund: { src: `${P}/gfx/Inner.png`, tile: 16, cols: 40, muster: { boden: [80, 97], wand: [40], deko: [91] } },
  },
  weltraum: {
    name: "Weltraum", spieler: figur, hintergrund: null,
    farben: { himmel: "radial-gradient(#0b1030, #02030a)", boden: "#1b2150", akzent: "#77ccff", text: "#e6ecff" },
  },
};

export const themeVon = (id?: string | null): ThemeDef => THEMES[id ?? ""] ?? THEMES.klassisch;
