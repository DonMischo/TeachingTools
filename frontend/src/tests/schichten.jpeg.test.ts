import { describe, expect, it } from "vitest";
import { abschnitte, groesse, quantisierung } from "@/lib/schichten/jpeg";

/** Kleinster Kopf: SOI, APP0 (JFIF), DQT mit 1..64, SOF0 1600×1200, SOS */
function kopf(): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const dqt = [0xff, 0xdb, 0x00, 0x43, 0x00, ...Array.from({ length: 64 }, (_, i) => i + 1)];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0xb0, 0x06, 0x40, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const sos = [0xff, 0xda, 0x00, 0x0c, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...dqt, ...sof, ...sos, 0x12, 0x34]);
}

describe("JPEG lesen", () => {
  it("findet die Abschnitte in Reihenfolge", () => {
    expect(abschnitte(kopf()).map(a => a.name)).toEqual(["SOI", "APP0 (JFIF)", "DQT", "SOF0", "SOS"]);
  });

  it("liest Breite und Höhe aus dem Bildkopf", () => {
    expect(groesse(kopf())).toMatchObject({ breite: 1600, hoehe: 1200 });
  });

  it("ordnet die Quantisierungstabelle aus dem Zickzack zurück", () => {
    const q = quantisierung(kopf())!;
    expect(q[0].slice(0, 4)).toEqual([1, 2, 6, 7]);
    expect(q[1][0]).toBe(3);
    expect(q[7][7]).toBe(64);
  });

  it("lehnt Nicht-JPEG ab", () => {
    expect(abschnitte(Uint8Array.of(1, 2, 3))).toEqual([]);
    expect(groesse(Uint8Array.of(1, 2, 3))).toBeNull();
  });
});
