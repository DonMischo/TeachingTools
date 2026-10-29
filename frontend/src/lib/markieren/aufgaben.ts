/**
 * Aufgaben fürs Markieren und Bearbeiten: würfeln, prüfen, Lektionen und
 * Challenge-Modi. Rein rechnend, ohne DOM — das Textfeld meldet nur
 * Text und Auswahl (`selectionStart`/`selectionEnd`).
 *
 * Geprüft wird nachsichtig, damit Browser-Eigenheiten kein Kind eine Aufgabe
 * kosten: Der Doppelklick nimmt unter Windows das Leerzeichen hinter dem Wort
 * mit, Strg + Umschalt + → hört erst vor dem nächsten Wort auf, der
 * Dreifachklick nimmt den Zeilenumbruch mit. Deshalb zählen bei der Auswahl
 * Leerraum und Satzzeichen am Rand nicht, beim Text weder doppelte
 * Leerzeichen noch leere Zeilen.
 */
import { EINDRINGLINGE, FALSCHE_ZEILEN, TEXTE, type Uebungstext } from "./texte";
import type { Technik } from "./technik";

export type Bereich = { von: number; bis: number };
export type Zufall = () => number;

/** Fester Zufall — gleiche Aufgaben auf Server und Browser (kein Hydrationsfehler). */
export function zufall(seed: number): Zufall {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Pruefung =
  | { art: "auswahl"; ziel: Bereich }
  | { art: "cursor"; pos: number }
  | { art: "text"; ergebnis: string }
  /** Erst `zwischen` herstellen (z. B. Zeile gelöscht), dann zurück zum Ausgangstext. */
  | { art: "rueckgaengig"; zwischen: string };

export type Aufgabe = {
  typ: AufgabenTyp;
  /** Auftrag mit »…« und [[Tasten]]. */
  auftrag: string;
  text: string;
  /** Cursor bzw. Auswahl zu Beginn; ohne Angabe bekommt das Feld keinen Fokus. */
  start?: Bereich;
  pruefung: Pruefung;
  /** Der schnelle Weg … */
  profi: Technik[];
  /** … und wie viele Aktionen er ungefähr braucht. */
  profiAktionen: number;
};

// ---------------------------------------------------------------- Prüfen

const RAND = /[\s.,;:!?»«"'()–-]/;

/** Bereich ohne Leerraum und Satzzeichen am Rand. */
export function kern(text: string, b: Bereich): Bereich {
  let von = Math.min(b.von, b.bis), bis = Math.max(b.von, b.bis);
  while (von < bis && RAND.test(text[von])) von++;
  while (bis > von && RAND.test(text[bis - 1])) bis--;
  return { von, bis };
}

export function auswahlPasst(text: string, auswahl: Bereich, ziel: Bereich): boolean {
  const a = kern(text, auswahl), z = kern(text, ziel);
  return a.bis > a.von && a.von === z.von && a.bis === z.bis;
}

/** Doppelte Leerzeichen, Leerzeichen vor Satzzeichen und leere Zeilen fallen weg. */
export function normalisiereText(s: string): string {
  return s.replace(/\r/g, "").split("\n")
    .map(z => z.replace(/[ \t ]+/g, " ").replace(/ ([.,;:!?])/g, "$1").trim())
    .filter(z => z)
    .join("\n");
}

export type Zustand = { text: string; von: number; bis: number };

/**
 * `zwischen`: Bei »rückgängig« wurde der Zwischenstand schon erreicht.
 * Liefert, ob die Aufgabe gelöst ist und ob der Zwischenstand jetzt erreicht ist.
 */
export function pruefe(a: Aufgabe, z: Zustand, zwischen = false): { geloest: boolean; zwischen: boolean } {
  const p = a.pruefung;
  if (p.art === "auswahl") return { geloest: auswahlPasst(z.text, z, p.ziel), zwischen };
  if (p.art === "cursor") return { geloest: z.von === z.bis && z.von === p.pos, zwischen };
  const jetzt = normalisiereText(z.text);
  if (p.art === "text") return { geloest: jetzt === normalisiereText(p.ergebnis), zwischen };
  const erreicht = zwischen || jetzt === normalisiereText(p.zwischen);
  return { geloest: erreicht && jetzt === normalisiereText(a.text), zwischen: erreicht };
}

// ---------------------------------------------------------------- Text zerlegen

export type Wort = { wort: string; von: number; bis: number; zeile: number; nr: number };

export function zeilenStarts(zeilen: string[]): number[] {
  const starts: number[] = [];
  let pos = 0;
  for (const z of zeilen) { starts.push(pos); pos += z.length + 1; }
  return starts;
}

/** Alle Wörter mit absoluter Lage; `nr` zählt innerhalb der Zeile. */
export function woerter(zeilen: string[]): Wort[] {
  const starts = zeilenStarts(zeilen);
  const out: Wort[] = [];
  zeilen.forEach((z, zeile) => {
    let nr = 0;
    for (const m of z.matchAll(/[\p{L}\p{N}]+/gu)) {
      out.push({ wort: m[0], von: starts[zeile] + m.index!, bis: starts[zeile] + m.index! + m[0].length, zeile, nr: nr++ });
    }
  });
  return out;
}

/** Wörter, die genau einmal vorkommen — sonst wäre »markiere X« mehrdeutig. */
export function eindeutige(zeilen: string[], minLaenge = 4): Wort[] {
  const alle = woerter(zeilen);
  return alle.filter(w => w.wort.length >= minLaenge && alle.filter(v => v.wort === w.wort).length === 1);
}

const wahl = <T,>(xs: T[], r: Zufall): T => xs[Math.floor(r() * xs.length) % xs.length];
const anfang = (z: string, n = 3) => {
  const w = z.split(" ");
  return w.length > n ? w.slice(0, n).join(" ") + " …" : z;
};
const text = (zeilen: string[]) => zeilen.join("\n");

// ---------------------------------------------------------------- Aufgaben würfeln

type Gen = (t: Uebungstext, r: Zufall) => Aufgabe | null;

const wortMarkieren: Gen = (t, r) => {
  const w = wahl(eindeutige(t.zeilen), r);
  return {
    typ: "wortMarkieren", auftrag: `Markiere das Wort »${w.wort}«.`, text: text(t.zeilen),
    pruefung: { art: "auswahl", ziel: w }, profi: ["doppelklick"], profiAktionen: 1,
  };
};

const zeileMarkieren: Gen = (t, r) => {
  const n = 1 + Math.floor(r() * (t.zeilen.length - 1));
  const s = zeilenStarts(t.zeilen)[n];
  return {
    typ: "zeileMarkieren", auftrag: `Markiere die ganze Zeile ${n + 1} (»${anfang(t.zeilen[n])}«).`, text: text(t.zeilen),
    pruefung: { art: "auswahl", ziel: { von: s, bis: s + t.zeilen[n].length } }, profi: ["dreifachklick"], profiAktionen: 1,
  };
};

/** Zwei bis drei Wörter am Stück. `mitStart`: Cursor steht schon vor dem ersten. */
function mehrereWoerter(mitStart: boolean): Gen {
  return (t, r) => {
    const alle = woerter(t.zeilen);
    const k = 2 + Math.floor(r() * 2);
    const kandidaten = alle.filter((w, i) => {
      const letztes = alle[i + k - 1];
      if (!letztes || letztes.zeile !== w.zeile) return false;
      const stueck = t.zeilen.join("\n").slice(w.von, letztes.bis);
      return text(t.zeilen).indexOf(stueck) === text(t.zeilen).lastIndexOf(stueck);
    });
    if (!kandidaten.length) return null;
    const w = wahl(kandidaten, r);
    const ende = alle[alle.indexOf(w) + k - 1].bis;
    const stueck = text(t.zeilen).slice(w.von, ende);
    return {
      typ: "mehrereWoerter", auftrag: `Markiere »${stueck}«.`, text: text(t.zeilen),
      start: mitStart ? { von: w.von, bis: w.von } : undefined,
      pruefung: { art: "auswahl", ziel: { von: w.von, bis: ende } },
      profi: mitStart ? ["strgUmschaltPfeil"] : ["doppelklick", "strgUmschaltPfeil"], profiAktionen: k,
    };
  };
}

/** Ein Wort mitten in einer Zeile mit mindestens drei Wörtern. */
function mittelwort(t: Uebungstext, r: Zufall): { w: Wort; letzte: number } | null {
  const alle = woerter(t.zeilen);
  const kand = eindeutige(t.zeilen, 3).filter(w => {
    const n = alle.filter(v => v.zeile === w.zeile).length;
    return n >= 3 && w.nr >= 1 && w.nr < n - 1;
  });
  if (!kand.length) return null;
  const w = wahl(kand, r);
  return { w, letzte: alle.filter(v => v.zeile === w.zeile).length - 1 };
}

const bisZeilenende: Gen = (t, r) => {
  const m = mittelwort(t, r);
  if (!m) return null;
  const ende = zeilenStarts(t.zeilen)[m.w.zeile] + t.zeilen[m.w.zeile].length;
  return {
    typ: "bisZeilenende", auftrag: `Markiere in Zeile ${m.w.zeile + 1} alles ab »${m.w.wort}« bis zum Zeilenende.`, text: text(t.zeilen),
    pruefung: { art: "auswahl", ziel: { von: m.w.von, bis: ende } }, profi: ["umschaltPos1Ende"], profiAktionen: 2,
  };
};

const abZeilenanfang: Gen = (t, r) => {
  const m = mittelwort(t, r);
  if (!m) return null;
  const s = zeilenStarts(t.zeilen)[m.w.zeile];
  return {
    typ: "abZeilenanfang", auftrag: `Markiere in Zeile ${m.w.zeile + 1} alles vom Zeilenanfang bis einschließlich »${m.w.wort}«.`, text: text(t.zeilen),
    pruefung: { art: "auswahl", ziel: { von: s, bis: m.w.bis } }, profi: ["umschaltPos1Ende"], profiAktionen: 2,
  };
};

/** Über eine Zeilengrenze: vom Wort in Zeile n bis zum Wort in Zeile n+1. */
const vonBis: Gen = (t, r) => {
  const ein = eindeutige(t.zeilen);
  const paare = ein.flatMap(a => ein.filter(b => b.zeile === a.zeile + 1).map(b => [a, b] as const));
  if (!paare.length) return null;
  const [a, b] = wahl(paare, r);
  return {
    typ: "vonBis", auftrag: `Markiere von »${a.wort}« (Zeile ${a.zeile + 1}) bis einschließlich »${b.wort}« (Zeile ${b.zeile + 1}).`, text: text(t.zeilen),
    pruefung: { art: "auswahl", ziel: { von: a.von, bis: b.bis } }, profi: ["umschaltklick"], profiAktionen: 2,
  };
};

const allesMarkieren: Gen = t => ({
  typ: "allesMarkieren", auftrag: "Markiere den ganzen Text.", text: text(t.zeilen),
  pruefung: { art: "auswahl", ziel: { von: 0, bis: text(t.zeilen).length } }, profi: ["strgA"], profiAktionen: 2,
});

/** Nur den vorderen Teil eines zusammengesetzten Worts — Buchstabe für Buchstabe. */
const teilwort: Gen = (t, r) => {
  const alle = woerter(t.zeilen);
  const paare = t.teile.map(([ganz, teil]) => ({ w: alle.find(w => w.wort === ganz), teil })).filter(p => p.w);
  if (!paare.length) return null;
  const { w, teil } = wahl(paare, r);
  return {
    typ: "teilwort", auftrag: `Markiere nur »${teil}« aus »${w!.wort}«.`, text: text(t.zeilen),
    start: { von: w!.von, bis: w!.von },
    pruefung: { art: "auswahl", ziel: { von: w!.von, bis: w!.von + teil.length } }, profi: ["umschaltPfeil"], profiAktionen: teil.length,
  };
};

/** Cursor an den Rand einer Zeile; er blinkt schon mitten in dieser Zeile. */
const cursorRand: Gen = (t, r) => {
  const m = mittelwort(t, r);
  if (!m) return null;
  const s = zeilenStarts(t.zeilen)[m.w.zeile];
  const zumEnde = r() < 0.5;
  return {
    typ: "cursorRand",
    auftrag: zumEnde
      ? `Der Cursor blinkt in Zeile ${m.w.zeile + 1}. Bring ihn ans Ende der Zeile.`
      : `Der Cursor blinkt in Zeile ${m.w.zeile + 1}. Bring ihn an den Anfang der Zeile.`,
    text: text(t.zeilen), start: { von: m.w.von, bis: m.w.von },
    pruefung: { art: "cursor", pos: zumEnde ? s + t.zeilen[m.w.zeile].length : s }, profi: ["pos1ende"], profiAktionen: 1,
  };
};

/** Cursor vom Zeilenanfang vor ein späteres Wort — Wort für Wort springen. */
const cursorVorWort: Gen = (t, r) => {
  const alle = woerter(t.zeilen);
  const kand = eindeutige(t.zeilen, 3).filter(w => w.nr >= 2 && w.nr <= 4);
  if (!kand.length) return null;
  const w = wahl(kand, r);
  const s = alle.find(v => v.zeile === w.zeile && v.nr === 0)!.von;
  return {
    typ: "cursorVorWort", auftrag: `Der Cursor steht am Anfang von Zeile ${w.zeile + 1}. Bring ihn direkt vor »${w.wort}«.`, text: text(t.zeilen),
    start: { von: s, bis: s }, pruefung: { art: "cursor", pos: w.von }, profi: ["strgPfeil"], profiAktionen: w.nr,
  };
};

/** Ein Eindringling steht im Text und muss weg. */
const wortLoeschen: Gen = (t, r) => {
  const ziele = woerter(t.zeilen).filter(w => w.nr >= 1);
  const w = wahl(ziele, r);
  const fremd = wahl(EINDRINGLINGE.filter(e => !t.zeilen.join(" ").includes(e)), r);
  const orig = text(t.zeilen);
  return {
    typ: "wortLoeschen", auftrag: `In Zeile ${w.zeile + 1} hat sich »${fremd}« eingeschlichen. Lösche es.`,
    text: orig.slice(0, w.von) + fremd + " " + orig.slice(w.von),
    pruefung: { art: "text", ergebnis: orig }, profi: ["doppelklick", "loeschen"], profiAktionen: 2,
  };
};

const zeileLoeschen: Gen = (t, r) => {
  const n = 1 + Math.floor(r() * (t.zeilen.length - 1));
  const fremd = wahl(FALSCHE_ZEILEN, r);
  const neu = [...t.zeilen.slice(0, n), fremd, ...t.zeilen.slice(n)];
  return {
    typ: "zeileLoeschen", auftrag: `Zeile ${n + 1} (»${fremd}«) gehört nicht in den Text. Lösche sie.`, text: text(neu),
    pruefung: { art: "text", ergebnis: text(t.zeilen) }, profi: ["dreifachklick", "loeschen"], profiAktionen: 2,
  };
};

const wortErsetzen: Gen = (t, r) => {
  const ein = eindeutige(t.zeilen, 1);
  const paare = t.ersatz.filter(([alt]) => ein.some(w => w.wort === alt));
  if (!paare.length) return null;
  const [alt, neu] = wahl(paare, r);
  const w = ein.find(v => v.wort === alt)!;
  const orig = text(t.zeilen);
  return {
    typ: "wortErsetzen", auftrag: `Ersetze »${alt}« durch »${neu}«.`, text: orig,
    pruefung: { art: "text", ergebnis: orig.slice(0, w.von) + neu + orig.slice(w.bis) }, profi: ["doppelklick", "tippen"], profiAktionen: 1,
  };
};

/** Eine Zeile steht an der falschen Stelle — ausschneiden und richtig einfügen. */
const zeileVerschieben: Gen = (t, r) => {
  const n = 2 + Math.floor(r() * (t.zeilen.length - 2));
  const ohne = t.zeilen.filter((_, i) => i !== n);
  let ziel = 1 + Math.floor(r() * (ohne.length - 1));
  if (ziel === n) ziel = ziel === 1 ? 2 : ziel - 1;
  const falsch = [...ohne.slice(0, ziel), t.zeilen[n], ...ohne.slice(ziel)];
  return {
    typ: "zeileVerschieben",
    auftrag: `Die Zeile »${anfang(t.zeilen[n])}« ist verrutscht. Sie gehört direkt unter »${anfang(t.zeilen[n - 1])}«.`,
    text: text(falsch), pruefung: { art: "text", ergebnis: text(t.zeilen) },
    profi: ["dreifachklick", "ausschneiden", "einfuegen"], profiAktionen: 4,
  };
};

/** Ein Wort ist an den Zeilenanfang gerutscht — ausschneiden und zurück. */
const wortVerschieben: Gen = (t, r) => {
  const alle = woerter(t.zeilen);
  const kand = alle.filter(w => w.nr >= 1 && /^[\p{L} ]+$/u.test(t.zeilen[w.zeile]) && w.wort.length >= 3);
  if (!kand.length) return null;
  const w = wahl(kand, r);
  const zeile = t.zeilen[w.zeile];
  const s = zeilenStarts(t.zeilen)[w.zeile];
  const ohne = (zeile.slice(0, w.von - s) + zeile.slice(w.bis - s)).replace(/ +/g, " ").trim();
  const falsch = t.zeilen.map((z, i) => (i === w.zeile ? `${w.wort} ${ohne}` : z));
  const davor = alle.find(v => v.zeile === w.zeile && v.nr === w.nr - 1)!;
  return {
    typ: "wortVerschieben",
    auftrag: `In Zeile ${w.zeile + 1} ist »${w.wort}« nach vorn gerutscht. Es gehört hinter »${davor.wort}«.`,
    text: text(falsch), pruefung: { art: "text", ergebnis: text(t.zeilen) },
    profi: ["doppelklick", "ausschneiden", "einfuegen"], profiAktionen: 3,
  };
};

const zeileKopieren: Gen = (t, r) => {
  const n = 1 + Math.floor(r() * (t.zeilen.length - 1));
  return {
    typ: "zeileKopieren", auftrag: `Kopiere Zeile ${n + 1} (»${anfang(t.zeilen[n])}«) und füge sie als neue letzte Zeile noch einmal ein.`,
    text: text(t.zeilen), pruefung: { art: "text", ergebnis: text([...t.zeilen, t.zeilen[n]]) },
    profi: ["dreifachklick", "kopieren", "einfuegen"], profiAktionen: 5,
  };
};

const wortKopieren: Gen = (t, r) => {
  const w = wahl(eindeutige(t.zeilen), r);
  const n = (w.zeile + 1 + Math.floor(r() * (t.zeilen.length - 1))) % t.zeilen.length;
  return {
    typ: "wortKopieren", auftrag: `Kopiere »${w.wort}« und füge es am Ende von Zeile ${n + 1} noch einmal ein.`,
    text: text(t.zeilen), pruefung: { art: "text", ergebnis: text(t.zeilen.map((z, i) => (i === n ? `${z} ${w.wort}` : z))) },
    profi: ["doppelklick", "kopieren", "pos1ende", "einfuegen"], profiAktionen: 5,
  };
};

const rueckgaengig: Gen = (t, r) => {
  const n = 1 + Math.floor(r() * (t.zeilen.length - 1));
  return {
    typ: "rueckgaengig", auftrag: `Lösche Zeile ${n + 1} (»${anfang(t.zeilen[n])}«) — und hol sie danach mit [[Strg]] + [[Z]] zurück.`,
    text: text(t.zeilen), pruefung: { art: "rueckgaengig", zwischen: text(t.zeilen.filter((_, i) => i !== n)) },
    profi: ["dreifachklick", "loeschen", "rueckgaengig"], profiAktionen: 3,
  };
};

export const GENERATOREN = {
  wortMarkieren, zeileMarkieren, mehrereWoerter: mehrereWoerter(false), mehrereWoerterTastatur: mehrereWoerter(true),
  bisZeilenende, abZeilenanfang, vonBis, allesMarkieren, teilwort, cursorRand, cursorVorWort,
  wortLoeschen, zeileLoeschen, wortErsetzen, zeileVerschieben, wortVerschieben, zeileKopieren, wortKopieren, rueckgaengig,
} satisfies Record<string, Gen>;

export type AufgabenTyp = keyof typeof GENERATOREN;

/** Würfelt eine Aufgabe des Typs; `nicht` = Text, der gerade dran war. */
export function wuerfle(typ: AufgabenTyp, r: Zufall = Math.random, nicht?: string): Aufgabe {
  const texte = TEXTE.filter(t => t.titel !== nicht);
  const start = Math.floor(r() * texte.length);
  for (let i = 0; i < texte.length; i++) {
    const a = GENERATOREN[typ](texte[(start + i) % texte.length], r);
    if (a) return a;
  }
  throw new Error(`Keine Aufgabe für ${typ}`);
}

export function titelVon(a: Aufgabe): string {
  return TEXTE.find(t => a.text.startsWith(t.zeilen[0]))?.titel ?? "";
}

// ---------------------------------------------------------------- Lektionen

export type Lektion = {
  id: string;
  titel: string;
  icon: string;
  /** So geht's — Schritte mit [[Tasten]]. */
  schritte: string[];
  /** Ein Satz zum Mitnehmen (Word, Mail, …). */
  merke?: string;
  typen: AufgabenTyp[];
  /** Alle diese Techniken müssen benutzt werden. */
  verlangt: Technik[];
};

export const AUFGABEN_JE_LEKTION = 3;

export const LEKTIONEN: Lektion[] = [
  {
    id: "doppelklick", titel: "Doppelklick: ein Wort", icon: "✌️", typen: ["wortMarkieren"], verlangt: ["doppelklick"],
    schritte: ["Zeige mit der Maus auf das Wort.", "Klicke zweimal schnell hintereinander."],
    merke: "Das Leerzeichen dahinter wird oft mitmarkiert — das ist richtig so.",
  },
  {
    id: "dreifachklick", titel: "Dreifachklick: eine ganze Zeile", icon: "🤟", typen: ["zeileMarkieren"], verlangt: ["dreifachklick"],
    schritte: ["Zeige irgendwo in die Zeile.", "Klicke dreimal schnell hintereinander."],
    merke: "In Word und LibreOffice markiert der Dreifachklick den ganzen Absatz.",
  },
  {
    id: "ziehen", titel: "Ziehen: mehrere Wörter", icon: "🖱️", typen: ["mehrereWoerter"], verlangt: ["ziehen"],
    schritte: ["Zeige vor das erste Wort.", "Linke Maustaste drücken und festhalten.", "Bis hinter das letzte Wort ziehen, dann loslassen."],
  },
  {
    id: "umschaltklick", titel: "Umschalt + Klick: von hier bis da", icon: "🎯", typen: ["vonBis"], verlangt: ["umschaltklick"],
    schritte: ["Klicke vor das erste Wort.", "Halte [[Umschalt]] fest.", "Klicke hinter das letzte Wort."],
    merke: "Gut für lange Stücke, bei denen das Ziehen wackelt — der Text darf dazwischen sogar scrollen.",
  },
  {
    id: "pos1ende", titel: "Pos1 und Ende: an den Zeilenrand", icon: "⏮️", typen: ["cursorRand"], verlangt: ["pos1ende"],
    schritte: ["Der Cursor blinkt schon in der Zeile.", "[[Ende]] springt ans Zeilenende, [[Pos1]] an den Anfang."],
    merke: "[[Strg]] + [[Pos1]] springt an den Anfang des ganzen Textes, [[Strg]] + [[Ende]] ans Ende.",
  },
  {
    id: "umschaltPos1Ende", titel: "Umschalt + Pos1/Ende: bis zum Rand markieren", icon: "↔️", typen: ["bisZeilenende", "abZeilenanfang"], verlangt: ["umschaltPos1Ende"],
    schritte: ["Klicke an die Stelle, an der die Markierung anfangen soll.", "Halte [[Umschalt]] fest und drücke [[Ende]] (bis zum Zeilenende) oder [[Pos1]] (bis zum Anfang)."],
  },
  {
    id: "strgPfeil", titel: "Strg + Pfeil: Wort für Wort springen", icon: "🦘", typen: ["cursorVorWort"], verlangt: ["strgPfeil"],
    schritte: ["Halte [[Strg]] fest.", "Jedes [[→]] springt ein ganzes Wort weiter, [[←]] eins zurück."],
  },
  {
    id: "strgUmschaltPfeil", titel: "Strg + Umschalt + Pfeil: Wort für Wort markieren", icon: "🚀", typen: ["mehrereWoerterTastatur"], verlangt: ["strgUmschaltPfeil"],
    schritte: ["Der Cursor steht vor dem ersten Wort.", "Halte [[Strg]] und [[Umschalt]] fest.", "Drücke [[→]] so oft, wie Wörter markiert werden sollen."],
    merke: "Zu weit? Mit [[←]] (Strg und Umschalt weiter halten) wird die Markierung wieder kürzer.",
  },
  {
    id: "umschaltPfeil", titel: "Umschalt + Pfeil: Buchstabe für Buchstabe", icon: "🔤", typen: ["teilwort"], verlangt: ["umschaltPfeil"],
    schritte: ["Der Cursor steht vor dem Wort.", "Halte [[Umschalt]] fest.", "Jedes [[→]] markiert einen Buchstaben mehr."],
  },
  {
    id: "strgA", titel: "Strg + A: alles", icon: "📄", typen: ["allesMarkieren"], verlangt: ["strgA"],
    schritte: ["Klicke in den Text.", "Halte [[Strg]] fest und drücke [[A]]."],
    merke: "A wie »alles« — klappt in fast jedem Programm, auch im Explorer.",
  },
  {
    id: "loeschen", titel: "Entf und Rücktaste: löschen", icon: "🧹", typen: ["wortLoeschen", "zeileLoeschen"], verlangt: ["loeschen"],
    schritte: ["Markiere, was weg soll.", "Drücke [[Entf]] oder [[Rücktaste]]."],
    merke: "Ohne Markierung löscht [[Entf]] den Buchstaben rechts vom Cursor, [[Rücktaste]] den links davon.",
  },
  {
    id: "ersetzen", titel: "Überschreiben: markieren und tippen", icon: "✏️", typen: ["wortErsetzen"], verlangt: ["tippen"],
    schritte: ["Markiere das alte Wort (Doppelklick).", "Tippe einfach das neue Wort — das Markierte verschwindet von selbst."],
  },
  {
    id: "kopieren", titel: "Strg + C und Strg + V: kopieren", icon: "📋", typen: ["wortKopieren", "zeileKopieren"], verlangt: ["kopieren", "einfuegen"],
    schritte: ["Markiere den Text.", "[[Strg]] + [[C]] kopiert ihn in die Zwischenablage.", "Klicke an die Zielstelle (oder [[Ende]], dann [[Enter]] für eine neue Zeile).", "[[Strg]] + [[V]] fügt ihn ein."],
    merke: "Was in der Zwischenablage liegt, kannst du beliebig oft einfügen.",
  },
  {
    id: "ausschneiden", titel: "Strg + X: ausschneiden und verschieben", icon: "✂️", typen: ["zeileVerschieben", "wortVerschieben"], verlangt: ["ausschneiden", "einfuegen"],
    schritte: ["Markiere den Text.", "[[Strg]] + [[X]] schneidet ihn aus — er ist jetzt in der Zwischenablage.", "Klicke an die richtige Stelle.", "[[Strg]] + [[V]] fügt ihn dort ein."],
    merke: "X sieht aus wie eine geöffnete Schere.",
  },
  {
    id: "rueckgaengig", titel: "Strg + Z: rückgängig", icon: "↩️", typen: ["rueckgaengig"], verlangt: ["rueckgaengig"],
    schritte: ["Lösche die Zeile.", "Ups! Halte [[Strg]] fest und drücke [[Z]] — sie ist wieder da."],
    merke: "Strg + Z rettet fast alles. Mehrmals drücken geht mehrere Schritte zurück.",
  },
];

/** Die Aufgaben einer Lektion, reihum über ihre Typen. */
export function lektionsAufgaben(l: Lektion, r: Zufall = Math.random): Aufgabe[] {
  const out: Aufgabe[] = [];
  for (let i = 0; i < AUFGABEN_JE_LEKTION; i++) out.push(wuerfle(l.typen[i % l.typen.length], r, out[i - 1] && titelVon(out[i - 1])));
  return out;
}

// ---------------------------------------------------------------- Challenge

export type Modus = "markieren" | "bearbeiten" | "gemischt";

export const MODI: Record<Modus, { titel: string; icon: string; anzahl: number; typen: AufgabenTyp[]; text: string }> = {
  markieren: {
    titel: "Markier-Sprint", icon: "🖍️", anzahl: 10,
    typen: ["wortMarkieren", "zeileMarkieren", "mehrereWoerter", "bisZeilenende", "abZeilenanfang", "vonBis", "teilwort", "cursorRand", "allesMarkieren"],
    text: "Wörter, Zeilen, Stücke bis zum Zeilenrand, Cursor setzen — nur markieren, nichts ändern.",
  },
  bearbeiten: {
    titel: "Bearbeiten", icon: "✂️", anzahl: 8,
    typen: ["wortLoeschen", "zeileLoeschen", "wortErsetzen", "wortKopieren", "zeileKopieren", "zeileVerschieben", "wortVerschieben", "rueckgaengig"],
    text: "Löschen, überschreiben, kopieren, verschieben und rückgängig machen.",
  },
  gemischt: {
    titel: "Profi-Mix", icon: "🏆", anzahl: 12,
    typen: ["wortMarkieren", "zeileMarkieren", "mehrereWoerter", "bisZeilenende", "vonBis", "teilwort", "wortLoeschen", "zeileLoeschen", "wortErsetzen", "wortKopieren", "zeileVerschieben", "wortVerschieben", "rueckgaengig"],
    text: "Alles durcheinander — wie beim echten Arbeiten am Text.",
  },
};

/** Typen gemischt, aber jeder kommt dran, bevor sich einer wiederholt. */
export function challengeAufgaben(m: Modus, r: Zufall = Math.random): Aufgabe[] {
  const { anzahl, typen } = MODI[m];
  const reihe: AufgabenTyp[] = [];
  while (reihe.length < anzahl) {
    const runde = [...typen];
    for (let i = runde.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [runde[i], runde[j]] = [runde[j], runde[i]];
    }
    reihe.push(...runde);
  }
  const out: Aufgabe[] = [];
  for (const typ of reihe.slice(0, anzahl)) out.push(wuerfle(typ, r, out.length ? titelVon(out[out.length - 1]) : undefined));
  return out;
}

/** Strafzeit fürs Überspringen. */
export const STRAFE_MS = 15000;
