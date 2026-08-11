// Shared types for the Zeitstrahl engine (viewer + game board).
// Mirrors the backend contracts in api/timeline_engine.py and
// api/routers/timelines.py — keep the two in sync.

export type TimelineAxis = {
  kind: "number" | "year";
  min: number;
  max: number;
  /** Snap/grid step for game placement (also the minor-tick hint). */
  step?: number | null;
  /** Unit suffix for number axes, e.g. "cm", "°C". */
  unit?: string | null;
};

export type TimelineLane = {
  id: string;
  label: string;
  color?: string | null;
};

export type TimelineEvent = {
  id: string;
  label: string;
  /** Position on the axis; for spans this is the start. */
  value: number;
  end?: number | null;
  lane?: string | null;
  info?: string | null;
  /** Optional precise date for the start (and, for spans, end): a CE
   * ISO-8601 "YYYY-MM-DD" positions the event down to the day (e.g. the
   * start of WWI) instead of just the year, and drives the display label
   * too. Anything else (BCE dates, uncertain/legendary dates) is shown as a
   * freeform note next to the year instead — see eventDateLabel() in
   * scale.ts for the exact rules. */
  exact_date?: string | null;
  exact_date_end?: string | null;
  /** Filter key — click a category in the viewer to isolate + zoom to it. */
  category?: string | null;
  color?: string | null;
};

export type TimelineSetOut = {
  id: number;
  title: string;
  description: string | null;
  tags: string[];
  grades: number[];
  axis: TimelineAxis;
  lane_count: number;
  event_count: number;
  created_by: number | null;
  created_by_student: number | null;
  created_at: string;
};

export type TimelineSetDetail = TimelineSetOut & {
  lanes: TimelineLane[];
  events: TimelineEvent[];
};

// ── Game (sort / spot) ─────────────────────────────────────────────────────

export type TimelineGameMode = "sort" | "spot";

/** Client-safe board: in sort mode items carry NO value (placing them is the
 * task), in spot mode `value` is the displayed — possibly wrong — position. */
export type TimelineBoardItem = {
  id: string;
  label: string;
  value?: number;
  /** spot mode only: the displayed position, day-precise. In sort mode this
   * is part of the answer and is never sent to the client. */
  exact_date?: string | null;
};

export type TimelineBoard = {
  mode: TimelineGameMode;
  axis: TimelineAxis;
  scoring: "position" | "order";
  items: TimelineBoardItem[];
};

export type TimelineSolutionItem = {
  id: string;
  label: string;
  value: number;
  actual?: number;
  /** Real positions to draw at — day-precise when the item has an exact date.
   * `value`/`actual` stay as authored, for labelling. */
  value_effective?: number;
  actual_effective?: number;
  exact_date?: string;
  misplaced: boolean;
  info?: string;
};

export type TimelineSolution = {
  mode: TimelineGameMode;
  axis?: TimelineAxis;
  scoring: "position" | "order";
  tolerance: number | null;
  items: TimelineSolutionItem[];
};

/** sort: {placements}, spot: {flagged} — exactly what the backend scores. */
export type TimelineAnswer = {
  placements?: Record<string, number>;
  flagged?: string[];
};

/** Full authoring spec (what teachers write in Caputh/Exitgame JSON). */
export type TimelineGameSpec = {
  mode: TimelineGameMode;
  axis: TimelineAxis;
  items: {
    id: string;
    label: string;
    value: number;
    actual?: number | null;
    /** Day-precise position (CE ISO-8601, any precision). Required when two
     * items share a year, or they land on the same spot. In spot mode this is
     * the *displayed* date; exact_date_actual carries the true one. */
    exact_date?: string | null;
    exact_date_actual?: string | null;
    info?: string | null;
  }[];
  tolerance?: number | null;
  scoring?: "position" | "order" | null;
};
