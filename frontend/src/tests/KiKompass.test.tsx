import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import KiKompass from "@/components/kikompass/KiKompass";
import { STATIONEN } from "@/lib/kikompass/stationen";

// Gast ohne Konto: alles läuft im Browser, kein Server nötig.
function zeige() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <KiKompass konto={false} speicherSchluessel="gast-name-test" name="Testkind" />
    </QueryClientProvider>,
  );
}

const stand = () => JSON.parse(localStorage.getItem("hp_kikompass_gast-name-test") ?? "null");

describe("KI-Kompass", () => {
  beforeEach(() => localStorage.clear());

  it("speichert Häkchen als Messpunkt im Browser", () => {
    zeige();
    fireEvent.click(screen.getByRole("tab", { name: /Kompetenzraster/ }));
    fireEvent.click(screen.getByLabelText(/Geräte und Apps nennen/));
    fireEvent.click(screen.getByRole("button", { name: /Messpunkt speichern/ }));
    expect(stand().einschaetzungen).toHaveLength(1);
    expect(stand().einschaetzungen[0].haken).toEqual(["v-0-1"]);
  });

  it("schließt eine Station ab: Selbst-Check + Reflexion landen im Portfolio", () => {
    const s = STATIONEN[0];
    zeige();
    fireEvent.click(screen.getByRole("tab", { name: /KI-Führerschein/ }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(s.titel) }));
    // Geführter Ablauf: über die Schrittleiste zum Selbst-Check.
    fireEvent.click(screen.getByRole("button", { name: /Selbst-Check/ }));
    s.quiz.forEach(f => fireEvent.click(screen.getByLabelText(f.antworten[f.richtig])));
    fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
    expect(screen.getByText(/3 von 3 richtig/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Weiter: .*Reflexion/ }));
    const felder = screen.getAllByRole("textbox");
    felder.forEach((f, i) => fireEvent.change(f, { target: { value: `Meine eigene Antwort Nummer ${i + 1} dazu.` } }));
    fireEvent.click(screen.getByRole("button", { name: "Reflexion speichern" }));
    expect(stand().stationen[s.id].quiz).toBe(3);
    expect(stand().stationen[s.id].erledigt_am).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByText(/Station geschafft/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Nächste Station/ }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(STATIONEN[1].titel);

    fireEvent.click(screen.getByRole("tab", { name: /Portfolio/ }));
    expect(screen.getByText("Meine eigene Antwort Nummer 1 dazu.")).toBeInTheDocument();
  });

  it("zeigt den Reiter für Lehrkräfte nur auf der Verwaltungsseite", () => {
    zeige();
    expect(screen.queryByRole("tab", { name: /Für Lehrkräfte/ })).toBeNull();
  });
});
