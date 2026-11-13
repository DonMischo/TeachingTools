import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api, type ResearchItemOut } from "@/lib/api";
import { Markdown } from "@/lib/markdown";
import { kiPrompt } from "@/lib/diagramm/vorlagen";
import { WorkflowCard, WorkflowModal } from "@/components/fragmente/Workflow";

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
