import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StufeApps from "@/components/maus/StufeApps";
import { APPS } from "@/lib/maus/windows";

describe("Maus-Führerschein: Welche App?", () => {
  // Math.random nahe 1 lässt ziehKarten (Fisher-Yates) die Reihenfolge
  // unverändert — die ersten Karten der Runde stehen damit fest.
  beforeEach(() => { vi.spyOn(Math, "random").mockReturnValue(0.999); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("klickt man eine Karte und dann eine richtige App-Kachel, verschwindet die Karte und ein Erfolgshinweis erscheint", async () => {
    const user = userEvent.setup();
    render(<StufeApps avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);

    const karte = screen.getByText("Ein Bild malen");
    await user.click(karte);
    const kachel = screen.getByText(APPS.paint.name).closest("button")!;
    await user.click(kachel);

    expect(screen.queryByText("Ein Bild malen")).not.toBeInTheDocument();
    expect(screen.getByText(/Richtig!/)).toBeInTheDocument();
  });

  it("klickt man eine falsche Kachel, bleibt die Karte und ein Hinweis erscheint", async () => {
    const user = userEvent.setup();
    render(<StufeApps avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);

    const karte = screen.getByText("Ein Bild malen");
    await user.click(karte);
    const kachel = screen.getByText(APPS.vlc.name).closest("button")!;
    await user.click(kachel);

    expect(screen.getByText("Ein Bild malen")).toBeInTheDocument();
    expect(screen.getByText(/geht das nicht so gut/)).toBeInTheDocument();
  });
});
