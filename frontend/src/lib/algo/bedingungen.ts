/** Wörter für die Bedingungen der Code-Abenteuer-Programme. */
import type { Bedingung, BedingungArt } from "./spiel";

/** Wörter für Bedingungen: [stimmt, stimmt nicht]. */
export const BEDINGUNG_TEXT: Record<BedingungArt, [string, string]> = {
  frei: ["vorne frei", "vorne nicht frei"],
  frei_links: ["links frei", "links nicht frei"],
  frei_rechts: ["rechts frei", "rechts nicht frei"],
  ding: ["hier liegt etwas", "hier liegt nichts"],
  ziel: ["geschafft", "nicht geschafft"],
  gegner: ["Gegner in der Nähe", "kein Gegner in der Nähe"],
};
export const bedingungText = (b: Bedingung) => BEDINGUNG_TEXT[b.art][b.nicht ? 1 : 0];
