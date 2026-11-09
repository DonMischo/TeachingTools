import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const baueDocx = vi.fn(async () => new Blob(["x"]));
const herunterladen = vi.fn();
vi.mock("@/lib/docx", () => ({ baueDocx: (...a: unknown[]) => baueDocx(...(a as [])), herunterladen: (...a: unknown[]) => herunterladen(...a) }));

import { EINHEITEN, ETAPPEN, WORKSHOP, einheitenVon, handoutDocx, workshopDocx } from "@/lib/kikompass/lernpfad";
import { WORKFLOWS } from "@/lib/kikompass/workflows";
import { STUFEN } from "@/lib/kikompass/raster";
import { Lernpfad } from "@/components/kikompass/Lernpfad";
import { Workflows } from "@/components/kikompass/Workflows";

describe("Lernpfad-Daten", () => {
  it("jede Etappe hat Einheiten, Ids eindeutig, Verweise gültig", () => {
    expect(new Set(EINHEITEN.map(e => e.id)).size).toBe(EINHEITEN.length);
    for (const et of ETAPPEN) {
      expect(STUFEN.map(s => s.id)).toContain(et.stufe);
      expect(einheitenVon(et.id).length).toBeGreaterThan(0);
    }
    for (const e of EINHEITEN) {
      expect(ETAPPEN.map(x => x.id)).toContain(e.etappe);
      if (e.workflow) expect(WORKFLOWS.map(w => w.id)).toContain(e.workflow);
    }
  });

  it("Workshop dauert 90 Minuten, Word-Bausteine enthalten Ablauf und Formel", () => {
    expect(WORKSHOP.phasen.reduce((s, p) => s + p.minuten, 0)).toBe(90);
    const ablauf = workshopDocx().map(b => ("text" in b ? b.text : "")).join("\n");
    expect(ablauf).toContain("0–10 Min. · Ankommen und Standort");
    expect(ablauf).toContain("80–90 Min.");
    const handout = handoutDocx().map(b => ("text" in b ? b.text : "")).join("\n");
    expect(handout).toContain("Rolle:");
    expect(handout).toContain("Fünf Datenschutzregeln");
  });
});

describe("Lernpfad für Lehrkräfte", () => {
  beforeEach(() => { localStorage.clear(); baueDocx.mockClear(); herunterladen.mockClear(); });

  it("Haken und Notiz bleiben im Browser, Zähler an der Etappe", async () => {
    const { unmount } = render(<Lernpfad speicherSchluessel="lehrkraft-1" onSprung={() => {}} onWorkflow={() => {}} />);
    fireEvent.change(screen.getByLabelText("Notiz zu Erster Prompt in 10 Minuten"), { target: { value: "Elternbrief klappte gut" } });
    fireEvent.click(screen.getAllByLabelText("Erledigt")[0]);
    expect(screen.getByRole("button", { name: /Erste Schritte 1\/3/ })).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem("hp_kikompass_lernpfad_lehrkraft-1")).toContain("Elternbrief"));
    unmount();
    render(<Lernpfad speicherSchluessel="lehrkraft-1" onSprung={() => {}} onWorkflow={() => {}} />);
    expect(await screen.findByDisplayValue("Elternbrief klappte gut")).toBeInTheDocument();
  });

  it("springt zum Workflow und zur Material-Werkstatt", () => {
    const onWorkflow = vi.fn(), onSprung = vi.fn();
    render(<Lernpfad speicherSchluessel="x" onSprung={onSprung} onWorkflow={onWorkflow} />);
    fireEvent.click(screen.getByRole("button", { name: /Material erstellen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Workflow »Arbeitsblatt in drei Niveaus«/ }));
    expect(onWorkflow).toHaveBeenCalledWith("differenzieren");
    fireEvent.click(screen.getByRole("button", { name: /Im Unterricht einsetzen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Material-Werkstatt/ }));
    expect(onSprung).toHaveBeenCalledWith("werkstatt");
  });

  it("Workshop: Ablaufplan und Handout als Word", async () => {
    render(<Lernpfad speicherSchluessel="x" onSprung={() => {}} onWorkflow={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Workshop fürs Kollegium/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ablaufplan als Word/ }));
    fireEvent.click(screen.getByRole("button", { name: /Handout als Word/ }));
    await waitFor(() => expect(herunterladen).toHaveBeenCalledTimes(2));
    expect(herunterladen.mock.calls.map(c => c[1])).toEqual(["Prompt-Werkstatt_Ablaufplan.docx", "KI_im_Unterricht_Handout.docx"]);
  });

  it("Workflows öffnet direkt den angesprungenen Workflow", () => {
    render(<Workflows lehrkraft mitWerkstatt start="differenzieren" />);
    expect(screen.getByRole("heading", { name: /Arbeitsblatt in drei Niveaus/ })).toBeInTheDocument();
  });
});
