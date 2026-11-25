import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import { Rennbahn } from "@/components/tippen/Rennbahn";
import { api } from "@/lib/api";

const darfHosten = { wert: true };
vi.mock("@/hooks/useAvailability", () => ({
  useAvailability: () => ({
    can: (_slug: string, cap: string) => (cap === "host" ? darfHosten.wert : true),
    ready: true,
  }),
}));
import Tippen from "@/components/tippen/Tippen";
import Lektionen from "@/components/tippen/Lektionen";
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

  /** Rasterplatz einer Taste: [Spalte, Breite, Reihe, Höhe] in Viertel-Einheiten. */
  function platz(el: Element): [number, number, number, number] {
    const st = (el as HTMLElement).style;
    const [c, cs] = st.gridColumn.split("/").map((t) => parseInt(t.replace(/\D/g, ""), 10));
    const [r, rs] = st.gridRow.split("/").map((t) => parseInt(t.replace(/\D/g, ""), 10));
    return [c, cs, r, rs];
  }

  it("legt keine zwei Tasten übereinander und bleibt in der Reihenbreite", () => {
    // Die Spalten müssen untereinander stehen — sonst zeigt die Tastatur auf
    // eine andere Stelle, als der Finger treffen soll. Seit Plus und Eingabe
    // zwei Reihen hoch sind, steht jeder Platz ausdrücklich im Bauplan; ein
    // Rechenfehler darin würde Tasten überlappen lassen.
    const { container } = render(<Tastatur gedrueckt={new Set()} zeigeFinger bloecke />);
    const tasten = Array.from(container.querySelectorAll("[data-code]"));
    expect(tasten.length).toBeGreaterThan(80);

    const belegt = new Set<string>();
    for (const el of tasten) {
      const [c, cs, r, rs] = platz(el);
      for (let y = r; y < r + rs; y++) {
        for (let x = c; x < c + cs; x++) {
          const zelle = `${x}/${y}`;
          expect(belegt.has(zelle)).toBe(false);
          belegt.add(zelle);
        }
      }
    }
  });

  it("hält den Hauptblock auf 15 Einheiten", () => {
    const { container } = render(<Tastatur gedrueckt={new Set()} zeigeFinger />);
    for (const el of container.querySelectorAll("[data-code]")) {
      const [c, cs] = platz(el);
      expect(c + cs - 1).toBeLessThanOrEqual(REIHENBREITE * 4 + 1);
    }
  });

  it("macht Plus und Eingabe des Ziffernblocks zwei Reihen hoch", () => {
    // Wie auf der echten Tastatur — daran erkennt ein Kind den Block wieder.
    render(<Tastatur gedrueckt={new Set()} zeigeFinger bloecke />);
    expect(platz(taste("NumpadAdd"))[3]).toBe(2);
    expect(platz(taste("NumpadEnter"))[3]).toBe(2);
    expect(platz(taste("Numpad5"))[3]).toBe(1);
  });

  it("zeigt mit den Blöcken auch die Funktionsreihe", () => {
    const { unmount } = render(<Tastatur gedrueckt={new Set()} zeigeFinger bloecke />);
    for (const code of ["Escape", "F1", "F5", "F12", "PrintScreen", "ScrollLock", "Pause"]) {
      expect(taste(code)).toBeInTheDocument();
    }
    unmount();

    // Der Schreibtrainer bleibt beim Hauptblock: keine dieser Tasten wird dort
    // getippt, und der Platz gehört den Buchstaben.
    render(<Tastatur gedrueckt={new Set()} zeigeFinger />);
    expect(document.querySelector('[data-code="Escape"]')).toBeNull();
    expect(document.querySelector('[data-code="F1"]')).toBeNull();
    expect(document.querySelector('[data-code="PrintScreen"]')).toBeNull();
  });

  it("zeigt Navigations- und Ziffernblock nur auf Anfrage", () => {
    // Der Schreibtrainer braucht die Breite für den Hauptblock. Aufgaben, die
    // von Pos1, Ende oder Entf sprechen, brauchen dagegen die Tasten im Bild —
    // was nicht abgebildet ist, kann ein Kind auch nicht suchen.
    const { unmount } = render(<Tastatur gedrueckt={new Set()} zeigeFinger />);
    expect(document.querySelector('[data-code="Home"]')).toBeNull();
    expect(document.querySelector('[data-code="Numpad5"]')).toBeNull();
    unmount();

    render(<Tastatur gedrueckt={new Set()} zeigeFinger bloecke />);
    for (const code of ["Insert", "Home", "PageUp", "Delete", "End", "PageDown",
                        "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight",
                        "NumLock", "Numpad0", "Numpad5", "NumpadAdd", "NumpadEnter"]) {
      expect(taste(code)).toBeInTheDocument();
    }
  });

  it("hebt auch Pos1, Ende und Entf hervor, wenn sie gedrückt werden", () => {
    render(<Tastatur gedrueckt={new Set(["Home", "End", "Delete"])} zeigeFinger={false} bloecke />);
    expect(taste("Home")).toHaveAttribute("data-gedrueckt");
    expect(taste("End")).toHaveAttribute("data-gedrueckt");
    expect(taste("Delete")).toHaveAttribute("data-gedrueckt");
    expect(taste("PageUp")).not.toHaveAttribute("data-gedrueckt");
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

  beforeEach(() => { darfHosten.wert = true; });

  it("bietet Schülern kein Rennen an, sondern erklärt den Weg über den Code", async () => {
    // Ohne diese Sperre bekämen sie beim Anlegen ein 403 vom Server.
    darfHosten.wert = false;
    vi.spyOn(api.tipptexte, "list").mockResolvedValue([]);
    renderWithProviders(<Tippen verwaltung />);
    fireEvent.click(screen.getByRole("tab", { name: /Wettschreiben/ }));

    expect(await screen.findByText(/Ein Rennen startet deine Lehrkraft/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rennen anlegen/ })).not.toBeInTheDocument();
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

describe("Bestenliste", () => {
  const EINTRAEGE = [
    { id: 1, platz: 1, name: "Ada L.", klasse: "7a", gast: false, wert: 260, selbst: false,
      extra: { roh: 260, anschlaege: 300, fehler: 0, dauer_ms: 60000, kontext: "Grundstellung" } },
    { id: 2, platz: 2, name: "Bo M.", klasse: "7a", gast: false, wert: 210, selbst: true,
      extra: { roh: 215, anschlaege: 280, fehler: 4, dauer_ms: 70000, kontext: "Grundstellung" } },
  ];

  beforeEach(() => {
    vi.spyOn(api.tipptexte, "list").mockResolvedValue([]);
    vi.spyOn(api.bestenlisten, "liste").mockResolvedValue(EINTRAEGE);
  });

  it("bleibt Gästen ohne Konto verborgen", () => {
    render(<Tippen />);
    expect(screen.queryByRole("tab", { name: /Bestenliste/ })).not.toBeInTheDocument();
  });

  it("zeigt die Plätze und hebt die eigene Zeile hervor", async () => {
    renderWithProviders(<Tippen verwaltung />);
    fireEvent.click(screen.getByRole("tab", { name: /Bestenliste/ }));

    expect(await screen.findByText("Ada L.")).toBeInTheDocument();
    expect(document.querySelector('[data-platz="1"]')).toHaveTextContent("Ada L.");
    expect(document.querySelector("[data-selbst]")).toHaveTextContent("Bo M.");
  });

  it("wechselt zwischen den drei Listen", async () => {
    renderWithProviders(<Tippen verwaltung />);
    fireEvent.click(screen.getByRole("tab", { name: /Bestenliste/ }));
    await screen.findByText("Ada L.");
    expect(api.bestenlisten.liste).toHaveBeenCalledWith("tippen", "lektionen", undefined, {});

    fireEvent.click(screen.getByRole("button", { name: /Tastenjagd/ }));
    await waitFor(() => expect(api.bestenlisten.liste).toHaveBeenCalledWith("tippen", "tastenjagd", undefined, {}));
    // Bei der Tastenjagd zählt die kleinere Zahl — das muss dranstehen.
    expect(screen.getByText(/weniger ist besser/)).toBeInTheDocument();
  });

  it("sagt es, wenn noch niemand eingetragen ist", async () => {
    vi.spyOn(api.bestenlisten, "liste").mockResolvedValue([]);
    renderWithProviders(<Tippen verwaltung />);
    fireEvent.click(screen.getByRole("tab", { name: /Bestenliste/ }));
    expect(await screen.findByText(/Noch kein Eintrag/)).toBeInTheDocument();
  });
});

describe("Ergebnisse melden", () => {
  // Direkt am Lektionsmodus statt durch die ganze Hülle: der Test tippt einen
  // Text Zeichen für Zeichen ab, und jeder Anschlag rendert die Tastatur neu —
  // über die volle Lektion und die Modus-Reiter lief das unter Last in den Timeout.
  const KURZ = {
    id: "kurz",
    titel: "Kurzprobe",
    neueZeichen: "",
    text: "asdf jklö asdf jklö asdf jklö asdf jklö asdf jklö asdf jklö asdf",
  };

  function tippen(text: string) {
    const feld = screen.getByRole("textbox", { name: "Übungstext tippen" });
    for (const c of text) fireEvent.keyDown(feld, { key: c, code: "KeyF" });
  }

  it("meldet nichts, wenn niemand angemeldet ist", () => {
    // Ohne Konto reicht die Hülle keinen Melder durch.
    render(<Lektionen zeigeFinger={false} texte={[KURZ]} />);
    tippen(KURZ.text);
    expect(screen.getByText(/Lektion geschafft/)).toBeInTheDocument();
  });

  it("meldet die fertige Lektion mit Anschlägen, Fehlern und Titel", () => {
    const gemeldet = vi.fn();
    render(<Lektionen zeigeFinger={false} texte={[KURZ]} onErgebnis={gemeldet} />);

    const feld = screen.getByRole("textbox", { name: "Übungstext tippen" });
    fireEvent.keyDown(feld, { key: "x", code: "KeyX" }); // ein Fehlgriff
    tippen(KURZ.text);

    expect(gemeldet).toHaveBeenCalledTimes(1);
    expect(gemeldet.mock.calls[0][0]).toMatchObject({
      fehler: 1,
      anschlaege: KURZ.text.length + 1,
      kontext: "Kurzprobe",
    });
  });

  it("meldet kurze Texte gar nicht erst", () => {
    // Auf zehn Zeichen ist jeder schnell — das gehört nicht in eine Bestenliste.
    const winzig = { ...KURZ, text: "asdf jklö" };
    const gemeldet = vi.fn();
    render(<Lektionen zeigeFinger={false} texte={[winzig]} onErgebnis={gemeldet} />);
    tippen(winzig.text);
    expect(screen.getByText(/Lektion geschafft/)).toBeInTheDocument();
    expect(gemeldet).not.toHaveBeenCalled();
  });

  it("meldet dieselbe Runde nur einmal", () => {
    const gemeldet = vi.fn();
    render(<Lektionen zeigeFinger={false} texte={[KURZ]} onErgebnis={gemeldet} />);
    tippen(KURZ.text);
    // Weitere Anschläge nach dem Ziel ändern nichts mehr.
    tippen("abc");
    expect(gemeldet).toHaveBeenCalledTimes(1);
  });
});
