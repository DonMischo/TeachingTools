import { describe, it, expect } from "vitest";
import {
  isInSlot,
  hasSlot,
  pickSlides,
  slideDurationMs,
  type SlideshowItem,
} from "@/lib/slideshow";

const MONDAY = new Date(2026, 8, 14, 12, 10); // 2026-09-14, a Monday, 12:10 local

const baseItem = (overrides: Partial<SlideshowItem> = {}): SlideshowItem => ({
  id: 1,
  position: 0,
  kind: "link",
  title: "Item",
  active: true,
  audience: "guest",
  duration_seconds: 15,
  media_type: null,
  file_url: null,
  original_filename: null,
  url: "https://example.com",
  calendar_tags: [],
  calendar_categories: [],
  calendar_days_ahead: 14,
  slot_days: [],
  slot_start: null,
  slot_end: null,
  slot_from: null,
  slot_until: null,
  warnings: [],
  events: [],
  wochenspruch: null,
  ...overrides,
});

describe("hasSlot", () => {
  it("is true when slot_days is non-empty", () => {
    expect(hasSlot(baseItem({ slot_days: [0] }))).toBe(true);
  });

  it("is false when slot_days is empty", () => {
    expect(hasSlot(baseItem({ slot_days: [] }))).toBe(false);
  });
});

describe("isInSlot", () => {
  it("converts JS Sunday (getDay()===0) to weekday index 6", () => {
    const sunday = new Date(2026, 8, 13, 12, 10); // day before the Monday fixture
    const itemSunday = baseItem({ slot_days: [6], slot_start: "00:00", slot_end: "23:59" });
    const itemMonday = baseItem({ slot_days: [0], slot_start: "00:00", slot_end: "23:59" });
    expect(isInSlot(itemSunday, sunday)).toBe(true);
    expect(isInSlot(itemMonday, sunday)).toBe(false);
  });

  it("matches the fixed Monday against weekday index 0", () => {
    const item = baseItem({ slot_days: [0], slot_start: "00:00", slot_end: "23:59" });
    expect(isInSlot(item, MONDAY)).toBe(true);
  });

  it("treats slot_start as inclusive", () => {
    const item = baseItem({ slot_days: [0], slot_start: "12:10", slot_end: "12:30" });
    expect(isInSlot(item, MONDAY)).toBe(true);
  });

  it("treats slot_end as exclusive", () => {
    const item = baseItem({ slot_days: [0], slot_start: "11:50", slot_end: "12:10" });
    expect(isInSlot(item, MONDAY)).toBe(false);
  });

  it("is false when slot_days is empty", () => {
    const item = baseItem({ slot_days: [], slot_start: "00:00", slot_end: "23:59" });
    expect(isInSlot(item, MONDAY)).toBe(false);
  });

  it("is false when slot_start/slot_end are missing", () => {
    const item = baseItem({ slot_days: [0], slot_start: null, slot_end: null });
    expect(isInSlot(item, MONDAY)).toBe(false);
  });

  it("respects slot_from inclusively", () => {
    const inRange = baseItem({
      slot_days: [0], slot_start: "00:00", slot_end: "23:59", slot_from: "2026-09-14",
    });
    const notYet = baseItem({
      slot_days: [0], slot_start: "00:00", slot_end: "23:59", slot_from: "2026-09-15",
    });
    expect(isInSlot(inRange, MONDAY)).toBe(true);
    expect(isInSlot(notYet, MONDAY)).toBe(false);
  });

  it("respects slot_until inclusively", () => {
    const inRange = baseItem({
      slot_days: [0], slot_start: "00:00", slot_end: "23:59", slot_until: "2026-09-14",
    });
    const alreadyOver = baseItem({
      slot_days: [0], slot_start: "00:00", slot_end: "23:59", slot_until: "2026-09-13",
    });
    expect(isInSlot(inRange, MONDAY)).toBe(true);
    expect(isInSlot(alreadyOver, MONDAY)).toBe(false);
  });

  it("treats null slot_from/slot_until as open bounds", () => {
    const item = baseItem({
      slot_days: [0], slot_start: "00:00", slot_end: "23:59", slot_from: null, slot_until: null,
    });
    expect(isInSlot(item, MONDAY)).toBe(true);
  });
});

describe("pickSlides", () => {
  it("pins the first item (in order) whose slot matches now", () => {
    const notInSlot = baseItem({ id: 1, slot_days: [1], slot_start: "00:00", slot_end: "23:59" });
    const firstMatch = baseItem({ id: 2, slot_days: [0], slot_start: "00:00", slot_end: "23:59" });
    const secondMatch = baseItem({ id: 3, slot_days: [0], slot_start: "00:00", slot_end: "23:59" });

    const { pinned } = pickSlides([notInSlot, firstMatch, secondMatch], MONDAY);
    expect(pinned?.id).toBe(2);
  });

  it("pinned is null when no item's slot matches", () => {
    const notInSlot = baseItem({ id: 1, slot_days: [1], slot_start: "00:00", slot_end: "23:59" });
    const { pinned } = pickSlides([notInSlot], MONDAY);
    expect(pinned).toBeNull();
  });

  it("keeps slotted items in the rotation - a slot only adds pinning", () => {
    const withSlot = baseItem({ id: 1, slot_days: [0], slot_start: "00:00", slot_end: "23:59" });
    const outsideSlot = baseItem({ id: 2, slot_days: [1], slot_start: "00:00", slot_end: "23:59" });
    const noSlot = baseItem({ id: 3, slot_days: [] });

    const { rotation } = pickSlides([withSlot, outsideSlot, noSlot], MONDAY);
    expect(rotation.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it("skips a Wochenspruch without data and a Termine slide without events", () => {
    const ws = baseItem({ id: 1, kind: "wochenspruch", wochenspruch: null });
    const cal = baseItem({ id: 2, kind: "calendar", events: [], slot_days: [0], slot_start: "00:00", slot_end: "23:59" });
    const link = baseItem({ id: 3 });

    const { pinned, rotation } = pickSlides([ws, cal, link], MONDAY);
    expect(pinned).toBeNull();
    expect(rotation.map((i) => i.id)).toEqual([3]);
  });
});

describe("slideDurationMs", () => {
  it("is null for video items regardless of duration_seconds", () => {
    const item = baseItem({ media_type: "video", duration_seconds: 20 });
    expect(slideDurationMs(item)).toBeNull();
  });

  it("is null for PDFs, which page through on their own", () => {
    const item = baseItem({ kind: "file", media_type: "pdf", duration_seconds: 20 });
    expect(slideDurationMs(item)).toBeNull();
  });

  it("is duration_seconds * 1000 for non-video items", () => {
    const item = baseItem({ media_type: "image", duration_seconds: 20 });
    expect(slideDurationMs(item)).toBe(20000);
  });
});
