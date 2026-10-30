import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ElemonSpiel from "@/components/klikk/elemon/ElemonSpiel";
import Duell from "@/components/klikk/elemon/Duell";
import { qrLesen, qrSpieler, qrWild, starten, neuerElemonStand } from "@/lib/klikk/elemon/spiel";
import { api, type KlikkDuelle } from "@/lib/api";

describe("Elemon-QR-Codes", () => {
  it("Karte und Mitspieler·in werden erkannt, Fremdes nicht", () => {
    expect(qrLesen(qrWild("dragon_evolved", 25))).toEqual({ art: "wild", elemon: "dragon_evolved", stufe: 25 });
    expect(qrLesen(qrSpieler("AB12CD", 7))).toEqual({ art: "spieler", code: "AB12CD", id: 7 });
    expect(qrLesen("ELEMON:W:gibtsnicht:5")).toBeNull();
    expect(qrLesen("https://example.org")).toBeNull();
  });
});

describe("Elemon als eigenes Spiel", () => {
  it("Name aus Vorschlägen, Starter, dann eine abgetippte Karte startet einen wilden Kampf", async () => {
    localStorage.clear();
    render(<ElemonSpiel speicherSchluessel="test" />);
    await act(async () => {});
    const namen = screen.getAllByRole("button").filter(b => /^[a-zäöü]+\.[a-zäöü]+\.\d+$/.test(b.textContent ?? ""));
    expect(namen.length).toBe(3);
    fireEvent.click(namen[0]);
    fireEvent.click(screen.getByText("Nicht erlauben"));
    fireEvent.click(screen.getByText("Funkfuchs"));
    // keine Eltern im eigenen Spiel
    expect(screen.queryByText(/Eltern um Extra-Zeit/)).toBeNull();

    fireEvent.click(screen.getByLabelText("QR-Code scannen"));
    fireEvent.change(screen.getByLabelText("Code abtippen"), { target: { value: qrWild("yeti", 4) } });
    fireEvent.click(screen.getByText("OK"));
    expect(screen.getByText(/Ein wildes Yeti taucht auf/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("hp_elemon_test")!).elemon.gesehen).toContain("yeti");
  });
});

describe("Elemon-Duelle: gezielt herausfordern", () => {
  const z = { code: "AB12CD", token: "t" };
  const e = starten(neuerElemonStand(), "fox");
  const daten: KlikkDuelle = {
    offen: [], meins: null, ich: 3, warten: 0,
    an_mich: [{ id: 9, name: "blaue.ente.7", team: [{ art: "duck", stufe: 4 }] }],
    spieler: [{ id: 5, name: "gelbe.eule.1", team: [{ art: "owl", stufe: 6 }] }],
  };
  const lage = (d: KlikkDuelle) => ({ daten: d, setDaten: vi.fn(), fehler: null, setFehler: vi.fn(), laden: vi.fn(), darf: true });

  it("Anfrage annehmen oder ablehnen, Mitspieler·in herausfordern, eigener QR-Code", () => {
    const anbieten = vi.spyOn(api.klikk, "duellAnbieten").mockResolvedValue({} as never);
    const ablehnen = vi.spyOn(api.klikk, "duellAblehnen").mockResolvedValue({} as never);
    render(<Duell name="rote.katze.3" e={e} z={z} lage={lage(daten)} aendere={vi.fn()} />);
    expect(screen.getByText(/Herausforderung an dich/)).toBeTruthy();
    fireEvent.click(screen.getByText("Ablehnen"));
    expect(ablehnen).toHaveBeenCalledWith(z, 9);
    fireEvent.click(screen.getByText("Herausfordern"));
    expect(anbieten).toHaveBeenCalledWith(z, "rote.katze.3", expect.any(Array), 5);
    expect(screen.getByText("Dein Duell-Code")).toBeTruthy();
  });

  it("nach einer Herausforderung drei Minuten gesperrt", () => {
    render(<Duell name="rote.katze.3" e={e} z={z} lage={lage({ ...daten, warten: 175 })} aendere={vi.fn()} />);
    expect(screen.getByText(/Nächste Herausforderung in 2:55/)).toBeTruthy();
    expect((screen.getByText("Herausfordern") as HTMLButtonElement).disabled).toBe(true);
  });

  it("gescannter Code fordert diese Person gleich heraus", () => {
    const anbieten = vi.spyOn(api.klikk, "duellAnbieten").mockResolvedValue({} as never);
    const erledigt = vi.fn();
    render(<Duell name="rote.katze.3" e={e} z={z} lage={lage(daten)} aendere={vi.fn()} qrZiel={5} qrErledigt={erledigt} />);
    expect(anbieten).toHaveBeenCalledWith(z, "rote.katze.3", expect.any(Array), 5);
    expect(erledigt).toHaveBeenCalled();
  });
});
