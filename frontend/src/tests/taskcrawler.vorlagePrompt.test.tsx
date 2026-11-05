import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api", () => ({ api: { school: { toolFaecher: async () => ({ faecher: { pse: ["Physik"] } }) } } }));

import { VorlageInteraktivDialog } from "@/components/exitgame/VorlageInteraktivDialog";
import { SIM_STATIONEN } from "@/components/exitgame/SimStation";
import { reparaturPrompt } from "@/lib/uploadError";

function zeige(onDownload = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VorlageInteraktivDialog onClose={() => {}} onDownload={onDownload} />
    </QueryClientProvider>,
  );
  return onDownload;
}

describe("Interaktive Vorlage nach Fach", () => {
  it("ohne Auswahl lädt sie alle Werkzeuge", () => {
    const onDownload = zeige();
    fireEvent.click(screen.getByRole("button", { name: /Herunterladen/ }));
    expect(onDownload).toHaveBeenCalledWith(undefined);
  });

  it("mit Fach nur dessen Werkzeuge, von Hand gesetzte Fächer gelten", async () => {
    const onDownload = zeige();
    fireEvent.click(await screen.findByText("Chemie"));
    fireEvent.click(screen.getByRole("button", { name: /Herunterladen/ }));
    const liste: string[] = onDownload.mock.calls[0][0];
    expect(liste).toContain("strukturformeln");
    expect(liste).not.toContain("vierecke");
    // Die Schule hat pse auf Physik umgestellt.
    expect(liste).not.toContain("pse");
    expect(liste.every(w => w in SIM_STATIONEN)).toBe(true);
  });
});

describe("Reparatur-Prompt für die KI", () => {
  it("enthält Auftrag und alle Fehler", () => {
    const text = reparaturPrompt({ message: "Ungültiges TaskCrawler-Format", errors: ["slides[2]: 'id' fehlt", "slides[4]: kind unbekannt"] });
    expect(text).toMatch(/^Meine Datei wurde beim Hochladen abgelehnt/);
    expect(text).toContain("- slides[2]: 'id' fehlt\n- slides[4]: kind unbekannt");
    expect(text).not.toContain("zu lang");
  });

  it("bei kaputtem JSON der Hinweis auf eine abgebrochene Antwort", () => {
    expect(reparaturPrompt({ message: "Ungültiges JSON: Expecting ',' delimiter", errors: [] })).toContain("Abschnitt für Abschnitt");
  });
});
