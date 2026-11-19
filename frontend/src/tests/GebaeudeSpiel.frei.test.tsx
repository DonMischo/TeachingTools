import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import type { ExitGameAttemptSummary, ExitGameData } from "@/lib/api";
import type { FreiOrt, FreiPlan } from "@/lib/gebaeude/frei";

// jsdom kann kein WebGL: Die Welt wird durch Knöpfe ersetzt, die »ankommen«.
vi.mock("@/components/gebaeude/frei/FreiWelt", () => ({
  default: ({ plan, stock, zielOffen, zustaende, objekte, waechter, kaempfe, bosse, stile, gegenschlag, stufe, aktiv, onKampf, onAnkunft }: {
    plan: FreiPlan; stock: number; zielOffen: boolean[]; zustaende: string[][]; objekte: string[][]; waechter: boolean[]; kaempfe?: (string | undefined)[][]; bosse?: (string | undefined)[]; stile: string[];
    gegenschlag: number; stufe: string; aktiv: boolean; onKampf: (gut: boolean, art: string, reaktion: number | null) => void;
    onAnkunft: (o: FreiOrt) => void;
  }) => (
    <div data-testid="welt" data-stock={stock} data-gegenschlag={gegenschlag} data-stufe={stufe} data-aktiv={String(aktiv)} data-ziel={String(zielOffen[stock])} data-zustaende={zustaende[stock].join(",")}
      data-objekte={objekte[stock].join(",")} data-waechter={String(waechter[stock])} data-stile={stile.join(",")} data-kaempfe={(kaempfe?.[stock] ?? []).map(k => k ?? "-").join(",")} data-boss={bosse?.[stock] ?? "-"}
      data-plaetze={plan.ebenen.map(e => e.raeume.length).join(",")}>
      {zustaende[stock].map((_, k) => (
        <button key={k} onClick={() => onAnkunft({ art: "raum", raum: k })}>ankommen {k}</button>
      ))}
      <button onClick={() => onAnkunft({ art: "ziel" })}>ankommen ziel</button>
      <button onClick={() => onKampf(true, "ausweichen", 0.42)}>kampf gewonnen</button>
      <button onClick={() => onKampf(false, "konter", null)}>kampf verloren</button>
    </div>
  ),
}));
vi.mock("@/components/gebaeude/Gebaeude", () => ({ default: () => <div data-testid="buehne" /> }));

const postEvent = vi.fn();
vi.mock("@/lib/api", async orig => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: { exitgame: { attempts: { postEvent: (...a: unknown[]) => postEvent(...a) } } },
}));

import GebaeudeSpiel from "@/components/exitgame/GebaeudeSpiel";
import { STILE, type Stil } from "@/components/gebaeude/szene";
import { istOrganisch, weltVon } from "@/components/gebaeude/frei/welt";

const data: ExitGameData = {
  title: "Testwelt",
  subject: "Mathe",
  slides: [
    { id: "e1", type: "explanation", title: "Erklärung eins", text: "So geht das." },
    { id: "a1", type: "task", title: "Aufgabe eins", task: { kind: "single", question: "1+1?", answers: [{ text: "2" }, { text: "3" }], codeFragment: "ZW" } },
    { id: "t1", type: "door", title: "Tor eins" },
    { id: "a2", type: "task", title: "Aufgabe zwei", task: { kind: "input", question: "2+2?" } },
  ],
};

const attempt = (solved: string[]) => ({ id: 7, solved_slide_ids: solved } as unknown as ExitGameAttemptSummary);

function spiel(solved: string[], stil?: Stil, stile?: (Stil | undefined)[], onFinish = vi.fn(), spielDaten: ExitGameData = data) {
  renderWithProviders(
    <GebaeudeSpiel code="WELT01" attempt={attempt(solved)} exitgameId={1} data={spielDaten} variantChoices={{}} art="frei" stil={stil} stile={stile}
      fragments={[]} adaptation={null} onSlideSolved={vi.fn()} onAdaptation={vi.fn()} onFinish={onFinish} />,
  );
  return onFinish;
}

describe("TaskCrawler als freie 3D-Welt", () => {
  beforeEach(() => { postEvent.mockReset().mockResolvedValue({}); localStorage.clear(); });

  it("reicht die im TaskCrawler vorgegebenen Minispiele je Aufgabe und Tor an die Welt", () => {
    localStorage.setItem("hp_frei_kampf", "mittel");
    const mit = { ...data, slides: data.slides.map(s => (s.id === "a1" ? { ...s, minispiel: "block" } : s.id === "t1" ? { ...s, minispiel: "kraft" } : s)) };
    spiel([], undefined, undefined, vi.fn(), mit);
    const w = screen.getByTestId("welt");
    expect(w.dataset.kaempfe).toBe("-,block");
    expect(w.dataset.boss).toBe("kraft");
  });

  it("ohne Minispiele (gebaeude.minispiele = false): keine Kämpfe, keine Stufenwahl", () => {
    spiel([], undefined, undefined, vi.fn(), { ...data, gebaeude: { ansicht: "frei", minispiele: false } });
    const w = screen.getByTestId("welt");
    expect(screen.queryByText(/Wie schwer sollen die Kämpfe sein/)).toBeNull();
    expect(w.dataset.stufe).toBe("aus");
    expect(w.dataset.aktiv).toBe("true");
    expect(screen.queryByRole("group", { name: "Schwierigkeit der Kämpfe" })).toBeNull();
    expect(screen.getByText(/keine Kämpfe/)).toBeInTheDocument();
  });

  it("fragt beim ersten Mal nach der Schwierigkeit der Kämpfe und merkt sie sich", () => {
    spiel([]);
    const w = screen.getByTestId("welt");
    // bis zur Wahl: keine Kämpfe, die Welt wartet
    expect(screen.getByText(/Wie schwer sollen die Kämpfe sein/)).toBeInTheDocument();
    expect(w.dataset.stufe).toBe("aus");
    expect(w.dataset.aktiv).toBe("false");
    fireEvent.click(screen.getByText("🙂 Leicht"));
    expect(screen.queryByText(/Wie schwer sollen die Kämpfe sein/)).toBeNull();
    expect(w.dataset.stufe).toBe("leicht");
    expect(w.dataset.aktiv).toBe("true");
    expect(localStorage.getItem("hp_frei_kampf")).toBe("leicht");
  });

  it("stellt die Schwierigkeit oben in der Leiste um und zählt die Kämpfe", () => {
    localStorage.setItem("hp_frei_kampf", "mittel");
    spiel([]);
    const w = screen.getByTestId("welt");
    expect(screen.queryByText(/Wie schwer sollen die Kämpfe sein/)).toBeNull();
    expect(w.dataset.stufe).toBe("mittel");
    const leiste = screen.getByRole("group", { name: "Schwierigkeit der Kämpfe" });
    fireEvent.click(Array.from(leiste.querySelectorAll("button")).find(b => b.textContent === "Schwer")!);
    expect(w.dataset.stufe).toBe("schwer");
    expect(localStorage.getItem("hp_frei_kampf")).toBe("schwer");
    fireEvent.click(screen.getByText("kampf gewonnen"));
    fireEvent.click(screen.getByText("kampf gewonnen"));
    expect(screen.getByText(/2 von 2 gewonnen · Serie 2 🔥 · beste Reaktion 0,42 s/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("kampf verloren"));
    expect(screen.getByText(/2 von 3 gewonnen · beste Reaktion 0,42 s/)).toBeInTheDocument();
  });

  it("baut je Abschnitt eine Karte mit einem Platz je Folie; ohne Stil ist es ein Wald, jede Aufgabe ein Monster", () => {
    spiel([]);
    const w = screen.getByTestId("welt");
    expect(screen.queryByTestId("buehne")).toBeNull();
    expect(w.dataset.plaetze).toBe("2,1");
    expect(w.dataset.stile).toBe("wald,wald");
    expect(w.dataset.zustaende).toBe("info,offen");
    expect(w.dataset.ziel).toBe("false");
    // die Erklärung behält ihr Objekt (in der Welt steht dort Erz), die Aufgabe ist ein Monster, das Tor bewacht ein Boss
    expect(w.dataset.objekte!.split(",")[1]).toBe("monster");
    expect(w.dataset.objekte!.split(",")[0]).not.toBe("monster");
    expect(w.dataset.waechter).toBe("true");
    expect(w.dataset.gegenschlag).toBe("0");
    expect(screen.getByText(/Abschnitt 1 \/ 2/)).toBeInTheDocument();
  });

  it("öffnet bei der Ankunft die Folie und führt durchs offene Tor in den nächsten Abschnitt", () => {
    const fertig = spiel(["a1", "t1"]);
    // Wiedereinstieg: das erste Tor ist offen, es geht im zweiten Abschnitt weiter
    expect(screen.getByTestId("welt").dataset.stock).toBe("1");
    fireEvent.click(screen.getByText("ankommen 0"));
    expect(screen.getByText("2+2?")).toBeInTheDocument();
    expect(postEvent).toHaveBeenCalledWith(7, "a2", "view", { slide_index: 3 });
    fireEvent.click(screen.getByText("Später lösen"));
    fireEvent.click(screen.getByText("ankommen ziel"));
    expect(fertig).toHaveBeenCalled();
  });

  it("nennt die Erklärung beim Öffnen einen Info-Splitter", () => {
    spiel([]);
    fireEvent.click(screen.getByText("ankommen 0"));
    expect(screen.getByText("💎 Info-Splitter …")).toBeInTheDocument();
    expect(screen.getByText("So geht das.")).toBeInTheDocument();
  });

  it("ordnet jedem Stil eine Welt zu: Wald, Garten, Höhlen — alles andere ist ein Gebäude", () => {
    const welten = Object.fromEntries((Object.keys(STILE) as Stil[]).map(s => [s, weltVon(s)]));
    expect(welten).toMatchObject({
      wald: "wald", winter: "winter", oase: "oase", pilze: "pilze", garten: "garten",
      hoehle: "hoehle", steinzeit: "hoehle", lava: "hoehle", klassisch: "gebaeude", burg: "gebaeude",
    });
    expect(Object.values(welten).filter(w => w === "gebaeude")).toHaveLength(Object.keys(STILE).length - 8);
    // gerade Karten für Gebäude und Garten, angenagte für Wälder und Höhle
    expect((["wald", "winter", "oase", "pilze", "hoehle", "garten", "burg"] as Stil[]).map(istOrganisch)).toEqual([true, true, true, true, true, false, false]);
  });

  it("nimmt je Abschnitt einen eigenen Stil; wo keiner steht, gilt der gemeinsame", () => {
    spiel([], "burg", [undefined, "lava"]);
    expect(screen.getByTestId("welt").dataset.stile).toBe("burg,lava");
  });
});
