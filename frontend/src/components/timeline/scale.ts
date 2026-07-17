// Axis math + German label formatting for the Zeitstrahl engine.
import { useEffect, useRef, useState } from "react";
import { TimelineAxis, TimelineEvent } from "./types";

/** Round a raw step up to a "nice" 1/2/2.5/5×10^k value. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !isFinite(raw)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function decimalsOf(step: number): number {
  if (step >= 1) return 0;
  return Math.min(6, Math.max(0, -Math.floor(Math.log10(step)) + 1));
}

function roundToStep(v: number, step: number): number {
  const d = decimalsOf(step);
  return Number((Math.round(v / step) * step).toFixed(d));
}

/** Major tick positions for a view range. `minStep` floors the tick spacing —
 * year axes pass 1 so that zooming past a few years of span shows whole years
 * (1914, 1915, …) instead of nonsense half-years (1914,5). */
export function niceTicks(min: number, max: number, target = 8, minStep = 0): number[] {
  if (!(max > min)) return [];
  const step = Math.max(niceStep((max - min) / target), minStep);
  const ticks: number[] = [];
  let v = Math.ceil(min / step - 1e-9) * step;
  for (; v <= max + step * 1e-9; v += step) ticks.push(roundToStep(v, step));
  return ticks;
}

/** Smallest span the view may zoom to, derived from how dense the events are
 * in the range being looked at: zoom is allowed until the two closest visible
 * events sit ~half a viewport apart, never tighter than one axis unit (= year
 * scale, which recent history needs) and never bounded above.
 *
 * The point is that one global limit cannot serve an axis running from the
 * dinosaurs to last week. Density gives the right answer per region for free:
 * around 1914–1945 the nearest events are a year or two apart, so you can zoom
 * to a handful of years; around the Kreidezeit they are millions of years
 * apart, so it stops at roughly that scale instead of letting you zoom into
 * tens of millions of years of empty nothing. Events with a precise
 * exact_date use their real calendar position here (not just the year), so
 * e.g. two events three weeks apart in the same year can still pull the
 * floor down to day scale even though their `value` is identical. */
export function minVisibleSpan(
  rangeMin: number, rangeMax: number,
  events: { value: number; end?: number | null; exact_date?: string | null; exact_date_end?: string | null }[],
  absoluteFloor = 1,
): number {
  const pts: number[] = [];
  for (const e of events) {
    const a = effectiveStart(e);
    const b = effectiveEnd(e) ?? a;
    if (b >= rangeMin && a <= rangeMax) {
      pts.push(a);
      if (b !== a) pts.push(b);
    }
  }
  pts.sort((p, q) => p - q);
  let minGap = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const g = pts[i] - pts[i - 1];
    if (g > 1e-9) minGap = Math.min(minGap, g);
  }
  if (!isFinite(minGap)) return absoluteFloor;
  return Math.max(absoluteFloor, minGap * 2);
}

// ---------------------------------------------------------------------------
// Day-precision dates (exact_date / exact_date_end)
// ---------------------------------------------------------------------------
//
// `value`/`end` stay whole years — every zoom/scale computation above works
// on them unchanged. exact_date/exact_date_end are an optional, purely
// additive layer: when a CE ISO-8601 date is present it gives a more precise
// position (down to the day) than the year alone, and a nicer display label.
// Anything that isn't a parseable CE ISO date (BCE dates, "21. April 753 v.
// Chr. (Überlieferung)", …) is left alone: a freeform label shown alongside
// the year, no effect on position.
//
// All three ISO 8601 precisions are accepted, because that is what authors
// (and LLMs filling in the Vorlage) actually write when the day isn't known:
//   "1942-01-20"  full date   -> positioned on that day
//   "0732-10"     year+month  -> positioned on the 1st of that month
//   "1337"        year only   -> positioned on Jan 1 (i.e. same as `value`,
//                                but renders as a clean year, not as a
//                                redundant "1337 · 1337" note)
//
// Deliberately CE-only: ISO 8601's astronomical year numbering for BCE (1
// BCE = year 0000, 2 BCE = year -0001, …) is off by one from this app's
// "-753 = 753 v. Chr." convention used everywhere else in the schema, and
// reliable to-the-day BCE dates are rare enough in practice that it isn't
// worth risking a silent one-year positioning error to support them.

const ISO_DATE_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export type IsoDateParts = { year: number; month: number | null; day: number | null };

/** UTC timestamp for a Y/M/D. Not Date.UTC(): that maps years 0-99 to
 * 1900-1999, which would silently break every 1st-century CE date. */
function utcTime(year: number, month: number, day: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/** Parse a CE ISO-8601 date at any precision (YYYY | YYYY-MM | YYYY-MM-DD).
 * Null for anything else, including invalid calendar dates like Feb 30. */
export function parseIsoDate(iso: string): IsoDateParts | null {
  const m = ISO_DATE_RE.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] != null ? Number(m[2]) : null;
  const day = m[3] != null ? Number(m[3]) : null;
  if (year < 1) return null;
  if (month != null && (month < 1 || month > 12)) return null;
  if (day != null) {
    if (day < 1 || day > 31) return null;
    // Rolls over on invalid days (Feb 30 -> Mar 2) — compare back to catch it.
    const check = new Date(utcTime(year, month!, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month! - 1 || check.getUTCDate() !== day) {
      return null;
    }
  }
  return { year, month, day };
}

/** A CE ISO-8601 date as a fractional year for precise axis positioning,
 * e.g. "1942-01-20" -> ~1942.052. Null for anything unparseable. */
export function isoDateToYear(iso: string): number | null {
  const p = parseIsoDate(iso);
  if (!p) return null;
  const start = utcTime(p.year, 1, 1);
  const nextStart = utcTime(p.year + 1, 1, 1);
  const at = utcTime(p.year, p.month ?? 1, p.day ?? 1);
  return p.year + (at - start) / (nextStart - start);
}

/** German label at whatever precision the date carries: "20. Januar 1942",
 * "Oktober 732", "1337". Null if not a parseable CE ISO date (the caller
 * falls back to showing the freeform text). */
export function formatIsoDateDe(iso: string): string | null {
  const p = parseIsoDate(iso);
  if (!p) return null;
  if (p.month == null) return String(p.year);
  if (p.day == null) return `${MONTHS_DE[p.month - 1]} ${p.year}`;
  return `${p.day}. ${MONTHS_DE[p.month - 1]} ${p.year}`;
}

/** The event's real axis position: the parsed exact_date when present and a
 * valid CE ISO date, otherwise the plain (year-level) value. Positioning
 * only — never feed this into formatValue/eventWhen, which must keep
 * showing the authored year, not a fractional one. */
export function effectiveStart(ev: { value: number; exact_date?: string | null }): number {
  return (ev.exact_date ? isoDateToYear(ev.exact_date) : null) ?? ev.value;
}

export function effectiveEnd(ev: { end?: number | null; exact_date_end?: string | null }): number | null {
  if (ev.end == null) return null;
  return (ev.exact_date_end ? isoDateToYear(ev.exact_date_end) : null) ?? ev.end;
}

function yearToDate(v: number): Date {
  const year = Math.floor(v);
  const start = utcTime(year, 1, 1);
  const nextStart = utcTime(year + 1, 1, 1);
  return new Date(Math.round(start + (v - year) * (nextStart - start)));
}

function dateToYear(d: Date): number {
  const year = d.getUTCFullYear();
  const start = utcTime(year, 1, 1);
  const nextStart = utcTime(year + 1, 1, 1);
  return year + (d.getTime() - start) / (nextStart - start);
}

/** Add months to a UTC instant, keeping day-of-month at 1 (tick anchors). */
function addMonthsUtc(d: Date, months: number): Date {
  return new Date(utcTime(d.getUTCFullYear(), d.getUTCMonth() + 1 + months, 1));
}

const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const MONTHS_DE_ABBR = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** Calendar-aware ticks for narrow year-axis views (a few years or less),
 * where whole-year ticks are too coarse to be useful once the view is tight
 * enough to matter for day-precision events. Steps through real calendar
 * units (day or month, via actual Date arithmetic — correct month lengths
 * and leap years, not naive fractional-year math) and labels each tick with
 * a real calendar date instead of a fractional year. */
export function calendarTicks(min: number, max: number, target = 6): { v: number; label: string }[] {
  const startDate = yearToDate(min);
  const endDate = yearToDate(max);
  const totalDays = (endDate.getTime() - startDate.getTime()) / 86_400_000;
  if (!(totalDays > 0)) return [];

  const ticks: { v: number; label: string }[] = [];

  if (totalDays <= 70) {
    const dayStep = [1, 2, 5, 10, 15].find(n => totalDays / n <= target) ?? 15;
    const first = utcTime(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate());
    for (let t = first; t <= endDate.getTime(); t += dayStep * 86_400_000) {
      const d = new Date(t);
      ticks.push({ v: dateToYear(d), label: `${d.getUTCDate()}. ${MONTHS_DE_ABBR[d.getUTCMonth()]}` });
    }
  } else {
    const totalMonths = totalDays / 30.44;
    const monthStep = [1, 2, 3, 6].find(n => totalMonths / n <= target) ?? 6;
    const firstMonth = Math.floor(startDate.getUTCMonth() / monthStep) * monthStep;
    let cursor = new Date(utcTime(startDate.getUTCFullYear(), firstMonth + 1, 1));
    while (cursor.getTime() <= endDate.getTime()) {
      const label = monthStep >= 12
        ? String(cursor.getUTCFullYear())
        : `${MONTHS_DE_ABBR[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`;
      ticks.push({ v: dateToYear(cursor), label });
      cursor = addMonthsUtc(cursor, monthStep);
    }
  }
  return ticks;
}

/** Date/range label for an event, e.g. "1618 – 1648" (no exact dates) or
 * "20. Januar 1942" (precise). Freeform non-ISO exact_date is appended as a
 * supplementary note rather than replacing the coarse year, since it's often
 * an uncertainty caveat ("… (Überlieferung)") rather than a real date. */
export function eventWhen(ev: TimelineEvent, axis: TimelineAxis): string {
  return ev.end != null && ev.end > ev.value
    ? formatRange(ev.value, ev.end, axis)
    : formatValue(ev.value, axis);
}

export function eventDateLabel(ev: TimelineEvent, axis: TimelineAxis): string {
  const startIso = ev.exact_date ? formatIsoDateDe(ev.exact_date) : null;
  const isSpan = ev.end != null && ev.end > ev.value;
  if (startIso) {
    if (!isSpan) return startIso;
    const endIso = ev.exact_date_end ? formatIsoDateDe(ev.exact_date_end) : null;
    return `${startIso} – ${endIso ?? formatValue(ev.end!, axis)}`;
  }
  const coarse = eventWhen(ev, axis);
  return ev.exact_date ? `${coarse} · ${ev.exact_date}` : coarse;
}

export function valueToX(v: number, viewMin: number, viewMax: number, width: number): number {
  return ((v - viewMin) / (viewMax - viewMin)) * width;
}

export function xToValue(x: number, viewMin: number, viewMax: number, width: number): number {
  return viewMin + (x / width) * (viewMax - viewMin);
}

/** Snap a value to the axis step (if any), clamped to the axis range. Year
 * axes never snap finer than a whole year — placing an event "in 1913,95"
 * is meaningless, and the auto-focused game axis makes that reachable. */
export function snapValue(v: number, axis: TimelineAxis): number {
  const auto = niceStep((axis.max - axis.min) / 2000);
  const step = axis.step && axis.step > 0
    ? axis.step
    : axis.kind === "year" ? Math.max(1, auto) : auto;
  return Math.min(axis.max, Math.max(axis.min, roundToStep(v, step)));
}

const de = (v: number, maxFrac = 2) =>
  v.toLocaleString("de-DE", { maximumFractionDigits: maxFrac });

/** "13,8 Mrd." / "500 Mio." / "300.000" for deep-time magnitudes. */
function bigNumber(abs: number): string {
  if (abs >= 1e9) return `${de(abs / 1e9, 1)} Mrd.`;
  if (abs >= 1e6) return `${de(abs / 1e6, 1)} Mio.`;
  return de(abs, 0);
}

/** Tick/value label appropriate for the axis kind (German conventions). */
export function formatValue(v: number, axis: TimelineAxis): string {
  if (axis.kind === "year") {
    const abs = Math.abs(v);
    if (v < 0 && abs >= 100_000) return `vor ${bigNumber(abs)}`;
    if (v < 0) return `${abs >= 10_000 ? de(abs, 0) : abs} v. Chr.`;
    if (abs >= 10_000) return de(v, 0);
    return String(Math.round(v) === v ? v : Number(v.toFixed(1)));
  }
  const frac = axis.step && axis.step < 1 ? decimalsOf(axis.step) : absFrac(v);
  const s = v.toLocaleString("de-DE", { maximumFractionDigits: Math.max(frac, 3) });
  return axis.unit ? `${s} ${axis.unit}` : s;
}

function absFrac(v: number): number {
  return Math.round(v) === v ? 0 : 2;
}

/** Range label for a span event, e.g. "1618 – 1648" / "27 v. Chr. – 476". */
export function formatRange(start: number, end: number, axis: TimelineAxis): string {
  return `${formatValue(start, axis)} – ${formatValue(end, axis)}`;
}

/** Rough pixel width of a label at ~11px font — good enough for stacking. */
export function estimateTextWidth(text: string, fontSize = 11): number {
  return text.length * fontSize * 0.58;
}

/** Greedy row assignment: place each [x0, x1] interval (sorted by x0) into the
 * first row whose right edge it clears. Returns row index per input index. */
export function assignRows(spans: { x0: number; x1: number }[], gap = 8): number[] {
  const rowRight: number[] = [];
  const order = spans.map((s, i) => i).sort((a, b) => spans[a].x0 - spans[b].x0);
  const rows = new Array<number>(spans.length).fill(0);
  for (const i of order) {
    let row = rowRight.findIndex(r => spans[i].x0 >= r + gap);
    if (row === -1) {
      row = rowRight.length;
      rowRight.push(-Infinity);
    }
    rowRight[row] = Math.max(rowRight[row], spans[i].x1);
    rows[i] = row;
  }
  return rows;
}

/** Observe an element's content width (SSR-safe, defaults to `fallback`). */
export function useContainerWidth<T extends HTMLElement>(fallback = 700) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || fallback);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return { ref, width };
}
