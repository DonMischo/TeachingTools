/**
 * Text in die Zwischenablage. `navigator.clipboard` gibt es nur auf https (und
 * localhost) — die Schulinstallation läuft oft über http im LAN. Dann bleibt
 * der alte Weg über ein unsichtbares Textfeld und `execCommand("copy")`.
 * Liefert false, wenn beides nicht ging; dann soll die Seite den Text zum
 * Markieren zeigen.
 */
export async function kopiereText(text: string): Promise<boolean> {
  if (typeof window !== "undefined" && window.isSecureContext && navigator.clipboard) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* weiter mit dem alten Weg */ }
  }
  if (typeof document === "undefined") return false;
  const feld = document.createElement("textarea");
  feld.value = text;
  feld.setAttribute("readonly", "");
  feld.style.position = "fixed";
  feld.style.opacity = "0";
  document.body.appendChild(feld);
  feld.select();
  try { return document.execCommand("copy"); } catch { return false; } finally { feld.remove(); }
}
