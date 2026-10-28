/**
 * Geheimbotschaft: Kopieren klappt auch ohne https, Post geht nur an
 * Anwesende, die Sperre zählt herunter, angenommene Post landet zum Knacken
 * im Entschlüsseln-Blatt. Anwesend ist man auf jedem Blatt der Simulation,
 * und die Frage »annehmen?« kommt auch dort.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Geheimbotschaft from "@/components/stellenwert/spiele/Geheimbotschaft";
import Stellenwert, { type StellenwertZugang } from "@/components/stellenwert/Stellenwert";
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

/** die ganze Simulation, gleich in der Geheimbotschaft unter »Verschlüsseln« */
async function zumVerschluesseln(zugang: StellenwertZugang) {
  render(<Stellenwert zugang={zugang} />);
  fireEvent.click(screen.getByRole("button", { name: /Spiele/ }));
  fireEvent.click(screen.getByRole("button", { name: /Geheimbotschaft/ }));
  fireEvent.click(screen.getByRole("button", { name: /Verschlüsseln/ }));
  await act(async () => {});
}

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
    await zumVerschluesseln({ code: "ABCD", token: "t" });
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
    await zumVerschluesseln({ code: "ABCD" });
    fireEvent.change(screen.getByLabelText("Empfänger"), { target: { value: "g:mia" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Schicken/ })); });
    expect(screen.getByRole("alert").textContent).toBe("Diese Person ist gerade nicht in der Sitzung.");
  });

  it("auf der Tafel schon anwesend: das Lebenszeichen geht ohne das Spiel raus", async () => {
    const stand = vi.spyOn(api.toolSessions, "geheimpost").mockResolvedValue(STAND);
    render(<Stellenwert zugang={{ code: "ABCD" }} />);
    await act(async () => {});
    expect(screen.getByRole("button", { name: /Tafel/ }).className).toMatch(/bg-accent/);
    expect(stand).toHaveBeenCalledWith("ABCD", null);
  });

  it("Eingang auf jedem Blatt: annehmen springt zur Geheimbotschaft und legt sie zum Knacken hin", async () => {
    vi.spyOn(api.toolSessions, "geheimpost").mockResolvedValue({
      ...STAND, eingang: [{ id: 7, von_name: "Mia", an_name: "Ich", basis: 2, status: "offen", inhalt: null }],
    });
    const antwort = vi.spyOn(api.toolSessions, "geheimpostAntwort").mockResolvedValue(
      { id: 7, von_name: "Mia", an_name: "Ich", basis: 2, status: "angenommen", inhalt: "01001000 01101001" });
    render(<Stellenwert zugang={{ code: "ABCD" }} />);
    await act(async () => {});
    // noch auf der Tafel — die Frage kommt trotzdem
    expect(screen.getByLabelText("Zahl eintragen")).toBeTruthy();
    expect(screen.getByText(/schickt dir eine Geheimbotschaft/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Annehmen/ })); });
    expect(antwort).toHaveBeenCalledWith("ABCD", 7, true, null);
    expect(screen.getByText(/Botschaft von Mia/)).toBeTruthy();
    // zwei Bytes, im Binärmodus
    expect(screen.getByRole("button", { name: "01001000" })).toBeTruthy();
    expect(screen.getAllByLabelText(/^Zeichen \d$/)).toHaveLength(2);
  });
});
