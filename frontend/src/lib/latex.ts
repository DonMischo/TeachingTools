/**
 * LaTeX-Eingabe für Gleichungen und Formeln.
 *
 * Statt einen zweiten Parser zu bauen, wird LaTeX auf die Schreibweise
 * heruntergebrochen, die die Tokenizer in gleichung.ts und formel.ts ohnehin
 * lesen: \cdot wird ·, \frac{a}{b} wird a/b, geschweifte Klammern fallen weg.
 * Was danach übrig bleibt und keinen Sinn ergibt, meldet der jeweilige Parser
 * mit seiner eigenen Fehlermeldung.
 */

type Group = { body: string; end: number };

/** Liest eine geschweifte Gruppe ab `from` — mit Verschachtelung. */
function readGroup(s: string, from: number): Group | null {
  let i = from;
  while (i < s.length && /\s/.test(s[i])) i++;
  if (s[i] !== "{") return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}") {
      depth--;
      if (depth === 0) return { body: s.slice(i + 1, j), end: j + 1 };
    }
  }
  return null;
}

/** Klammern nur setzen, wenn im Zähler/Nenner wirklich eine Summe steht. */
const wrap = (body: string): string => {
  const t = body.trim();
  return /[+\-−]/.test(t.replace(/^[+\-−]/, "")) ? `(${t})` : t;
};

function expandFrac(src: string): string {
  let s = src;
  for (let guard = 0; guard < 40; guard++) {
    const i = s.indexOf("\\frac");
    if (i < 0) return s;
    const num = readGroup(s, i + 5);
    if (!num) return s;
    const den = readGroup(s, num.end);
    if (!den) return s;
    s = `${s.slice(0, i)}${wrap(num.body)}/${wrap(den.body)}${s.slice(den.end)}`;
  }
  return s;
}

/** Erkennt, ob überhaupt LaTeX im Spiel ist — für Hinweise in der Oberfläche. */
export const looksLikeLatex = (src: string): boolean => /\\|\$|\{/.test(src);

/**
 * Macht aus LaTeX die einfache Schreibweise. Unbekannte Makros bleiben stehen,
 * damit der Parser sie benennen kann, statt sie stillschweigend zu schlucken.
 */
export function fromLatex(src: string): string {
  let s = src.trim();
  if (!looksLikeLatex(s)) return s;

  // Mathe-Umgebungen abstreifen: $…$, $$…$$, \(…\), \[…\]
  s = s.replace(/^\$\$([\s\S]*)\$\$$/, "$1").replace(/^\$([\s\S]*)\$$/, "$1");
  s = s.replace(/\\[([]/g, "").replace(/\\[)\]]/g, "");

  s = s.replace(/\\(?:mathrm|mathit|text|operatorname)\s*\{([^{}]*)\}/g, "$1");
  s = expandFrac(s);

  s = s
    .replace(/\\left|\\right/g, "")
    .replace(/\\cdot|\\times/g, "·")
    .replace(/\\div/g, ":")
    .replace(/\\quad|\\qquad/g, " ")
    .replace(/\\[,;!:]/g, "") // Abstandsmakros
    .replace(/[{}]/g, "");    // x^{2} → x^2, Reste von \mathrm & Co.

  return s.replace(/\s+/g, " ").trim();
}

// ── Ausgabe ───────────────────────────────────────────────────────────────────

/** Zahl für LaTeX: deutsches Komma braucht {,}, sonst setzt KaTeX zu viel Luft. */
export const numToLatex = (formatted: string): string =>
  formatted.replace("−", "-").replace(",", "{,}");
