/**
 * Schicht 1: Wie Bits zu einem Signal werden — vereinfacht, je Medium ein
 * typisches Verfahren:
 *   Kupfer: Manchester-Code wie im ersten Ethernet (1 = Flanke nach oben,
 *           0 = Flanke nach unten, immer in der Bitmitte)
 *   Glas:   Licht an / aus (On-Off-Keying)
 *   Funk:   Phasenumtastung (BPSK): bei einer 0 springt die Welle um eine
 *           halbe Schwingung
 * Echte Leitungen packen mehrere Bits in ein Symbol (PAM, QAM).
 */
import type { Medium } from "./route";

export const VERFAHREN: Record<Medium, { name: string; text: string }> = {
  kupfer: { name: "Manchester-Code", text: "1 = Spannung springt in der Bitmitte nach oben, 0 = nach unten. So hört der Empfänger auch bei langen Nullen-Reihen den Takt. Heutige Leitungen nutzen mehrere Spannungsstufen und viele Frequenzen gleichzeitig." },
  see: { name: "Licht an / aus", text: "1 = Laser an, 0 = Laser aus — milliardenfach pro Sekunde. Moderne Seekabel schicken viele Farben (Wellenlängen) gleichzeitig durch eine Faser." },
  glas: { name: "Licht an / aus", text: "1 = Laser an, 0 = Laser aus — milliardenfach pro Sekunde. Moderne Glasfasern schicken viele Farben (Wellenlängen) gleichzeitig durch eine Faser." },
  funk: { name: "Phasenumtastung", text: "Die Funkwelle schwingt gleichmäßig; bei einer 0 springt sie um eine halbe Schwingung. WLAN nutzt in Wahrheit bis zu 1024 Stufen aus Phase und Stärke (QAM) — 10 Bit pro Symbol." },
};

/** Bits der ersten Bytes. Ethernet schickt jedes Byte mit dem niedrigsten Bit zuerst (`leitung`). */
export function bitsVon(b: Uint8Array, anzahlBytes: number, leitung = false): number[] {
  const aus: number[] = [];
  for (let i = 0; i < Math.min(anzahlBytes, b.length); i++) {
    for (let k = 0; k < 8; k++) aus.push((b[i] >> (leitung ? k : 7 - k)) & 1);
  }
  return aus;
}

/** Signal als Werte zwischen −1 und 1, `n` Abtastwerte je Bit. */
export function signal(bits: number[], medium: Medium, n = 16): number[] {
  const aus: number[] = [];
  for (const bit of bits) {
    for (let k = 0; k < n; k++) {
      const x = k / n;
      if (medium === "kupfer") aus.push(x < 0.5 ? (bit ? -1 : 1) : (bit ? 1 : -1));
      else if (medium === "funk") aus.push(Math.sin(2 * Math.PI * 2 * x + (bit ? 0 : Math.PI)));
      else aus.push(bit ? 1 : -1);
    }
  }
  return aus;
}

/** Präambel und Rahmenbeginn (SFD) vor jedem Ethernet-Rahmen */
export const PRAEAMBEL = Uint8Array.of(0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0xd5);
