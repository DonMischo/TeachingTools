import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { renderWithProviders } from "./helpers";
import { api, type ExitGameSlide } from "@/lib/api";
import { TaskCrawlerForm } from "@/components/vorlagen/TaskCrawlerForm";
import { stationsObjekt } from "@/lib/gebaeude/exitgame";

describe("Boss-Folie", () => {
  it("bekommt im Verlies und sonst das Boss-Objekt", () => {
    const s: ExitGameSlide = { id: "b", type: "boss", title: "Boss" };
    expect(stationsObjekt(s, true)).toBe("boss");
    expect(stationsObjekt(s)).toBe("boss");
  });

  it("legt im Formular einen leeren Challenge-Satz an und speichert Änderungen ohne Titel", () => {
    vi.spyOn(api.exitgame, "katalog").mockResolvedValue({ ansichten: { folien: "" }, stile: {}, objekte: {}, werkzeuge: {} });
    const onWert = vi.fn();
    const start = { title: "T", subject: "mathe", slides: [{ id: "a1", type: "task" as const, title: "Drache", text: "y" }] };
    function G() {
      const [v, setV] = useState(start);
      return <TaskCrawlerForm value={v} onChange={n => { setV(n as typeof start); onWert(n); }} />;
    }
    renderWithProviders(<G />);
    fireEvent.change(screen.getAllByLabelText("Art")[0], { target: { value: "boss" } });
    const boss = onWert.mock.calls.at(-1)![0].slides[0];
    expect(boss.type).toBe("boss");
    expect(boss.challenge).toEqual({ facts: [], challenges: [] });
    expect(boss.task).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "+ Fakt" }));
    const nach = onWert.mock.calls.at(-1)![0].slides[0];
    expect(nach.challenge.facts).toHaveLength(1);
    expect(nach.challenge.title).toBeUndefined();
  });
});
