/**
 * Die KI-Werkstatt von außen: die vier Stationen hängen zusammen, und der
 * Fingerabdruck des Textes landet als Seed im Bilder-Reiter.
 *
 * Der Zerleger und das Netz sind je für sich in kiTokenizer.test.ts und
 * kiWortnetz.test.ts geprüft; hier geht es nur um den Weg durch das Werkzeug.
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, within } from "@testing-library/react";
import KiWerkstatt from "@/components/ki/KiWerkstatt";

/** Klickt sich vom Auftrag bis in das Netz durch. */
function bisZumNetz() {
  fireEvent.click(screen.getByText("Los →"));
  fireEvent.click(screen.getByText("Prüfen"));
  fireEvent.click(screen.getByText("Weiter zum Netz →"));
}

/** Ein Wort aus dem Netz wählen — die Knoten sind SVG-Gruppen, kein <button>. */
function waehle(container: HTMLElement, wort: string) {
  const netz = container.querySelector("svg[aria-label^='Wortnetz']")!;
  const treffer = [...netz.querySelectorAll("g[role='button']")]
    .find(g => g.querySelector("text")?.textContent === wort);
  if (!treffer) throw new Error(`»${wort}« wird gerade nicht angeboten`);
  fireEvent.click(treffer);
}

/** Solange das wahrscheinlichste Wort nehmen, bis ein Punkt gefallen ist. */
function schreibeBisZumPunkt(container: HTMLElement) {
  for (let i = 0; i < 30; i++) {
    const netz = container.querySelector("svg[aria-label^='Wortnetz']")!;
    const knoten = [...netz.querySelectorAll("g[role='button']")]
      .filter(g => g.querySelectorAll("text").length === 2);  // nur echte Vorschläge
    const punkt = knoten.find(g => g.querySelector("text")?.textContent === ".");
    fireEvent.click(punkt ?? knoten[0]);
    if (punkt) return;
  }
  throw new Error("kam nicht zu einem Punkt");
}

describe("Weg durch die Werkstatt", () => {
  it("zeigt den Auftrag und führt in den Zerleger", () => {
    render(<KiWerkstatt />);
    expect(screen.getByText(/Schreibe einen kurzen Text über eine Katze/)).toBeTruthy();
    fireEvent.click(screen.getByText("Los →"));
    expect(screen.getByText("✂️ Wo schneidet die Maschine?")).toBeTruthy();
  });

  it("deckt beim Prüfen die Stücke samt Nummern auf", () => {
    render(<KiWerkstatt />);
    fireEvent.click(screen.getByText("Los →"));
    fireEvent.click(screen.getByText("Prüfen"));
    // »Schreibe« zerfällt in Stamm und Endung, »Katze.« bleibt samt Punkt ein Stück.
    expect(screen.getByText("Schreib")).toBeTruthy();
    expect(screen.getByText("Katze.")).toBeTruthy();
    expect(screen.getByText(/9 Zahlen/)).toBeTruthy();
  });

  it("schreibt den Text Wort für Wort und lässt ihn zurücknehmen", () => {
    const { container } = render(<KiWerkstatt />);
    bisZumNetz();
    waehle(container, "die");
    waehle(container, "Katze");
    expect(screen.getByText("Die Katze")).toBeTruthy();
    fireEvent.click(screen.getByText("↶ letztes Wort zurück"));
    expect(screen.getByText("Die")).toBeTruthy();
  });

  it("gibt »Fertig« erst frei, wenn ein Satz zu Ende ist", () => {
    const { container } = render(<KiWerkstatt />);
    bisZumNetz();
    waehle(container, "die");
    expect(screen.getByText("✓ Fertig").closest("button")!.disabled).toBe(true);
    schreibeBisZumPunkt(container);
    expect(screen.getByText("✓ Fertig").closest("button")!.disabled).toBe(false);
  });

  it("zeigt am Ende Erwartbarkeit und Fingerabdruck", () => {
    const { container } = render(<KiWerkstatt />);
    bisZumNetz();
    schreibeBisZumPunkt(container);
    fireEvent.click(screen.getByText("✓ Fertig"));

    // »Erwartbarkeit« steht auch im Erklärtext darunter — die Kachel hängt am
    // Titel-Attribut, das sie eindeutig macht.
    expect(screen.getByTitle(/Wie sehr die Maschine/)).toBeTruthy();
    const abdruck = screen.getByTitle(/startet gleich das Bild/);
    expect(within(abdruck).getByText(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/)).toBeTruthy();
  });

  it("weist ohne Sitzung auf den QR hin, statt eine leere Tafel zu zeigen", () => {
    const { container } = render(<KiWerkstatt />);
    bisZumNetz();
    schreibeBisZumPunkt(container);
    fireEvent.click(screen.getByText("✓ Fertig"));
    expect(screen.getByText(/Die gemeinsame Tafel gibt es in einer Sitzung/)).toBeTruthy();
    expect(screen.queryByText("📌 An die Tafel")).toBeNull();
  });
});

describe("Bilder-Reiter", () => {
  it("übernimmt den Fingerabdruck als Seed", () => {
    const { container } = render(<KiWerkstatt />);
    bisZumNetz();
    schreibeBisZumPunkt(container);
    fireEvent.click(screen.getByText("✓ Fertig"));
    const abdruck = within(screen.getByTitle(/startet gleich das Bild/))
      .getByText(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/).textContent!;

    fireEvent.click(screen.getByText("🖼️ Bilder"));
    expect(screen.getByText(new RegExp(`Seed ${abdruck}`))).toBeTruthy();
  });

  it("sagt beim Rückwärtslaufen dazu, dass das geschummelt ist", () => {
    render(<KiWerkstatt />);
    fireEvent.click(screen.getByText("🖼️ Bilder"));
    fireEvent.click(screen.getByText("✨ Entrauschen"));
    expect(screen.getByText(/geschummelt/)).toBeTruthy();
  });
});

describe("Tafel in einer Sitzung", () => {
  it("gibt den Text unter dem Sitzungscode ab", async () => {
    const abgeben = vi.fn().mockResolvedValue({
      id: 1, name: "Mia", thema: "katze", text: "Die Katze schläft.",
      wert: 0.3, mut: 3, signatur: "AB1-C23", selbst: true,
    });
    vi.doMock("@/lib/api", () => ({
      api: {
        toolSessions: {
          beitraege: vi.fn().mockResolvedValue([]),
          beitragAbgeben: abgeben,
          beitraegeLeeren: vi.fn(),
          create: vi.fn(),
        },
      },
    }));
    vi.resetModules();
    const { default: Werkstatt } = await import("@/components/ki/KiWerkstatt");

    const { container } = render(<Werkstatt zugang={{ code: "AB12", token: "t", name: "Mia" }} />);
    bisZumNetz();
    schreibeBisZumPunkt(container);
    fireEvent.click(screen.getByText("✓ Fertig"));
    fireEvent.click(screen.getByText("📌 An die Tafel"));

    expect(abgeben).toHaveBeenCalled();
    const [code, koerper, token] = abgeben.mock.calls[0];
    expect(code).toBe("AB12");
    expect(token).toBe("t");
    expect(koerper.name).toBe("Mia");
    expect(koerper.text.endsWith(".")).toBe(true);
    vi.doUnmock("@/lib/api");
  });
});
