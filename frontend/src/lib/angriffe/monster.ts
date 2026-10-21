/**
 * Gegner-Monster aus Quaternius „Ultimate Monsters" (CC0, public/modelle/monster).
 * Jedes Monster greift mit einem Element an; für jedes der 15 Elemente gibt es mindestens eins.
 */
import type { ElementId } from "./effekte";

export type MonsterId =
  | "dragon_evolved" | "alien_blob" | "demon" | "orc" | "yeti" | "dino" | "armabee_evolved" | "cactoro" | "ghost_skull" | "greenspikyblob"
  | "ninja" | "hywirl" | "birb" | "alpaking_evolved" | "orc_skull" | "wizard_blob" | "greenblob" | "pinkblob" | "mushnub" | "ghost" | "glub";

export interface Monster {
  id: MonsterId;
  name: string;
  element: ElementId;
  /** gross: stehende Bosse, klein: Blobs und Flieger fürs Verlies */
  groesse: "gross" | "klein";
}

export const MONSTER: Record<MonsterId, Monster> = {
  dragon_evolved: { id: "dragon_evolved", name: "Drache", element: "feuer", groesse: "gross" },
  alien_blob: { id: "alien_blob", name: "Tentakel-Blob", element: "arkan", groesse: "klein" },
  demon: { id: "demon", name: "Dämon", element: "blut", groesse: "gross" },
  orc: { id: "orc", name: "Ork", element: "schall", groesse: "gross" },
  yeti: { id: "yeti", name: "Yeti", element: "eis", groesse: "gross" },
  dino: { id: "dino", name: "Dino", element: "erde", groesse: "gross" },
  armabee_evolved: { id: "armabee_evolved", name: "Panzerbiene", element: "blitz", groesse: "klein" },
  cactoro: { id: "cactoro", name: "Kaktoro", element: "pflanzen", groesse: "gross" },
  ghost_skull: { id: "ghost_skull", name: "Schädelgeist", element: "dunkel", groesse: "klein" },
  greenspikyblob: { id: "greenspikyblob", name: "Stachelschleim", element: "gift", groesse: "klein" },
  ninja: { id: "ninja", name: "Ninja", element: "schatten", groesse: "gross" },
  hywirl: { id: "hywirl", name: "Hywirl", element: "fee", groesse: "klein" },
  birb: { id: "birb", name: "Birb", element: "wind", groesse: "gross" },
  alpaking_evolved: { id: "alpaking_evolved", name: "Alpakönig", element: "licht", groesse: "klein" },
  orc_skull: { id: "orc_skull", name: "Schädelork", element: "klingen", groesse: "gross" },
  wizard_blob: { id: "wizard_blob", name: "Zauberblob", element: "arkan", groesse: "klein" },
  greenblob: { id: "greenblob", name: "Grünschleim", element: "gift", groesse: "klein" },
  pinkblob: { id: "pinkblob", name: "Rosaschleim", element: "fee", groesse: "klein" },
  mushnub: { id: "mushnub", name: "Pilzling", element: "pflanzen", groesse: "klein" },
  ghost: { id: "ghost", name: "Geist", element: "dunkel", groesse: "klein" },
  glub: { id: "glub", name: "Glub", element: "wind", groesse: "klein" },
};

/** Für jedes Element ein Gegner, der damit angreift */
export const ELEMENT_MONSTER: Record<ElementId, MonsterId> = {
  eis: "yeti", feuer: "dragon_evolved", erde: "dino", blitz: "armabee_evolved", pflanzen: "cactoro", dunkel: "ghost_skull",
  gift: "greenspikyblob", blut: "demon", schatten: "ninja", fee: "hywirl", wind: "birb", schall: "orc",
  licht: "alpaking_evolved", klingen: "orc_skull", arkan: "wizard_blob",
};

/** Boss der Bosskampf-Skins */
export const SKIN_BOSS: Record<string, MonsterId> = { monster: "dragon_evolved", prinzessin: "alien_blob", einhorn: "demon", rap: "orc" };

/** Kleine Verlies-Monster (TaskCrawler) und Wächter vor Treppe/Ausgang */
export const VERLIES_MONSTER: MonsterId[] = ["greenblob", "pinkblob", "mushnub", "ghost", "glub", "greenspikyblob", "wizard_blob", "alien_blob"];
export const VERLIES_WAECHTER: MonsterId[] = ["yeti", "dino", "cactoro", "ninja", "orc_skull", "demon", "birb", "orc"];

export const monsterUrl = (id: MonsterId) => `/modelle/monster/${id}.glb`;
