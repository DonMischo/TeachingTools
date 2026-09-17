/**
 * Das Oszilloskop-Bild — und der Fehler, der hier festgehalten wird.
 *
 * Der erste Wurf verankerte das Bild an der *jüngsten* steigenden Flanke.
 * Danach blieb nur der Rest einer Periode zum Zeichnen übrig: die Kurve
 * quetschte sich als Stummel an den linken Rand und flackerte, weil dieser
 * Rest mit jedem Bild eine andere Länge hatte. Richtig ist die jüngste
 * Flanke, **hinter die noch ein volles Fenster passt** — dann füllt der
 * Durchlauf den Schirm und steht still.
 */
import { describe, it, expect } from "vitest";
import { flankenIndex, imFenster, jeFeld, spanne, stufe, zeitfenster } from "@/lib/physik/oszilloskop";

const DT = 1 / 240;

/** Ein abgetasteter Sinus, so wie ihn der Messbus aufzeichnen würde. */
function sinus(frequenz: number, amplitude: number, sekunden: number) {
  const t: number[] = [], v: number[] = [];
  for (let i = 1; i * DT <= sekunden; i++) {
    t.push(i * DT);
    v.push(amplitude * Math.sin(2 * Math.PI * frequenz * i * DT));
  }
  return { t, v };
}

/** Wie weit ein Sinus zwischen zwei Abtastungen höchstens springt. */
const schrittHoehe = (frequenz: number, amplitude: number) => amplitude * 2 * Math.PI * frequenz * DT;

describe("flankenIndex", () => {
  it("findet die letzte steigende Flanke durch den Pegel", () => {
    expect(flankenIndex([-1, 1, -1, 1, 2, 3], 0)).toBe(3);
  });

  it("gibt 0 zurück, wenn es keine Flanke gibt", () => {
    expect(flankenIndex([1, 2, 3], 10)).toBe(0);
    expect(flankenIndex([], 0)).toBe(0);
  });
});

describe("spanne", () => {
  it("umfasst alle Werte", () => {
    const { min, max } = spanne([-2, 5, 1]);
    expect(min).toBeLessThanOrEqual(-2);
    expect(max).toBeGreaterThanOrEqual(5);
  });

  it("fällt bei lauter gleichen Werten nicht auf null zusammen", () => {
    const { min, max } = spanne([3, 3, 3]);
    expect(max).toBeGreaterThan(min);
  });

  it("kommt mit einer leeren Messung zurecht", () => {
    const { min, max } = spanne([]);
    expect(Number.isFinite(min) && Number.isFinite(max)).toBe(true);
    expect(max).toBeGreaterThan(min);
  });
});

describe("zeitfenster", () => {
  it("ist immer genau so breit wie eingestellt", () => {
    const daten = sinus(2, 5, 5);
    for (const pegel of [0, null]) {
      const f = zeitfenster(daten, 1, pegel);
      expect(f.t1 - f.t0).toBeCloseTo(1, 9);
    }
  });

  it("zeigt ohne Auslöser das Neueste am rechten Rand", () => {
    const daten = sinus(2, 5, 5);
    const f = zeitfenster(daten, 1, null);
    expect(f.t1).toBeCloseTo(daten.t[daten.t.length - 1], 9);
  });

  it("beginnt mit Auslöser an einer steigenden Flanke", () => {
    const daten = sinus(2, 5, 5);
    const bild = imFenster(daten, zeitfenster(daten, 1, 0));
    expect(Math.abs(bild.v[0])).toBeLessThanOrEqual(schrittHoehe(2, 5));
    expect(bild.v[1]).toBeGreaterThan(bild.v[0]);
  });

  it("füllt den Schirm, statt einen Stummel zu zeichnen", () => {
    const daten = sinus(2, 5, 5);
    const bild = imFenster(daten, zeitfenster(daten, 1, 0));
    // Eine Sekunde bei 240 Hz sind rund 240 Punkte — keine Handvoll.
    expect(bild.t.length).toBeGreaterThan(200);
  });

  it("steht still, statt zu flackern", () => {
    // Der eigentliche Regressionstest: egal wie viele Messpunkte seither
    // dazugekommen sind, das Bild muss dieselbe Phase zeigen und dieselbe
    // Breite haben. Frueher wechselte beides mit jedem Bild.
    const alles = sinus(2, 5, 6);
    const grenze = schrittHoehe(2, 5);
    for (let weg = 0; weg < 150; weg++) {
      const bisher = { t: alles.t.slice(0, alles.t.length - weg), v: alles.v.slice(0, alles.v.length - weg) };
      const f = zeitfenster(bisher, 1, 0);
      const bild = imFenster(bisher, f);
      expect(f.t1 - f.t0).toBeCloseTo(1, 9);
      expect(bild.t.length).toBeGreaterThan(200);
      expect(Math.abs(bild.v[0])).toBeLessThanOrEqual(grenze);
    }
  });

  it("gibt ohne Messwerte ein brauchbares Fenster zurück", () => {
    const f = zeitfenster(undefined, 2, 0);
    expect(f.t1 - f.t0).toBeCloseTo(2, 9);
  });

  it("weicht auf ungetriggert aus, solange noch keine Flanke weit genug zurückliegt", () => {
    // Eine Viertelsekunde Messung, aber ein Fenster von einer Sekunde.
    const daten = sinus(2, 5, 0.25);
    const f = zeitfenster(daten, 1, 0);
    expect(f.t1 - f.t0).toBeCloseTo(1, 9);
    expect(f.t1).toBeCloseTo(daten.t[daten.t.length - 1], 9);
  });
});

describe("imFenster", () => {
  it("schneidet auf den Zeitbereich zu", () => {
    const daten = { t: [0, 1, 2, 3, 4], v: [0, 10, 20, 30, 40] };
    expect(imFenster(daten, { t0: 1, t1: 3 })).toEqual({ t: [1, 2, 3], v: [10, 20, 30] });
  });

  it("kommt mit leeren Messwerten zurecht", () => {
    expect(imFenster(undefined, { t0: 0, t1: 1 })).toEqual({ t: [], v: [] });
  });
});

describe("jeFeld", () => {
  it("teilt den Bereich auf die Rasterzeilen auf", () => {
    expect(jeFeld(-4, 4, 8)).toBeCloseTo(1, 12);
  });
});

describe("stufe", () => {
  it("rastet in der 1-2-5-Folge ein", () => {
    expect(stufe(1, 1)).toBeCloseTo(2, 9);
    expect(stufe(2, 1)).toBeCloseTo(5, 9);
    expect(stufe(5, 1)).toBeCloseTo(10, 9);
    expect(stufe(1, -1)).toBeCloseTo(0.5, 9);
    expect(stufe(0.5, -1)).toBeCloseTo(0.2, 9);
    expect(stufe(0.2, -1)).toBeCloseTo(0.1, 9);
  });

  it("findet von einem krummen Wert auf die Folge zurück", () => {
    expect(stufe(3.7, 1)).toBeCloseTo(5, 9);
    expect(stufe(3.7, -1)).toBeCloseTo(1, 9);
  });

  it("kommt hoch und wieder herunter aufs selbe", () => {
    let x = 1;
    for (let i = 0; i < 6; i++) x = stufe(x, 1);
    for (let i = 0; i < 6; i++) x = stufe(x, -1);
    expect(x).toBeCloseTo(1, 9);
  });

  it("verträgt Unsinn, ohne zu entgleisen", () => {
    expect(stufe(0, 1)).toBeGreaterThan(0);
    expect(stufe(Number.NaN, -1)).toBeGreaterThan(0);
  });
});
