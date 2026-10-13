/** Pixelfiguren der Boss-Skins. Halbbilder werden gespiegelt (gleiche Zeilenbreite garantiert). */
export type Figur = { bild: string[]; palette: Record<string, string>; name: string };

export const spiegel = (halb: string[]): string[] => halb.map((z) => z + [...z].reverse().join(""));
/** Einzelne Pixel [x, y, Zeichen] überschreiben (z. B. Schwert, Mikro). */
export const ueber = (bild: string[], pixel: [number, number, string][]): string[] => {
  const z = bild.map((r) => [...r]);
  for (const [x, y, c] of pixel) if (z[y]?.[x] !== undefined) z[y][x] = c;
  return z.map((r) => r.join(""));
};

const HELD = ueber(spiegel([
  ".....kk", "...kkgg", "..kgggg", "..kgsss", "..kskss", "..kssss", "...kkbb",
  "..kbbbb", ".kbbbbb", ".kbbbbb", "..kbkkk", "..kggkk", "..kggkk", ".kkkkkk",
]), [[0, 4, "w"], [0, 5, "w"], [0, 6, "w"], [0, 7, "w"], [0, 8, "r"], [1, 8, "r"]]);
const HELD_P = { k: "#1b1b2b", g: "#9aa7b5", s: "#f2c9a0", b: "#3a6fd8", w: "#e8eef5", r: "#a8552b" };

const DRACHE = spiegel([
  ".k.k...", ".kgkkkk", ".kggggg", ".kgeggg", ".kgggkg", ".kgwgwg", "kkdgggg",
  "kddgyyy", "kddgyyy", "kdkgyyy", ".kkgyyy", "..kgggg", "..kgkkk", "..kkk..",
]);
const DRACHE_P = { k: "#1a2418", g: "#3f9b4a", d: "#2a6b33", y: "#e8d56a", e: "#ff3b30", w: "#ffffff" };

const RAPPER = ueber(spiegel([
  "...kkkk", "..kcccc", ".kccccc", ".kkkkkk", ".kskkkk", ".ksssss", ".ksssmm",
  "..kssss", ".kcccyy", "kcccccc", "kcccccc", ".kccccc", ".kppppp", ".kppkkk",
]), [[12, 6, "w"], [13, 6, "w"], [12, 7, "w"], [13, 7, "w"], [12, 8, "k"], [12, 9, "s"]]);

const PRINZESSIN = spiegel([
  "..y.y.y", "..kyyyy", ".khhhhh", ".khssss", ".khskss", ".khssss", ".khhkss",
  "..kpppp", ".kppppp", ".kpppqq", "kpppppp", "kppppqp", "kppppqp", "kkkkkkk",
]);
const PRINZESSIN_P = { k: "#3a1f33", y: "#ffd84a", h: "#e9b44c", s: "#f6d2b0", p: "#ff7fc0", q: "#ffffff" };

const MONSTER = spiegel([
  ".k.....", ".kpk...", "kpppppp", "kppwwww", "kppwwwk", "kppwwww", "kpppppp",
  "kpkwkwk", "kpppppp", ".kppppp", ".kppppp", ".kpp.kk", "..kk...",
]);
const MONSTER_P = { k: "#21122e", p: "#8a4fd0", w: "#ffffff" };

const EINHORN = spiegel([
  "......y", "......y", ".kk.kww", ".kwwwww", ".kwkwww", ".kwwwww", ".kowwpp",
  ".kgwwww", ".kbwwww", "kwwwwww", "kwwwwww", "kowwwww", ".kwk.kw", ".kkk.kk",
]);
const EINHORN_P = { k: "#3a2a55", w: "#fbf7ff", y: "#ffd84a", p: "#ffa6cf", o: "#ff9a3c", g: "#5ccf6a", b: "#5aa8ff" };

const BESTIE = spiegel([
  "kk.....", "krk.kkk", ".kooooo", "koooooo", "kooyyoo", "koooooo", "koookwk",
  "kookkkk", ".kooooo", "koodddd", "koodddd", "kooooo.", ".kook.k", ".kkk...",
]);
const BESTIE_P = { k: "#3b1a14", o: "#e0703a", r: "#c4291c", y: "#fff27a", w: "#ffffff", d: "#f3b184" };

export type Skin = {
  titel: string; held: Figur; boss: Figur;
  angriff: string; kontern: string; sieg: string; intro: string;
};

export const SKINS: Record<string, Skin> = {
  monster: {
    titel: "Drachenkampf", angriff: "Angriff", kontern: "Kontern", sieg: "Der Drache ist besiegt!", intro: "Der Drache fordert dich heraus!",
    held: { bild: HELD, palette: HELD_P, name: "Held" }, boss: { bild: DRACHE, palette: DRACHE_P, name: "Drache" },
  },
  rap: {
    titel: "Rap-Battle", angriff: "Diss", kontern: "Konter-Line", sieg: "Mic drop – du hast das Battle gewonnen!", intro: "Battle! Der Gegner greift zum Mikro!",
    held: { bild: RAPPER, palette: { k: "#15151f", c: "#2f6fe0", s: "#d9a273", m: "#7a2f2f", y: "#ffd84a", p: "#444a66", w: "#cfd6e0" }, name: "Rapper" },
    boss: { bild: RAPPER, palette: { k: "#15151f", c: "#d8352a", s: "#8a5a3a", m: "#3a1a1a", y: "#e8e8e8", p: "#2b2b2b", w: "#cfd6e0" }, name: "Gegner-Rapper" },
  },
  prinzessin: {
    titel: "Prinzessin gegen Monster", angriff: "Angriff", kontern: "Kontern", sieg: "Das Monster ist besiegt!", intro: "Ein wildes Monster versperrt der Prinzessin den Weg!",
    held: { bild: PRINZESSIN, palette: PRINZESSIN_P, name: "Prinzessin" }, boss: { bild: MONSTER, palette: MONSTER_P, name: "Monster" },
  },
  einhorn: {
    titel: "Einhorn gegen Bestie", angriff: "Angriff", kontern: "Kontern", sieg: "Die Bestie ist besiegt!", intro: "Eine wilde Bestie stellt sich dem Einhorn entgegen!",
    held: { bild: EINHORN, palette: EINHORN_P, name: "Einhorn" }, boss: { bild: BESTIE, palette: BESTIE_P, name: "Bestie" },
  },
};

export const skinVon = (id?: string | null): Skin => SKINS[id ?? ""] ?? SKINS.monster;
