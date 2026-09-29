import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/waage/Gleichungswaage", () => ({
  default: ({ vorgabe }: { vorgabe?: Record<string, unknown> }) => <div data-testid="waage">{JSON.stringify(vorgabe)}</div>,
}));

import { SimKnopf } from "@/components/exitgame/SimStation";

describe("Werkzeug an einer Station", () => {
  it("öffnet die Simulation mit der Vorgabe im Vollbild und schließt zur Antwort", async () => {
    render(<SimKnopf sim={{ tool: "gleichungswaage", config: { gleichung: "3x+4=19" } }} frage="Wie groß ist x?" />);
    fireEvent.click(screen.getByText(/Gleichungswaage öffnen/));
    expect(screen.getByRole("dialog", { name: "Gleichungswaage" })).toBeInTheDocument();
    expect(screen.getByText("Wie groß ist x?")).toBeInTheDocument();
    expect(await screen.findByTestId("waage")).toHaveTextContent('{"gleichung":"3x+4=19"}');
    fireEvent.click(screen.getByText("✓ Zur Antwort"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("schließt auch mit Escape", async () => {
    render(<SimKnopf sim={{ tool: "gleichungswaage" }} />);
    fireEvent.click(screen.getByText(/öffnen/));
    await screen.findByTestId("waage");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("meldet ein unbekanntes Werkzeug", () => {
    render(<SimKnopf sim={{ tool: "toaster" }} />);
    expect(screen.getByText(/»toaster« gibt es nicht/)).toBeInTheDocument();
  });
});
