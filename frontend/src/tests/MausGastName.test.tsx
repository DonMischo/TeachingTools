import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MausFuehrerschein, { schluesselFuerGastName } from "@/components/maus/MausFuehrerschein";

function zeige(props: Parameters<typeof MausFuehrerschein>[0]) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MausFuehrerschein {...props} />
    </QueryClientProvider>,
  );
}

const STAND = { ergebnisse: { klick: { punkte: 1234, dauerMs: 1000, details: [] } }, bestanden: [], hilfe: false };

describe("Maus-Führerschein: Stand der Gäste nach Namen", () => {
  beforeEach(() => localStorage.clear());

  it("macht aus dem Namen einen Schlüssel — ohne Rücksicht auf Groß-/Kleinschreibung und Leerzeichen", () => {
    expect(schluesselFuerGastName("  Mia  Sophie ")).toBe("gast-name-mia sophie");
    expect(schluesselFuerGastName("MIA SOPHIE")).toBe(schluesselFuerGastName("mia sophie"));
    expect(schluesselFuerGastName("   ")).toBeNull();
  });

  it("lädt den Stand unter dem Namen — auch mit anderem Code", () => {
    localStorage.setItem("hp_maus_gast-name-mia", JSON.stringify(STAND));
    zeige({ speicherSchluessel: schluesselFuerGastName("Mia")!, ersatzSchluessel: "gast-NEU123-abc" });
    expect(screen.getByTitle("Punkte aller Stufen")).toHaveTextContent("1.234");
  });

  it("übernimmt einmalig den Stand unter der alten Gast-Id und speichert ihn unter dem Namen", () => {
    localStorage.setItem("hp_maus_gast-ABC123-g7", JSON.stringify(STAND));
    zeige({ speicherSchluessel: schluesselFuerGastName("Mia")!, ersatzSchluessel: "gast-ABC123-g7" });
    expect(screen.getByTitle("Punkte aller Stufen")).toHaveTextContent("1.234");
    expect(JSON.parse(localStorage.getItem("hp_maus_gast-name-mia")!).ergebnisse.klick.punkte).toBe(1234);
  });
});
