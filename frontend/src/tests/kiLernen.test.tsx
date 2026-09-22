/**
 * Der Lernen-Reiter: Perzeptron und Nächster-Nachbar.
 *
 * Zwei Zusagen stehen hier auf dem Spiel, und beide sind Unterrichtsstoff:
 * Der trennbare Datensatz *muss* lösbar sein (sonst steht die Klasse vor einem
 * Werkzeug, das nie fertig wird), und der knifflige *darf* es nicht sein
 * (sonst fällt die Begründung für tiefe Netze in sich zusammen).
 */
import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import {
  DATENSAETZE, START, antwort, fehlerhafte, treffer, lernschritt, linie,
} from "@/lib/ki/perzeptron";
import {
  START_SEED, starte, lernschritt2, treffer2, fehler2, antwort2, linie2, vorwaerts,
} from "@/lib/ki/netz2";
import { KANTE, leeresBild, istLeer, zentriere, abstand, erkenne, type Bild } from "@/lib/ki/knn";
import { Neuron } from "@/components/ki/Neuron";
import { Neuron2 } from "@/components/ki/Neuron2";
import { Netzbild } from "@/components/ki/Netzbild";
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

describe("Zwei Neuronen", () => {
  /** Üben wie die Station: ganze Durchgänge über alle Punkte. */
  function uebe(slug: string, seed = START_SEED, durchgaenge = 3000) {
    const satz = DATENSAETZE.find(d => d.slug === slug)!;
    let n = starte(seed);
    for (let i = 0; i < durchgaenge; i++) n = lernschritt2(n, satz.punkte, 2);
    return { n, satz };
  }

  it("löst, woran ein einzelnes Neuron scheitert", () => {
    // Das ist der ganze Sinn der Station — und der Grund für tiefe Netze.
    const { n, satz } = uebe("knifflig");
    expect(satz.trennbar).toBe(false);
    expect(treffer2(n, satz.punkte), "zwei Neuronen kommen am XOR nicht durch").toBe(satz.punkte.length);
  });

  it("schafft auch die einfachen Datensätze", () => {
    for (const satz of DATENSAETZE) {
      const { n } = uebe(satz.slug);
      expect(treffer2(n, satz.punkte), satz.slug).toBe(satz.punkte.length);
    }
  });

  it("macht den Fehler mit jedem Üben kleiner", () => {
    const satz = DATENSAETZE.find(d => d.slug === "knifflig")!;
    const anfang = fehler2(starte(START_SEED), satz.punkte);
    const { n } = uebe("knifflig", START_SEED, 500);
    expect(fehler2(n, satz.punkte)).toBeLessThan(anfang);
  });

  it("übt reproduzierbar — derselbe Startwert, derselbe Verlauf", () => {
    const a = uebe("knifflig", 3, 200).n;
    const b = uebe("knifflig", 3, 200).n;
    const c = uebe("knifflig", 4, 200).n;
    expect(a.v[0]).toBe(b.v[0]);
    expect(a.v[0]).not.toBe(c.v[0]);
  });

  it("zeichnet für beide verdeckten Neuronen eine Gerade", () => {
    const { n } = uebe("knifflig", START_SEED, 100);
    expect(linie2(n, 0)).not.toBeNull();
    expect(linie2(n, 1)).not.toBeNull();
  });

  it("schneidet einen Streifen aus, keine Halbebene", () => {
    // Ein einzelnes Neuron teilt die Fläche in zwei Hälften: Auf einer Geraden
    // quer durchs Bild wechselt die Antwort dann genau einmal. Beim Streifen
    // wechselt sie zweimal — daran erkennt man die zweite Schicht.
    const { n } = uebe("knifflig");
    let wechsel = 0;
    let vorher = antwort2(n, { x: 0, y: 0 });
    for (let i = 1; i <= 100; i++) {
      const jetzt = antwort2(n, { x: i / 100, y: i / 100 });
      if (jetzt !== vorher) wechsel++;
      vorher = jetzt;
    }
    expect(wechsel, "die Antwort wechselt nicht zweimal — das wäre nur eine Gerade").toBe(2);
  });

  it("gibt für jede Stelle einen Wert zwischen 0 und 1", () => {
    const { n } = uebe("obst", START_SEED, 50);
    for (const [x, y] of [[0, 0], [1, 1], [0.5, 0.5], [0.2, 0.9]]) {
      const { aus } = vorwaerts(n, x, y);
      expect(aus).toBeGreaterThanOrEqual(0);
      expect(aus).toBeLessThanOrEqual(1);
    }
  });
});

describe("Die Station »Zwei Neuronen«", () => {
  /** Die Uhr vorstellen, bis das Training von selbst aufhört. */
  async function ueben(sekunden: number) {
    for (let i = 0; i < sekunden * 25; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    }
  }

  it("hört von selbst auf, sobald alle Punkte stimmen", async () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<Neuron2 />);
      fireEvent.click(screen.getByText("🤖 Maschine übt"));
      await ueben(20);

      // Fertig heißt: alle Punkte richtig — und der Lauf steht.
      expect(container.textContent).toMatch(/32 von 32 richtig/);
      expect(screen.queryByText("⏸ Anhalten"), "das Training läuft immer noch").toBeNull();
      expect(screen.getByText("🤖 Weiter üben")).toBeTruthy();

      // Und es rechnet auch nicht heimlich weiter.
      const stand = container.textContent?.match(/(\d+) Durchgänge/)?.[1];
      await ueben(5);
      expect(container.textContent?.match(/(\d+) Durchgänge/)?.[1]).toBe(stand);
    } finally {
      vi.useRealTimers();
    }
  });

  it("zeigt im Bauplan, was an der angetippten Stelle durch das Netz läuft", () => {
    const { container } = render(<Neuron2 />);
    const feld = container.querySelector(".cursor-crosshair") as HTMLElement;
    feld.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 260, height: 260, right: 260, bottom: 260, x: 0, y: 0 }) as DOMRect;

    // Der Prüfpunkt ist der ganze Grund für den Bauplan: Erst an einer
    // konkreten Stelle sieht man, dass hinten nur noch zwei Zahlen ankommen.
    fireEvent.pointerDown(feld, { clientX: 195, clientY: 65 });
    expect(container.textContent).toContain("0.75");

    const oben = container.querySelector("svg[aria-label^='Bauplan']")!.textContent;
    fireEvent.pointerDown(feld, { clientX: 26, clientY: 234 });
    expect(container.textContent).toContain("0.10");
    expect(
      container.querySelector("svg[aria-label^='Bauplan']")!.textContent,
      "der Bauplan zeigt überall dasselbe",
    ).not.toBe(oben);
  });

  it("lässt sich jederzeit anhalten", async () => {
    vi.useFakeTimers();
    try {
      render(<Neuron2 />);
      fireEvent.click(screen.getByText("🤖 Maschine übt"));
      // Nur ein paar Bilder weit — mit dem Grund-Startwert ist das Netz nach
      // einer Sekunde schon fertig, und dann heißt der Knopf anders.
      await ueben(0.2);
      // Der Knopf darf nie ausgegraut sein — sonst kommt man nicht mehr heraus.
      const anhalten = screen.getByText("⏸ Anhalten").closest("button")!;
      expect(anhalten.disabled).toBe(false);
      fireEvent.click(anhalten);
      expect(screen.getByText("🤖 Maschine übt")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
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

describe("Der Bauplan", () => {
  it("zeichnet je Knoten einen Kreis und je Gewicht eine Verbindung", () => {
    const { container } = render(
      <Netzbild
        schichten={[
          { titel: "Eingang", knoten: [{ name: "a" }, { name: "b" }] },
          { titel: "verdeckte Schicht", knoten: [{ name: "h1", wert: 0.8 }, { name: "h2", wert: 0.1 }] },
          { titel: "Antwort", knoten: [{ name: "ja", wert: 0.9 }] },
        ]}
        kanten={[[[1, -2], [0.5, 0.5]], [[3, -3]]]}
      />,
    );
    expect(container.querySelectorAll("circle")).toHaveLength(5);
    const linien = [...container.querySelectorAll("line")];
    expect(linien).toHaveLength(6);
    // Gestrichelt heißt »spricht dagegen« — ohne das sieht ein negatives
    // Gewicht aus wie ein positives.
    expect(linien.filter(l => l.getAttribute("stroke-dasharray"))).toHaveLength(2);
    const dick = (i: number) => Number(linien[i].getAttribute("stroke-width"));
    expect(dick(0), "das größere Gewicht muss dicker sein").toBeLessThan(dick(4));
  });

  it("zeigt den Wert eines Neurons als Zahl und als Füllung", () => {
    const { container } = render(
      <Netzbild
        schichten={[
          { titel: "Eingang", knoten: [{ name: "a", wert: 0.2 }] },
          { titel: "Antwort", knoten: [{ name: "ja", wert: 0.9 }] },
        ]}
        kanten={[[[1]]]}
      />,
    );
    expect(container.textContent).toContain("90");
    const [ein, aus] = [...container.querySelectorAll("circle")];
    expect(Number(ein.getAttribute("fill-opacity"))).toBeLessThan(
      Number(aus.getAttribute("fill-opacity")),
    );
  });

  it("hat beim einzelnen Neuron keine Schicht dazwischen", () => {
    // Genau darin besteht der Unterschied, um den es auf beiden Stationen
    // geht: eine Spalte gegen zwei. Stünde hier eine verdeckte Schicht,
    // wäre das Bild eine Lüge.
    const { container } = render(<Neuron />);
    expect(container.textContent).not.toContain("verdeckte Schicht");
    expect(screen.getAllByText("Eingang")).toHaveLength(1);
  });
});

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
