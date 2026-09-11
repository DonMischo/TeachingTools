/**
 * Reine Logik für Stufe »Bildschirmfoto«: aus einem Einfüge- oder
 * Ablage-Ereignis das erste Bild herausfischen, und erkennen, ob stattdessen
 * nur Text ankam.
 *
 * Bewusst lose an `DataTransfer` angelehnt (nicht der Typ selbst), damit sich
 * Tests ohne echtes Zwischenablage-Objekt schreiben lassen.
 */

export type DatenTeil = { kind: string; type: string; getAsFile?: () => File | null };

export type DatenQuelle = {
  items?: ArrayLike<DatenTeil>;
  files?: ArrayLike<File>;
};

/** Das erste Bild aus Zwischenablage- oder Ablage-Daten — oder null. */
export function bildAusDaten(daten: DatenQuelle): File | null {
  if (daten.items) {
    for (const teil of Array.from(daten.items)) {
      if (teil.kind === "file" && teil.type.startsWith("image/")) {
        const datei = teil.getAsFile?.();
        if (datei) return datei;
      }
    }
  }
  if (daten.files) {
    for (const datei of Array.from(daten.files)) {
      if (datei.type.startsWith("image/")) return datei;
    }
  }
  return null;
}

/** War es (nur) Text — kein Bild dabei? */
export function istText(daten: DatenQuelle): boolean {
  if (bildAusDaten(daten)) return false;
  if (daten.items) {
    return Array.from(daten.items).some(teil => teil.kind === "string" && teil.type.startsWith("text/"));
  }
  return false;
}

/** Sind zwei Bildmaße genau gleich? Für die Warnung bei Aufgabe 2. */
export function groesseGleich(a: { width: number; height: number }, b: { width: number; height: number }): boolean {
  return a.width === b.width && a.height === b.height;
}
