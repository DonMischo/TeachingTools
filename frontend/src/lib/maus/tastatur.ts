/**
 * Stufe »Tastatur«: die Grundlagen — Umschalt, Rücktaste, Entf, Pfeiltasten,
 * Pos1/Ende und die Rettungsanker Strg+Z / Strg+X / Strg+V.
 *
 * Jede Aufgabe hat ein eigenes Feld mit Startwert; geprüft wird der Endwert
 * *und* ob der richtige Weg benutzt wurde (z. B. wirklich die Rücktaste, nicht
 * einfach neu getippt). `pruefeAufgabe` bleibt reine Logik, damit sie ohne DOM
 * getestet werden kann — welche Taste wann gedrückt wurde, meldet die
 * Komponente über `Gesehen`.
 */

export type AufgabenId =
  | "umschalt" | "ruecktaste" | "entf" | "pfeiltasten" | "pos1" | "ende" | "strgz" | "ausschneiden";

export type Aufgabe = {
  id: AufgabenId;
  /** Kurzname für die Aufgabenliste, z. B. »Umschalt ⇧«. */
  kurz: string;
  auftrag: string;
  tipp: string;
  start: string;
  art: "input" | "textarea";
  caret: "anfang" | "ende";
  /** Tasten, die als Hinweis-Chips gezeigt werden. */
  tastenHinweis: string[];
};

export const TASTATUR_AUFGABEN: Aufgabe[] = [
  {
    id: "umschalt",
    kurz: "Umschalt ⇧",
    auftrag: "Schreibe »Hund« mit großem H.",
    tipp: "Halte Umschalt ⇧ fest und tippe H — dann »und«.",
    start: "",
    art: "input",
    caret: "ende",
    tastenHinweis: ["Umschalt ⇧"],
  },
  {
    id: "ruecktaste",
    kurz: "Rücktaste ⟵",
    auftrag: "Lösche das doppelte e mit der Rücktaste ⟵.",
    tipp: "Die Rücktaste löscht das Zeichen links vom Cursor.",
    start: "Katzee",
    art: "input",
    caret: "ende",
    tastenHinweis: ["Rücktaste ⟵"],
  },
  {
    id: "entf",
    kurz: "Entf",
    auftrag: "Lösche das doppelte M mit Entf.",
    tipp: "Entf löscht das Zeichen rechts vom Cursor.",
    start: "MMaus",
    art: "input",
    caret: "anfang",
    tastenHinweis: ["Entf"],
  },
  {
    id: "pfeiltasten",
    kurz: "Pfeiltaste ←",
    auftrag: "Geh mit ← zurück und setze das fehlende a ein.",
    tipp: "Die Pfeiltaste ← bewegt den Cursor nach links.",
    start: "Bll",
    art: "input",
    caret: "ende",
    tastenHinweis: ["←"],
  },
  {
    id: "pos1",
    kurz: "Pos1",
    auftrag: "Spring mit Pos1 an den Anfang und schreibe A.",
    tipp: "Pos1 springt an den Anfang der Zeile.",
    start: "pfel",
    art: "input",
    caret: "ende",
    tastenHinweis: ["Pos1"],
  },
  {
    id: "ende",
    kurz: "Ende",
    auftrag: "Spring mit Ende ans Ende und setze ein !.",
    tipp: "Ende springt ans Ende der Zeile.",
    start: "Hallo",
    art: "input",
    caret: "anfang",
    tastenHinweis: ["Ende"],
  },
  {
    id: "strgz",
    kurz: "Strg + Z",
    auftrag: "Markiere den Satz, lösche ihn mit Entf — und hol ihn mit Strg + Z zurück.",
    tipp: "Strg + Z macht den letzten Schritt rückgängig.",
    start: "Die Maus rennt schnell.",
    art: "textarea",
    caret: "ende",
    tastenHinweis: ["Strg", "Z"],
  },
  {
    id: "ausschneiden",
    kurz: "Strg + X / Strg + V",
    auftrag: "Schneide »Zoo« aus und setze es vor den Punkt.",
    tipp: "Strg + X schneidet aus, Strg + V fügt ein.",
    start: "Zoo Ich war im .",
    art: "input",
    caret: "ende",
    tastenHinweis: ["Strg", "X", "Strg", "V"],
  },
];

export type Gesehen = {
  shift: boolean;
  capsLock: boolean;
  backspace: boolean;
  delete: boolean;
  arrowLeft: boolean;
  home: boolean;
  end: boolean;
  ctrlZ: boolean;
  leerZwischenzeitlich: boolean;
  cut: boolean;
  paste: boolean;
};

export function leeresGesehen(): Gesehen {
  return {
    shift: false, capsLock: false, backspace: false, delete: false, arrowLeft: false,
    home: false, end: false, ctrlZ: false, leerZwischenzeitlich: false, cut: false, paste: false,
  };
}

/** Whitespace glätten und Leerzeichen vor Satzzeichen entfernen — für Ausschneiden/Einfügen. */
export function normalisiereSatz(s: string): string {
  return s.trim().replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1");
}

export function pruefeAufgabe(aufgabe: Aufgabe, wert: string, gesehen: Gesehen): boolean {
  switch (aufgabe.id) {
    case "umschalt":
      return wert === "Hund" && (gesehen.shift || gesehen.capsLock);
    case "ruecktaste":
      return wert === "Katze" && gesehen.backspace;
    case "entf":
      return wert === "Maus" && gesehen.delete;
    case "pfeiltasten":
      return wert === "Ball" && gesehen.arrowLeft;
    case "pos1":
      return wert === "Apfel" && gesehen.home;
    case "ende":
      return wert === "Hallo!" && gesehen.end;
    case "strgz":
      return wert === aufgabe.start && gesehen.leerZwischenzeitlich && gesehen.ctrlZ;
    case "ausschneiden":
      return normalisiereSatz(wert) === "Ich war im Zoo." && gesehen.cut && gesehen.paste;
  }
}

/** Bei »Umschalt« gelöst, aber mit Feststelltaste statt Umschalt — verdient trotzdem den Punkt, aber einen Hinweis. */
export function mitFeststelltasteGeloest(aufgabe: Aufgabe, wert: string, gesehen: Gesehen): boolean {
  return aufgabe.id === "umschalt" && wert === "Hund" && gesehen.capsLock && !gesehen.shift;
}
