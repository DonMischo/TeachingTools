/**
 * »Vorführen«: der Profi-Weg einer Aufgabe als Folge von Schritten — wohin der
 * Zeiger fährt, welche Maustaste bzw. Tasten gedrückt sind und wie Auswahl und
 * Text danach aussehen. Rein rechnend; das Textfeld rechnet die
 * Zeichenpositionen in Bildschirmorte um und spielt die Schritte mit der
 * Vorführ-Bühne des Maus-Führerscheins ab.
 */
import { kern, woerter, zeilenStarts, type Aufgabe, type Bereich } from "./aufgaben";

export type VorfuehrSchritt = {
  text: string;
  /** Zeichenposition, auf die der Zeiger fährt. */
  zeiger?: number;
  taste?: "links" | "doppel" | "halten";
  /** Gedrückte Tasten als KeyboardEvent.code. */
  tasten?: string[];
  /** Auswahl nach dem Schritt (von = bis: nur der Cursor). */
  auswahl?: Bereich;
  /** Text nach dem Schritt. */
  wert?: string;
  ms?: number;
};

const STRG = "ControlLeft", UMSCHALT = "ShiftLeft";
const cursor = (p: number): Bereich => ({ von: p, bis: p });
const mitte = (b: Bereich) => Math.floor((b.von + b.bis) / 2);

/** Gemeinsamer Anfang und gemeinsames Ende zweier Texte: was dazwischen steht, ist anders. */
export function unterschied(a: string, b: string): { von: number; bisA: number; bisB: number } {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return { von: p, bisA: a.length - s, bisB: b.length - s };
}

/** Die Zeile, in der `pos` steht — mit dem Zeilenumbruch dahinter, falls es einen gibt. */
function zeileUm(text: string, pos: number, mitUmbruch = false): Bereich {
  const von = text.lastIndexOf("\n", pos - 1) + 1;
  const ende = text.indexOf("\n", pos);
  const bis = ende < 0 ? text.length : ende;
  return { von, bis: mitUmbruch && ende >= 0 ? bis + 1 : bis };
}

/** Wortenden bzw. Wortanfänge im Stück `b` (für Ziehen und Strg + Pfeil). */
function wortGrenzen(text: string, b: Bereich): { anfang: number; ende: number }[] {
  return [...text.slice(b.von, b.bis).matchAll(/[\p{L}\p{N}]+/gu)]
    .map(m => ({ anfang: b.von + m.index!, ende: b.von + m.index! + m[0].length }));
}

const wortIn = (text: string, b: Bereich) => `»${text.slice(b.von, b.bis)}«`;

function auswahlSchritte(a: Aufgabe, ziel: Bereich): VorfuehrSchritt[] {
  const t = a.text;
  const z = kern(t, ziel);
  switch (a.typ) {
    case "wortMarkieren":
      return [
        { text: `Zeige mit der Maus auf ${wortIn(t, z)}.`, zeiger: mitte(z), ms: 2200 },
        { text: "Doppelklick — das Wort ist markiert.", zeiger: mitte(z), taste: "doppel", auswahl: ziel },
      ];
    case "zeileMarkieren":
      return [
        { text: "Zeige irgendwo in die Zeile.", zeiger: mitte(z), ms: 2200 },
        { text: "Dreifachklick — die ganze Zeile ist markiert.", zeiger: mitte(z), taste: "doppel", auswahl: ziel },
      ];
    case "mehrereWoerter":
      return [
        { text: "Zeige direkt vor das erste Wort.", zeiger: z.von, ms: 2200 },
        { text: "Linke Taste drücken und festhalten …", zeiger: z.von, taste: "halten", auswahl: cursor(z.von), ms: 1800 },
        ...wortGrenzen(t, z).map(w => ({
          text: "… und ziehen, bis alles markiert ist.", zeiger: w.ende, taste: "halten" as const, auswahl: { von: z.von, bis: w.ende }, ms: 1300,
        })),
        { text: "Loslassen — fertig.", zeiger: z.bis, auswahl: z, ms: 2000 },
      ];
    case "mehrereWoerterTastatur":
      return [
        { text: "Der Cursor steht schon vor dem ersten Wort. Halte Strg und Umschalt fest.", tasten: [STRG, UMSCHALT], auswahl: cursor(z.von), ms: 2500 },
        ...wortGrenzen(t, z).map(w => ({
          text: "Jedes → markiert ein Wort mehr.", tasten: [STRG, UMSCHALT, "ArrowRight"], auswahl: { von: z.von, bis: w.ende }, ms: 1600,
        })),
      ];
    case "bisZeilenende":
      return [
        { text: `Klicke direkt vor ${wortIn(t, wortGrenzen(t, z).map(w => ({ von: w.anfang, bis: w.ende }))[0] ?? z)}.`, zeiger: z.von, taste: "links", auswahl: cursor(z.von) },
        { text: "Umschalt festhalten und Ende drücken — markiert bis zum Zeilenende.", tasten: [UMSCHALT, "End"], auswahl: ziel },
      ];
    case "abZeilenanfang":
      return [
        { text: "Klicke direkt hinter das letzte Wort.", zeiger: z.bis, taste: "links", auswahl: cursor(z.bis) },
        { text: "Umschalt festhalten und Pos1 drücken — markiert bis zum Zeilenanfang.", tasten: [UMSCHALT, "Home"], auswahl: { von: z.bis, bis: z.von } },
      ];
    case "vonBis":
      return [
        { text: "Klicke direkt vor das erste Wort.", zeiger: z.von, taste: "links", auswahl: cursor(z.von) },
        { text: "Halte Umschalt fest …", zeiger: z.von, tasten: [UMSCHALT], ms: 1800 },
        { text: "… und klicke hinter das letzte Wort.", zeiger: z.bis, taste: "links", tasten: [UMSCHALT], auswahl: z },
      ];
    case "allesMarkieren":
      return [
        { text: "Klicke irgendwo in den Text.", zeiger: Math.min(4, t.length), taste: "links", auswahl: cursor(Math.min(4, t.length)) },
        { text: "Strg + A — alles ist markiert.", tasten: [STRG, "KeyA"], auswahl: ziel },
      ];
    case "teilwort": {
      const n = ziel.bis - ziel.von;
      return [
        { text: "Der Cursor steht vor dem Wort. Halte Umschalt fest.", tasten: [UMSCHALT], auswahl: cursor(ziel.von), ms: 2200 },
        ...Array.from({ length: n }, (_, i) => ({
          text: `Jedes → markiert einen Buchstaben mehr (${i + 1} von ${n}).`, tasten: [UMSCHALT, "ArrowRight"], auswahl: { von: ziel.von, bis: ziel.von + i + 1 }, ms: 1100,
        })),
      ];
    }
    default:
      return [];
  }
}

function cursorSchritte(a: Aufgabe, pos: number): VorfuehrSchritt[] {
  const start = a.start?.von ?? 0;
  if (a.typ === "cursorVorWort") {
    const ziele = wortGrenzen(a.text, { von: start + 1, bis: pos + 1 }).map(w => w.anfang).filter(p => p > start && p <= pos);
    return [
      { text: "Halte Strg fest.", tasten: [STRG], auswahl: cursor(start), ms: 2000 },
      ...ziele.map(p => ({ text: "Jedes → springt ein ganzes Wort weiter.", tasten: [STRG, "ArrowRight"], auswahl: cursor(p), ms: 1600 })),
    ];
  }
  const ende = pos > start;
  return [
    { text: "Der Cursor blinkt schon in der Zeile.", auswahl: cursor(start), ms: 2000 },
    { text: ende ? "Ende — der Cursor springt ans Zeilenende." : "Pos1 — der Cursor springt an den Zeilenanfang.", tasten: [ende ? "End" : "Home"], auswahl: cursor(pos) },
  ];
}

const KOPIEREN = [STRG, "KeyC"], AUSSCHNEIDEN = [STRG, "KeyX"], EINFUEGEN = [STRG, "KeyV"];

function textSchritte(a: Aufgabe, ergebnis: string): VorfuehrSchritt[] {
  const t = a.text;
  const d = unterschied(t, ergebnis);
  switch (a.typ) {
    case "wortLoeschen": {
      const weg = kern(t, { von: d.von, bis: d.bisA });
      return [
        { text: `Doppelklick auf ${wortIn(t, weg)} markiert es.`, zeiger: mitte(weg), taste: "doppel", auswahl: { von: d.von, bis: d.bisA } },
        { text: "Entf löscht das Markierte.", tasten: ["Delete"], wert: ergebnis, auswahl: cursor(d.von) },
      ];
    }
    case "zeileLoeschen": {
      const zeile = zeileUm(t, d.von, true);
      return [
        { text: "Dreifachklick in die Zeile markiert sie ganz.", zeiger: mitte(zeileUm(t, d.von)), taste: "doppel", auswahl: zeile },
        { text: "Entf löscht sie.", tasten: ["Delete"], wert: ergebnis, auswahl: cursor(zeile.von) },
      ];
    }
    case "wortErsetzen": {
      // Ein gemeinsamer Anfangsbuchstabe gehört trotzdem zum alten Wort.
      const w = woerter(t.split("\n")).find(x => x.von <= d.von && x.bis >= d.bisA)!;
      const neuBis = w.bis + (ergebnis.length - t.length);
      return [
        { text: `Doppelklick auf ${wortIn(t, w)} markiert es.`, zeiger: mitte(w), taste: "doppel", auswahl: w },
        { text: `Einfach »${ergebnis.slice(w.von, neuBis)}« tippen — das Markierte verschwindet von selbst.`, wert: ergebnis, auswahl: cursor(neuBis) },
      ];
    }
    case "zeileKopieren": {
      const zeilen = t.split("\n");
      const n = zeilen.indexOf(ergebnis.split("\n").at(-1)!);
      const s = zeilenStarts(zeilen)[n];
      const zeile = { von: s, bis: s + zeilen[n].length };
      return [
        { text: "Dreifachklick markiert die Zeile.", zeiger: mitte(zeile), taste: "doppel", auswahl: zeile },
        { text: "Strg + C kopiert sie in die Zwischenablage.", tasten: KOPIEREN },
        { text: "Strg + Ende springt ans Ende des Textes.", tasten: [STRG, "End"], auswahl: cursor(t.length) },
        { text: "Enter macht eine neue Zeile.", tasten: ["Enter"], wert: t + "\n", auswahl: cursor(t.length + 1) },
        { text: "Strg + V fügt die Zeile ein.", tasten: EINFUEGEN, wert: ergebnis, auswahl: cursor(ergebnis.length) },
      ];
    }
    case "wortKopieren": {
      const wort = ergebnis.slice(d.von, d.bisB).trim();
      const quelle = woerter(t.split("\n")).find(x => x.wort === wort)!;
      const mitLeer = t.slice(0, d.von) + " " + t.slice(d.von);
      return [
        { text: `Doppelklick auf ${wortIn(t, quelle)} markiert es.`, zeiger: mitte(quelle), taste: "doppel", auswahl: quelle },
        { text: "Strg + C kopiert es.", tasten: KOPIEREN },
        { text: "Klicke ans Ende der Zeile.", zeiger: d.von, taste: "links", auswahl: cursor(d.von) },
        { text: "Ein Leerzeichen tippen …", tasten: ["Space"], wert: mitLeer, auswahl: cursor(d.von + 1) },
        { text: "… und Strg + V fügt das Wort ein.", tasten: EINFUEGEN, wert: ergebnis, auswahl: cursor(d.bisB) },
      ];
    }
    case "zeileVerschieben": {
      const f = t.split("\n");
      for (let i = 0; i < f.length; i++) {
        const ohne = f.filter((_, k) => k !== i);
        for (let j = 0; j <= ohne.length; j++) {
          if ([...ohne.slice(0, j), f[i], ...ohne.slice(j)].join("\n") !== ergebnis) continue;
          const s = zeilenStarts(f)[i];
          // Die letzte Zeile hat keinen Umbruch dahinter — dann den davor mitnehmen.
          const weg = i < f.length - 1 ? { von: s, bis: s + f[i].length + 1 } : { von: s - 1, bis: s + f[i].length };
          const zwischen = ohne.join("\n");
          const amEnde = j === ohne.length;
          const ziel = amEnde ? zwischen.length : zeilenStarts(ohne)[j];
          return [
            { text: "Dreifachklick markiert die verrutschte Zeile.", zeiger: mitte({ von: s, bis: s + f[i].length }), taste: "doppel", auswahl: weg },
            { text: "Strg + X schneidet sie aus.", tasten: AUSSCHNEIDEN, wert: zwischen, auswahl: cursor(Math.min(weg.von, zwischen.length)) },
            amEnde
              ? { text: "Klicke ans Textende und mach mit Enter eine neue Zeile.", zeiger: ziel, taste: "links", wert: zwischen + "\n", auswahl: cursor(ziel + 1) }
              : { text: "Klicke an den Anfang der Zeile, vor die sie gehört.", zeiger: ziel, taste: "links", auswahl: cursor(ziel) },
            { text: "Strg + V fügt sie dort ein.", tasten: EINFUEGEN, wert: ergebnis, auswahl: cursor(ziel + f[i].length + 1) },
          ];
        }
      }
      return [];
    }
    case "wortVerschieben": {
      const f = t.split("\n"), o = ergebnis.split("\n");
      const z = f.findIndex((x, i) => x !== o[i]);
      const s = zeilenStarts(f)[z];
      const ws = f[z].split(" ");
      for (let k = 0; k < ws.length; k++) {
        const rest = ws.filter((_, i) => i !== k);
        for (let m = 0; m <= rest.length; m++) {
          if ([...rest.slice(0, m), ws[k], ...rest.slice(m)].join(" ") !== o[z]) continue;
          const vor = ws.slice(0, k).join(" ").length + (k > 0 ? 1 : 0);
          const wort = { von: s + vor, bis: s + vor + ws[k].length };
          const weg = { von: wort.von, bis: Math.min(wort.bis + 1, s + f[z].length) };
          const zwischen = t.slice(0, weg.von) + t.slice(weg.bis);
          const ziel = s + rest.slice(0, m).join(" ").length;
          return [
            { text: `Doppelklick auf ${wortIn(t, wort)} markiert es.`, zeiger: mitte(wort), taste: "doppel", auswahl: weg },
            { text: "Strg + X schneidet es aus.", tasten: AUSSCHNEIDEN, wert: zwischen, auswahl: cursor(weg.von) },
            { text: `Klicke direkt hinter »${rest[m - 1] ?? ""}«.`, zeiger: ziel, taste: "links", auswahl: cursor(ziel) },
            { text: "Strg + V fügt es dort ein (die Leerzeichen räumt das Programm hier selbst auf).", tasten: EINFUEGEN, wert: ergebnis, auswahl: cursor(ziel + ws[k].length + 1) },
          ];
        }
      }
      return [];
    }
    default:
      return [];
  }
}

export function vorfuehrung(a: Aufgabe): VorfuehrSchritt[] {
  const p = a.pruefung;
  if (p.art === "auswahl") return auswahlSchritte(a, p.ziel);
  if (p.art === "cursor") return cursorSchritte(a, p.pos);
  if (p.art === "text") return textSchritte(a, p.ergebnis);
  // rückgängig: Zeile löschen, dann zurückholen
  const d = unterschied(a.text, p.zwischen);
  const zeile = zeileUm(a.text, d.von, true);
  return [
    { text: "Dreifachklick markiert die Zeile.", zeiger: mitte(zeileUm(a.text, d.von)), taste: "doppel", auswahl: zeile },
    { text: "Entf löscht sie.", tasten: ["Delete"], wert: p.zwischen, auswahl: cursor(zeile.von) },
    { text: "Ups! Strg + Z holt sie zurück.", tasten: [STRG, "KeyZ"], wert: a.text, auswahl: zeile },
  ];
}
