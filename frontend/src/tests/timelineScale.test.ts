import { describe, it, expect } from "vitest";
import {
  isoDateToYear, formatIsoDateDe, effectiveStart, effectiveEnd,
  eventDateLabel, eventWhen, calendarTicks,
} from "@/components/timeline/scale";
import { TimelineAxis } from "@/components/timeline/types";

const yearAxis: TimelineAxis = { kind: "year", min: -800, max: 2025 };

describe("isoDateToYear", () => {
  it("parses a plain CE date to a fractional year", () => {
    const v = isoDateToYear("1942-01-20");
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(1942);
    expect(v!).toBeLessThan(1943);
  });

  it("Jan 1 is (almost exactly) the whole year", () => {
    expect(isoDateToYear("1914-01-01")).toBeCloseTo(1914, 2);
  });

  it("Dec 31 is just under the next year", () => {
    const v = isoDateToYear("1913-12-31")!;
    expect(v).toBeGreaterThan(1913.99);
    expect(v).toBeLessThan(1914);
  });

  it("orders two same-year dates correctly", () => {
    const sarajevo = isoDateToYear("1914-06-28")!;
    const austriaDeclares = isoDateToYear("1914-07-28")!;
    expect(sarajevo).toBeLessThan(austriaDeclares);
  });

  it("handles leap years correctly (Feb 29)", () => {
    expect(isoDateToYear("2000-02-29")).not.toBeNull();
  });

  it("rejects an invalid calendar date (Feb 30)", () => {
    expect(isoDateToYear("1942-02-30")).toBeNull();
  });

  it("rejects month/day out of range", () => {
    expect(isoDateToYear("1942-13-01")).toBeNull();
    expect(isoDateToYear("1942-01-32")).toBeNull();
  });

  it("rejects freeform/legacy labels", () => {
    expect(isoDateToYear("21. April 753 v. Chr. (Überlieferung)")).toBeNull();
    expect(isoDateToYear("15. März 44 v. Chr.")).toBeNull();
  });

  // ISO 8601 reduced precision — what authors actually write when the exact
  // day isn't known. These used to be rejected, silently losing positioning.
  it("accepts year-only precision, anchored at the start of the year", () => {
    expect(isoDateToYear("1337")).toBeCloseTo(1337, 6);
  });

  it("accepts year-month precision, anchored at the 1st of the month", () => {
    const v = isoDateToYear("0732-10")!;
    expect(v).not.toBeNull();
    expect(v).toBeCloseTo(isoDateToYear("0732-10-01")!, 6);
    expect(v).toBeGreaterThan(732.7);
    expect(v).toBeLessThan(732.8);
  });

  it("orders reduced-precision dates within the same year", () => {
    expect(isoDateToYear("1077-01")!).toBeLessThan(isoDateToYear("1077-06")!);
  });

  // Date.UTC() maps years 0-99 to 1900-1999; a naive implementation silently
  // mangles or rejects 1st-century CE dates.
  it("handles early-CE years correctly (no 1900 offset)", () => {
    expect(isoDateToYear("0072-01-01")).toBeCloseTo(72, 2);
    expect(isoDateToYear("0009-09-01")!).toBeGreaterThan(9);
    expect(isoDateToYear("0009-09-01")!).toBeLessThan(10);
    expect(isoDateToYear("0476-09-04")!).toBeGreaterThan(476);
    expect(isoDateToYear("0476-09-04")!).toBeLessThan(477);
  });

  it("rejects year 0 (not a CE year in this schema's convention)", () => {
    expect(isoDateToYear("0000")).toBeNull();
  });

  it("rejects BCE (leading minus) — CE-only by design", () => {
    expect(isoDateToYear("-0753-04-21")).toBeNull();
  });

  it("rejects non-4-digit years and malformed strings", () => {
    expect(isoDateToYear("942-01-20")).toBeNull();
    expect(isoDateToYear("1942/01/20")).toBeNull();
    expect(isoDateToYear("")).toBeNull();
  });
});

describe("formatIsoDateDe", () => {
  it("formats a valid ISO date in German", () => {
    expect(formatIsoDateDe("1942-01-20")).toBe("20. Januar 1942");
    expect(formatIsoDateDe("1989-11-09")).toBe("9. November 1989");
  });

  it("formats reduced precision at the precision given", () => {
    expect(formatIsoDateDe("0732-10")).toBe("Oktober 732");
    expect(formatIsoDateDe("1337")).toBe("1337");
  });

  it("returns null for anything non-ISO", () => {
    expect(formatIsoDateDe("21. April 753 v. Chr.")).toBeNull();
    expect(formatIsoDateDe("1942-02-30")).toBeNull();
  });
});

describe("effectiveStart / effectiveEnd", () => {
  it("uses the precise ISO date when present", () => {
    const ev = { value: 1942, exact_date: "1942-01-20" };
    expect(effectiveStart(ev)).toBeCloseTo(isoDateToYear("1942-01-20")!, 6);
  });

  it("falls back to the raw value when exact_date is absent or non-ISO", () => {
    expect(effectiveStart({ value: 1942 })).toBe(1942);
    expect(effectiveStart({ value: -753, exact_date: "21. April 753 v. Chr." })).toBe(-753);
  });

  it("effectiveEnd is null for point events, precise for dated spans", () => {
    expect(effectiveEnd({ end: null })).toBeNull();
    expect(effectiveEnd({ end: 1918 })).toBe(1918);
    expect(effectiveEnd({ end: 1918, exact_date_end: "1918-11-11" }))
      .toBeCloseTo(isoDateToYear("1918-11-11")!, 6);
  });
});

describe("eventDateLabel", () => {
  it("shows the precise date for a point event with an ISO exact_date", () => {
    const ev = { id: "e", label: "Wannseekonferenz", value: 1942, exact_date: "1942-01-20" };
    expect(eventDateLabel(ev, yearAxis)).toBe("20. Januar 1942");
  });

  it("shows a precise range when both span ends are ISO dates", () => {
    const ev = {
      id: "e", label: "WWI", value: 1914, end: 1918,
      exact_date: "1914-07-28", exact_date_end: "1918-11-11",
    };
    expect(eventDateLabel(ev, yearAxis)).toBe("28. Juli 1914 – 11. November 1918");
  });

  it("mixes a precise start with a coarse end when only the start is dated", () => {
    const ev = { id: "e", label: "E", value: 1914, end: 1918, exact_date: "1914-07-28" };
    expect(eventDateLabel(ev, yearAxis)).toBe("28. Juli 1914 – 1918");
  });

  it("falls back to the coarse year, appending freeform text as a note", () => {
    const ev = { id: "e", label: "Gründung Roms", value: -753, exact_date: "21. April 753 v. Chr. (Überlieferung)" };
    expect(eventDateLabel(ev, yearAxis)).toBe("753 v. Chr. · 21. April 753 v. Chr. (Überlieferung)");
  });

  it("does not render a redundant note for year-only precision", () => {
    // Regression: "1337" used to fail parsing and render as "1337 · 1337".
    const ev = { id: "e", label: "E", value: 1337, exact_date: "1337" };
    expect(eventDateLabel(ev, yearAxis)).toBe("1337");
  });

  it("renders a month-precision span range", () => {
    const ev = {
      id: "e", label: "Krieg", value: 1337, end: 1453,
      exact_date: "1337", exact_date_end: "1453",
    };
    expect(eventDateLabel(ev, yearAxis)).toBe("1337 – 1453");
  });

  it("matches eventWhen exactly when there's no exact_date at all", () => {
    const ev = { id: "e", label: "E", value: 1989, end: 1990 };
    expect(eventDateLabel(ev, yearAxis)).toBe(eventWhen(ev, yearAxis));
  });
});

describe("calendarTicks", () => {
  it("produces day-level ticks for a narrow (few-week) view", () => {
    const ticks = calendarTicks(isoDateToYear("1914-06-01")!, isoDateToYear("1914-08-01")!, 6);
    expect(ticks.length).toBeGreaterThan(0);
    // Labels should look like calendar dates ("28. Jun"), not fractional years.
    for (const t of ticks) expect(t.label).toMatch(/^\d{1,2}\. [A-ZÄÖÜ][a-zäöü]{2}$/);
  });

  it("produces month-level ticks for a ~2-year view", () => {
    const ticks = calendarTicks(1914, 1916, 6);
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) expect(t.label).toMatch(/^[A-ZÄÖÜ][a-zäöü]{2} \d{4}$/);
  });

  it("returns nothing for a degenerate (empty) range", () => {
    expect(calendarTicks(1914, 1914, 6)).toEqual([]);
  });
});
