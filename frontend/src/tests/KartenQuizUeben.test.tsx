// Kartenquiz: Üben (Lernhelfer) — Auswahl mit Ablenkern, Lösung nach falscher Antwort, Weiter; Erfolge-Editor mit Arten.
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { QuizSpiel } from "@/lib/karten/quiz";
import type { SatzInhalt } from "@/lib/karten/satz";

const SPIEL: QuizSpiel = {
  titel: "Thüringen", einstellungen: { modus: "benennen", wortbank: false, max_punkte: 10, ueben: true },
  katalog: [{ id: "de-staedte", name: "Städte", gruppe: "politisch", bereich: "de", geometrie: "punkt", quiz: true, bytes: 0,
    quelle: { name: "BKG", lizenz: "", url: "" } }],
  karte: { art: "stumm", region: "thueringen", ebenen: ["de-staedte"], ausschnitt: null, auswahl: {} },
  spiel: { modus: "benennen", auswahl: { "de-staedte": ["t1"] }, aufgaben: [{ nr: 1, marke: "1", kategorie: "Städte", ebene: "de-staedte", anker: [11, 51] }] },
  erfolge: [{ id: "lauf", name: "Lauf", icon: "🔥", text: "5 richtige Antworten hintereinander" }],
  stand: { antworten: {}, richtig: 0, erfolge: [] },
  lernen: { sicherheit: { 1: 0 }, schwach: 1, tage: 0 },
};

const { gesendet, naechste } = vi.hoisted(() => ({ gesendet: [] as unknown[], naechste: { n: 0 } }));
vi.mock("@/lib/api", () => ({ api: { karten: {
  quiz: async () => SPIEL,
  uebenNaechste: async () => {
    naechste.n += 1;
    return { nr: 1, richtung: "benennen", hilfe: "auswahl", kategorie: "Städte", ebene: "de-staedte", sicherheit: 0,
      anker: [11, 51], token: "t1", optionen: ["Weimar", "Erfurt", "Gotha", "Jena"] };
  },
  uebenAntwort: async (_c: string, body: unknown) => {
    gesendet.push(body);
    return { richtig: false, name: "Erfurt", token: "t1", sicherheit: 0, neue_erfolge: [],
      stand: { antworten: {}, richtig: 0, erfolge: [] }, lernen: { sicherheit: { 1: 0 }, schwach: 1, tage: 1 } };
  },
} } }));
vi.mock("@/components/karten/KartenAnsicht", () => ({ default: () => <div data-testid="karte" /> }));

import KartenQuizSpiel from "@/components/karten/KartenQuizSpiel";
import ErfolgeEditor from "@/components/karten/ErfolgeEditor";

describe("Kartenquiz: Üben", () => {
  it("stellt eine Auswahl, zeigt nach falscher Antwort die Lösung und holt die nächste Übung", async () => {
    render(<KartenQuizSpiel code="KQ1" token="gast" />);
    fireEvent.click(await screen.findByRole("tab", { name: "🎯 Üben" }));
    fireEvent.click(await screen.findByRole("button", { name: "Weimar" }));
    expect(await screen.findByText("Nicht ganz — das ist »Erfurt«.")).toBeTruthy();
    expect(gesendet).toEqual([{ nr: 1, richtung: "benennen", antwort: "Weimar" }]);
    expect(screen.getByText(/Noch unsicher: 1 · geübt an 1 Tag$/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Weiter →" }));
    expect(await screen.findByRole("button", { name: "Gotha" })).toBeTruthy();
    expect(naechste.n).toBe(2);
  });
});

describe("Erfolge-Editor", () => {
  it("bietet Arten mit passenden Feldern und wählt Objekte per Knopf", () => {
    const START: SatzInhalt = { art: "stumm", region: "deutschland", ebenen: ["de-staedte"], beschriftung: false, ausschnitt: null,
      auswahl: { "de-staedte": { zeigen: "alle", objekte: ["16051000"], nummerierung: "zahl" } },
      erfolge: [{ id: "e1", name: "Profi", icon: "🏅", art: "anteil", ebenen: ["de-staedte"], schwelle: 1 }] };
    let zuletzt = START;
    function Rahmen() {
      const [inhalt, setInhalt] = useState(START);
      zuletzt = inhalt;
      return <ErfolgeEditor ebenen={SPIEL.katalog} inhalt={inhalt} setInhalt={setInhalt} nummern={{ "de-staedte": { 16051000: "1" } }}
        daten={{ "de-staedte": { type: "FeatureCollection", features: [
          { type: "Feature", geometry: { type: "Point", coordinates: [11, 51] }, properties: { id: "16051000", name: "Erfurt" } }] } }} />;
    }
    render(<Rahmen />);
    fireEvent.change(screen.getByLabelText("Art des Erfolgs"), { target: { value: "serie" } });
    expect((screen.getByLabelText("Anzahl") as HTMLInputElement).value).toBe("5");
    expect(zuletzt.erfolge?.[0]).toMatchObject({ art: "serie", anzahl: 5, icon: "🔥" });

    fireEvent.change(screen.getByLabelText("Art des Erfolgs"), { target: { value: "objekte" } });
    fireEvent.click(screen.getByRole("button", { name: "1 Erfurt" }));
    expect(zuletzt.erfolge?.[0]).toMatchObject({ art: "objekte", objekte: ["de-staedte:16051000"], icon: "📍" });
  });
});
