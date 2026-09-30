/**
 * Text für jsPDF mit der eingebauten Schrift (Helvetica, nur Windows-1252):
 * Hochzahlen, Minuszeichen und Zeichen außerhalb werden in darstellbare
 * übersetzt. Genutzt vom Sonnensystem-Kodex und der TaskCrawler-Ergebnissicherung.
 */
const HOCH: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
/** Geschützte und schmale Leerzeichen, als Zeichencodes. */
const LEERZEICHEN = [0xa0, 0x202f, 0x2009];
const WINDOWS_1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Übersetzt Text in Zeichen, die die PDF-Standardschrift kennt. */
export function fuerPdf(text: string): string {
  const ersetzt = text
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, m => `^${[...m].map(c => HOCH[c]).join("")}`)
    .replace(/[−‒]/g, "-")
    .replace(/≈/g, "ca. ")
    .replace(/→/g, "->");
  return nurWindows1252(ersetzt);
}

/** Nur die Zeichen behalten, die Windows-1252 kennt (¹ ² ³ · × ÷ ½ gehören dazu); Leerzeichen vereinheitlichen. */
export function nurWindows1252(text: string): string {
  // Zeichen per Code prüfen statt per Regex-Bereich: getippte Escapes landen hier sonst als echte Steuerzeichen.
  return [...text]
    .map(c => (LEERZEICHEN.includes(c.charCodeAt(0)) ? " " : c))
    .filter(c => c.charCodeAt(0) === 10 || (c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0xff) || WINDOWS_1252_EXTRA.includes(c))
    .join("")
    .replace(/ {2,}/g, " ")
    .trim();
}
