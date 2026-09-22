/**
 * Der Lernen-Reiter: Perzeptron und Nächster-Nachbar.
 *
 * Zwei Zusagen stehen hier auf dem Spiel, und beide sind Unterrichtsstoff:
 * Der trennbare Datensatz *muss* lösbar sein (sonst steht die Klasse vor einem
 * Werkzeug, das nie fertig wird), und der knifflige *darf* es nicht sein
 * (sonst fällt die Begründung für tiefe Netze in sich zusammen).
 */
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import {
  DATENSAETZE, START, antwort, fehlerhafte, treffer, lernschritt, linie,
} from "@/lib/ki/perzeptron";
import { KANTE, leeresBild, istLeer, zentriere, abstand, erkenne, type Bild } from "@/lib/ki/knn";
import { Zeichnen } from "@/components/ki/Zeichnen";
import { rng } from "@/lib/ki/rng";

/** So lange üben, wie die Station es zulässt. */
function trainiere(slug: string, maxSchritte = 400) {
  const satz = DATENSAETZE.find(d => d.slug === slug)!;
  const wuerfel = rng(4711);
  let g = START;
  let schritte = 0;
  while (schritte < maxSchritte) {
    const naechster = lernschritt(g, satz.punkte, wuerfel);
    if (!naechster) break;
    g = naechster.gewichte;
    schritte++;
  }
  return { g, schritte, satz };
}

describe("Das Neuron", () => {
  it("lernt den trennbaren Datensatz fehlerfrei", () => {
    const { g, satz, schritte } = trainiere("obst");
    expect(fehlerhafte(g, satz.punkte), `nach ${schritte} Schritten`).toHaveLength(0);
    expect(schritte).toBeLessThan(400);
  });

  it("kommt beim kniffligen Datensatz nie zur Ruhe", () => {
    // Das ist der Punkt der Station: Mit einer Geraden geht es nicht.
    const { g, satz, schritte } = trainiere("knifflig");
    expect(schritte).toBe(400);
    expect(fehlerhafte(g, satz.punkte).length).toBeGreaterThan(0);
  });

  it("wird beim Üben besser, nicht schlechter", () => {
    const satz = DATENSAETZE.find(d => d.slug === "obst")!;
    const vorher = treffer(START, satz.punkte);
    const { g } = trainiere("obst");
    expect(treffer(g, satz.punkte)).toBeGreaterThan(vorher);
  });

  it("hört auf, sobald alles stimmt", () => {
    const { g, satz } = trainiere("obst");
    expect(lernschritt(g, satz.punkte, rng(1))).toBeNull();
  });

  it("zeichnet für jede Gewichtung eine Linie — außer bei lauter Nullen", () => {
    expect(linie({ w1: 1, w2: 0, b: 0 })).not.toBeNull();
    expect(linie({ w1: 0, w2: 1, b: 0 })).not.toBeNull();
    expect(linie({ w1: 0, w2: 0, b: 0 })).toBeNull();
  });

  it("trennt die beiden Seiten der Linie", () => {
    const g = { w1: 1, w2: 0, b: 0 };
    expect(antwort(g, { x: 0.9, y: 0.5 })).toBe(0);
    expect(antwort(g, { x: 0.1, y: 0.5 })).toBe(1);
  });
});

/** Ein Bild aus einer Zeichenvorlage bauen (# = gemalt). */
function bildAus(zeilen: string[]): Bild {
  const out = leeresBild();
  zeilen.forEach((zeile, y) => {
    [...zeile].forEach((c, x) => { if (c === "#") out[y * KANTE + x] = 1; });
  });
  return out;
}

describe("Erkennen durch Vergleichen", () => {
  it("rückt eine Zeichnung in die Mitte", () => {
    // Dieselbe Form links oben und rechts unten muss dasselbe ergeben.
    const linksOben = bildAus(["##", "##"]);
    const verschoben = leeresBild();
    verschoben[8 * KANTE + 8] = 1;
    verschoben[8 * KANTE + 9] = 1;
    verschoben[9 * KANTE + 8] = 1;
    verschoben[9 * KANTE + 9] = 1;
    expect(abstand(linksOben, verschoben)).toBe(0);
  });

  it("findet das ähnlichste Beispiel", () => {
    const kreis = bildAus(["####", "#..#", "#..#", "####"]);
    const strich = bildAus(["#", "#", "#", "#"]);
    const beispiele = [
      { id: 1, klasse: "Kreis", bild: kreis },
      { id: 2, klasse: "Strich", bild: strich },
    ];
    const fastKreis = bildAus(["####", "#..#", "#..#", "###."]);
    expect(erkenne(beispiele, fastKreis)!.klasse).toBe("Kreis");
    expect(erkenne(beispiele, bildAus(["#", "#", "#", "##"]))!.klasse).toBe("Strich");
  });

  it("sagt nichts zu einem leeren Feld", () => {
    const beispiele = [{ id: 1, klasse: "Kreis", bild: bildAus(["##", "##"]) }];
    expect(erkenne(beispiele, leeresBild())).toBeNull();
    expect(istLeer(leeresBild())).toBe(true);
  });

  it("ist unsicher, wenn zwei Klassen gleich nah liegen", () => {
    const form = bildAus(["##", "##"]);
    const beispiele = [
      { id: 1, klasse: "A", bild: form },
      { id: 2, klasse: "B", bild: form },
    ];
    expect(erkenne(beispiele, form)!.sicherheit).toBe(0);
  });

  it("lässt eine unveränderte Zeichnung unverändert", () => {
    const mittig = zentriere(bildAus(["........#", "........#"]));
    expect(zentriere(mittig)).toEqual(mittig);
  });
});

describe("Die Malstation", () => {
  it("gibt »Was ist das?« erst frei, wenn zwei Formen angelernt sind", () => {
    render(<Zeichnen />);
    const frage = screen.getByText("🤖 Was ist das?").closest("button")!;
    expect(frage.disabled).toBe(true);
    // Ohne Zeichnung lässt sich auch nichts merken.
    expect(screen.getByText("Das ist ein Kreis").closest("button")!.disabled).toBe(true);
  });
});
