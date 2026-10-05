import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StufeApps from "@/components/maus/StufeApps";
import { artVon } from "@/lib/maus/apps";

type Nutzer = ReturnType<typeof userEvent.setup>;

/** Runde 0 (Dateitypen) lösen: jede Datei auf ihre Art. */
async function dateitypenLoesen(user: Nutzer) {
  for (let karte = document.querySelector<HTMLElement>("[data-karte]"); karte; karte = document.querySelector<HTMLElement>("[data-karte]")) {
    const name = karte.textContent!.replace("📄", "").trim();
    await user.click(karte);
    await user.click(document.querySelector<HTMLElement>(`[data-art="${artVon(name)}"]`)!);
    if (screen.queryByText(/Welche App brauchst du/)) break;
  }
  await screen.findByText("Ein Bild malen", {}, { timeout: 2000 });
}

describe("Maus-Führerschein: Welche App?", () => {
  // Math.random nahe 1 lässt ziehKarten (Fisher-Yates) die Reihenfolge
  // unverändert — die ersten Karten der Runde stehen damit fest.
  beforeEach(() => { vi.spyOn(Math, "random").mockReturnValue(0.999); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("beginnt mit den Dateitypen: falsche Art zeigt auf die Endung, richtige Art nimmt die Karte weg", async () => {
    const user = userEvent.setup();
    render(<StufeApps avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    expect(screen.getByText(/Erst die/)).toBeInTheDocument();
    const karte = document.querySelector<HTMLElement>("[data-karte]")!;
    const name = karte.textContent!.replace("📄", "").trim();
    await user.click(karte);
    await user.click(document.querySelector<HTMLElement>(`[data-art="${artVon(name) === "video" ? "musik" : "video"}"]`)!);
    expect(screen.getByText(/Schau auf die Endung/)).toBeInTheDocument();
    // Die Karte bleibt nach dem Fehlgriff ausgewählt — gleich die richtige Art.
    await user.click(document.querySelector<HTMLElement>(`[data-art="${artVon(name)}"]`)!);
    expect(screen.getByText(/Richtig!/)).toBeInTheDocument();
  });

  it("zeigt beim Draufzeigen, was eine App kann und welche Dateien passen", async () => {
    const user = userEvent.setup();
    render(<StufeApps avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    await dateitypenLoesen(user);
    await user.hover(document.querySelector<HTMLElement>('[data-app-kachel="reader"]')!);
    const info = document.getElementById("app-info-reader")!;
    expect(info).toBeVisible();
    expect(info).toHaveTextContent(".pdf");
  });

  it("klickt man eine Karte und dann eine richtige App-Kachel, verschwindet die Karte und ein Erfolgshinweis erscheint", async () => {
    const user = userEvent.setup();
    render(<StufeApps avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    await dateitypenLoesen(user);

    const karte = screen.getByText("Ein Bild malen");
    await user.click(karte);
    const kachel = document.querySelector<HTMLElement>('[data-app-kachel="paint"]')!;
    await user.click(kachel);

    expect(screen.queryByText("Ein Bild malen")).not.toBeInTheDocument();
    expect(screen.getByText(/Richtig!/)).toBeInTheDocument();
  });

  it("klickt man eine falsche Kachel, bleibt die Karte und ein Hinweis erscheint", async () => {
    const user = userEvent.setup();
    render(<StufeApps avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    await dateitypenLoesen(user);

    const karte = screen.getByText("Ein Bild malen");
    await user.click(karte);
    const kachel = document.querySelector<HTMLElement>('[data-app-kachel="vlc"]')!;
    await user.click(kachel);

    expect(screen.getByText("Ein Bild malen")).toBeInTheDocument();
    expect(screen.getByText(/geht das nicht so gut/)).toBeInTheDocument();
  });
});
