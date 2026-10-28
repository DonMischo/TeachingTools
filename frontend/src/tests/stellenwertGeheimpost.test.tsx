/**
 * Geheimbotschaft: Kopieren klappt auch ohne https, Post geht nur an
 * Anwesende, die Sperre zählt herunter, angenommene Post landet zum Knacken
 * im Entschlüsseln-Blatt.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Geheimbotschaft from "@/components/stellenwert/spiele/Geheimbotschaft";
import { api, type GeheimStand } from "@/lib/api";
import { kopiereText } from "@/lib/zwischenablage";

const STAND: GeheimStand = {
  ich: { schluessel: "g:ich", name: "Ich" },
  anwesend: [{ schluessel: "g:mia", name: "Mia" }],
  eingang: [],
  gesendet: [],
  sperre_sekunden: 0,
};

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Kopieren", () => {
  it("nimmt ohne sichere Verbindung den alten Weg über execCommand", async () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    const exec = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    expect(await kopiereText("48 69")).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("zeigt den Code zum Markieren, wenn gar nichts geht", async () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    Object.defineProperty(document, "execCommand", { value: () => false, configurable: true });
    render(<Geheimbotschaft />);
    fireEvent.click(screen.getByRole("button", { name: /Verschlüsseln/ }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Code kopieren/ })); });
    expect((screen.getByLabelText("Code zum Kopieren") as HTMLTextAreaElement).value).toMatch(/^54 72 65/);
  });
});

describe("Geheimpost", () => {
  it("ohne Sitzung kein Verschicken, nur der Hinweis", () => {
    render(<Geheimbotschaft />);
    fireEvent.click(screen.getByRole("button", { name: /Verschlüsseln/ }));
    expect(screen.getByText(/Verschicken geht in einer Sitzung/)).toBeTruthy();
  });

  it("schickt an eine anwesende Person, danach läuft die Sperre", async () => {
    let stand = STAND;
    vi.spyOn(api.toolSessions, "geheimpost").mockImplementation(async () => stand);
    const senden = vi.spyOn(api.toolSessions, "geheimpostSenden").mockImplementation(async (_c, body) => {
      stand = { ...STAND, sperre_sekunden: 180, gesendet: [{ id: 1, von_name: "Ich", an_name: "Mia", basis: 16, status: "offen", inhalt: body.inhalt }] };
      return stand.gesendet[0];
    });
    render(<Geheimbotschaft zugang={{ code: "ABCD", token: "t" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Verschlüsseln/ }));
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("Empfänger"), { target: { value: "g:mia" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Schicken/ })); });
    expect(senden).toHaveBeenCalledWith("ABCD", expect.objectContaining({ an: "g:mia", basis: 16 }), "t");
    expect(screen.getByText(/Nächste Botschaft in 3:00/)).toBeTruthy();
    expect(screen.getByText(/An Mia: ⏳ wartet/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Schicken/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("zeigt den Fehler des Servers", async () => {
    vi.spyOn(api.toolSessions, "geheimpost").mockResolvedValue(STAND);
    vi.spyOn(api.toolSessions, "geheimpostSenden").mockRejectedValue(new Error('{"detail":"Diese Person ist gerade nicht in der Sitzung."}'));
    render(<Geheimbotschaft zugang={{ code: "ABCD" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Verschlüsseln/ }));
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("Empfänger"), { target: { value: "g:mia" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Schicken/ })); });
    expect(screen.getByRole("alert").textContent).toBe("Diese Person ist gerade nicht in der Sitzung.");
  });

  it("Eingang: erst annehmen, dann liegt die Botschaft zum Knacken bereit", async () => {
    vi.spyOn(api.toolSessions, "geheimpost").mockResolvedValue({
      ...STAND, eingang: [{ id: 7, von_name: "Mia", an_name: "Ich", basis: 2, status: "offen", inhalt: null }],
    });
    const antwort = vi.spyOn(api.toolSessions, "geheimpostAntwort").mockResolvedValue(
      { id: 7, von_name: "Mia", an_name: "Ich", basis: 2, status: "angenommen", inhalt: "01001000 01101001" });
    render(<Geheimbotschaft zugang={{ code: "ABCD" }} />);
    await act(async () => {});
    expect(screen.getByText(/schickt dir eine Geheimbotschaft/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Annehmen/ })); });
    expect(antwort).toHaveBeenCalledWith("ABCD", 7, true, null);
    expect(screen.getByText(/Botschaft von Mia/)).toBeTruthy();
    // zwei Bytes, im Binärmodus
    expect(screen.getByRole("button", { name: "01001000" })).toBeTruthy();
    expect(screen.getAllByLabelText(/^Zeichen \d$/)).toHaveLength(2);
  });
});
