import { describe, expect, it } from "vitest";
import { resynthese, synthetisiere, type Bild } from "@/lib/wfc/textur";

/** senkrechte Streifen: Spalte gerade = schwarz, ungerade = weiß */
function streifen(b: number, h: number): Bild {
  const farben = new Uint32Array(b * h);
  for (let i = 0; i < b * h; i++) farben[i] = (i % b) % 2 ? 0xffffff : 0x000000;
  return { b, h, farben };
}

describe("Textur-Synthese (Harrison)", () => {
  const opt = { b: 24, h: 24, n: 1, m: 4, polieren: 2, seed: 3 };

  it("benutzt nur Farben der Probe und setzt Streifen fort — auch über den Rand hinweg", () => {
    const aus = synthetisiere(streifen(8, 8), opt);
    expect(aus.every(c => c === 0 || c === 0xffffff)).toBe(true);
    // nebeneinander meist verschieden, untereinander meist gleich (ringsum, also nahtlos);
    // einzelne Versätze im Streifenmuster sind bei Harrison normal
    let quer = 0, laengs = 0;
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      if (aus[y * 24 + x] !== aus[y * 24 + ((x + 1) % 24)]) quer++;
      if (aus[y * 24 + x] === aus[((y + 1) % 24) * 24 + x]) laengs++;
    }
    expect(quer / 576).toBeGreaterThan(0.8);
    expect(laengs / 576).toBeGreaterThan(0.8);
  });

  it("gleicher Seed, gleiches Bild", () => {
    expect(synthetisiere(streifen(8, 8), opt)).toEqual(synthetisiere(streifen(8, 8), opt));
  });

  it("liefert unterwegs Zwischenstände mit wachsender Zahl gefüllter Pixel", () => {
    const lauf = resynthese(streifen(8, 8), { ...opt, polieren: 0 }, 100);
    const gefuellt: number[] = [];
    for (let r = lauf.next(); !r.done; r = lauf.next()) gefuellt.push(r.value.herkunft.filter(h => h >= 0).length);
    expect(gefuellt).toEqual([100, 200, 300, 400, 500]);
  });
});
