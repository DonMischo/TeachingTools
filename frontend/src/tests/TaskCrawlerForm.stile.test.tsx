/** Editor: je Abschnitt ein eigener Stil (gebaeude.stile), leer = wie der Baustil. */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { renderWithProviders } from "./helpers";
import { api, type ExitGameData } from "@/lib/api";
import { TaskCrawlerForm } from "@/components/vorlagen/TaskCrawlerForm";

const start: ExitGameData = {
  title: "Testwelt", subject: "Mathe", gebaeude: { ansicht: "frei", stil: "wald" },
  slides: [
    { id: "e1", type: "explanation", title: "Eins" },
    { id: "t1", type: "door", title: "Tor eins" },
    { id: "e2", type: "explanation", title: "Zwei" },
    { id: "t2", type: "door", title: "Tor zwei" },
  ],
};

describe("TaskCrawler-Editor: Stil je Abschnitt", () => {
  it("setzt den Stil eines Abschnitts, Lücken bleiben null und hinten wird gekürzt", async () => {
    vi.spyOn(api.exitgame, "katalog").mockResolvedValue({
      ansichten: { folien: "", frei: "" }, stile: { wald: "", hoehle: "", pilze: "" }, objekte: {}, werkzeuge: {},
    });
    const onWert = vi.fn();
    function Huelle() {
      const [v, setV] = useState(start);
      return <TaskCrawlerForm value={v} onChange={n => { setV(n as ExitGameData); onWert(n); }} />;
    }
    renderWithProviders(<Huelle />);
    const zwei = await screen.findByLabelText("Stil von Abschnitt 2");
    expect(screen.getByLabelText("Stil von Abschnitt 1")).toHaveValue("");
    fireEvent.change(zwei, { target: { value: "hoehle" } });
    expect(onWert.mock.lastCall![0].gebaeude.stile).toEqual([null, "hoehle"]);
    fireEvent.change(screen.getByLabelText("Stil von Abschnitt 1"), { target: { value: "pilze" } });
    expect(onWert.mock.lastCall![0].gebaeude.stile).toEqual(["pilze", "hoehle"]);
    fireEvent.change(screen.getByLabelText("Stil von Abschnitt 2"), { target: { value: "" } });
    expect(onWert.mock.lastCall![0].gebaeude.stile).toEqual(["pilze"]);
    fireEvent.change(screen.getByLabelText("Stil von Abschnitt 1"), { target: { value: "" } });
    expect(onWert.mock.lastCall![0].gebaeude.stile).toBeUndefined();
  });
});
