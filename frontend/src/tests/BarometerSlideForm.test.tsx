import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SlideForm } from "@/components/barometer/AnswerInput";

const parentQuestion = {
  id: 1, order: 0, text: "Machst du im Sportverein mit?", kind: "choice" as const,
  options: ["Ja", "Nein"], scale_min: 1, scale_max: 5, scale_min_label: null, scale_max_label: null,
  chart: null, same_slide: false, block: null, intro: null, show_if: null,
  scale_style: "zahlen" as const, max_choices: null, num_min: null, num_max: null, unit: null,
};

const followUpQuestion = {
  id: 2, order: 1, text: "Welcher Verein?", kind: "text" as const,
  options: [], scale_min: 1, scale_max: 5, scale_min_label: null, scale_max_label: null,
  chart: null, same_slide: true, block: null, intro: null,
  show_if: { question: 0, options: [0], parent_id: 1 },
  scale_style: "zahlen" as const, max_choices: null, num_min: null, num_max: null, unit: null,
};

describe("SlideForm follow-ups", () => {
  it("hides a follow-up question until the parent's matching option is chosen", () => {
    const { rerender } = render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <SlideForm questions={[parentQuestion, followUpQuestion] as any} answers={{}} onChange={vi.fn()} />
    );
    expect(screen.queryByText("Welcher Verein?")).not.toBeInTheDocument();

    rerender(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <SlideForm questions={[parentQuestion, followUpQuestion] as any} answers={{ 1: 0 }} onChange={vi.fn()} />
    );
    expect(screen.getByText("Welcher Verein?")).toBeInTheDocument();
  });

  it("stays hidden when the parent's answer does not match the condition", () => {
    render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <SlideForm questions={[parentQuestion, followUpQuestion] as any} answers={{ 1: 1 }} onChange={vi.fn()} />
    );
    expect(screen.queryByText("Welcher Verein?")).not.toBeInTheDocument();
  });
});

describe("SlideForm multi max_choices", () => {
  const multiQuestion = {
    id: 3, order: 0, text: "Welche Sportarten magst du?", kind: "multi" as const,
    options: ["Fußball", "Basketball", "Schwimmen"], scale_min: 1, scale_max: 5,
    scale_min_label: null, scale_max_label: null, chart: null, same_slide: false, block: null,
    intro: null, show_if: null, scale_style: "zahlen" as const, max_choices: 2,
    num_min: null, num_max: null, unit: null,
  };

  it("disables unchecked checkboxes once max_choices is reached", () => {
    render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <SlideForm questions={[multiQuestion] as any} answers={{ 3: [0, 1] }} onChange={vi.fn()} />
    );
    expect(screen.getByRole("checkbox", { name: "Schwimmen" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Fußball" })).not.toBeDisabled();
  });

  it("keeps all checkboxes enabled when below max_choices", () => {
    render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <SlideForm questions={[multiQuestion] as any} answers={{ 3: [0] }} onChange={vi.fn()} />
    );
    expect(screen.getByRole("checkbox", { name: "Schwimmen" })).not.toBeDisabled();
  });
});
