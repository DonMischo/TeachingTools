import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import { Rennbahn } from "@/components/tippen/Rennbahn";
import { api } from "@/lib/api";

vi.mock("@/hooks/useAvailability", () => ({
  useAvailability: () => ({ can: () => true, ready: true }),
}));
import Tippen from "@/components/tippen/Tippen";
import { Tastatur } from "@/components/tippen/Tastatur";
import { zeichenZuTaste, REIHENBREITE } from "@/lib/tippen/layout";
import { LEKTIONEN } from "@/lib/tippen/lektionen";

function taste(code: string) {
  return document.querySelector(`[data-code="${code}"]`)!;
}

describe("Tastatur", () => {
  it("hebt die nächste Taste hervor", () => {
    render(<Tastatur naechste={zeichenZuTaste("f")} gedrueckt={new Set()} zeigeFinger />);
    expect(taste("KeyF")).toHaveAttribute("data-naechste");
    expect(taste("KeyJ")).not.toHaveAttribute("data-naechste");
  });

  it("hebt bei Großbuchstaben zusätzlich die Umschalttaste der anderen Hand hervor", () => {
    render(<Tastatur naechste={zeichenZuTaste("A")} gedrueckt={new Set()} zeigeFinger />);
    expect(taste("KeyA")).toHaveAttribute("data-naechste");
    expect(taste("ShiftRight")).toHaveAttribute("data-naechste");
    expect(taste("ShiftLeft")).not.toHaveAttribute("data-naechste");
  });

  it("füllt jede Reihe auf dieselbe Breite auf", () => {
    // Die Spalten müssen untereinander stehen — sonst zeigt die Tastatur auf
    // eine andere Stelle, als der Finger treffen soll.
    const { container } = render(<Tastatur gedrueckt={new Set()} zeigeFinger />);
    const reihen = Array.from(container.firstElementChild!.children);
    expect(reihen).toHaveLength(5);
    for (const reihe of reihen) {
      const summe = Array.from(reihe.children)
        .reduce((s, el) => s + parseFloat((el as HTMLElement).style.flexGrow || "0"), 0);
      expect(summe).toBeCloseTo(REIHENBREITE);
    }
  });

  it("zeigt gedrückte Tasten an", () => {
    render(<Tastatur gedrueckt={new Set(["KeyD"])} zeigeFinger={false} />);
    expect(taste("KeyD")).toHaveAttribute("data-gedrueckt");
    expect(taste("KeyF")).not.toHaveAttribute("data-gedrueckt");
  });
});

describe("Tippen", () => {
  const ersteLektion = LEKTIONEN[0].text;

  function feld() {
    return screen.getByRole("textbox", { name: "Übungstext tippen" });
  }

  it("leuchtet auf, solange eine Taste gedrückt ist", () => {
    render(<Tippen />);
    fireEvent.keyDown(feld(), { key: "f", code: "KeyF" });
    expect(taste("KeyF")).toHaveAttribute("data-gedrueckt");
    fireEvent.keyUp(feld(), { key: "f", code: "KeyF" });
    expect(taste("KeyF")).not.toHaveAttribute("data-gedrueckt");
  });

  it("rückt bei richtigem Anschlag zum nächsten Zeichen", () => {
    render(<Tippen />);
    expect(document.querySelector("[data-aktuell]")).toHaveAttribute("data-index", "0");
    fireEvent.keyDown(feld(), { key: ersteLektion[0], code: "KeyF" });
    expect(document.querySelector("[data-aktuell]")).toHaveAttribute("data-index", "1");
  });

  it("hält bei falschem Anschlag die Stelle und zählt den Fehler", () => {
    render(<Tippen />);
    fireEvent.keyDown(feld(), { key: "q", code: "KeyQ" });
    expect(document.querySelector("[data-aktuell]")).toHaveAttribute("data-index", "0");
    expect(screen.getByText("Fehler").previousSibling).toHaveTextContent("1");
  });

  it("überlässt Strg-Kürzel dem Browser", () => {
    render(<Tippen />);
    fireEvent.keyDown(feld(), { key: "a", code: "KeyA", ctrlKey: true });
    expect(document.querySelector("[data-aktuell]")).toHaveAttribute("data-index", "0");
    expect(screen.getByText("Fehler").previousSibling).toHaveTextContent("0");
  });

  it("ignoriert Tottasten", () => {
    render(<Tippen />);
    fireEvent.keyDown(feld(), { key: "Dead", code: "Backquote" });
    expect(screen.getByText("Fehler").previousSibling).toHaveTextContent("0");
  });

  it("zeigt die Umschalttaste, sobald ein Großbuchstabe fällig ist", () => {
    render(<Tippen />);
    // Lektion 6 beginnt mit "Der ..." — großes D, also linke Hand + rechte Umschalttaste.
    fireEvent.change(screen.getByLabelText("Lektion"), { target: { value: "5" } });
    expect(taste("KeyD")).toHaveAttribute("data-naechste");
    expect(taste("ShiftRight")).toHaveAttribute("data-naechste");
  });
});

describe("Modus-Umschalter", () => {
  it("startet im Lektionsmodus", () => {
    render(<Tippen />);
    expect(screen.getByRole("tab", { name: /Lektionen/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Übungstext tippen" })).toBeInTheDocument();
  });

  it("wechselt in den Wortregen", () => {
    render(<Tippen />);
    fireEvent.click(screen.getByRole("tab", { name: /Wortregen/ }));
    expect(screen.getByRole("textbox", { name: /Wortregen/ })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Übungstext tippen" })).not.toBeInTheDocument();
    // Die Tastatur bleibt in jedem Modus stehen.
    expect(taste("KeyF")).toBeInTheDocument();
  });

  it("wechselt in die Tastenjagd", () => {
    render(<Tippen />);
    fireEvent.click(screen.getByRole("tab", { name: /Tastenjagd/ }));
    expect(screen.getByRole("textbox", { name: /Tastenjagd/ })).toBeInTheDocument();
  });

  it("verwirft den Spielstand beim Zurückwechseln", () => {
    render(<Tippen />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Übungstext tippen" }),
      { key: LEKTIONEN[0].text[0], code: "KeyF" });
    expect(document.querySelector("[data-aktuell]")).toHaveAttribute("data-index", "1");

    fireEvent.click(screen.getByRole("tab", { name: /Wortregen/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Lektionen/ }));
    expect(document.querySelector("[data-aktuell]")).toHaveAttribute("data-index", "0");
  });

  it("schaltet die Fingerfarben für alle Modi", () => {
    render(<Tippen />);
    const schalter = screen.getByLabelText("Fingerfarben");
    expect(schalter).toBeChecked();
    fireEvent.click(schalter);
    expect(schalter).not.toBeChecked();
    fireEvent.click(screen.getByRole("tab", { name: /Tastenjagd/ }));
    expect(screen.getByLabelText("Fingerfarben")).not.toBeChecked();
  });
});

describe("Tastenjagd (Bedienung)", () => {
  it("zeigt nach dem Start ein Ziel und hebt es auf der Tastatur hervor", () => {
    render(<Tippen />);
    fireEvent.click(screen.getByRole("tab", { name: /Tastenjagd/ }));
    fireEvent.click(screen.getByRole("button", { name: /Los/ }));

    const ziel = document.querySelector("[data-ziel]");
    expect(ziel).toBeInTheDocument();
    const zeichen = ziel!.getAttribute("data-ziel")!;
    const anschlag = zeichenZuTaste(zeichen)!;
    expect(taste(anschlag.code)).toHaveAttribute("data-naechste");
  });

  it("zählt einen Fehlgriff, ohne weiterzurücken", () => {
    render(<Tippen />);
    fireEvent.click(screen.getByRole("tab", { name: /Tastenjagd/ }));
    fireEvent.click(screen.getByRole("button", { name: /Los/ }));

    const feld = screen.getByRole("textbox", { name: /Tastenjagd/ });
    const ziel = document.querySelector("[data-ziel]")!.getAttribute("data-ziel")!;
    const falsch = ziel === "a" ? "b" : "a";
    fireEvent.keyDown(feld, { key: falsch, code: "KeyA" });

    expect(document.querySelector("[data-ziel]")).toHaveAttribute("data-ziel", ziel);
    expect(screen.getByText("Fehlgriffe").previousSibling).toHaveTextContent("1");
  });
});

describe("Wortregen (Bedienung)", () => {
  it("zeigt vor dem Start eine Anleitung und drei Leben", () => {
    render(<Tippen />);
    fireEvent.click(screen.getByRole("tab", { name: /Wortregen/ }));
    expect(screen.getByRole("button", { name: /Los/ })).toBeInTheDocument();
    expect(screen.getByLabelText("3 Leben")).toBeInTheDocument();
  });

  it("beschränkt den Zeichenvorrat auf die gewählte Lektion", () => {
    render(<Tippen />);
    fireEvent.click(screen.getByRole("tab", { name: /Wortregen/ }));
    fireEvent.change(screen.getByLabelText("Tasten bis Lektion"), { target: { value: "0" } });
    // Lektion 1 ist die Grundstellung — q darf dort nicht vorkommen.
    expect(screen.getByText(/^asdfjklö$/)).toBeInTheDocument();
  });
});

describe("Rennbahn", () => {
  const laeufer = [
    { id: 1, name: "Ada", pos: 30, anschlaege: 32, fehler: 2, dauer_ms: 60000 },
    { id: 2, name: "Bo", pos: 15, anschlaege: 15, fehler: 0, dauer_ms: null },
  ];

  it("zeigt einen Balken je Mitschreiber", () => {
    render(<Rennbahn laeufer={laeufer} laenge={30} />);
    expect(document.querySelectorAll("[data-laeufer]")).toHaveLength(2);
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });

  it("rechnet für Angekommene Anschläge pro Minute aus", () => {
    // 30 Zeichen in 60 Sekunden = 30 A/min.
    render(<Rennbahn laeufer={laeufer} laenge={30} />);
    expect(screen.getByText("30 A/min")).toBeInTheDocument();
  });

  it("zeigt für Laufende den Anteil am Text", () => {
    render(<Rennbahn laeufer={laeufer} laenge={30} />);
    expect(screen.getByText("50 %")).toBeInTheDocument();
  });

  it("sagt es, wenn noch niemand da ist", () => {
    render(<Rennbahn laeufer={[]} laenge={30} />);
    expect(screen.getByText(/Noch niemand da/)).toBeInTheDocument();
  });

  it("hebt den eigenen Balken hervor", () => {
    render(<Rennbahn laeufer={laeufer} laenge={30} ich={2} />);
    expect(screen.getByText("Bo").className).toMatch(/font-black/);
    expect(screen.getByText("Ada").className).not.toMatch(/font-black/);
  });
});

describe("Wettschreiben im Werkzeug", () => {
  it("bleibt Schülern und Gästen verborgen", () => {
    render(<Tippen />);
    expect(screen.queryByRole("tab", { name: /Wettschreiben/ })).not.toBeInTheDocument();
  });

  it("steht der Lehrkraft zur Verfügung", async () => {
    vi.spyOn(api.tipptexte, "list").mockResolvedValue([]);
    renderWithProviders(<Tippen verwaltung />);
    const reiter = screen.getByRole("tab", { name: /Wettschreiben/ });
    fireEvent.click(reiter);
    expect(await screen.findByRole("button", { name: /Rennen anlegen/ })).toBeInTheDocument();
    // Der Renntext kommt aus demselben Material wie die Lektionen.
    expect(screen.getByLabelText("Text für das Rennen")).toBeInTheDocument();
  });
});
