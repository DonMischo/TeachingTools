/**
 * Main Character (Oberfläche): Fragebogen → Charakterbogen → Spiel, Stand nur
 * im Browser; in die Sitzung gehen nur Klasse, Woche und Werte. Lehrkräfte
 * sehen Vorführen und Übersicht.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MainCharacter from "@/components/mainCharacter/MainCharacter";
import { FRAGEN } from "@/lib/mainCharacterFragebogen";
import { ABSCHLUSS } from "@/lib/mainCharacter";
import { TAKT_MS } from "@/components/mainCharacter/useLauf";
import { api } from "@/lib/api";

function zeige(props: Partial<Parameters<typeof MainCharacter>[0]> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MainCharacter speicherSchluessel="test" {...props} />
    </QueryClientProvider>,
  );
}
const stand = () => JSON.parse(localStorage.getItem("hp_main_character_test") ?? "null");

describe("Main Character", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("führt durch den Fragebogen zum Charakterbogen mit Vorschlag", () => {
    zeige();
    fireEvent.click(screen.getByRole("button", { name: "Fragebogen starten" }));
    for (const f of FRAGEN) {
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(f.frage);
      fireEvent.click(screen.getByRole("button", { name: f.antworten[0].text }));
    }
    expect(screen.getByText(/Der Fragebogen schlägt/)).toBeInTheDocument();
    expect(screen.getByText("passt zu dir")).toBeInTheDocument();
    const s = stand();
    expect(s.schritt).toBe("bogen");
    expect(s.antworten).toHaveLength(FRAGEN.length);
    expect(Object.values(s.profil.talente).some(t => t !== 1)).toBe(true);
  });

  it("Stärken und Baustellen lassen sich frei ankreuzen", () => {
    zeige();
    fireEvent.click(screen.getByRole("button", { name: /Ohne Fragebogen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Neugierig/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kreativ/ }));
    fireEvent.click(screen.getByRole("button", { name: /Handy-Sog/ }));
    expect(stand().profil.staerken).toEqual(["neugierig", "kreativ"]);
    expect(stand().profil.baustellen).toEqual(["handy"]);
    fireEvent.click(screen.getByRole("button", { name: /Neugierig/ }));
    expect(stand().profil.staerken).toEqual(["kreativ"]);
  });

  it("spielt bis zum Abschluss, meldet nur anonyme Werte und bietet das Zeugnis an", () => {
    vi.useFakeTimers();
    const melde = vi.spyOn(api.mainCharacter, "stand").mockResolvedValue({ ok: true });
    zeige({ zugang: { code: "ABC123", token: "t" } });
    fireEvent.click(screen.getByRole("button", { name: /Ohne Fragebogen/ }));
    fireEvent.change(screen.getByLabelText("Spitzname"), { target: { value: "Pixelfuchs" } });
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    fireEvent.click(screen.getByRole("button", { name: /LOS/ }));
    act(() => { vi.advanceTimersByTime(TAKT_MS * (ABSCHLUSS + 2)); });
    expect(screen.getByText(/Abschluss 2028 — geschafft/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zeugnis als PDF/ })).toBeInTheDocument();
    expect(melde).toHaveBeenCalledTimes(ABSCHLUSS / 5);
    const body = melde.mock.calls.at(-1)![1];
    expect(Object.keys(body).sort()).toEqual(["klasse", "werte", "woche"]);
    expect(body.woche).toBe(ABSCHLUSS);
    expect(JSON.stringify(melde.mock.calls)).not.toContain("Pixelfuchs");
    vi.useRealTimers();
  });

  it("Lehrkräfte sehen Vorführen, Übersicht und Selbst ausprobieren", () => {
    vi.spyOn(api.toolSessions, "create").mockResolvedValue({ code: "ABC123" } as never);
    zeige({ lehrkraft: true });
    expect(screen.getByRole("button", { name: /Vorführen/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Klasse wählen" })).toHaveValue("checker");
    fireEvent.keyDown(window, { key: "3" });
    expect(screen.getByRole("combobox", { name: "Klasse wählen" })).toHaveValue("nerd");
    fireEvent.keyDown(window, { key: "3" });
    expect(screen.getByRole("combobox", { name: "Klasse wählen" })).toHaveValue("gamer");
    fireEvent.click(screen.getByRole("button", { name: /Selbst ausprobieren/ }));
    expect(screen.getByRole("button", { name: "Fragebogen starten" })).toBeInTheDocument();
  });
});
