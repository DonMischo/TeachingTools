/**
 * Syntaxfarben für D2 im Code-Modus — Zeile für Zeile, ohne Bibliothek.
 *
 * Es geht nur ums Lesen: Schlüssel vor dem Doppelpunkt, Werte danach,
 * reservierte Wörter (shape, style.fill …), Pfeile, Zeichenketten, Kommentare.
 * Ein Fehler hier verfärbt höchstens etwas, am Code ändert er nichts.
 */

export type Art = "kommentar" | "text" | "pfeil" | "klammer" | "satzzeichen" | "reserviert" | "schluessel" | "wert" | "zahl" | "leer";

export interface Stueck { text: string; art: Art; farbe?: string }

const RESERVIERT = new Set([
  "label", "shape", "style", "icon", "near", "width", "height", "tooltip", "link", "direction",
  "vars", "d2-config", "theme-id", "dark-theme-id", "sketch", "layout-engine", "pad", "center",
  "fill", "stroke", "font-color", "font-size", "stroke-dash", "stroke-width", "border-radius",
  "bold", "italic", "underline", "shadow", "opacity", "3d", "multiple", "animated", "double-border",
  "class", "classes", "layers", "scenarios", "steps", "grid-rows", "grid-columns", "constraint",
  "source-arrowhead", "target-arrowhead", "null", "true", "false",
]);

const MUSTER = /(#.*)|("(?:[^"\\]|\\.)*"?|'[^']*'?)|(<->|->|<-|--)|([{}[\]])|([:;])|(\s+)|([^\s#"'{}[\]:;]+?(?=<->|->|<-|--|[\s#"'{}[\]:;]|$))/gy;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function zeileHervorheben(zeile: string): Stueck[] {
  const out: Stueck[] = [];
  let nachDoppelpunkt = false;
  MUSTER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (MUSTER.lastIndex < zeile.length && (m = MUSTER.exec(zeile))) {
    const [t, kommentar, text, pfeil, klammer, zeichen, leer, wort] = m;
    if (kommentar) out.push({ text: t, art: "kommentar" });
    else if (text) {
      const innen = text.slice(1, -1);
      out.push({ text: t, art: "text", farbe: HEX.test(innen) ? innen : undefined });
    } else if (pfeil) out.push({ text: t, art: "pfeil" });
    else if (klammer) { out.push({ text: t, art: "klammer" }); nachDoppelpunkt = false; }
    else if (zeichen) { out.push({ text: t, art: "satzzeichen" }); nachDoppelpunkt = zeichen === ":"; }
    else if (leer) out.push({ text: t, art: "leer" });
    else if (wort) {
      if (nachDoppelpunkt) {
        out.push({ text: t, art: /^-?\d+(\.\d+)?$/.test(t) ? "zahl" : RESERVIERT.has(t) ? "reserviert" : "wert" });
      } else {
        // Pfade wie a.style.fill: reservierte Teile eigens färben
        t.split(/(\.)/).forEach(teil => {
          if (!teil) return;
          out.push({ text: teil, art: teil === "." ? "satzzeichen" : RESERVIERT.has(teil.toLowerCase()) ? "reserviert" : "schluessel" });
        });
      }
    } else {
      out.push({ text: t, art: "wert" });
    }
  }
  if (MUSTER.lastIndex < zeile.length) out.push({ text: zeile.slice(MUSTER.lastIndex), art: "wert" });
  return out;
}

/** KI-Antworten kommen oft im Markdown-Codeblock — beim Einfügen nur den Code nehmen. */
export function codeAusAntwort(text: string): string {
  const m = /```[^\n]*\n([\s\S]*?)```/.exec(text);
  return m ? m[1] : text;
}
