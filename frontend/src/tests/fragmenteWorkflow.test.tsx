import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api, type ResearchItemOut } from "@/lib/api";
import { Markdown } from "@/lib/markdown";
import { kiPrompt } from "@/lib/diagramm/vorlagen";
import { WorkflowCard, WorkflowModal } from "@/components/fragmente/Workflow";
import { MarkdownFeld } from "@/components/MarkdownFeld";
import { Einordnung, EinordnenWahl, tabName } from "@/components/fragmente/Einordnung";

vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
// Der echte D2-Übersetzer ist WASM — hier reicht ein Bild mit dem Code als Text.
vi.mock("@/lib/diagramm/d2laufzeit", () => ({
  zeichne: async (code: string) => ({ svg: `<svg><text>${code}</text></svg>`, formen: [], verbindungen: [] }),
  fehlerLesen: () => [],
}));

const mitQuery = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

const workflow = (x: Partial<ResearchItemOut> = {}): ResearchItemOut => ({
  id: 7, collection_id: 1, tab: "snippets", title: "Versuch", url: null, url_title: null, url_description: null,
  url_image: null, text_content: "1. Hypothese\n2. **Versuch**", tags: [], sim: null, art: "workflow", d2: "a -> b",
  media: [], author_kind: "teacher", author_id: 1, author_name: "Frau Beispiel", can_edit: true,
  klasse: null, einheit: null, ...x,
});

describe("Markdown", () => {
  it("liest Überschriften, Listen, Aufgaben und Hervorhebungen", () => {
    const { container } = render(<Markdown text={"## Ablauf\n1. Erst\n2. **Dann**\n- [x] erledigt\n- [ ] offen"} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Ablauf");
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(container.querySelector("strong")?.textContent).toBe("Dann");
    expect(container.textContent).toContain("☑erledigt");
    expect(container.textContent).toContain("☐offen");
  });

  it("macht aus HTML und javascript:-Links nur Text", () => {
    const { container } = render(<Markdown text={'<img src=x onerror="alert(1)"> [klick](javascript:alert(1))'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("klick");
  });
});

describe("KI-Prompt aus Text", () => {
  it("schickt die Beschreibung als Grundlage mit", () => {
    const p = kiPrompt({ art: "ablauf", thema: "Versuch", text: "1. Hypothese\n2. Versuch" });
    expect(p).toContain("Ablaufdiagramm");
    expect(p).toContain("1. Hypothese\n2. Versuch");
  });
});

describe("Workflow", () => {
  it("legt einen Workflow mit Ablauf und D2-Code an", async () => {
    const anlegen = vi.spyOn(api.fragments, "createResearch").mockResolvedValue(workflow());
    const zu = vi.fn();
    mitQuery(<WorkflowModal collectionId={1} initial={null} tab="snippets" onClose={zu} />);
    fireEvent.change(screen.getByLabelText("Titel"), { target: { value: "Versuch" } });
    fireEvent.click(screen.getByTitle("Markdown-Quelltext bearbeiten"));
    fireEvent.change(screen.getByLabelText("Ablauf (Markdown)"), { target: { value: "1. Hypothese" } });
    expect(await screen.findByTestId("d2-bild")).toBeTruthy();
    fireEvent.click(screen.getByText("Speichern"));
    await waitFor(() => expect(zu).toHaveBeenCalled());
    const [, body] = anlegen.mock.calls[0];
    expect(body).toMatchObject({ art: "workflow", title: "Versuch", text_content: "1. Hypothese", tab: "snippets" });
    expect(body.d2).toContain("start -> schritt -> ende");
  });

  it("übernimmt aus einer eingefügten KI-Antwort nur den Code", () => {
    mitQuery(<WorkflowModal collectionId={1} initial={null} tab="snippets" onClose={() => {}} />);
    const feld = screen.getByLabelText("D2-Code") as HTMLTextAreaElement;
    fireEvent.change(feld, { target: { value: "Hier ist es:\n```d2\nx -> y\n```\nViel Erfolg" } });
    expect(feld.value).toBe("x -> y\n");
  });

  it("zeigt auf der Karte Diagramm und Ablauf", async () => {
    mitQuery(<WorkflowCard item={workflow()} onEdit={() => {}} />);
    expect(screen.getByText(/Versuch$/, { selector: "button" })).toBeTruthy();
    expect((await screen.findByTestId("d2-bild")).textContent).toBe("a -> b");
    expect(screen.getByText("Versuch", { selector: "strong" })).toBeTruthy();
  });
});

describe("Markdown-Feld", () => {
  it("zeigt Markdown formatiert und gibt es unverändert zurück", async () => {
    const aendern = vi.fn();
    const text = ["## Ablauf", "", "1. Erst", "2. **Dann**", "", "- [ ] offen", "- [x] erledigt"].join("\n");
    const { container } = render(<MarkdownFeld label="Ablauf" wert={text} onChange={aendern} />);
    await waitFor(() => expect(container.querySelector("h2")?.textContent).toBe("Ablauf"));
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(container.querySelectorAll("ul[data-type=taskList] > li")).toHaveLength(2);
    // Quelltext-Ansicht zeigt das Markdown, Änderungen landen im Feld
    fireEvent.click(screen.getByTitle("Markdown-Quelltext bearbeiten"));
    expect((screen.getByLabelText("Ablauf") as HTMLTextAreaElement).value).toBe(text);
    fireEvent.change(screen.getByLabelText("Ablauf"), { target: { value: "- [ ] neu" } });
    expect(aendern).toHaveBeenCalledWith("- [ ] neu");
  });
});

describe("Einordnen", () => {
  const kategorien = [{ klasse: 6, einheiten: [{ id: "k6-t2", titel: "Brüche" }] }];
  const wert = (tabs: string[]) => ({ kategorien, vorgabe: { klasse: null, einheit: null }, tabs, art: "materialsammlung" });

  it("wählt erst die Kategorie; Allgemein hat keine Klassen", () => {
    const aendern = vi.fn();
    const tabs = ["snippets", "Unterrichtsmaterial", "Leistungskontrollen", "archive"];
    const { rerender } = render(<Einordnung.Provider value={wert(tabs)}>
      <EinordnenWahl tab="snippets" ort={{ klasse: null, einheit: null }} onChange={aendern} /></Einordnung.Provider>);
    const kat = screen.getByLabelText("Kategorie") as HTMLSelectElement;
    expect([...kat.options].map(o => o.text)).toEqual(["Allgemein", "Unterrichtsmaterial", "Leistungskontrollen"]);
    expect(screen.queryByLabelText("Klasse und Unterrichtseinheit")).toBeNull();
    fireEvent.change(kat, { target: { value: "Leistungskontrollen" } });
    expect(aendern).toHaveBeenLastCalledWith("Leistungskontrollen", { klasse: null, einheit: null });
    rerender(<Einordnung.Provider value={wert(tabs)}>
      <EinordnenWahl tab="Leistungskontrollen" ort={{ klasse: 6, einheit: "k6-t2" }} onChange={aendern} /></Einordnung.Provider>);
    fireEvent.change(screen.getByLabelText("Kategorie"), { target: { value: "snippets" } });
    expect(aendern).toHaveBeenLastCalledWith("snippets", { klasse: null, einheit: null });
  });

  it("nennt Schnipsel nur in Materialsammlungen »Allgemein«", () => {
    expect(tabName("snippets", "materialsammlung")).toBe("Allgemein");
    expect(tabName("snippets", "standard")).toBe("Schnipsel");
    expect(tabName("Leistungskontrollen", "materialsammlung")).toBe("Leistungskontrollen");
  });
});
