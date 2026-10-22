import { describe, expect, it } from "vitest";
import { ASCHE, GLUT, LAPILLI, quelleSetzen, sandSchritt, sandStart, setzeBoden, type Sand } from "@/lib/vulkan/sand";
import { ausbrechen, ausbruchBeenden, caldera, kennzahlen, kette, saeule, STOFFE, TYPEN, vulkanStart, type Magma, type Vulkan } from "@/lib/vulkan/modell";

function wachsen(m: Magma, anzahl: number, seed = 7, meer = false): Vulkan {
  const v = vulkanStart(seed, meer);
  for (let e = 0; e < anzahl; e++) { ausbrechen(v, m); ausbruchBeenden(v); }
  return v;
}
const schild = wachsen(TYPEN[0].magma, 25);
const schicht = wachsen(TYPEN[1].magma, 25);

describe("Vulkanform entsteht aus dem Magma", () => {
  it("Basalt mit wenig Gas baut einen flachen, breiten Schildvulkan", () => {
    const k = kennzahlen(schild, TYPEN[0].magma.sio2);
    expect(k.form.id).toBe("schild");
    expect(k.neigung).toBeLessThan(10);
    expect(k.durchmesser).toBeGreaterThan(8000);
    expect(k.tephraAnteil).toBeLessThan(0.2);
  });

  it("Andesit mit viel Gas baut einen steilen Schichtvulkan aus Asche und Lava", () => {
    const k = kennzahlen(schicht, TYPEN[1].magma.sio2);
    expect(k.form.id).toBe("schicht");
    expect(k.neigung).toBeGreaterThan(18);
    expect(k.tephraAnteil).toBeGreaterThan(0.3);
    expect(k.tephraAnteil).toBeLessThan(0.75);
    // gleiche Menge Magma, aber höher als der Schild
    expect(k.hoehe).toBeGreaterThan(kennzahlen(schild, 49).hoehe);
  });

  it("sehr zähe Lava bleibt als Dom über dem Schlot", () => {
    const v = wachsen({ ...TYPEN[0].magma, sio2: 72, gas: 1, flanke: 0, menge: 0.3 }, 10, 3);
    const k = kennzahlen(v, 72);
    expect(k.form.id).toBe("dom");
    expect(k.durchmesser).toBeLessThan(5000);
  });
});

describe("Schichten", () => {
  it("Oberfläche = Grundgebirge + alle Schichten, keine negative Dicke", () => {
    for (const v of [schild, schicht]) {
      for (let k = 0; k < v.G.length; k += 37) {
        let s = v.B[k];
        for (const x of v.schichten) { expect(x.d[k]).toBeGreaterThanOrEqual(-1e-3); s += x.d[k]; }
        expect(Math.abs(s - v.G[k])).toBeLessThan(0.05);
      }
    }
  });

  it("Volumen bleibt erhalten: abgelagert = gefördert − über den Rand geflossen", () => {
    for (const v of [schild, schicht]) {
      let dep = 0;
      for (let k = 0; k < v.G.length; k++) dep += v.G[k] - v.start[k];
      expect(Math.abs(dep - (v.gefoerdert - v.verloren)) / v.gefoerdert).toBeLessThan(0.02);
    }
  });

  it("an der Flanke des Schichtvulkans wechseln Asche- und Lavaschichten", () => {
    const v = schicht, n = v.n, c = n / 2;
    let wechsel = 0;
    for (const dx of [12, -12]) {
      const s = saeule(v, c + dx, c + 0.5);
      const folge = s.d.map((d, i) => (d > 1 ? (STOFFE[v.schichten[i].stoff].locker ? "t" : "l") : "")).filter(Boolean);
      for (let i = 1; i < folge.length; i++) if (folge[i] !== folge[i - 1]) wechsel++;
    }
    expect(wechsel).toBeGreaterThanOrEqual(4);
  });

  it("eine Caldera senkt den Gipfel und bleibt im Querschnitt geschichtet", () => {
    const v = wachsen(TYPEN[1].magma, 12, 11);
    const vorher = kennzahlen(v, 61).gipfel;
    const lagen = v.schichten.length;
    caldera(v, TYPEN[1].magma);
    expect(v.calderen.length).toBe(1);
    expect(kennzahlen(v, 61).gipfel).toBeLessThan(vorher - 100);
    expect(v.schichten.length).toBeGreaterThan(lagen);
    expect(v.schichten.some(s => s.stoff === "ignimbrit")).toBe(true);
  });

  it("im Meer wächst der Schild bis über den Meeresspiegel", () => {
    const v = wachsen(TYPEN[0].magma, 15, 5, true);
    expect(kennzahlen(v, 49).gipfel).toBeGreaterThan(0);
  });
});

describe("Ausbruch zum Zusehen (fallender Sand)", () => {
  const boden = (s: Sand) => setzeBoden(s, Array.from({ length: s.W }, (_, i) => 120 + Math.abs(i - s.W / 2) * 0.4));
  const zaehle = (s: Sand, f: (i: number, j: number, art: number) => boolean) => {
    let n = 0;
    for (let k = 0; k < s.art.length; k++) if (s.art[k] && f(k % s.W, Math.floor(k / s.W), s.art[k])) n++;
    return n;
  };

  it("eine explosive Säule steigt weit über den Krater, der Wind trägt den Schirm zur Seite", () => {
    const s = sandStart(200, 160, 3);
    boden(s);
    for (let t = 0; t < 120; t++) { quelleSetzen(s, { x: 100, y: 120, explosiv: 0.8, lava: 0, glut: false }, 0.4); sandSchritt(s); }
    expect(zaehle(s, (_, j, a) => a === ASCHE && j < 60)).toBeGreaterThan(50);
    // mehr Asche auf der Leeseite (rechts)
    expect(zaehle(s, (i, _, a) => a === ASCHE && i > 115)).toBeGreaterThan(zaehle(s, (i, _, a) => a === ASCHE && i < 85));
    expect(zaehle(s, (_, __, a) => a === LAPILLI)).toBeGreaterThan(0);
  });

  it("Glutlawinen laufen den Hang hinab; nach dem Ausbruch verschwindet alles", () => {
    const s = sandStart(200, 160, 4);
    boden(s);
    for (let t = 0; t < 60; t++) { quelleSetzen(s, { x: 100, y: 120, explosiv: 0.6, lava: 0, glut: true }, 0); sandSchritt(s); }
    expect(zaehle(s, (i, _, a) => a === GLUT && Math.abs(i - 100) > 15)).toBeGreaterThan(0);
    quelleSetzen(s, null, 0);
    for (let t = 0; t < 3000 && s.anzahl > 0; t++) sandSchritt(s);
    expect(s.anzahl).toBe(0);
  });
});

describe("Hotspot", () => {
  it("die wandernde Platte baut eine Inselkette, die nach Westen älter und niedriger wird", () => {
    const v = vulkanStart(7, true, true), m = TYPEN[2].magma;
    for (let e = 0; e < 100; e++) { ausbrechen(v, m); ausbruchBeenden(v); }
    const k = kette(v), inseln = k.filter(g => g.insel);
    expect(inseln.length).toBeGreaterThanOrEqual(3);
    // Alter wächst nach Westen
    for (let a = 1; a < k.length; a++) expect(k[a - 1].alter).toBeGreaterThanOrEqual(k[a].alter);
    const juengste = inseln[inseln.length - 1], aelteste = inseln[0];
    expect(juengste.hoehe).toBeGreaterThan(aelteste.hoehe + 300);
    expect(aelteste.alter).toBeGreaterThan(0.8);
  }, 60000);
});

describe("Ausbruch unter Wasser", () => {
  it("im flachen Meer explodiert auch Basalt (surtseyanisch), in der Tiefe nicht", () => {
    const flach = vulkanStart(5, true);
    const a = ausbrechen(flach, TYPEN[0].magma);
    expect(a.wasser).toBe("flach");
    expect(a.explosiv).toBeGreaterThanOrEqual(0.3);
    expect(a.asche).not.toBeNull();
    const tief = vulkanStart(5, true, true);
    const b = ausbrechen(tief, TYPEN[1].magma);
    expect(b.wasser).toBe("tief");
    expect(b.explosiv).toBeLessThan(0.15);
    const land = ausbrechen(vulkanStart(5), TYPEN[0].magma);
    expect(land.wasser).toBeNull();
  });
});

describe("Sand am Bildrand", () => {
  it("Asche treibt mit dem Wind aus dem Bild statt sich am Rand zu stauen", () => {
    const s = sandStart(200, 160, 5);
    setzeBoden(s, Array.from({ length: 200 }, () => 120));
    for (let t = 0; t < 400; t++) { quelleSetzen(s, { x: 100, y: 120, explosiv: 0.8, lava: 0, glut: false }, 0.6); sandSchritt(s); }
    let rand = 0;
    for (let j = 0; j < 160; j++) for (let i = 190; i < 200; i++) if (s.art[j * 200 + i]) rand++;
    // kein Stau: am rechten Rand höchstens so viel wie in einem gleich breiten Streifen mitten im Lee
    let lee = 0;
    for (let j = 0; j < 160; j++) for (let i = 150; i < 160; i++) if (s.art[j * 200 + i]) lee++;
    expect(rand).toBeLessThanOrEqual(lee * 1.2 + 5);
    quelleSetzen(s, null, 0.6);
    for (let t = 0; t < 800 && s.anzahl > 0; t++) sandSchritt(s);
    expect(s.anzahl).toBe(0);
  });
});
