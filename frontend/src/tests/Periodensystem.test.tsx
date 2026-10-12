/**
 * Prüft das gerenderte Periodensystem: Raster, Suche, Steckbrief und der
 * Weg in die Gleichungswaage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Periodensystem, { feldBreite, rasterBreite } from "@/components/pse/Periodensystem";
import { HAUPTGRUPPEN, PSE, pseElement, pseNummer, suche } from "@/lib/pse/elemente";
import { masseText } from "@/lib/pse/rallye";

/** Klickt die Kachel an — die Kacheln tragen ihren Namen im title. */
const oeffne = (name: string) => {
  render(<Periodensystem />);
  fireEvent.click(screen.getByTitle(new RegExp(`^${name} —`)));
};

describe("Periodensystem", () => {
  it("zeigt alle 118 Elemente als Felder", () => {
    render(<Periodensystem />);
    // Jede Kachel trägt ihren Namen im title; die Kategorieknöpfe nicht.
    expect(screen.getAllByTitle(/—/)).toHaveLength(118);
  });

  it("öffnet den Steckbrief mit Kenndaten", () => {
    oeffne("Eisen");
    // »Übergangsmetalle« steht auch auf dem Filterknopf — hier zählt der Kopf des Steckbriefs.
    const kopf = screen.getByRole("heading", { name: "Eisen" }).parentElement!;
    expect(within(kopf).getByText("Übergangsmetalle")).toBeInTheDocument();
    expect(within(kopf).getByText(/4\. Periode/)).toBeInTheDocument();
    // Schmelzpunkt 1811 K = 1538 °C
    expect(screen.getByText("1538 °C")).toBeInTheDocument();
    // Die Genauigkeit der Quelle bleibt stehen: 55,84 u, nicht 55,840 u.
    expect(screen.getByText("55,84 u")).toBeInTheDocument();
  });

  it("gibt die Dichte von Gasen in g/l an", () => {
    oeffne("Wasserstoff");
    // PubChem nennt 0,00008988 g/cm³ — das sind 0,0899 g/l.
    expect(screen.getByText("0,0899 g/l")).toBeInTheDocument();
  });

  it("zeigt das Foto der Stoffprobe mit Lizenz und Urheber", () => {
    oeffne("Kupfer");
    expect(screen.getByAltText("Stoffprobe Kupfer")).toBeInTheDocument();
    expect(screen.getByText(/Foto:.*CC BY/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wikimedia Commons" })).toHaveAttribute(
      "href", expect.stringContaining("commons.wikimedia.org"));
  });

  it("verlinkt jede Reaktion in den Chemiemodus der Gleichungswaage", () => {
    oeffne("Natrium");
    const link = screen.getByRole("link", { name: /Natrium in Wasser/ });
    expect(link).toHaveAttribute("href",
      "/simulationen/gleichungswaage?reaktion=Na%20%2B%20H2O%20-%3E%20NaOH%20%2B%20H2");
    // Die Gleichung steht unausgeglichen da — sie soll ja ausgeglichen werden.
    // Indizes stehen tief, wie in der Gleichungswaage.
    expect(within(link).getByText("Na + H₂O → NaOH + H₂")).toBeInTheDocument();
  });

  it("blendet beim Suchen alles andere zurück", () => {
    render(<Periodensystem />);
    fireEvent.change(screen.getByPlaceholderText(/Suchen/), { target: { value: "Gold" } });
    expect(screen.getByTitle(/^Gold —/).className).not.toMatch(/opacity-40/);
    expect(screen.getByTitle(/^Silber —/).className).toMatch(/opacity-40/);
  });

  it("filtert nach Kategorie", () => {
    render(<Periodensystem />);
    fireEvent.click(screen.getByRole("button", { name: "Edelgase" }));
    expect(screen.getByTitle(/^Neon —/).className).not.toMatch(/opacity-40/);
    expect(screen.getByTitle(/^Eisen —/).className).toMatch(/opacity-40/);
  });

  it("kommt ohne Steckbrieftext aus, wenn es keinen gibt", () => {
    oeffne("Dubnium");
    expect(screen.getByRole("heading", { name: "Dubnium" })).toBeInTheDocument();
    expect(screen.queryByText("Typische Reaktionen")).not.toBeInTheDocument();
  });
});

// Jede Aufgabe zeichnet das Raster mit seinen 118 Kacheln neu. Allein läuft
// das in Sekunden, unter der Last der ganzen Suite reichen die üblichen 15 s
// aber nicht — darum hier mehr Zeit für den ganzen Block.
describe("PSE-Rallye", { timeout: 40_000 }, () => {
  // Der Stand der Rallye liegt im Browser — ohne Aufräumen trüge ein
  // vorheriger Lauf seine Erfolge in den nächsten hinein.
  beforeEach(() => {
    localStorage.removeItem("hp_pse_rallye");
    // Die Aufgaben werden gezogen. Mit festem Zufall stellt die Rallye in
    // jedem Lauf dieselben Fragen — sonst scheitert der Test irgendwann an
    // einer Frage, die er nur selten zu sehen bekommt.
    let z = 20261007;
    vi.spyOn(Math, "random").mockImplementation(() => {
      z = (z * 1664525 + 1013904223) >>> 0;
      return z / 4294967296;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  const starte = () => {
    render(<Periodensystem />);
    fireEvent.click(screen.getByRole("button", { name: /PSE-Rallye/ }));
    fireEvent.click(screen.getByRole("button", { name: "Runde starten" }));
  };

  /** Das Feld der Rallye — die Kacheln daneben tragen eigene Zeichen. */
  const tafel = () => screen.getByRole("heading", { name: /PSE-Rallye/ }).closest(".card") as HTMLElement;

  /** Liest aus der gestellten Frage, welches Element gemeint ist. */
  const gesuchtesFeld = (): HTMLElement => {
    const frage = within(tafel()).getByText(/\?$|^Finde |^Klick ein/).textContent!;
    let treffer: ReturnType<typeof pseElement>;
    let m: RegExpExecArray | null;
    if ((m = /Ordnungszahl (\d+)/.exec(frage))) treffer = pseNummer(Number(m[1]));
    else if ((m = /Symbol (\S+)\?/.exec(frage))) treffer = pseElement(m[1]);
    else if ((m = /^Finde (.+)\./.exec(frage))) treffer = suche(m[1])[0];
    else if ((m = /Atommasse (\S+) u/.exec(frage))) {
      treffer = PSE.find(e => masseText(e) === m![1]);
    } else {
      // Gruppenfragen: irgendein Element, das passt.
      const g = /Gruppe der (\S+) an/.exec(frage);
      const p = /der (\d+)\. Periode und in der (\S+)\. Hauptgruppe/.exec(frage);
      treffer = g
        ? PSE.find(e => e.hauptgruppe !== null && e.z !== 1 && HAUPTGRUPPEN[e.hauptgruppe].name === g[1])
        : PSE.find(e => e.periode === Number(p![1]) && e.hauptgruppe !== null
          && HAUPTGRUPPEN[e.hauptgruppe].roemisch === p![2]);
    }
    return screen.getByTitle(new RegExp(`^${treffer!.name} —`));
  };

  it("stellt eine Frage und nimmt die richtige Kachel an", () => {
    starte();
    fireEvent.click(gesuchtesFeld());
    expect(screen.getByText(/^Richtig\.$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter" })).toBeInTheDocument();
  });

  it("weist eine falsche Kachel zurück und kostet Punkte", () => {
    starte();
    const richtig = gesuchtesFeld();
    const falsch = screen.getAllByTitle(/—/).find(k => k !== richtig)!;
    fireEvent.click(falsch);
    expect(screen.getByText(/passt nicht/)).toBeInTheDocument();
    expect(screen.getByText(/1 Fehlversuch/)).toBeInTheDocument();
    // Danach geht die richtige Antwort weiterhin.
    fireEvent.click(gesuchtesFeld());
    expect(screen.getByText(/^Richtig\.$/)).toBeInTheDocument();
  });

  it("zeigt auf Wunsch die Lösung samt Erklärung", () => {
    starte();
    fireEvent.click(screen.getByRole("button", { name: "Lösung zeigen" }));
    expect(screen.getByText("Die Lösung:")).toBeInTheDocument();
  });

  it("zählt die Aufgaben einer Runde", () => {
    starte();
    expect(screen.getByText(/1\/10/)).toBeInTheDocument();
    fireEvent.click(gesuchtesFeld());
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByText(/2\/10/)).toBeInTheDocument();
  });

  // Dieser Test spielt zehn Aufgaben am Stück durch.
  it("schließt die Runde mit Sternen und Erfolgen ab", () => {
    starte();
    for (let i = 0; i < 10; i++) {
      fireEvent.click(gesuchtesFeld());
      fireEvent.click(screen.getByRole("button", { name: i < 9 ? "Weiter" : "Runde abschließen" }));
    }
    expect(screen.getByText(/von 30 Punkten/)).toBeInTheDocument();
    expect(screen.getByText("Neue Erfolge")).toBeInTheDocument();
    expect(screen.getByText(/Erste Rallye/)).toBeInTheDocument();
  });

  it("lässt im Rallye-Modus keinen Steckbrief aufgehen", () => {
    starte();
    fireEvent.click(screen.getByTitle(/^Eisen —/));
    expect(screen.queryByRole("heading", { name: "Eisen" })).not.toBeInTheDocument();
  });
});

describe("Atommodelle", { timeout: 40_000 }, () => {
  /** Öffnet den Reiter; ohne Wahl steht Bor da. */
  const reiter = () => {
    render(<Periodensystem />);
    fireEvent.click(screen.getByRole("button", { name: /Atommodelle/ }));
  };

  it("zeigt ohne Wahl Bor im Schalenmodell", () => {
    reiter();
    expect(screen.getByRole("heading", { name: /Bor — Schalenmodell/ })).toBeInTheDocument();
    // 2 innen, 3 außen. »3e⁻« steht zweimal da: an der Schale im Bild und
    // in der Tabelle darunter.
    expect(screen.getByText("2·3")).toBeInTheDocument();
    expect(screen.getAllByText("3e⁻").length).toBeGreaterThan(0);
  });

  it("nennt bei jedem Modell Urheber, Leistung und Lücke", () => {
    reiter();
    for (const [knopf, wer] of [
      ["Teilchenmodell", "John Dalton"], ["Kern-Hülle-Modell", "Ernest Rutherford"],
      ["Energiestufenmodell", "Bohr und Sommerfeld"], ["Orbitalmodell", "Erwin Schrödinger"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(knopf) }));
      expect(screen.getByText(new RegExp(wer))).toBeInTheDocument();
      expect(screen.getByText(/Erklärt:/)).toBeInTheDocument();
      expect(screen.getByText(/Hört auf bei:/)).toBeInTheDocument();
    }
  });

  it("erklärt bei Bor den Elektronenmangel", () => {
    reiter();
    expect(screen.getByText("Warum Bor?")).toBeInTheDocument();
    expect(screen.getByText(/sechs statt acht/)).toBeInTheDocument();
  });

  it("wechselt das Element über das Raster", () => {
    reiter();
    fireEvent.click(screen.getByTitle(/^Kohlenstoff —/));
    expect(screen.getByRole("heading", { name: /Kohlenstoff — Schalenmodell/ })).toBeInTheDocument();
    expect(screen.getByText("2·4")).toBeInTheDocument();
    // Der Bor-Kasten gehört nur zu Bor.
    expect(screen.queryByText("Warum Bor?")).not.toBeInTheDocument();
  });

  it("baut im Bindungslabor BF₃ und zeigt das Sextett", () => {
    reiter();
    fireEvent.click(screen.getByRole("button", { name: "Verbindungen" }));
    expect(screen.getByRole("heading", { name: /BF₃/ })).toBeInTheDocument();
    expect(screen.getByText(/Bortrifluorid/)).toBeInTheDocument();
    expect(screen.getByText(/3 Bindungen/)).toBeInTheDocument();
    expect(screen.getByText(/Elektronenmangel/)).toBeInTheDocument();
  });

  it("nimmt Atome dazu und wieder weg", () => {
    reiter();
    fireEvent.click(screen.getByRole("button", { name: "Verbindungen" }));
    fireEvent.click(screen.getByRole("button", { name: "H₂O" }));
    expect(screen.getByRole("heading", { name: /H₂O/ })).toBeInTheDocument();
    expect(screen.getByText(/Edelgaskonfiguration/)).toBeInTheDocument();
    // Ein Wasserstoff weg: übrig bleibt ein Rest aus O und H.
    fireEvent.click(screen.getAllByRole("button", { name: "H ×" })[0]);
    expect(screen.getByRole("heading", { name: /^HO/ })).toBeInTheDocument();
  });

  it("lässt höchstens acht Atome zu", () => {
    reiter();
    fireEvent.click(screen.getByRole("button", { name: "Verbindungen" }));
    const dazu = screen.getByRole("button", { name: "+H" });
    for (let i = 0; i < 8; i++) if (!(dazu as HTMLButtonElement).disabled) fireEvent.click(dazu);
    expect(screen.getByText("Atome dazunehmen (8/8)")).toBeInTheDocument();
    expect(dazu).toBeDisabled();
  });

  it("führt aus dem Steckbrief in die Modelle", () => {
    render(<Periodensystem />);
    fireEvent.click(screen.getByTitle(/^Eisen —/));
    // Der Knopf im Steckbrief, nicht der Reiter oben — beide heißen gleich.
    fireEvent.click(screen.getByRole("button", { name: /Eisen als Kugel/ }));
    expect(screen.getByRole("heading", { name: /Eisen — Schalenmodell/ })).toBeInTheDocument();
    // 2, 8, 14, 2 — die angefangene vierte Schale.
    expect(screen.getByText("2·8·14·2")).toBeInTheDocument();
  });
});

describe("Größe des Rasters", () => {
  it("passt sich so ein, dass nichts über die Breite hinausragt", () => {
    for (const platz of [700, 820, 966, 1024, 1280, 1440, 1860]) {
      const feld = feldBreite(platz, 1);
      expect(rasterBreite(feld), `${platz} px`).toBeLessThanOrEqual(platz);
      // Und es soll die Breite auch ausnutzen, nicht nur knapp hineinpassen.
      expect(rasterBreite(feld)).toBeGreaterThan(platz - 30);
    }
  });

  it("macht die Felder beim Zoomen größer und beim Verkleinern kleiner", () => {
    const eins = feldBreite(1200, 1);
    expect(feldBreite(1200, 2)).toBeGreaterThan(eins);
    expect(feldBreite(1200, 0.5)).toBeLessThan(eins);
    // Zweifacher Zoom heißt rund doppelt so breite Felder.
    expect(feldBreite(1200, 2) / eins).toBeCloseTo(2, 1);
  });

  it("bleibt auch auf schmalen Geräten lesbar statt winzig", () => {
    expect(feldBreite(320, 1)).toBeGreaterThanOrEqual(26);
    expect(feldBreite(0, 1)).toBeGreaterThanOrEqual(26);
  });
});
