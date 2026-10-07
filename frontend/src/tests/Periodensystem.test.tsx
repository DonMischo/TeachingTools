/**
 * Prüft das gerenderte Periodensystem: Raster, Suche, Steckbrief und der
 * Weg in die Gleichungswaage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Periodensystem from "@/components/pse/Periodensystem";
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

describe("PSE-Rallye", () => {
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

  // Dieser eine Test spielt zehn Aufgaben durch und zeichnet dabei das Raster
  // immer wieder — unter Last reichen die üblichen 15 s nicht.
  it("schließt die Runde mit Sternen und Erfolgen ab", () => {
    starte();
    for (let i = 0; i < 10; i++) {
      fireEvent.click(gesuchtesFeld());
      fireEvent.click(screen.getByRole("button", { name: i < 9 ? "Weiter" : "Runde abschließen" }));
    }
    expect(screen.getByText(/von 30 Punkten/)).toBeInTheDocument();
    expect(screen.getByText("Neue Erfolge")).toBeInTheDocument();
    expect(screen.getByText(/Erste Rallye/)).toBeInTheDocument();
  }, 40_000);

  it("lässt im Rallye-Modus keinen Steckbrief aufgehen", () => {
    starte();
    fireEvent.click(screen.getByTitle(/^Eisen —/));
    expect(screen.queryByRole("heading", { name: "Eisen" })).not.toBeInTheDocument();
  });
});
