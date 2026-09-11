import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultChart } from "@/components/barometer/ResultChart";
import { AnalysisView } from "@/components/barometer/AnalysisView";
import { BlockChart } from "@/components/barometer/BlockChart";

const textQuestion = {
  id: 1, kind: "text" as const, options: [], scale_min: 1, scale_max: 5,
  scale_min_label: null, scale_max_label: null, chart: null,
};

const scaleQuestion = {
  id: 2, kind: "scale" as const, options: [], scale_min: 1, scale_max: 5,
  scale_min_label: "schlecht", scale_max_label: "gut", chart: null,
};

describe("ResultChart", () => {
  it("shows a muted empty state when there are no responses", () => {
    render(<ResultChart question={scaleQuestion} distribution={{}} count={0} />);
    expect(screen.getByText(/noch keine antworten/i)).toBeInTheDocument();
  });

  it("renders every text answer in liste mode when texts are given", () => {
    render(
      <ResultChart
        question={textQuestion}
        distribution={{}}
        count={2}
        texts={["Antwort eins", "Antwort zwei"]}
        chart="liste"
      />
    );
    expect(screen.getByText("Antwort eins")).toBeInTheDocument();
    expect(screen.getByText("Antwort zwei")).toBeInTheDocument();
  });

  it("hides raw answers and shows only the count when texts are not provided", () => {
    render(<ResultChart question={textQuestion} distribution={{}} count={3} chart="liste" />);
    expect(screen.getByText(/3 antwort/i)).toBeInTheDocument();
  });

  it("renders the most frequent word in wortwolke mode", () => {
    render(
      <ResultChart
        question={textQuestion}
        distribution={{}}
        count={2}
        texts={["Fußball ist super Fußball", "Fußball macht Spaß"]}
        chart="wortwolke"
      />
    );
    expect(screen.getByText("fußball")).toBeInTheDocument();
  });

  it("shows median and mean tiles for a number question in kennzahlen mode", () => {
    const numberQuestion = {
      id: 3, kind: "number" as const, options: [], scale_min: 1, scale_max: 5,
      scale_min_label: null, scale_max_label: null, chart: null, num_min: null, num_max: null, unit: "min",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    render(
      <ResultChart question={numberQuestion} distribution={{ "2": 1, "4": 1, "6": 1 }} count={3} chart="kennzahlen" />
    );
    expect(screen.getByText(/median/i)).toBeInTheDocument();
    expect(screen.getByText(/ø/i)).toBeInTheDocument();
  });

  it("shows a Befragte footer for a multi question", () => {
    const multiQuestion = {
      id: 4, kind: "multi" as const, options: ["Fußball", "Basketball", "Schwimmen"],
      scale_min: 1, scale_max: 5, scale_min_label: null, scale_max_label: null, chart: null, max_choices: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    render(
      <ResultChart question={multiQuestion} distribution={{ "0": 2, "1": 1 }} count={3} chart="balken" />
    );
    expect(screen.getByText(/befragte/i)).toBeInTheDocument();
  });
});

describe("BlockChart", () => {
  const statementA = {
    id: 10, text: "Der Unterricht macht Spaß", kind: "scale" as const, options: [],
    scale_min: 1, scale_max: 5, scale_min_label: "stimme gar nicht zu", scale_max_label: "stimme voll zu",
    scale_style: "zahlen" as const, chart: "likert", block: "blk1", intro: "Wie sehr stimmst du zu?",
  };
  const statementB = {
    ...statementA, id: 11, text: "Ich fühle mich wohl", intro: null,
  };

  it("renders every statement and its Ø for a likert block", () => {
    render(
      <BlockChart
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        questions={[statementA, statementB] as any}
        results={{
          10: { distribution: { "4": 2, "5": 1 }, count: 3 },
          11: { distribution: { "3": 1 }, count: 1 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any}
        chart="likert"
      />
    );
    expect(screen.getByText("Der Unterricht macht Spaß")).toBeInTheDocument();
    expect(screen.getByText("Ich fühle mich wohl")).toBeInTheDocument();
    expect(screen.getAllByText(/Ø/).length).toBeGreaterThanOrEqual(2);
  });
});

describe("AnalysisView", () => {
  const analysis = {
    answers: [
      { text: "Weniger Hausaufgaben", count: 2 },
      { text: "Mehr Pausen", count: 5 },
    ],
    uploaded_at: "2026-01-15T09:00:00Z",
  };

  it("shows the essence as one bar per answer with its count, most frequent first", () => {
    render(<AnalysisView analysis={analysis} />);
    const rows = screen.getAllByTestId("essenz-zeile");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Mehr Pausen");
    expect(rows[0]).toHaveTextContent("5");
    expect(rows[1]).toHaveTextContent("Weniger Hausaufgaben");
  });
});
