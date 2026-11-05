import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/diagramm/d2laufzeit", () => ({
  zeichne: () => new Promise(() => {}),
  fehlerLesen: () => [],
}));

import { WORKFLOWS, PLATZHALTER, alsD2, fuelle, fuerGruppe, ziel } from "@/lib/kikompass/workflows";
import { STUFEN } from "@/lib/kikompass/raster";
import { parse, alleKnoten, alleKanten } from "@/lib/diagramm/d2modell";
import { DIAGRAMM_IMPORT } from "@/lib/diagramm/vorlagen";
import { Workflows } from "@/components/kikompass/Workflows";
import DiagrammWerkstatt from "@/components/diagramme/DiagrammWerkstatt";

describe("Workflow-Daten", () => {
  it("Ids eindeutig, Stufen gültig, jede Zielgruppe hat Workflows", () => {
    expect(new Set(WORKFLOWS.map(w => w.id)).size).toBe(WORKFLOWS.length);
    for (const w of WORKFLOWS) {
      expect(STUFEN.map(s => s.id)).toContain(w.stufe);
      expect(w.fuer.length).toBeGreaterThan(0);
      expect(new Set(w.schritte.map(s => s.id)).size).toBe(w.schritte.length);
    }
    expect(fuerGruppe("lehrkraft").length).toBeGreaterThanOrEqual(5);
    expect(fuerGruppe("lernende").length).toBeGreaterThanOrEqual(3);
  });

  it("jede Prüfung führt zu einem echten Schritt oder zum Ende", () => {
    for (const w of WORKFLOWS) for (const s of w.schritte) if (s.pruefe) {
      for (const z of [s.pruefe.nein, s.pruefe.ja].filter(Boolean) as string[]) {
        expect(z === "ende" || ziel(w, z) >= 0, `${w.id}/${s.id} → ${z}`).toBe(true);
      }
    }
  });

  it("Prompts nutzen nur bekannte Platzhalter; fuelle setzt ein oder markiert", () => {
    for (const w of WORKFLOWS) for (const s of w.schritte) {
      for (const m of s.prompt?.matchAll(/\{([a-z]+)\}/g) ?? []) expect(PLATZHALTER).toContain(m[1]);
    }
    expect(fuelle("{thema} in Klasse {klasse}", { thema: "Photosynthese" })).toBe("Photosynthese in Klasse [Klasse]");
  });

  it("alsD2: alle Schritte, Rauten mit ja/nein, Schleife zurück", () => {
    const w = WORKFLOWS.find(x => x.id === "tt-vorlage")!;
    const m = parse(alsD2(w));
    const ids = alleKnoten(m).map(k => k.id);
    expect(ids).toEqual(expect.arrayContaining(["start", "ende", ...w.schritte.map((_, i) => `s${i + 1}`)]));
    const kanten = alleKanten(m);
    // Schritt 4 »Plan prüfen«: nein zurück zu Schritt 3, ja weiter zu 5.
    expect(kanten).toEqual(expect.arrayContaining([
      expect.objectContaining({ von: "p4", nach: "s3", label: "nein" }),
      expect.objectContaining({ von: "p4", nach: "s5", label: "ja" }),
    ]));
    expect(kanten.some(k => k.von === "s7" && k.nach === "ende")).toBe(true);
  });

  it("alsD2: »nein« zum Ende landet bei Fertig", () => {
    const m = parse(alsD2(WORKFLOWS.find(x => x.id === "bild")!));
    expect(alleKanten(m)).toEqual(expect.arrayContaining([expect.objectContaining({ von: "p1", nach: "ende", label: "nein" })]));
  });
});

describe("Workflows im KI-Kompass", () => {
  beforeEach(() => localStorage.clear());

  it("Lernende sehen nur ihre Workflows, ohne Umschalter", () => {
    render(<Workflows lehrkraft={false} mitWerkstatt />);
    expect(screen.getByText(/Recherchieren mit KI/)).toBeInTheDocument();
    expect(screen.queryByText(/Feedback zu Schülertexten/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Für Lehrkräfte/ })).toBeNull();
  });

  it("Lehrkraft füllt Thema und Werkzeug in die Prompts und öffnet das Flussdiagramm", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<Workflows lehrkraft mitWerkstatt />);
    fireEvent.click(screen.getByText(/TT-Material mit KI füllen/));
    fireEvent.change(screen.getByLabelText("TT-Werkzeug"), { target: { value: "lueckentext" } });
    fireEvent.change(screen.getByLabelText("Thema"), { target: { value: "Photosynthese" } });
    expect(screen.getByText(/Ich erstelle ein Lückentext zum Thema Photosynthese für Klasse \[Klasse\]/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Lückentext öffnen/ })[0]).toHaveAttribute("href", "/aktivitaeten/lueckentexte");
    fireEvent.click(screen.getByRole("button", { name: /Diagramm-Werkstatt öffnen/ }));
    const imp = JSON.parse(localStorage.getItem(DIAGRAMM_IMPORT)!);
    expect(imp.name).toBe("TT-Material mit KI füllen");
    expect(imp.code).toContain("p4 -> s3: nein");
    expect(open).toHaveBeenCalledWith("/simulationen/diagramme", "_blank");
  });

  it("ohne Konto kein Knopf zur Diagramm-Werkstatt", () => {
    render(<Workflows lehrkraft={false} mitWerkstatt={false} />);
    fireEvent.click(screen.getByText(/Recherchieren mit KI/));
    expect(screen.queryByRole("button", { name: /Diagramm-Werkstatt/ })).toBeNull();
  });
});

describe("Diagramm-Werkstatt übernimmt das Diagramm", () => {
  it("legt ein neues aktives Blatt an, behält die alten und löscht die Übergabe", async () => {
    localStorage.clear();
    localStorage.setItem("hp_diagramme", JSON.stringify({ aktiv: "alt", liste: [{ id: "alt", name: "Altes Blatt", code: "a -> b", geaendert: 1 }] }));
    localStorage.setItem(DIAGRAMM_IMPORT, JSON.stringify({ name: "Mein Workflow", code: "start -> ende\n" }));
    render(<DiagrammWerkstatt />);
    await waitFor(() => expect(localStorage.getItem(DIAGRAMM_IMPORT)).toBeNull());
    const ablage = JSON.parse(localStorage.getItem("hp_diagramme")!);
    expect(ablage.liste.map((b: { name: string }) => b.name)).toEqual(["Mein Workflow", "Altes Blatt"]);
    expect(ablage.liste.find((b: { id: string }) => b.id === ablage.aktiv).code).toBe("start -> ende\n");
  });
});
