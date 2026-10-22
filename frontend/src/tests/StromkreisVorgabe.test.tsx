import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BEISPIELE } from "@/lib/stromkreis/beispiele";
import { alsVorgabe, vorgabeAus } from "@/lib/stromkreis/datei";
import Stromkreis from "@/components/stromkreis/Stromkreis";

const m = vi.hoisted(() => ({ get: vi.fn(), einstellungen: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { toolSessions: { get: m.get, einstellungen: m.einstellungen } } }));

beforeAll(() => {
  // jsdom kennt beides nicht; die Zeichenfläche braucht sie nur zum Zeichnen
  globalThis.ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];
});
beforeEach(() => { m.get.mockReset(); m.einstellungen.mockReset(); });

const trafo = BEISPIELE.find(b => b.id === "trafo")!.schaltung;

describe("Vorgabe der Lehrkraft", () => {
  it("Schüler·innen bekommen Schaltung und Arbeitsauftrag", async () => {
    m.get.mockResolvedValue({ code: "ABC", settings: alsVorgabe(trafo, "Miss die Spannung auf der Sekundärseite.") });
    render(<Stromkreis code="ABC" />);
    expect(await screen.findByText("Miss die Spannung auf der Sekundärseite.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zurück zur Vorgabe/ })).toBeInTheDocument();
    expect(screen.queryByText(/Für die Klasse/)).not.toBeInTheDocument();
  });

  it("die Lehrkraft gibt die aktuelle Schaltung an die Klasse", async () => {
    m.get.mockResolvedValue({ code: "ABC", settings: {} });
    m.einstellungen.mockImplementation(async (_code: string, settings: unknown) => ({ code: "ABC", settings }));
    render(<Stromkreis code="ABC" lehrkraft />);
    await waitFor(() => expect(m.get).toHaveBeenCalledWith("ABC"));
    await userEvent.type(screen.getByLabelText(/Arbeitsauftrag/), "Baue um.");
    await userEvent.click(screen.getByRole("button", { name: "Diese Schaltung an die Klasse geben" }));
    await screen.findByText("Die Klasse bekommt jetzt diese Schaltung.");
    const [code, settings] = m.einstellungen.mock.calls[0];
    expect(code).toBe("ABC");
    const v = vorgabeAus(settings);
    expect(v?.aufgabe).toBe("Baue um.");
    expect(v?.schaltung.bauteile.map(t => t.art)).toEqual(["batterie", "schalter", "lampe"]);
  });

  it("zeigt den Fehler der API, wenn die Schaltung zu groß ist", async () => {
    m.get.mockResolvedValue({ code: "ABC", settings: {} });
    m.einstellungen.mockRejectedValue(new Error(JSON.stringify({ detail: "Die Einstellungen sind zu groß." })));
    render(<Stromkreis code="ABC" lehrkraft />);
    await userEvent.click(screen.getByRole("button", { name: "Diese Schaltung an die Klasse geben" }));
    expect(await screen.findByText("Die Einstellungen sind zu groß.")).toBeInTheDocument();
  });

  it("ohne Code: keine Anfrage, kein Lehrkraft-Feld", () => {
    render(<Stromkreis lehrkraft />);
    expect(m.get).not.toHaveBeenCalled();
    expect(screen.queryByText(/Für die Klasse/)).not.toBeInTheDocument();
  });
});
