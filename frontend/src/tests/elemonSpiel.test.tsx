import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ElemonSpiel from "@/components/elemon/ElemonSpiel";
import Duell from "@/components/elemon/Duell";
import { qrItem, qrLesen, qrSpieler, qrWild, starten, neuerElemonStand } from "@/lib/elemon/spiel";
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

  it("Item-Karte abtippen: Menge gutgeschrieben, zweites Mal ist die Karte leer", async () => {
    localStorage.clear();
    render(<ElemonSpiel speicherSchluessel="items" />);
    await act(async () => {});
    fireEvent.click(screen.getAllByRole("button").find(b => /^[a-zäöü]+\.[a-zäöü]+\.\d+$/.test(b.textContent ?? ""))!);
    fireEvent.click(screen.getByText("Nicht erlauben"));
    fireEvent.click(screen.getByText("Panzerkröte"));
    const scannen = (code: string) => {
      fireEvent.click(screen.getByLabelText("QR-Code scannen"));
      fireEvent.change(screen.getByLabelText("Code abtippen"), { target: { value: code } });
      fireEvent.click(screen.getByText("OK"));
    };
    scannen(qrItem("kaefig", 3, 1));
    expect(screen.getByText(/\+3 Käfig!/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("hp_elemon_items")!).elemon.kaefige).toBe(5 + 3);
    scannen(qrItem("kaefig", 3, 1));
    expect(screen.getByText(/Diese Karte ist noch 10 Min. leer/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("hp_elemon_items")!).elemon.kaefige).toBe(8);
  });

  it("ohne Werbung und Käufe: Laden zeigt Free/Pro, eigener Ort entsteht als QR und lässt sich scannen", async () => {
    localStorage.clear();
    render(<ElemonSpiel speicherSchluessel="pro" />);
    await act(async () => {});
    fireEvent.click(screen.getAllByRole("button").find(b => /^[a-zäöü]+\.[a-zäöü]+\.\d+$/.test(b.textContent ?? ""))!);
    fireEvent.click(screen.getByText("Nicht erlauben"));
    fireEvent.click(screen.getByText("Funkfuchs"));
    expect(screen.getByText("FREE")).toBeTruthy();
    fireEvent.click(screen.getByText("🛒 Laden"));
    expect(screen.queryByText(/Goldkäfig-Paket/)).toBeNull();
    expect(screen.queryByText(/Werbung ansehen/)).toBeNull();
    expect(screen.getByTestId("pro-karte").textContent).toMatch(/noch gesperrt/);
    // eigener Ort
    fireEvent.change(screen.getByLabelText("Name des Orts"), { target: { value: "Bibliothek" } });
    fireEvent.click(screen.getByRole("button", { name: /Yeti/ }));
    expect(screen.getByTestId("eigener-ort").textContent).toMatch(/Bibliothek/);
    fireEvent.click(screen.getByLabelText("QR-Code scannen"));
    fireEvent.change(screen.getByLabelText("Code abtippen"), { target: { value: "ELEMON:O:3-3:yeti:Bibliothek" } });
    fireEvent.click(screen.getByText("OK"));
    expect(screen.getByText(/Ein wildes Yeti taucht auf/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("hp_elemon_pro")!).elemon.orte).toEqual(["Bibliothek"]);
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
