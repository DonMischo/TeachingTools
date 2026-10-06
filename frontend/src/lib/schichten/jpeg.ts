/**
 * Liest die Abschnitte einer JPEG-Datei — so weit, dass man im Hex-Bild
 * zeigen kann, wo Anfang, Bildgröße und Quantisierungstabelle stehen.
 * Jeder Abschnitt beginnt mit FF und einer Kennung (Marker).
 */

export interface Abschnitt {
  marker: number;
  name: string;
  erkl: string;
  von: number;
  laenge: number;
}

const NAMEN: Record<number, [string, string]> = {
  0xd8: ["SOI", "Start: Hier beginnt ein JPEG-Bild"],
  0xe0: ["APP0 (JFIF)", "Kennzeichnung als JFIF-Datei, dazu die Auflösung"],
  0xe1: ["APP1 (Exif)", "Kameradaten: Modell, Datum, manchmal GPS-Ort"],
  0xdb: ["DQT", "Quantisierungstabelle: wie grob jede Bildfrequenz gespeichert wird"],
  0xc0: ["SOF0", "Bildkopf: Höhe, Breite, Farbanteile"],
  0xc2: ["SOF2", "Bildkopf (progressiv): Höhe, Breite, Farbanteile"],
  0xc4: ["DHT", "Huffman-Tabelle: kurze Codes für häufige Werte"],
  0xda: ["SOS", "Ab hier kommen die eigentlichen Bilddaten"],
  0xd9: ["EOI", "Ende des Bildes"],
};

export function abschnitte(b: Uint8Array): Abschnitt[] {
  const aus: Abschnitt[] = [];
  if (b[0] !== 0xff || b[1] !== 0xd8) return aus;
  aus.push({ marker: 0xd8, name: NAMEN[0xd8][0], erkl: NAMEN[0xd8][1], von: 0, laenge: 2 });
  let o = 2;
  while (o + 4 <= b.length && b[o] === 0xff) {
    const m = b[o + 1];
    const l = (b[o + 2] << 8) | b[o + 3];
    const [name, erkl] = NAMEN[m] ?? [`FF ${m.toString(16).toUpperCase()}`, "weiterer Abschnitt"];
    aus.push({ marker: m, name, erkl, von: o, laenge: 2 + l });
    if (m === 0xda) break;
    o += 2 + l;
  }
  return aus;
}

/** Höhe und Breite aus dem Bildkopf (SOF0/SOF2) */
export function groesse(b: Uint8Array): { breite: number; hoehe: number; von: number } | null {
  const s = abschnitte(b).find(a => a.marker === 0xc0 || a.marker === 0xc2);
  if (!s) return null;
  const o = s.von + 5;
  return { hoehe: (b[o] << 8) | b[o + 1], breite: (b[o + 2] << 8) | b[o + 3], von: o };
}

/** Erste Quantisierungstabelle (64 Werte, Zickzack-Reihenfolge) als 8×8, Zeile für Zeile */
export function quantisierung(b: Uint8Array): number[][] | null {
  const s = abschnitte(b).find(a => a.marker === 0xdb);
  if (!s || (b[s.von + 4] >> 4) !== 0) return null;
  const werte = b.subarray(s.von + 5, s.von + 5 + 64);
  const zickzack = [
    0, 1, 5, 6, 14, 15, 27, 28, 2, 4, 7, 13, 16, 26, 29, 42, 3, 8, 12, 17, 25, 30, 41, 43, 9, 11, 18, 24, 31, 40, 44, 53,
    10, 19, 23, 32, 39, 45, 52, 54, 20, 22, 33, 38, 46, 51, 55, 60, 21, 34, 37, 47, 50, 56, 59, 61, 35, 36, 48, 49, 57, 58, 62, 63,
  ];
  return Array.from({ length: 8 }, (_, z) => Array.from({ length: 8 }, (_, sp) => werte[zickzack[z * 8 + sp]]));
}
