import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import type { ExitGameAttemptSummary, ExitGameData } from "@/lib/api";
import type { FreiOrt, FreiPlan } from "@/lib/gebaeude/frei";

// jsdom kann kein WebGL: Die Welt wird durch Knöpfe ersetzt, die »ankommen«.
vi.mock("@/components/gebaeude/frei/FreiWelt", () => ({
  default: ({ plan, stock, zielOffen, zustaende, objekte, waechter, stile, onAnkunft }: {
    plan: FreiPlan; stock: number; zielOffen: boolean[]; zustaende: string[][]; objekte: string[][]; waechter: boolean[]; stile: string[];
    onAnkunft: (o: FreiOrt) => void;
  }) => (
    <div data-testid="welt" data-stock={stock} data-ziel={String(zielOffen[stock])} data-zustaende={zustaende[stock].join(",")}
      data-objekte={objekte[stock].join(",")} data-waechter={String(waechter[stock])} data-stile={stile.join(",")}
      data-plaetze={plan.ebenen.map(e => e.raeume.length).join(",")}>
      {zustaende[stock].map((_, k) => (
        <button key={k} onClick={() => onAnkunft({ art: "raum", raum: k })}>ankommen {k}</button>
      ))}
      <button onClick={() => onAnkunft({ art: "ziel" })}>ankommen ziel</button>
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
import type { Stil } from "@/components/gebaeude/szene";

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

function spiel(solved: string[], stil?: Stil, stile?: (Stil | undefined)[], onFinish = vi.fn()) {
  renderWithProviders(
    <GebaeudeSpiel code="WELT01" attempt={attempt(solved)} exitgameId={1} data={data} variantChoices={{}} art="frei" stil={stil} stile={stile}
      fragments={[]} adaptation={null} onSlideSolved={vi.fn()} onAdaptation={vi.fn()} onFinish={onFinish} />,
  );
  return onFinish;
}

describe("TaskCrawler als freie 3D-Welt", () => {
  beforeEach(() => postEvent.mockReset().mockResolvedValue({}));

  it("baut je Abschnitt eine Karte mit einem Platz je Folie; ohne Stil ist es ein Wald ohne Monster", () => {
    spiel([]);
    const w = screen.getByTestId("welt");
    expect(screen.queryByTestId("buehne")).toBeNull();
    expect(w.dataset.plaetze).toBe("2,1");
    expect(w.dataset.stile).toBe("wald,wald");
    expect(w.dataset.zustaende).toBe("info,offen");
    expect(w.dataset.ziel).toBe("false");
    expect(w.dataset.objekte).not.toContain("monster");
    expect(w.dataset.waechter).toBe("false");
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

  it("macht aus Höhlenstilen ein Verlies: Monster an den Aufgaben, ein Boss am Tor", () => {
    spiel([], "hoehle");
    const w = screen.getByTestId("welt");
    expect(w.dataset.stile).toBe("hoehle,hoehle");
    expect(w.dataset.objekte).toContain("monster");
    expect(w.dataset.waechter).toBe("true");
  });

  it("nimmt je Abschnitt einen eigenen Stil; wo keiner steht, gilt der gemeinsame", () => {
    spiel([], "burg", [undefined, "lava"]);
    expect(screen.getByTestId("welt").dataset.stile).toBe("burg,lava");
    expect(screen.getByTestId("welt").dataset.waechter).toBe("false");
  });
});
