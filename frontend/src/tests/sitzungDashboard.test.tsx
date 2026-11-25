import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SitzungDashboard from "@/components/sitzung/SitzungDashboard";
import type { SitzungAnsicht } from "@/lib/sitzung/typen";

const m = vi.hoisted(() => ({ uebersicht: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { sitzungen: { uebersicht: m.uebersicht } } }));

const jetzt = new Date().toISOString();
const zeile = (name: string, daten: Record<string, unknown>, extra = {}) => ({
  name, klasse: "7a", gast: false, daten, aktuell: null, beigetreten_am: jetzt, aktualisiert_am: jetzt, fertig_am: null, ...extra,
});

const ansicht: SitzungAnsicht = {
  spalten: [{ id: "p", titel: "Punkte", art: "zahl", wert: d => (d.p as number) ?? null }],
  aufgaben: [{ id: "a", titel: "Aufgabe A" }, { id: "b", titel: "Aufgabe B" }],
  geschafft: (d, id) => ((d.ok as string[]) ?? []).includes(id),
  rang: { titel: "Zeit", art: "zeit", richtung: "min", wert: d => (d.ms as number) ?? null },
};

function zeige(a?: SitzungAnsicht) {
  return render(<QueryClientProvider client={new QueryClient()}><SitzungDashboard code="ABC" ansicht={a} /></QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  m.uebersicht.mockResolvedValue({
    code: "ABC", tool_slug: "x", status: "open",
    zeilen: [zeile("Ada", { p: 3, ok: ["a"], ms: 9000 }), zeile("Bo", { p: 5, ok: ["a", "b"], ms: 7000 }, { fertig_am: jetzt })],
  });
});

describe("SitzungDashboard", () => {
  it("Tabelle zeigt Spalten der Ansicht und wer fertig ist", async () => {
    zeige(ansicht);
    const tabelle = await screen.findByTestId("dashboard-tabelle");
    expect(within(tabelle).getByText("Ada")).toBeInTheDocument();
    expect(within(tabelle).getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/2 dabei · 1 fertig/)).toBeInTheDocument();
  });

  it("Matrix zeigt je Aufgabe die Quote, Rangliste sortiert nach Wertung", async () => {
    const u = userEvent.setup();
    zeige(ansicht);
    await screen.findByTestId("dashboard-tabelle");
    await u.click(screen.getByRole("button", { name: /Matrix/ }));
    const matrix = screen.getByTestId("dashboard-matrix");
    expect(within(matrix).getByText("100%")).toBeInTheDocument();
    expect(within(matrix).getByText("50%")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: /Rangliste/ }));
    const plaetze = within(screen.getByTestId("dashboard-rangliste")).getAllByRole("listitem");
    expect(plaetze[0]).toHaveTextContent("Bo");
    expect(localStorage.getItem("hp_dashboard_ansicht")).toBe("rangliste");
  });

  it("ohne Ansicht nur Name und gerade, keine Matrix/Rangliste", async () => {
    zeige();
    await screen.findByTestId("dashboard-tabelle");
    expect(screen.queryByRole("button", { name: /Matrix/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Rangliste/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Kacheln/ })).toBeInTheDocument();
  });
});
