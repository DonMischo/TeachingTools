import { describe, it, expect } from "vitest";
import {
  OPTION_PRESETS,
  CHART_TYPES,
  chartOf,
  chartRows,
  scaleMean,
  wordFrequencies,
  smileyFor,
  slidesOf,
  segmentsOf,
  conditionMet,
  numberStats,
  histogramRows,
  blankQuestion,
  blankBlock,
  draftsToQuestions,
  questionsToDrafts,
  type DraftQuestion,
  type DraftBlock,
} from "@/lib/barometer";
import type { BarometerQuestionOut } from "@/lib/api";

describe("OPTION_PRESETS", () => {
  it("includes a Geschlecht preset with the four standard options", () => {
    const preset = OPTION_PRESETS.find((p) => p.id === "geschlecht");
    expect(preset).toBeDefined();
    expect(preset?.options).toEqual(["männlich", "weiblich", "divers", "keine Angabe"]);
  });
});

describe("CHART_TYPES", () => {
  it("has the exact chart ids per kind, in order", () => {
    expect(CHART_TYPES.scale.map((c) => c.id)).toEqual(["saeulen", "balken", "donut", "gestapelt", "flaeche"]);
    expect(CHART_TYPES.choice.map((c) => c.id)).toEqual(["balken", "saeulen", "donut", "kreis", "gestapelt"]);
    expect(CHART_TYPES.text.map((c) => c.id)).toEqual(["liste", "wortwolke"]);
  });
});

describe("chartOf", () => {
  it("defaults to the first chart type for the question's kind when chart is null", () => {
    expect(chartOf({ kind: "scale", chart: null })).toBe("saeulen");
    expect(chartOf({ kind: "choice", chart: null })).toBe("balken");
    expect(chartOf({ kind: "text", chart: null })).toBe("liste");
  });

  it("falls back to the default when chart is not valid for the kind", () => {
    expect(chartOf({ kind: "scale", chart: "wortwolke" })).toBe("saeulen");
    expect(chartOf({ kind: "text", chart: "donut" })).toBe("liste");
  });

  it("keeps a valid chart id", () => {
    expect(chartOf({ kind: "scale", chart: "donut" })).toBe("donut");
  });
});

describe("chartRows", () => {
  it("returns one row per scale step, including steps with zero responses", () => {
    const q = { kind: "scale" as const, scale_min: 1, scale_max: 4, options: [] };
    const rows = chartRows(q, { "1": 2, "3": 1 });
    expect(rows).toEqual([
      { key: "1", label: "1", count: 2 },
      { key: "2", label: "2", count: 0 },
      { key: "3", label: "3", count: 1 },
      { key: "4", label: "4", count: 0 },
    ]);
  });

  it("returns one row per option for choice questions, keyed by index", () => {
    const q = { kind: "choice" as const, scale_min: 1, scale_max: 5, options: ["Ja", "Nein"] };
    const rows = chartRows(q, { "0": 3, "1": 1 });
    expect(rows).toEqual([
      { key: "0", label: "Ja", count: 3 },
      { key: "1", label: "Nein", count: 1 },
    ]);
  });
});

describe("scaleMean", () => {
  it("computes the weighted mean of the distribution", () => {
    const q = { scale_min: 1, scale_max: 3 };
    // 1*1 + 2*2 + 3*1 = 8, 4 responses -> mean 2
    expect(scaleMean(q, { "1": 1, "2": 2, "3": 1 })).toBe(2);
  });

  it("returns null when there are no responses", () => {
    const q = { scale_min: 1, scale_max: 3 };
    expect(scaleMean(q, {})).toBeNull();
  });
});

describe("wordFrequencies", () => {
  it("drops stop words and short words, counts occurrences, and sorts by count desc then word", () => {
    const texts = [
      "Das ist super und macht Spaß",
      "Spaß macht das Lernen wirklich",
      "super Idee für den Unterricht",
    ];
    expect(wordFrequencies(texts)).toEqual([
      { word: "macht", count: 2 },
      { word: "spaß", count: 2 },
      { word: "super", count: 2 },
      { word: "idee", count: 1 },
      { word: "lernen", count: 1 },
      { word: "unterricht", count: 1 },
      { word: "wirklich", count: 1 },
    ]);
  });
});

describe("smileyFor", () => {
  it("returns null for the 'zahlen' style regardless of value", () => {
    expect(smileyFor({ scale_min: 1, scale_max: 5, scale_style: "zahlen" }, 3)).toBeNull();
  });

  it("maps 5 ascending steps (smileys_auf) from worst to best", () => {
    const q = { scale_min: 1, scale_max: 5, scale_style: "smileys_auf" as const };
    expect([1, 2, 3, 4, 5].map((v) => smileyFor(q, v))).toEqual(["😣", "🙁", "😐", "😊", "😀"]);
  });

  it("maps 5 descending steps (smileys_ab) from best to worst", () => {
    const q = { scale_min: 1, scale_max: 5, scale_style: "smileys_ab" as const };
    expect([1, 2, 3, 4, 5].map((v) => smileyFor(q, v))).toEqual(["😀", "😊", "😐", "🙁", "😣"]);
  });
});

describe("slidesOf", () => {
  it("starts a new slide at index 0 and at every same_slide === false", () => {
    const qs = [
      { same_slide: false },
      { same_slide: true },
      { same_slide: false },
      { same_slide: true },
      { same_slide: true },
    ];
    expect(slidesOf(qs)).toEqual([
      [qs[0], qs[1]],
      [qs[2], qs[3], qs[4]],
    ]);
  });

  it("treats same_slide on the very first question as still starting slide 0", () => {
    const qs = [{ same_slide: true }, { same_slide: true }];
    expect(slidesOf(qs)).toEqual([[qs[0], qs[1]]]);
  });
});

describe("segmentsOf", () => {
  it("groups consecutive questions with the same non-null block into one block segment, others as single", () => {
    const a = { block: "b1", id: 1 };
    const b = { block: "b1", id: 2 };
    const c = { block: null, id: 3 };
    const d = { block: "b2", id: 4 };
    expect(segmentsOf([a, b, c, d])).toEqual([
      { type: "block", block: "b1", questions: [a, b] },
      { type: "single", question: c },
      { type: "block", block: "b2", questions: [d] },
    ]);
  });
});

describe("conditionMet", () => {
  it("is true when the question has no show_if", () => {
    expect(conditionMet({ show_if: null }, {})).toBe(true);
  });

  it("matches a choice parent's answer against the option list", () => {
    const q = { show_if: { question: 0, options: [1], parent_id: 5 } };
    expect(conditionMet(q, { 5: 1 })).toBe(true);
    expect(conditionMet(q, { 5: 0 })).toBe(false);
  });

  it("matches when a multi parent's answers overlap any listed option", () => {
    const q = { show_if: { question: 0, options: [1, 2], parent_id: 5 } };
    expect(conditionMet(q, { 5: [0, 2] })).toBe(true);
    expect(conditionMet(q, { 5: [0, 3] })).toBe(false);
  });

  it("is false when the parent question has not been answered yet", () => {
    const q = { show_if: { question: 0, options: [1], parent_id: 5 } };
    expect(conditionMet(q, {})).toBe(false);
  });
});

describe("numberStats", () => {
  it("returns null when the distribution is empty", () => {
    expect(numberStats({})).toBeNull();
  });

  it("computes n, mean, median, min and max for an odd number of values", () => {
    // expanded values: 1, 2, 2, 3, 5
    const stats = numberStats({ "1": 1, "2": 2, "3": 1, "5": 1 });
    expect(stats).toEqual({ n: 5, mean: 2.6, median: 2, min: 1, max: 5 });
  });

  it("averages the two middle values for an even number of values", () => {
    // expanded values: 1, 2, 3, 4
    const stats = numberStats({ "1": 1, "2": 1, "3": 1, "4": 1 });
    expect(stats).toEqual({ n: 4, mean: 2.5, median: 2.5, min: 1, max: 4 });
  });
});

describe("histogramRows", () => {
  it("returns one row per distinct value, ascending, when distinct count is within maxBins", () => {
    const rows = histogramRows({ "5": 4, "1": 2, "3": 1 }, 8);
    expect(rows).toEqual([
      { key: "1", label: "1", count: 2 },
      { key: "3", label: "3", count: 1 },
      { key: "5", label: "5", count: 4 },
    ]);
  });

  it("falls back to equal-width bins summing to the total count when there are more distinct values than maxBins", () => {
    const distribution: Record<string, number> = {};
    for (let v = 1; v <= 10; v++) distribution[String(v)] = 1;
    const rows = histogramRows(distribution, 4);
    expect(rows.length).toBe(4);
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(10);
  });
});

describe("chartOf for block members", () => {
  it("uses the block's chart type when it is one of the block chart types", () => {
    expect(chartOf({ kind: "scale", chart: "mittelwerte", block: "b1" })).toBe("mittelwerte");
    expect(chartOf({ kind: "scale", chart: "likert", block: "b1" })).toBe("likert");
  });

  it("falls back to likert when the block member has no chart or an invalid one", () => {
    expect(chartOf({ kind: "scale", chart: null, block: "b1" })).toBe("likert");
    expect(chartOf({ kind: "scale", chart: "saeulen", block: "b1" })).toBe("likert");
  });
});

describe("draftsToQuestions", () => {
  it("expands a block into one scale question per statement, sharing a block id, intro only on the first", () => {
    const block: DraftBlock = {
      uid: "blk1",
      type: "block",
      intro: "Wie sehr stimmst du zu?",
      statements: ["Aussage 1", "Aussage 2"],
      chart: "likert",
      scale_min: 1,
      scale_max: 5,
      scale_min_label: "stimme gar nicht zu",
      scale_max_label: "stimme voll zu",
      scale_style: "zahlen",
      same_slide: true,
      show_if: null,
    };
    const out = draftsToQuestions([block]);
    expect(out).toHaveLength(2);
    expect(out[0].block).toBe("blk1");
    expect(out[1].block).toBe("blk1");
    expect(out[0].intro).toBe("Wie sehr stimmst du zu?");
    expect(out[1].intro).toBeNull();
    expect(out[1].same_slide).toBe(true);
    expect(out[0].chart).toBe("likert");
    expect(out[1].chart).toBe("likert");
    expect(out[0].text).toBe("Aussage 1");
    expect(out[1].text).toBe("Aussage 2");
  });

  it("skips questions with empty text and blocks without any non-empty statement", () => {
    const q: DraftQuestion = { ...blankQuestion(), text: "   " };
    const block: DraftBlock = { ...blankBlock(), statements: ["", "  "] };
    expect(draftsToQuestions([q, block])).toEqual([]);
  });

  it("maps show_if to the output index of the parent when it is an earlier choice/multi question with options", () => {
    const parent: DraftQuestion = {
      ...blankQuestion(), uid: "p1", kind: "choice", options: ["Ja", "Nein"], text: "Machst du im Sportverein mit?",
    };
    const child: DraftQuestion = {
      ...blankQuestion(), uid: "c1", text: "Welcher Verein?", show_if: { parentUid: "p1", options: [0] },
    };
    const out = draftsToQuestions([parent, child]);
    expect(out[1].show_if).toEqual({ question: 0, options: [0] });
  });

  it("sets show_if to null when the referenced parent is not a choice/multi question with options", () => {
    const parent: DraftQuestion = { ...blankQuestion(), uid: "p1", kind: "scale", text: "Wie zufrieden bist du?" };
    const child: DraftQuestion = {
      ...blankQuestion(), uid: "c1", text: "Warum?", show_if: { parentUid: "p1", options: [0] },
    };
    const out = draftsToQuestions([parent, child]);
    expect(out[1].show_if).toBeNull();
  });
});

describe("questionsToDrafts / draftsToQuestions round trip", () => {
  it("round-trips a plain question and a block back to equivalent BarometerQuestionIn objects", () => {
    const qs = [
      {
        id: 1, order: 0, text: "Wie zufrieden bist du?", scale_min: 1, scale_max: 5,
        scale_min_label: "schlecht", scale_max_label: "gut", kind: "scale", options: [],
        chart: "saeulen", analysis: null, same_slide: false, block: null, intro: null,
        show_if: null, scale_style: "zahlen", max_choices: null, num_min: null, num_max: null, unit: null,
      },
      {
        id: 2, order: 1, text: "Aussage 1", scale_min: 1, scale_max: 5,
        scale_min_label: "stimme gar nicht zu", scale_max_label: "stimme voll zu", kind: "scale", options: [],
        chart: "likert", analysis: null, same_slide: true, block: "blk1", intro: "Überschrift",
        show_if: null, scale_style: "zahlen", max_choices: null, num_min: null, num_max: null, unit: null,
      },
      {
        id: 3, order: 2, text: "Aussage 2", scale_min: 1, scale_max: 5,
        scale_min_label: "stimme gar nicht zu", scale_max_label: "stimme voll zu", kind: "scale", options: [],
        chart: "likert", analysis: null, same_slide: true, block: "blk1", intro: null,
        show_if: null, scale_style: "zahlen", max_choices: null, num_min: null, num_max: null, unit: null,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any as BarometerQuestionOut[];

    const drafts = questionsToDrafts(qs);
    const out = draftsToQuestions(drafts);

    expect(out).toEqual([
      expect.objectContaining({
        text: "Wie zufrieden bist du?", kind: "scale", chart: "saeulen",
        same_slide: false, block: null, intro: null, show_if: null,
      }),
      expect.objectContaining({
        text: "Aussage 1", block: "blk1", chart: "likert", same_slide: true, intro: "Überschrift",
      }),
      expect.objectContaining({
        text: "Aussage 2", block: "blk1", chart: "likert", same_slide: true, intro: null,
      }),
    ]);
  });
});
