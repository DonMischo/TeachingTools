// Client-side mirror of api/timeline_engine.py's board/solution/scoring
// helpers. Used where no server round-trip exists (local practice on the
// tool page) and to render Exitgame specs, whose full JSON the client
// already holds (same trust model as Exitgame's visible accept lists).
// Authoritative scoring for Caputh/Exitgame/Übung stays on the server.
import {
  TimelineAnswer, TimelineBoard, TimelineGameSpec, TimelineSolution,
} from "./types";
import { isoDateToYear } from "./scale";

export function defaultTolerance(spec: TimelineGameSpec): number {
  if (spec.tolerance && spec.tolerance > 0) return spec.tolerance;
  if (spec.axis.step && spec.axis.step > 0) return spec.axis.step;
  return (spec.axis.max - spec.axis.min) * 0.05;
}

type SpecItem = TimelineGameSpec["items"][number];

/** Mirror of timeline_engine.effective_value: the item's real position, day-
 * precise when it carries an exact date. Two events in the same year are only
 * distinguishable through this. */
export function itemValue(it: SpecItem): number {
  return (it.exact_date ? isoDateToYear(it.exact_date) : null) ?? it.value;
}

export function itemActual(it: SpecItem): number | null {
  const iso = it.exact_date_actual ? isoDateToYear(it.exact_date_actual) : null;
  return iso ?? it.actual ?? null;
}

function misplaced(it: SpecItem): boolean {
  const actual = itemActual(it);
  return actual != null && actual !== itemValue(it);
}

export function specToBoard(spec: TimelineGameSpec): TimelineBoard {
  return {
    mode: spec.mode,
    axis: spec.axis,
    scoring: spec.scoring ?? "position",
    // sort: value AND exact_date are the answer — neither may reach the client.
    items: spec.items.map(it => spec.mode === "spot"
      ? { id: it.id, label: it.label, value: it.value, exact_date: it.exact_date ?? null }
      : { id: it.id, label: it.label }),
  };
}

export function specToSolution(spec: TimelineGameSpec): TimelineSolution {
  return {
    mode: spec.mode,
    axis: spec.axis,
    scoring: spec.scoring ?? "position",
    tolerance: spec.mode === "sort" ? defaultTolerance(spec) : null,
    items: spec.items.map(it => ({
      id: it.id,
      label: it.label,
      value: it.value,
      value_effective: itemValue(it),
      actual: it.actual ?? undefined,
      actual_effective: itemActual(it) ?? undefined,
      exact_date: it.exact_date ?? undefined,
      misplaced: misplaced(it),
      info: it.info ?? undefined,
    })),
  };
}

/** Same semantics as timeline_engine.score_answer — ratio + per-item map. */
export function scoreLocally(
  spec: TimelineGameSpec, answer: TimelineAnswer,
): { ratio: number; results: Record<string, boolean> } {
  const results: Record<string, boolean> = {};
  if (spec.mode === "spot") {
    const flagged = new Set(answer.flagged ?? []);
    for (const it of spec.items) results[it.id] = flagged.has(it.id) === misplaced(it);
  } else if ((spec.scoring ?? "position") === "order") {
    const placements = answer.placements ?? {};
    const answered = spec.items
      .filter(it => placements[it.id] != null)
      .map(it => ({ id: it.id, v: placements[it.id] }))
      .sort((a, b) => a.v - b.v || (a.id < b.id ? -1 : 1));
    const placedRank = new Map(answered.map((e, r) => [e.id, r]));
    const trueRank = new Map(
      [...spec.items]
        .sort((a, b) => itemValue(a) - itemValue(b) || (a.id < b.id ? -1 : 1))
        .map((it, r) => [it.id, r]),
    );
    for (const it of spec.items) {
      results[it.id] = placedRank.has(it.id) && placedRank.get(it.id) === trueRank.get(it.id);
    }
  } else {
    const tol = defaultTolerance(spec);
    const placements = answer.placements ?? {};
    for (const it of spec.items) {
      const p = placements[it.id];
      results[it.id] = p != null && Math.abs(p - itemValue(it)) <= tol;
    }
  }
  const total = spec.items.length;
  const ratio = total ? Object.values(results).filter(Boolean).length / total : 0;
  return { ratio, results };
}
