import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { renderWithProviders } from "./helpers";
import { api } from "@/lib/api";
import { VorlagenEditor } from "@/components/vorlagen/VorlagenEditor";
import { CaputhForm, frageAlsTyp, type CaputhJson } from "@/components/vorlagen/CaputhForm";
import { TaskCrawlerForm, neueAufgabe } from "@/components/vorlagen/TaskCrawlerForm";
import { TipptexteForm, type TipptexteJson } from "@/components/vorlagen/TipptexteForm";
import { eindeutigeId, parseStufen } from "@/components/vorlagen/felder";

const CAPUTH: CaputhJson = {
  title: "Miniquiz", type: "classic", max_points: 4, time_limit_default: 20, preview_time_default: 3,
  settings: { randomize_answer_order: false }, tags: [], grades: [],
  questions: [{ type: "single", question: "1+1?", answers: [{ text: "1", correct: false }, { text: "2", correct: true }] }],
};

/** Formular mit eigenem Zustand, damit Eingaben wirken. */
function Gesteuert<T>({ start, Form, onWert }: {
  start: T; Form: (p: { value: T; onChange: (v: T) => void }) => React.ReactNode; onWert: (v: T) => void;
}) {
  const [v, setV] = useState(start);
  return <Form value={v} onChange={n => { setV(n); onWert(n); }} />;
}

describe("Hilfsfunktionen", () => {
  it("liest Klassenstufen mit Bereichen", () => {
    expect(parseStufen("7, 5-6 ,x")).toEqual([5, 6, 7]);
  });

  it("macht Kennungen eindeutig und lesbar", () => {
    expect(eindeutigeId("Die Tür öffnen", ["die-tuer-oeffnen"])).toBe("die-tuer-oeffnen-2");
  });

  it("baut Antworten beim Typwechsel gültig um", () => {
    const q = CAPUTH.questions[0];
    expect(frageAlsTyp(q, "true_false").answers).toEqual([{ text: "Wahr", correct: true }, { text: "Falsch", correct: false }]);
    expect(frageAlsTyp(q, "survey").answers).toEqual([{ text: "1" }, { text: "2" }]);
    const tl = frageAlsTyp(q, "timeline");
    expect(tl.answers).toBeUndefined();
    expect(tl.timeline?.mode).toBe("sort");
    const multi = frageAlsTyp({ ...q, answers: [{ text: "a", correct: true }, { text: "b", correct: true }] }, "single");
    expect(multi.answers!.filter(a => a.correct)).toHaveLength(1);
  });

  it("legt Aufgaben je Art mit Pflichtfeldern an", () => {
    expect(neueAufgabe("input").accept).toEqual([""]);
    expect(neueAufgabe("single").answers!.some(a => a.correct)).toBe(true);
    const wechsel = neueAufgabe("input", { kind: "single", question: "Q", codeFragment: "AB", answers: [] });
    expect(wechsel).toMatchObject({ kind: "input", question: "Q", codeFragment: "AB" });
    expect(wechsel.answers).toBeUndefined();
  });
});

describe("CaputhForm", () => {
  it("markiert eine andere Antwort als richtig", () => {
    const onWert = vi.fn();
    renderWithProviders(<Gesteuert start={CAPUTH} Form={CaputhForm} onWert={onWert} />);
    fireEvent.click(screen.getByLabelText("Antwort 1 ist richtig"));
    const q = onWert.mock.calls.at(-1)![0].questions[0];
    expect(q.answers).toEqual([{ text: "1", correct: true }, { text: "2", correct: false }]);
  });

  it("fügt eine Frage hinzu", () => {
    const onWert = vi.fn();
    renderWithProviders(<Gesteuert start={CAPUTH} Form={CaputhForm} onWert={onWert} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Frage hinzufügen" }));
    expect(onWert.mock.calls.at(-1)![0].questions).toHaveLength(2);
  });

  it("trennt bei der Umrechnung Zahl und Einheit", () => {
    const onWert = vi.fn();
    const start: CaputhJson = { ...CAPUTH, questions: [{ type: "umrechnung", question: "300 m", answers: [{ text: "30000 cm", correct: true }] }] };
    renderWithProviders(<Gesteuert start={start} Form={CaputhForm} onWert={onWert} />);
    expect(screen.getByLabelText("Zieleinheit")).toHaveValue("cm");
    fireEvent.change(screen.getByLabelText("Richtiges Ergebnis (Zahl)"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Zieleinheit"), { target: { value: "dm" } });
    expect(onWert.mock.calls.at(-1)![0].questions[0].answers).toEqual([{ text: "300 dm", correct: true }]);
  });
});

describe("Bild hochladen", () => {
  it("lädt ein Bild zur Frage hoch und trägt den Pfad ein, entfernen leert ihn", async () => {
    const onWert = vi.fn();
    const upload = vi.fn().mockResolvedValue({ path: "5/gfx/karte.png", url: "/uploads/quizzes/5/gfx/karte.png" });
    function Mit() {
      const [v, setV] = useState(CAPUTH);
      return <CaputhForm value={v} onChange={n => { setV(n); onWert(n); }} upload={upload} />;
    }
    renderWithProviders(<Mit />);
    const datei = new File(["x"], "karte.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Bild zur Frage (optional) hochladen"), { target: { files: [datei] } });
    await waitFor(() => expect(onWert.mock.calls.at(-1)?.[0].questions[0].image).toBe("5/gfx/karte.png"));
    expect(upload).toHaveBeenCalledWith(datei);
    expect(document.querySelector("img")).toHaveAttribute("src", "/uploads/quizzes/5/gfx/karte.png");
    fireEvent.click(screen.getByRole("button", { name: "🗑 Bild entfernen" }));
    expect(onWert.mock.calls.at(-1)![0].questions[0].image).toBeNull();
  });
});

describe("TaskCrawlerForm", () => {
  it("zieht Verweise mit, wenn eine Kennung umbenannt wird", () => {
    vi.spyOn(api.exitgame, "katalog").mockResolvedValue({ ansichten: { folien: "" }, stile: {}, objekte: {}, werkzeuge: {} });
    const onWert = vi.fn();
    const start = {
      title: "T", subject: "mathe",
      slides: [
        { id: "intro", type: "explanation" as const, title: "Intro", text: "x" },
        { id: "a1", type: "task" as const, title: "A", text: "y", task: neueAufgabe(), onFailReview: ["intro"] },
      ],
    };
    renderWithProviders(<Gesteuert start={start} Form={TaskCrawlerForm} onWert={onWert} />);
    fireEvent.change(screen.getAllByLabelText(/Kennung/)[0], { target: { value: "start" } });
    expect(onWert.mock.calls.at(-1)![0].slides[1].onFailReview).toEqual(["start"]);
  });
});

describe("VorlagenEditor", () => {
  it("lädt, bearbeitet im Formular und speichert", async () => {
    const save = vi.fn().mockResolvedValue({});
    const start: TipptexteJson = { title: "Alt", description: null, texts: [{ title: "T", text: "Text." }], words: [], settings: {} };
    renderWithProviders(
      <VorlagenEditor load={async () => start} save={save} render={(v, set) => <TipptexteForm value={v} onChange={set} />} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "✎ Bearbeiten" }));
    const titel = (await screen.findAllByLabelText("Titel *"))[0];
    fireEvent.change(titel, { target: { value: "Neu" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: "Neu" })));
  });

  it("zeigt Prüffehler des Servers lesbar an", async () => {
    const save = vi.fn().mockRejectedValue(new Error(JSON.stringify({ detail: { message: "Ungültig", errors: ["slides[0]: 'id' fehlt"] } })));
    renderWithProviders(
      <VorlagenEditor load={async () => ({ title: "x", description: null, texts: [], words: [], settings: {} })} save={save}
        render={(v: TipptexteJson, set) => <TipptexteForm value={v} onChange={set} />} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "✎ Bearbeiten" }));
    fireEvent.click(await screen.findByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("slides[0]: 'id' fehlt")).toBeInTheDocument();
  });
});
