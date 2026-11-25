import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LehrerUebersicht } from "@/components/leben/LehrerUebersicht";
import RockYourLife from "@/components/leben/RockYourLife";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("Rock your Life: Klassenübersicht", () => {
  it("zeigt je Person Stand und Protokoll, CSV-Link mit Code", async () => {
    vi.spyOn(api.sitzungen, "uebersicht").mockResolvedValue({ code: "ABC123", tool_slug: "leben", status: "open", zeilen: [{
      name: "Mia G.", klasse: null, gast: true, aktuell: null, fertig_am: null,
      beigetreten_am: "2026-09-26T09:00:00Z", aktualisiert_am: "2026-09-26T10:00:00Z",
      daten: { figur: "Mia", protokoll_zeilen: 2, zusammenfassung: { datum: "01.10.2026", monat: 4, konto: -120.5, sparkonto: 50, schulden: 139, steuern_gesamt: 0, sv_gesamt: 480,
        job: "Friseur/in", wohnung: "bei den Eltern", beduerfnisse: { hunger: 20, energie: 70 }, schufa: false } },
    }] });
    vi.spyOn(api.leben, "protokoll").mockResolvedValue([{ name: "Mia G.", figur: "Mia",
      protokoll: [{ tag: 3, stunde: 9, datum: "04.07.2026", art: "kauf", text: "Einkauf bei Lidl", betrag: -23.4 }] }]);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LehrerUebersicht code="ABC123" onZu={() => {}} />
    </QueryClientProvider>);
    expect(await screen.findByText("Mia G.")).toBeInTheDocument();
    expect(screen.getByText("Friseur/in")).toBeInTheDocument();
    expect(screen.getByText("hunger 20")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CSV/ })).toHaveAttribute("href", "/api/leben/sitzung/ABC123/protokoll.csv");
    fireEvent.click(screen.getByRole("button", { name: /Protokoll Mia G\. \(2\)/ }));
    expect(await screen.findByText("Einkauf bei Lidl")).toBeInTheDocument();
  });
});

describe("Rock your Life: Start", () => {
  it("verlangt Name und Pflichtnoten, startet dann am 1. Juli 2026", async () => {
    render(<RockYourLife speicherSchluessel="test" />);
    fireEvent.click(await screen.findByRole("button", { name: /Los geht/ }));
    expect(screen.getByText(/Namen/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("z. B. Alex Müller"), { target: { value: "Kim" } });
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    expect(screen.getByText(/fehlen noch Noten/)).toBeInTheDocument();
    for (const sel of screen.getAllByRole("combobox")) {
      if ([...(sel as HTMLSelectElement).options].some((o) => o.value === "6")) fireEvent.change(sel, { target: { value: "2" } });
    }
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    await waitFor(() => expect(screen.getByText(/Mittwoch, 1\. Juli 2026/)).toBeInTheDocument());
    // Spielstand liegt im Browser
    expect(localStorage.getItem("hp_leben_test")).toContain("\"name\":\"Kim\"");
  });
});

describe("Rock your Life: Übung", () => {
  it("zeigt nur die Knöpfe der aktuellen Aufgabe und schaltet Schritt für Schritt frei", async () => {
    render(<RockYourLife speicherSchluessel="uebung" />);
    fireEvent.click(await screen.findByRole("button", { name: /Übung starten/ }));
    expect(await screen.findByText("👋 Hallo!")).toBeInTheDocument();
    expect(screen.getByText(/Danach kommt: 📊 Deine Balken/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Essen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Raus/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
    fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
    // Uhr und Geld: beide anschauen (Maus drüber), erst dann geht es weiter
    expect(await screen.findByText("🕒 Uhr und Geld")).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId("uhr"));
    expect(screen.getByText("🕒 Uhr und Geld")).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId("konto"));
    fireEvent.click(await screen.findByRole("button", { name: /Essen/ }));
    expect(await screen.findByText("🚿 Duschen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Putzen/ })).not.toBeInTheDocument();
    // Übung beenden zeigt alles
    fireEvent.click(screen.getByRole("button", { name: "Übung beenden" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Putzen/ })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Raus/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Übung" })).not.toBeInTheDocument();
  });
});
