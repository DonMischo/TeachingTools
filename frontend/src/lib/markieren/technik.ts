/**
 * Welche Technik steckt hinter einem Tastendruck oder Klick? Daraus erkennt
 * das Werkzeug, ob eine Lektion wirklich mit der geübten Technik gelöst wurde,
 * und zählt die Aktionen (Klicks und Tastenkürzel, getippte Buchstaben nicht).
 */

export type Technik =
  | "doppelklick" | "dreifachklick" | "ziehen" | "umschaltklick"
  | "pos1ende" | "umschaltPos1Ende" | "strgPfeil" | "strgUmschaltPfeil" | "umschaltPfeil"
  | "strgA" | "kopieren" | "ausschneiden" | "einfuegen" | "rueckgaengig" | "loeschen" | "tippen";

/** Name und Tasten (»[[Strg]]« wird zur Tastenkappe, siehe maus/Taste.tsx). */
export const TECHNIKEN: Record<Technik, { name: string; tasten: string }> = {
  doppelklick: { name: "Doppelklick", tasten: "Doppelklick" },
  dreifachklick: { name: "Dreifachklick", tasten: "Dreifachklick" },
  ziehen: { name: "Ziehen", tasten: "Ziehen mit gedrückter Taste" },
  umschaltklick: { name: "Umschalt + Klick", tasten: "[[Umschalt]] + Klick" },
  pos1ende: { name: "Pos1 / Ende", tasten: "[[Pos1]] / [[Ende]]" },
  umschaltPos1Ende: { name: "Umschalt + Pos1 / Ende", tasten: "[[Umschalt]] + [[Pos1]] / [[Ende]]" },
  strgPfeil: { name: "Strg + Pfeil", tasten: "[[Strg]] + [[←]] / [[→]]" },
  strgUmschaltPfeil: { name: "Strg + Umschalt + Pfeil", tasten: "[[Strg]] + [[Umschalt]] + [[←]] / [[→]]" },
  umschaltPfeil: { name: "Umschalt + Pfeil", tasten: "[[Umschalt]] + [[←]] / [[→]]" },
  strgA: { name: "Strg + A", tasten: "[[Strg]] + [[A]]" },
  kopieren: { name: "Kopieren", tasten: "[[Strg]] + [[C]]" },
  ausschneiden: { name: "Ausschneiden", tasten: "[[Strg]] + [[X]]" },
  einfuegen: { name: "Einfügen", tasten: "[[Strg]] + [[V]]" },
  rueckgaengig: { name: "Rückgängig", tasten: "[[Strg]] + [[Z]]" },
  loeschen: { name: "Löschen", tasten: "[[Entf]] / [[Rücktaste]]" },
  tippen: { name: "Tippen", tasten: "Tippen" },
};

export type TastenDruck = { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey?: boolean };

const MODIFIKATOREN = new Set(["Shift", "Control", "Meta", "Alt", "AltGraph", "CapsLock", "OS"]);

/** Die Technik eines Tastendrucks — `null` für einfache Pfeile, Enter usw. */
export function technikAusTaste(e: TastenDruck): Technik | null {
  const strg = e.ctrlKey || e.metaKey;
  const k = e.key;
  if (strg && !e.altKey && k.length === 1) {
    const b = k.toLowerCase();
    if (b === "a") return "strgA";
    if (b === "c") return "kopieren";
    if (b === "x") return "ausschneiden";
    if (b === "v") return "einfuegen";
    if (b === "z" && !e.shiftKey) return "rueckgaengig";
    return null;
  }
  if (k === "Home" || k === "End") return e.shiftKey ? "umschaltPos1Ende" : "pos1ende";
  if (k === "ArrowLeft" || k === "ArrowRight") {
    if (strg && e.shiftKey) return "strgUmschaltPfeil";
    if (strg) return "strgPfeil";
    if (e.shiftKey) return "umschaltPfeil";
    return null;
  }
  if ((k === "ArrowUp" || k === "ArrowDown") && e.shiftKey) return "umschaltPfeil";
  if (k === "Delete" || k === "Backspace") return "loeschen";
  if (k.length === 1 && !strg) return "tippen";
  return null;
}

/** Zählt der Tastendruck als Aktion? Modifikatoren und getippte Zeichen nicht. */
export function zaehltAlsAktion(e: TastenDruck): boolean {
  if (MODIFIKATOREN.has(e.key)) return false;
  return !(e.key.length === 1 && !e.ctrlKey && !e.metaKey);
}
