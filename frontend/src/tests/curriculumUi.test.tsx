import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JsonEingabe } from "@/components/curriculum/JsonEingabe";
import { Fenster, KiDialog } from "@/components/curriculum/Dialoge";
import { KarteBox } from "@/components/curriculum/KarteBox";
import { InhaltText } from "@/components/curriculum/Editor";
import { index, leereVorlage } from "@/lib/curriculum/modell";

describe("JsonEingabe", () => {
  it("liest eine gewählte Datei und zeigt ihren Namen", async () => {
    const onText = vi.fn();
    const { container } = render(<JsonEingabe onText={onText} />);
    expect(screen.getByText("JSON-Datei wählen")).toBeTruthy();
    const datei = new File(['{"lehrplaene": []}'], "physik.json", { type: "application/json" });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [datei] } });
    await waitFor(() => expect(onText).toHaveBeenCalledWith('{"lehrplaene": []}', "physik.json"));
    expect(screen.getByText("physik.json")).toBeTruthy();
  });

  it("nimmt eine abgelegte Datei an", async () => {
    const onText = vi.fn();
    render(<JsonEingabe onText={onText} />);
    const datei = new File(["{}"], "vorlage.json", { type: "application/json" });
    fireEvent.drop(screen.getByText("JSON-Datei wählen").closest("label")!, { dataTransfer: { files: [datei] } });
    await waitFor(() => expect(onText).toHaveBeenCalledWith("{}", "vorlage.json"));
  });

  it("Text einfügen bleibt als Ausweg", () => {
    const onText = vi.fn();
    const { container } = render(<JsonEingabe onText={onText} />);
    fireEvent.change(container.querySelector("textarea")!, { target: { value: "```json\n{}\n```" } });
    expect(onText).toHaveBeenCalledWith("```json\n{}\n```", "");
  });
});

describe("InhaltText", () => {
  it("bearbeitet den Text in der Zelle und speichert beim Verlassen", () => {
    const speichern = vi.fn();
    render(<InhaltText text="alt" nurLesen={false} onSpeichern={speichern} />);
    fireEvent.click(screen.getByTitle(/Text bearbeiten/));
    const feld = screen.getByLabelText("Inhalt bearbeiten");
    fireEvent.change(feld, { target: { value: "neu" } });
    fireEvent.blur(feld);
    expect(speichern).toHaveBeenCalledWith("neu");
  });

  it("löscht nach Rückfrage und bietet nur Lesenden nichts an", () => {
    const speichern = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { unmount } = render(<InhaltText text="alt" nurLesen={false} onSpeichern={speichern} />);
    fireEvent.click(screen.getByTitle("Text löschen"));
    expect(speichern).toHaveBeenCalledWith("");
    unmount();
    render(<InhaltText text="alt" nurLesen onSpeichern={speichern} />);
    expect(screen.queryByTitle("Text löschen")).toBeNull();
  });
});

describe("Fenster", () => {
  it("schließt mit Esc", () => {
    const zu = vi.fn();
    render(<Fenster titel="Karte" onClose={zu}><textarea /></Fenster>);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(zu).toHaveBeenCalledTimes(1);
  });
});

describe("KiDialog", () => {
  it("auf der Startseite: Lehrpläne erfassen, beide Schularten, ohne alten Plan voreingestellt", () => {
    render(<KiDialog doc={leereVorlage("Chemie")} art="vergleich" onClose={() => {}} />);
    expect(screen.getByText("KI-Prompt: Lehrpläne Chemie erfassen")).toBeTruthy();
    expect(screen.queryByText("Curriculum zuordnen")).toBeNull();
    fireEvent.click(screen.getByText("beide in einem JSON"));
    const prompt = (document.querySelector("textarea[readonly]") as HTMLTextAreaElement).value;
    expect(prompt).toContain("Im Anhang (PDF): RS neu, GY neu.");
    expect(prompt).toContain("\"fach\": \"Chemie\"");
    // ohne erfassten alten Plan gibt es nichts mitzuschicken
    fireEvent.click(screen.getByLabelText("mit altem Lehrplan vergleichen"));
    expect(screen.queryByText(/schon erfasste alte Karten/)).toBeNull();
  });

  it("im Plan: nur Zuordnung", () => {
    render(<KiDialog doc={leereVorlage("Physik")} art="zuordnung" onClose={() => {}} />);
    expect(screen.getByText("KI-Prompt: Curriculum zuordnen")).toBeTruthy();
    expect(screen.queryByText("beide in einem JSON")).toBeNull();
  });
});

describe("KarteBox in Niveau-Zeilen", () => {
  const plan = { id: "rs", rolle: "neu" as const, schulart: "RS", karten: [] as any[] };
  const karte = { id: "k1", block: "7/8" as const, titel: "Ohmsches Gesetz", niveaus: { R: "nachweisen und interpretieren", H: "experimentell nachweisen" }, plan };
  plan.karten.push(karte);
  const v = { ...leereVorlage("Physik"), lehrplaene: [plan] };

  it("zeigt in der H-Zeile »H« und den H-Wortlaut, im Deck »RS«", () => {
    const i = index(v);
    const { unmount } = render(<KarteBox karte={karte} idx={i} niveaus={new Set(["R", "H"] as const)} nurNiveau="H" onOpen={() => {}} />);
    expect(screen.getByText("H")).toBeTruthy();
    expect(screen.queryByText("RS")).toBeNull();
    expect(screen.getByText("experimentell nachweisen")).toBeTruthy();
    expect(screen.queryByText("nachweisen und interpretieren")).toBeNull();
    unmount();
    render(<KarteBox karte={karte} idx={i} niveaus={new Set(["R", "H"] as const)} onOpen={() => {}} />);
    expect(screen.getByText("RS")).toBeTruthy();
  });
});
