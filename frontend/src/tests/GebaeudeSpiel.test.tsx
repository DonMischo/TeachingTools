import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import type { ExitGameAttemptSummary, ExitGameData, ExitGameFragment } from "@/lib/api";
import type { Ort } from "@/components/gebaeude/Gebaeude";

// jsdom kann kein WebGL: Die Bühne wird durch Knöpfe ersetzt, die »ankommen«.
vi.mock("@/components/gebaeude/Gebaeude", () => ({
  default: ({ stock, zielOffen, zustaende, objekte, waechter, art, onAnkunft }: {
    stock: number; zielOffen: boolean[]; zustaende: string[][]; objekte: string[][]; waechter: boolean[]; art: string;
    onAnkunft: (o: Ort) => void;
  }) => (
    <div data-testid="buehne" data-stock={stock} data-ziel={String(zielOffen[stock])} data-zustaende={zustaende[stock].join(",")}
      data-objekte={objekte[stock].join(",")} data-waechter={String(waechter[stock])} data-art={art}>
      {zustaende[stock].map((_, k) => (
        <button key={k} onClick={() => onAnkunft({ art: "raum", raum: k })}>ankommen {k}</button>
      ))}
      <button onClick={() => onAnkunft({ art: "ziel" })}>ankommen ziel</button>
      <button onClick={() => onAnkunft({ art: "zurueck" })}>ankommen zurueck</button>
    </div>
  ),
}));

const postEvent = vi.fn();
vi.mock("@/lib/api", async orig => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: { exitgame: { attempts: { postEvent: (...a: unknown[]) => postEvent(...a) } } },
}));

import GebaeudeSpiel from "@/components/exitgame/GebaeudeSpiel";

const data: ExitGameData = {
  title: "Testhaus",
  subject: "Mathe",
  slides: [
    { id: "e1", type: "explanation", title: "Erklärung eins", text: "So geht das." },
    { id: "a1", type: "task", title: "Aufgabe eins", task: { kind: "single", question: "1+1?", answers: [{ text: "2" }, { text: "3" }], codeFragment: "ZW" } },
    { id: "t1", type: "door", title: "Tür eins" },
    { id: "a2", type: "task", title: "Aufgabe zwei", task: { kind: "input", question: "2+2?" } },
  ],
};

const attempt = (solved: string[]): ExitGameAttemptSummary =>
  ({ id: 7, solved_slide_ids: solved } as unknown as ExitGameAttemptSummary);

const frag: ExitGameFragment[] = [{ door_id: "t1", slide_id: "a1", task_index: 0, earned: false, fragment: null }];

function spiel(solved: string[], onFinish = vi.fn(), fragments = frag, art: "haus" | "verlies" | "ebene" = "haus") {
  renderWithProviders(
    <GebaeudeSpiel code="HAUS01" attempt={attempt(solved)} exitgameId={1} data={data} variantChoices={{}} art={art}
      fragments={fragments} adaptation={null} onSlideSolved={vi.fn()} onAdaptation={vi.fn()} onFinish={onFinish} />,
  );
  return onFinish;
}

describe("Exitgame als Gebäude", () => {
  beforeEach(() => postEvent.mockReset().mockResolvedValue({}));

  it("macht aus den Folien Zimmer und hält die Tür zu, bis sie gelöst ist", () => {
    spiel([]);
    const b = screen.getByTestId("buehne");
    expect(b.dataset.stock).toBe("0");
    expect(b.dataset.zustaende).toBe("info,offen");
    expect(b.dataset.ziel).toBe("false");
  });

  it("hält die Tür auch zu, solange die Codeschnipsel noch nicht geladen sind", () => {
    // Die Spielerseite reicht die Schnipsel erst nach dem ersten Zeichnen nach;
    // vorher sah die Tür »leer« aus und man startete im obersten Stockwerk.
    spiel([], vi.fn(), []);
    expect(screen.getByTestId("buehne").dataset.stock).toBe("0");
    expect(screen.getByTestId("buehne").dataset.ziel).toBe("false");
  });

  it("öffnet ein Zimmer bei der Ankunft und meldet den Besuch", () => {
    spiel([]);
    fireEvent.click(screen.getByText("ankommen 1"));
    expect(screen.getByText("1+1?")).toBeInTheDocument();
    expect(postEvent).toHaveBeenCalledWith(7, "a1", "view", { slide_index: 1 });
    fireEvent.click(screen.getByText("Später lösen"));
    expect(screen.queryByText("1+1?")).not.toBeInTheDocument();
  });

  it("zeigt am verschlossenen Treppenhaus die Tür-Folie", () => {
    spiel([]);
    fireEvent.click(screen.getByText("ankommen ziel"));
    expect(screen.getByText("Tür eins")).toBeInTheDocument();
    expect(screen.getByText("🔑 Türcode")).toBeInTheDocument();
    expect(screen.getByTestId("buehne").dataset.stock).toBe("0");
  });

  it("Erklärungen gelten nach dem Lesen als gelesen", () => {
    spiel([]);
    fireEvent.click(screen.getByText("ankommen 0"));
    expect(screen.getByText("So geht das.")).toBeInTheDocument();
    expect(screen.getByTestId("buehne").dataset.zustaende).toBe("gelesen,offen");
  });

  it("geht über die offene Treppe nach oben und endet am Ausgang", () => {
    const fertig = spiel(["a1", "t1"]);
    // Tür unten schon offen → Wiedereinstieg im obersten Stockwerk
    expect(screen.getByTestId("buehne").dataset.stock).toBe("1");
    expect(screen.getByTestId("buehne").dataset.ziel).toBe("true");
    fireEvent.click(screen.getByText("ankommen ziel"));
    expect(fertig).toHaveBeenCalled();
  });

  it("Verlies: Monster in den Aufgabenzimmern, ein Boss bewacht die Tür", () => {
    spiel([], vi.fn(), frag, "verlies");
    const b = screen.getByTestId("buehne");
    expect(b.dataset.art).toBe("verlies");
    // Erklärung: ein Info-Objekt (reihum), Aufgabe: ein Monster
    expect(b.dataset.objekte).toMatch(/^[a-z]+,monster$/);
    expect(b.dataset.waechter).toBe("true");
    fireEvent.click(screen.getByText("ankommen 1"));
    expect(screen.getByText(/Ein Monster stellt dir eine Aufgabe/)).toBeInTheDocument();
    expect(screen.getByText(/Treppe hinab \(Boss\)/)).toBeInTheDocument();
  });

  it("Haus: keine Monster, kein Boss", () => {
    spiel([]);
    const b = screen.getByTestId("buehne");
    expect(b.dataset.objekte).not.toMatch(/monster/);
    expect(b.dataset.waechter).toBe("false");
  });

  it("zurück geht jederzeit ein Stockwerk hinunter", () => {
    spiel(["a1", "t1"]);
    expect(screen.getByTestId("buehne").dataset.stock).toBe("1");
    fireEvent.click(screen.getByText("⬇ Treppe hinunter"));
    fireEvent.click(screen.getByText("ankommen zurueck"));
    expect(screen.getByTestId("buehne").dataset.stock).toBe("0");
    // im ersten Stockwerk gibt es kein Zurück mehr
    expect(screen.queryByText("⬇ Treppe hinunter")).not.toBeInTheDocument();
  });

  it("Ebene: Türen statt Treppen", () => {
    spiel([], vi.fn(), frag, "ebene");
    expect(screen.getByText("Tür zum nächsten Abschnitt")).toBeInTheDocument();
    expect(screen.getByText(/Abschnitt 1 \/ 2/)).toBeInTheDocument();
  });
});
