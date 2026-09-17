/**
 * Der Stromkreis — gegen das Schulbuch gerechnet.
 *
 * Reihenschaltung: überall derselbe Strom, die Teilspannungen addieren sich.
 * Parallelschaltung: überall dieselbe Spannung, die Teilströme addieren sich.
 * Und U = R·I an jedem einzelnen Bauteil. Wenn eines davon nicht stimmt,
 * stimmt der Löser nicht.
 */
import { describe, it, expect } from "vitest";
import { bauteilSpannung, knotenZuordnung, loeseLGS, loeseStromkreis, stromPorts } from "@/lib/physik/stromkreis";
import { leererZustand, schritt } from "@/lib/physik/rechenwerke";
import { signalId } from "@/lib/physik/messbus";
import { neueSzene, stelle, verbinde } from "@/lib/physik/szene";
import type { Szene } from "@/lib/physik/typen";

const DT = 1 / 240;

/** Baut einen Aufbau aus Bauteilen und benennt sie. */
function aufbau(teile: { typ: string; werte?: Record<string, number> }[]): { szene: Szene; id: (i: number) => string } {
  let s = neueSzene();
  teile.forEach((teil, i) => {
    s = stelle(s, teil.typ, { x: i * 0.3, y: 1 });
    if (teil.werte) {
      const neu = s.geraete[s.geraete.length - 1];
      s = { ...s, geraete: s.geraete.map(g => (g.id === neu.id ? { ...g, werte: { ...g.werte, ...teil.werte } } : g)) };
    }
  });
  return { szene: s, id: (i: number) => s.geraete[i].id };
}

/** Verdrahtet zwei Anschlüsse. */
function draht(s: Szene, a: [number, string], b: [number, string]): Szene {
  return verbinde(s,
    { geraet: s.geraete[a[0]].id, port: a[1] },
    { geraet: s.geraete[b[0]].id, port: b[1] });
}

describe("loeseLGS", () => {
  it("löst ein kleines System", () => {
    // 2x + y = 5 ; x - y = 1  ->  x = 2, y = 1
    const x = loeseLGS([[2, 1], [1, -1]], [5, 1])!;
    expect(x[0]).toBeCloseTo(2, 9);
    expect(x[1]).toBeCloseTo(1, 9);
  });

  it("gibt bei einem entarteten System null zurück", () => {
    expect(loeseLGS([[1, 1], [2, 2]], [1, 2])).toBeNull();
  });
});

describe("knotenZuordnung", () => {
  it("macht aus verbundenen Anschlüssen einen Knoten — das ist das Kabel", () => {
    let { szene } = aufbau([{ typ: "batterie" }, { typ: "widerstand" }]);
    szene = draht(szene, [0, "plus"], [1, "a"]);
    const knoten = knotenZuordnung(szene);
    expect(knoten.get(`${szene.geraete[0].id}.plus`)).toBe(knoten.get(`${szene.geraete[1].id}.a`));
    expect(knoten.get(`${szene.geraete[0].id}.minus`)).not.toBe(knoten.get(`${szene.geraete[1].id}.a`));
  });

  it("kennt die beiden Anschlüsse jedes Bauteils", () => {
    expect(stromPorts("batterie")).toEqual(["plus", "minus"]);
    expect(stromPorts("widerstand")).toEqual(["a", "b"]);
    expect(stromPorts("massestueck")).toBeNull();
  });
});

describe("Einfacher Stromkreis", () => {
  /** Batterie und ein Widerstand im Kreis. */
  function einfach(spannung: number, widerstand: number) {
    let { szene } = aufbau([
      { typ: "batterie", werte: { spannung, innenwiderstand: 0 } },
      { typ: "widerstand", werte: { widerstand } },
    ]);
    szene = draht(szene, [0, "plus"], [1, "a"]);
    szene = draht(szene, [1, "b"], [0, "minus"]);
    return szene;
  }

  it("folgt dem Ohmschen Gesetz", () => {
    for (const [U, R] of [[4.5, 100], [12, 1000], [1.5, 10]]) {
      const szene = einfach(U, R);
      const kreis = loeseStromkreis(szene);
      expect(bauteilSpannung(kreis, szene.geraete[1])).toBeCloseTo(U, 6);
      expect(kreis.strom.get(szene.geraete[1].id)).toBeCloseTo(U / R, 9);
    }
  });

  it("legt Spannung und Strom auf den Messbus", () => {
    const szene = einfach(4.5, 100);
    const { werte } = schritt(szene, leererZustand(), DT);
    expect(werte.get(signalId(szene.geraete[1].id, "spannung"))).toBeCloseTo(4.5, 6);
    expect(werte.get(signalId(szene.geraete[1].id, "strom"))).toBeCloseTo(0.045, 9);
  });

  it("lässt ohne geschlossenen Kreis keinen Strom fließen", () => {
    let { szene } = aufbau([
      { typ: "batterie", werte: { spannung: 4.5, innenwiderstand: 0 } },
      { typ: "widerstand", werte: { widerstand: 100 } },
    ]);
    // Nur eine Seite verdrahtet — der Kreis ist offen.
    szene = draht(szene, [0, "plus"], [1, "a"]);
    const kreis = loeseStromkreis(szene);
    expect(Math.abs(kreis.strom.get(szene.geraete[1].id) ?? 0)).toBeLessThan(1e-6);
  });
});

describe("Reihenschaltung", () => {
  function reihe(spannung: number, r1: number, r2: number) {
    let { szene } = aufbau([
      { typ: "batterie", werte: { spannung, innenwiderstand: 0 } },
      { typ: "widerstand", werte: { widerstand: r1 } },
      { typ: "widerstand", werte: { widerstand: r2 } },
    ]);
    szene = draht(szene, [0, "plus"], [1, "a"]);
    szene = draht(szene, [1, "b"], [2, "a"]);
    szene = draht(szene, [2, "b"], [0, "minus"]);
    return szene;
  }

  it("führt überall denselben Strom", () => {
    const szene = reihe(12, 100, 200);
    const kreis = loeseStromkreis(szene);
    const i1 = kreis.strom.get(szene.geraete[1].id)!;
    const i2 = kreis.strom.get(szene.geraete[2].id)!;
    expect(i1).toBeCloseTo(12 / 300, 9);
    expect(i2).toBeCloseTo(i1, 9);
  });

  it("teilt die Spannung im Verhältnis der Widerstände", () => {
    const szene = reihe(12, 100, 200);
    const kreis = loeseStromkreis(szene);
    const u1 = bauteilSpannung(kreis, szene.geraete[1]);
    const u2 = bauteilSpannung(kreis, szene.geraete[2]);
    expect(u1).toBeCloseTo(4, 6);
    expect(u2).toBeCloseTo(8, 6);
    // Die Teilspannungen ergeben zusammen die Quellenspannung.
    expect(u1 + u2).toBeCloseTo(12, 6);
  });
});

describe("Parallelschaltung", () => {
  function parallel(spannung: number, r1: number, r2: number) {
    let { szene } = aufbau([
      { typ: "batterie", werte: { spannung, innenwiderstand: 0 } },
      { typ: "widerstand", werte: { widerstand: r1 } },
      { typ: "widerstand", werte: { widerstand: r2 } },
    ]);
    szene = draht(szene, [0, "plus"], [1, "a"]);
    szene = draht(szene, [0, "plus"], [2, "a"]);
    szene = draht(szene, [1, "b"], [0, "minus"]);
    szene = draht(szene, [2, "b"], [0, "minus"]);
    return szene;
  }

  it("legt an beide Zweige dieselbe Spannung", () => {
    const szene = parallel(6, 100, 300);
    const kreis = loeseStromkreis(szene);
    expect(bauteilSpannung(kreis, szene.geraete[1])).toBeCloseTo(6, 6);
    expect(bauteilSpannung(kreis, szene.geraete[2])).toBeCloseTo(6, 6);
  });

  it("addiert die Teilströme zum Gesamtstrom", () => {
    const szene = parallel(6, 100, 300);
    const kreis = loeseStromkreis(szene);
    const i1 = kreis.strom.get(szene.geraete[1].id)!;
    const i2 = kreis.strom.get(szene.geraete[2].id)!;
    expect(i1).toBeCloseTo(0.06, 9);
    expect(i2).toBeCloseTo(0.02, 9);
    // Ersatzwiderstand 75 Ohm: 6 V / 75 = 0,08 A.
    expect(i1 + i2).toBeCloseTo(0.08, 9);
  });
});

describe("Schalter", () => {
  function mitSchalter(stellung: number) {
    let { szene } = aufbau([
      { typ: "batterie", werte: { spannung: 4.5, innenwiderstand: 0 } },
      { typ: "schalter", werte: { geschlossen: stellung } },
      { typ: "lampe", werte: { widerstand: 90 } },
    ]);
    szene = draht(szene, [0, "plus"], [1, "a"]);
    szene = draht(szene, [1, "b"], [2, "plus"]);
    szene = draht(szene, [2, "minus"], [0, "minus"]);
    return szene;
  }

  it("lässt geschlossen den Strom durch", () => {
    const szene = mitSchalter(1);
    const { werte } = schritt(szene, leererZustand(), DT);
    expect(werte.get(signalId(szene.geraete[2].id, "strom"))).toBeCloseTo(0.05, 9);
    expect(werte.get(signalId(szene.geraete[2].id, "leistung"))).toBeCloseTo(4.5 * 0.05, 6);
  });

  it("macht offen die Lampe dunkel", () => {
    const szene = mitSchalter(0);
    const { werte } = schritt(szene, leererZustand(), DT);
    expect(Math.abs(werte.get(signalId(szene.geraete[2].id, "strom"))!)).toBeLessThan(1e-6);
    expect(Math.abs(werte.get(signalId(szene.geraete[2].id, "leistung"))!)).toBeLessThan(1e-6);
  });
});

describe("Messgeräte", () => {
  it("das Amperemeter zeigt den Strom, ohne ihn zu ändern", () => {
    let { szene } = aufbau([
      { typ: "batterie", werte: { spannung: 10, innenwiderstand: 0 } },
      { typ: "amperemeter" },
      { typ: "widerstand", werte: { widerstand: 200 } },
    ]);
    szene = draht(szene, [0, "plus"], [1, "a"]);
    szene = draht(szene, [1, "b"], [2, "a"]);
    szene = draht(szene, [2, "b"], [0, "minus"]);

    const { werte } = schritt(szene, leererZustand(), DT);
    expect(werte.get(signalId(szene.geraete[1].id, "strom"))).toBeCloseTo(0.05, 9);
    // Ideal ist es ein Draht: der Widerstand sieht die volle Spannung.
    expect(werte.get(signalId(szene.geraete[2].id, "spannung"))).toBeCloseTo(10, 6);
  });

  it("das Voltmeter zeigt die Spannung, ohne Strom zu ziehen", () => {
    let { szene } = aufbau([
      { typ: "batterie", werte: { spannung: 9, innenwiderstand: 0 } },
      { typ: "widerstand", werte: { widerstand: 100 } },
      { typ: "widerstand", werte: { widerstand: 200 } },
      { typ: "voltmeter" },
    ]);
    szene = draht(szene, [0, "plus"], [1, "a"]);
    szene = draht(szene, [1, "b"], [2, "a"]);
    szene = draht(szene, [2, "b"], [0, "minus"]);
    // Parallel zum zweiten Widerstand.
    szene = draht(szene, [3, "a"], [2, "a"]);
    szene = draht(szene, [3, "b"], [2, "b"]);

    const { werte } = schritt(szene, leererZustand(), DT);
    expect(werte.get(signalId(szene.geraete[3].id, "spannung"))).toBeCloseTo(6, 6);
    // Es belastet nichts: der Strom bleibt 9 V / 300 Ohm.
    expect(werte.get(signalId(szene.geraete[1].id, "strom"))).toBeCloseTo(0.03, 6);
  });
});

describe("Innenwiderstand", () => {
  function belastet(treue: "ideal" | "real") {
    let { szene } = aufbau([
      { typ: "batterie", werte: { spannung: 4.5, innenwiderstand: 2 } },
      { typ: "widerstand", werte: { widerstand: 10 } },
    ]);
    szene = draht(szene, [0, "plus"], [1, "a"]);
    szene = draht(szene, [1, "b"], [0, "minus"]);
    return { ...szene, treue };
  }

  it("bleibt im Schulbuchmodell aus dem Spiel", () => {
    const szene = belastet("ideal");
    const kreis = loeseStromkreis(szene);
    expect(bauteilSpannung(kreis, szene.geraete[1])).toBeCloseTo(4.5, 6);
    expect(kreis.strom.get(szene.geraete[1].id)).toBeCloseTo(0.45, 9);
  });

  it("lässt im realen Modell die Klemmenspannung einbrechen", () => {
    const szene = belastet("real");
    const kreis = loeseStromkreis(szene);
    // 4,5 V an 12 Ohm: 0,375 A, davon 3,75 V am Aussenwiderstand.
    expect(kreis.strom.get(szene.geraete[1].id)).toBeCloseTo(4.5 / 12, 9);
    expect(bauteilSpannung(kreis, szene.geraete[1])).toBeCloseTo(3.75, 6);
  });
});
