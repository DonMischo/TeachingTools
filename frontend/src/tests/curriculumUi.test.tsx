import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JsonEingabe } from "@/components/curriculum/JsonEingabe";
import { KiDialog } from "@/components/curriculum/Dialoge";
import { leereVorlage } from "@/lib/curriculum/modell";

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
