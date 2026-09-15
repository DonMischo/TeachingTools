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

/** Typische Bildschirmauflösungen (Breite × Höhe) für Aufgabe 2. */
const AUFLOESUNGEN: readonly [number, number][] = [
  [1280, 720], [1280, 800], [1280, 1024], [1360, 768], [1366, 768], [1440, 900],
  [1536, 864], [1600, 900], [1680, 1050], [1920, 1080], [1920, 1200], [2256, 1504],
  [2560, 1080], [2560, 1440], [2560, 1600], [2880, 1800], [3000, 2000], [3440, 1440],
  [3840, 2160],
];

const TOLERANZ = 2;

function nah(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANZ;
}

/**
 * Sieht das Bild aus wie ein ganzer Bildschirm — eine der typischen
 * Auflösungen, oder zwei davon mit gleicher Höhe nebeneinander
 * (Mehrschirm-Aufnahme, z. B. 3840×1080)?
 */
export function istBildschirmgroesse(breite: number, hoehe: number): boolean {
  if (AUFLOESUNGEN.some(([w, h]) => nah(w, breite) && nah(h, hoehe))) return true;
  const passendeHoehe = AUFLOESUNGEN.filter(([, h]) => nah(h, hoehe)).map(([w]) => w);
  return passendeHoehe.some(w1 => passendeHoehe.some(w2 => nah(w1 + w2, breite)));
}
