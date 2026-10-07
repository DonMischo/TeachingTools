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
  [1024, 600], [1024, 768], [1152, 864], [1280, 720], [1280, 768], [1280, 800], [1280, 960],
  [1280, 1024], [1360, 768], [1366, 768], [1400, 1050], [1440, 900], [1536, 864], [1600, 900],
  [1600, 1200], [1680, 1050], [1920, 1080], [1920, 1200], [1920, 1280], [2048, 1152], [2048, 1536],
  [2160, 1440], [2240, 1400], [2256, 1504], [2496, 1664], [2560, 1080], [2560, 1440], [2560, 1600],
  [2560, 1700], [2736, 1824], [2880, 1800], [2880, 1920], [3000, 2000], [3200, 1800], [3440, 1440],
  [3456, 2160], [3840, 1600], [3840, 2160], [3840, 2400], [5120, 1440], [5120, 2880],
];

/** Übliche Seitenverhältnisse: 16:9, 16:10, 4:3, 5:4, 3:2, 21:9 (bzw. 64:27 und 43:18). */
const VERHAELTNISSE: readonly [number, number][] = [
  [16, 9], [16, 10], [4, 3], [5, 4], [3, 2], [21, 9], [64, 27], [43, 18],
];

const TOLERANZ = 2;

function nah(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANZ;
}

/** Ein übliches Bildschirmformat in Bildschirmgröße — auch Auflösungen, die in der Liste fehlen. */
function istBildschirmformat(breite: number, hoehe: number): boolean {
  if (breite < 1024 || hoehe < 600) return false;
  // Strenger als bei der Liste: sonst ginge jeder Ausschnitt durch, der zufällig fast 16:9 ist.
  return VERHAELTNISSE.some(([w, h]) => Math.abs((breite * h) / w - hoehe) <= 1);
}

/**
 * Sieht das Bild aus wie ein ganzer Bildschirm — eine der typischen
 * Auflösungen, ein übliches Seitenverhältnis in Bildschirmgröße, oder zwei
 * davon mit gleicher Höhe nebeneinander (Mehrschirm-Aufnahme, z. B. 3840×1080)?
 */
export function istBildschirmgroesse(breite: number, hoehe: number): boolean {
  if (AUFLOESUNGEN.some(([w, h]) => nah(w, breite) && nah(h, hoehe))) return true;
  if (istBildschirmformat(breite, hoehe)) return true;
  const passendeHoehe = AUFLOESUNGEN.filter(([, h]) => nah(h, hoehe)).map(([w]) => w);
  return passendeHoehe.some(w1 => passendeHoehe.some(w2 => nah(w1 + w2, breite)));
}
