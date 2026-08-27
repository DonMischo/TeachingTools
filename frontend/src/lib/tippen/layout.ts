/**
 * Die deutsche Tastatur (QWERTZ, ISO) als Daten — Grundlage für die
 * Bildschirmtastatur und für die Frage »welche Taste kommt als nächste?«.
 *
 * Geschlüsselt wird über `KeyboardEvent.code` (die *physische* Taste), nicht
 * über das erzeugte Zeichen: `code` bleibt "Semicolon", egal ob das System
 * gerade ö, ; oder etwas anderes daraus macht. Die Beschriftung hier ist die
 * deutsche Belegung — sie beschreibt, was auf den Tasten steht.
 */

export type Finger = "l5" | "l4" | "l3" | "l2" | "daumen" | "r2" | "r3" | "r4" | "r5";

export type Taste = {
  /** KeyboardEvent.code — die physische Taste. */
  code: string;
  /** Beschriftung unten links (ohne Umschalt). */
  label: string;
  /** Beschriftung oben links (mit Umschalt). */
  shift?: string;
  finger: Finger;
  /** Breite in Einheiten; 1 = normale Buchstabentaste. */
  width?: number;
  /** Tottaste (^ ´ `): erzeugt erst zusammen mit dem nächsten Zeichen etwas. */
  dead?: boolean;
  /** Grundstellung — die Tasten, auf denen die Finger ruhen. */
  home?: boolean;
  /** Steuertaste: wird nie als »zu tippendes Zeichen« gesucht. */
  mod?: boolean;
};

/** Breite einer Reihe in Einheiten — Grundlage der Ausrichtung untereinander. */
export const REIHENBREITE = 15;

/**
 * Zeilen der Hauptblock-Tastatur.
 *
 * Die Buchstabenreihe bleibt eine Einheit unter der vollen Breite: dort sitzt
 * auf einer echten ISO-Tastatur der obere Schenkel der Eingabetaste. Die
 * Bildschirmtastatur füllt die Lücke, statt die Spalten zu verschieben.
 */
export const REIHEN: Taste[][] = [
  [
    { code: "Backquote", label: "^", shift: "°", finger: "l5", dead: true },
    { code: "Digit1", label: "1", shift: "!", finger: "l5" },
    { code: "Digit2", label: "2", shift: '"', finger: "l4" },
    { code: "Digit3", label: "3", shift: "§", finger: "l3" },
    { code: "Digit4", label: "4", shift: "$", finger: "l2" },
    { code: "Digit5", label: "5", shift: "%", finger: "l2" },
    { code: "Digit6", label: "6", shift: "&", finger: "r2" },
    { code: "Digit7", label: "7", shift: "/", finger: "r2" },
    { code: "Digit8", label: "8", shift: "(", finger: "r3" },
    { code: "Digit9", label: "9", shift: ")", finger: "r4" },
    { code: "Digit0", label: "0", shift: "=", finger: "r5" },
    { code: "Minus", label: "ß", shift: "?", finger: "r5" },
    { code: "Equal", label: "´", shift: "`", finger: "r5", dead: true },
    { code: "Backspace", label: "⌫", finger: "r5", width: 2, mod: true },
  ],
  [
    { code: "Tab", label: "⇥", finger: "l5", width: 1.5, mod: true },
    { code: "KeyQ", label: "q", shift: "Q", finger: "l5" },
    { code: "KeyW", label: "w", shift: "W", finger: "l4" },
    { code: "KeyE", label: "e", shift: "E", finger: "l3" },
    { code: "KeyR", label: "r", shift: "R", finger: "l2" },
    { code: "KeyT", label: "t", shift: "T", finger: "l2" },
    { code: "KeyZ", label: "z", shift: "Z", finger: "r2" },
    { code: "KeyU", label: "u", shift: "U", finger: "r2" },
    { code: "KeyI", label: "i", shift: "I", finger: "r3" },
    { code: "KeyO", label: "o", shift: "O", finger: "r4" },
    { code: "KeyP", label: "p", shift: "P", finger: "r5" },
    { code: "BracketLeft", label: "ü", shift: "Ü", finger: "r5" },
    { code: "BracketRight", label: "+", shift: "*", finger: "r5", width: 1.5 },
  ],
  [
    { code: "CapsLock", label: "⇪", finger: "l5", width: 1.75, mod: true },
    { code: "KeyA", label: "a", shift: "A", finger: "l5", home: true },
    { code: "KeyS", label: "s", shift: "S", finger: "l4", home: true },
    { code: "KeyD", label: "d", shift: "D", finger: "l3", home: true },
    { code: "KeyF", label: "f", shift: "F", finger: "l2", home: true },
    { code: "KeyG", label: "g", shift: "G", finger: "l2" },
    { code: "KeyH", label: "h", shift: "H", finger: "r2" },
    { code: "KeyJ", label: "j", shift: "J", finger: "r2", home: true },
    { code: "KeyK", label: "k", shift: "K", finger: "r3", home: true },
    { code: "KeyL", label: "l", shift: "L", finger: "r4", home: true },
    { code: "Semicolon", label: "ö", shift: "Ö", finger: "r5", home: true },
    { code: "Quote", label: "ä", shift: "Ä", finger: "r5" },
    { code: "Backslash", label: "#", shift: "'", finger: "r5" },
    { code: "Enter", label: "⏎", finger: "r5", width: 1.25, mod: true },
  ],
  [
    { code: "ShiftLeft", label: "⇧", finger: "l5", width: 1.25, mod: true },
    { code: "IntlBackslash", label: "<", shift: ">", finger: "l5" },
    { code: "KeyY", label: "y", shift: "Y", finger: "l5" },
    { code: "KeyX", label: "x", shift: "X", finger: "l4" },
    { code: "KeyC", label: "c", shift: "C", finger: "l3" },
    { code: "KeyV", label: "v", shift: "V", finger: "l2" },
    { code: "KeyB", label: "b", shift: "B", finger: "l2" },
    { code: "KeyN", label: "n", shift: "N", finger: "r2" },
    { code: "KeyM", label: "m", shift: "M", finger: "r2" },
    { code: "Comma", label: ",", shift: ";", finger: "r3" },
    { code: "Period", label: ".", shift: ":", finger: "r4" },
    { code: "Slash", label: "-", shift: "_", finger: "r5" },
    { code: "ShiftRight", label: "⇧", finger: "r5", width: 2.75, mod: true },
  ],
  [
    { code: "ControlLeft", label: "Strg", finger: "l5", width: 1.5, mod: true },
    { code: "MetaLeft", label: "⊞", finger: "l5", width: 1.25, mod: true },
    { code: "AltLeft", label: "Alt", finger: "daumen", width: 1.25, mod: true },
    { code: "Space", label: "", finger: "daumen", width: 6.25 },
    { code: "AltRight", label: "AltGr", finger: "daumen", width: 1.5, mod: true },
    { code: "MetaRight", label: "⊞", finger: "r5", width: 1.25, mod: true },
    { code: "ControlRight", label: "Strg", finger: "r5", width: 2, mod: true },
  ],
];

export const ALLE_TASTEN: Taste[] = REIHEN.flat();

/** Farbe je Finger — linke und rechte Hand spiegelbildlich gleich eingefärbt. */
export const FINGER_FARBEN: Record<Finger, string> = {
  l5: "#f472b6",
  l4: "#fbbf24",
  l3: "#34d399",
  l2: "#60a5fa",
  daumen: "#a78bfa",
  r2: "#60a5fa",
  r3: "#34d399",
  r4: "#fbbf24",
  r5: "#f472b6",
};

export const FINGER_NAMEN: Record<Finger, string> = {
  l5: "links: kleiner Finger",
  l4: "links: Ringfinger",
  l3: "links: Mittelfinger",
  l2: "links: Zeigefinger",
  daumen: "Daumen",
  r2: "rechts: Zeigefinger",
  r3: "rechts: Mittelfinger",
  r4: "rechts: Ringfinger",
  r5: "rechts: kleiner Finger",
};

/** Welche Hand bedient diesen Finger — für die Wahl der Umschalttaste. */
export function hand(finger: Finger): "links" | "rechts" | "daumen" {
  if (finger === "daumen") return "daumen";
  return finger.startsWith("l") ? "links" : "rechts";
}

export type Anschlag = { code: string; shift: boolean; finger: Finger };

const INDEX: Map<string, Anschlag> = (() => {
  const m = new Map<string, Anschlag>();
  for (const t of ALLE_TASTEN) {
    if (t.mod || t.dead) continue;
    if (t.label && !m.has(t.label)) m.set(t.label, { code: t.code, shift: false, finger: t.finger });
    if (t.shift && !m.has(t.shift)) m.set(t.shift, { code: t.code, shift: true, finger: t.finger });
  }
  m.set(" ", { code: "Space", shift: false, finger: "daumen" });
  return m;
})();

/** Welche Taste (und ob mit Umschalt) erzeugt dieses Zeichen? */
export function zeichenZuTaste(zeichen: string): Anschlag | undefined {
  return INDEX.get(zeichen);
}

/**
 * Die Umschalttaste der *anderen* Hand — so, wie es das Zehnfingersystem
 * verlangt: ein großes A entsteht aus rechter Umschalt- und linker A-Taste.
 */
export function umschaltFuer(finger: Finger): "ShiftLeft" | "ShiftRight" {
  return hand(finger) === "links" ? "ShiftRight" : "ShiftLeft";
}
