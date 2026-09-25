/**
 * Wie die Spielfigur aussieht: Oberteil (Art und Farbe), Mütze (Art und
 * Farbe), Rucksackfarbe und das Handy (Android oder Apple). Wird im Browser
 * gemerkt und an die anderen im Raum geschickt.
 */
export const SHIRTS = [
  { id: "tshirt", name: "T-Shirt", icon: "👕" },
  { id: "hoodie", name: "Hoodie", icon: "🧥" },
  { id: "jacke", name: "Jacke", icon: "🧥" },
  { id: "trikot", name: "Trikot", icon: "🎽" },
] as const;
export const MUETZEN = [
  { id: "keine", name: "Keine", icon: "🚫" },
  { id: "cap", name: "Basecap", icon: "🧢" },
  { id: "beanie", name: "Beanie", icon: "🧶" },
  { id: "hut", name: "Sonnenhut", icon: "👒" },
  { id: "helm", name: "Fahrradhelm", icon: "⛑️" },
] as const;
export const HANDYS = [
  { id: "android", name: "Android", icon: "🤖", karma: 10 },
  { id: "apple", name: "Apple", icon: "🍏", karma: -10 },
] as const;

export type ShirtArt = (typeof SHIRTS)[number]["id"];
export type MuetzenArt = (typeof MUETZEN)[number]["id"];
export type HandyArt = (typeof HANDYS)[number]["id"];

export type Aussehen = {
  shirt: ShirtArt; shirtFarbe: number;
  muetze: MuetzenArt; muetzeFarbe: number;
  rucksackFarbe: number;
  handy: HandyArt;
};

export const JACKEN = [0x2f6fd6, 0xe63946, 0x2a9d8f, 0xf4a261, 0x8e44ad, 0xe9c46a, 0x06d6a0, 0xff6b9d];

/** Wer nichts gewählt hat (auch ältere Spielstände). */
export const STANDARD_AUSSEHEN: Aussehen = {
  shirt: "tshirt", shirtFarbe: 0x2f6fd6, muetze: "keine", muetzeFarbe: 0xe63946, rucksackFarbe: 0xe0a100, handy: "android",
};

/** Ein zufälliges, aber hübsches Aussehen für den Anfang. */
export function zufallsAussehen(rnd: () => number = Math.random): Aussehen {
  const aus = <T,>(l: readonly T[]) => l[Math.floor(rnd() * l.length)];
  return {
    shirt: aus(SHIRTS).id, shirtFarbe: aus(JACKEN),
    muetze: aus(MUETZEN).id, muetzeFarbe: aus(JACKEN),
    rucksackFarbe: 0xe0a100, handy: aus(HANDYS).id,
  };
}

const farbe = (v: unknown, sonst: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(0xffffff, Math.round(v))) : sonst);
const eins = <T extends string>(v: unknown, erlaubt: readonly { id: T }[], sonst: T): T => (erlaubt.some((x) => x.id === v) ? (v as T) : sonst);

/** Aus dem Speicher oder vom Netz: nur Bekanntes übernehmen, der Rest wie `sonst`. */
export function pruefeAussehen(roh: unknown, sonst: Aussehen): Aussehen {
  const o = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  return {
    shirt: eins(o.shirt, SHIRTS, sonst.shirt), shirtFarbe: farbe(o.shirtFarbe, sonst.shirtFarbe),
    muetze: eins(o.muetze, MUETZEN, sonst.muetze), muetzeFarbe: farbe(o.muetzeFarbe, sonst.muetzeFarbe),
    rucksackFarbe: farbe(o.rucksackFarbe, sonst.rucksackFarbe), handy: eins(o.handy, HANDYS, sonst.handy),
  };
}

/** Karma fürs Handy (Android +10, Apple −10). */
export const handyKarma = (h: HandyArt) => HANDYS.find((x) => x.id === h)!.karma;

export const hexFarbe = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
export const ausHex = (s: string) => parseInt(s.replace("#", ""), 16) || 0;
