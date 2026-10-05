"use client";
// Multi-lane Zeitstrahl viewer: parallel lanes, zoom/pan, point + span events.
// Presentational only — lane filtering/toggling is the parent's job (pass the
// lanes/events you want drawn).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TimelineAxis, TimelineEvent, TimelineLane } from "./types";
import {
  assignRows, calendarTicks, effectiveEnd, effectiveStart, estimateTextWidth,
  eventDateLabel, formatValue, minVisibleSpan, niceTicks,
  useContainerWidth, valueToX, xToValue,
} from "./scale";

export { eventWhen } from "./scale";

/** Above this view span (in years), whole-year ticks are fine; below it,
 * calendar-aware day/month ticks take over (see calendarTicks in scale.ts). */
const CALENDAR_TICK_THRESHOLD_YEARS = 3;
/** One day, expressed as a fraction of a year — the zoom floor when the
 * dataset actually has exact_date precision to justify going below a year. */
const DAY_AS_YEAR = 1 / 365.25;

const TOOLTIP_W = 240;

const AXIS_H = 30;        // tick label strip at the top
const ROW_H = 26;         // one stacking row inside a lane
const LANE_PAD = 8;       // vertical padding inside a lane
const LANE_HEAD = 18;     // lane label strip
const MARGIN_X = 10;
const MIN_SPAN_PX = 14;   // a span bar never renders thinner than this

const FALLBACK_LANE: TimelineLane = { id: "__default", label: "" };

type View = { min: number; max: number };

export function TimelineCanvas({
  axis, lanes, events, onSelect, selectedId, maxHeight, viewRange,
}: {
  axis: TimelineAxis;
  lanes: TimelineLane[];
  events: TimelineEvent[];
  onSelect?: (ev: TimelineEvent | null) => void;
  selectedId?: string | null;
  maxHeight?: number;
  /** When set, the axis window animates to this [min, max] extent (with a
   * little padding) — used by the category filter to zoom to matches. */
  viewRange?: [number, number] | null;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [view, setView] = useState<View>({ min: axis.min, max: axis.max });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const drag = useRef<{ startX: number; view: View } | null>(null);
  const innerW = Math.max(100, width - 2 * MARGIN_X);

  const fullSpan = axis.max - axis.min;
  // A year axis without any day-precision data is measured in whole years,
  // so a year is the finest anyone needs; once at least one event carries an
  // exact_date, the floor drops to a day so those events can actually be
  // zoomed into (minVisibleSpan's density check still governs the real
  // floor almost everywhere — this only matters for genuinely isolated
  // dated events). A number line can be finer still (0,25-Schritte).
  const hasExactDates = useMemo(
    () => events.some(e => e.exact_date || e.exact_date_end),
    [events],
  );
  const unitFloor = axis.kind === "year"
    ? (hasExactDates ? DAY_AS_YEAR : 1)
    : (axis.step ?? fullSpan / 1e6);
  const clampView = useCallback((v: View): View => {
    const lo = axis.min - fullSpan * 0.03;
    const hi = axis.max + fullSpan * 0.03;
    // How far in you may zoom depends on what is actually there to look at —
    // see minVisibleSpan(). Computed against the candidate view so it tightens
    // as you zoom into a dense region and relaxes in sparse deep time.
    const minWidth = Math.min(minVisibleSpan(v.min, v.max, events, unitFloor), hi - lo);
    const span = Math.min(Math.max(v.max - v.min, minWidth), hi - lo);
    const min = Math.max(lo, Math.min(v.min, hi - span));
    return { min, max: min + span };
  }, [axis.min, axis.max, fullSpan, events, unitFloor]);

  const x = useCallback(
    (v: number) => MARGIN_X + valueToX(v, view.min, view.max, innerW),
    [view, innerW],
  );

  // Zoom to an externally-requested extent (category filter). null resets.
  useEffect(() => {
    if (!viewRange) {
      setView({ min: axis.min, max: axis.max });
      return;
    }
    const [lo, hi] = viewRange;
    const pad = (hi - lo) * 0.08 || fullSpan * 0.02;
    setView(clampView({ min: lo - pad, max: hi + pad }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewRange?.[0], viewRange?.[1]]);

  // ── layout: rows per lane ────────────────────────────────────────────────
  const drawLanes = lanes.length > 0 ? lanes : [FALLBACK_LANE];
  const layout = useMemo(() => {
    let y = AXIS_H;
    const out: {
      lane: TimelineLane; y: number; height: number;
      items: { ev: TimelineEvent; row: number; x0: number; x1: number; isSpan: boolean; ey: number }[];
    }[] = [];
    for (const lane of drawLanes) {
      const laneEvents = events.filter(e =>
        (lane.id === "__default" ? !e.lane : e.lane === lane.id));
      const visible = laneEvents.filter(e => {
        const start = effectiveStart(e);
        const end = effectiveEnd(e) ?? start;
        return end >= view.min && start <= view.max;
      });
      const spans = visible.map(e => {
        const isSpan = e.end != null && e.end > e.value;
        const x0 = x(effectiveStart(e));
        const x1 = isSpan
          ? Math.max(x(effectiveEnd(e)!), x0 + MIN_SPAN_PX)
          : x0 + Math.min(150, estimateTextWidth(e.label)) + 14;
        return { x0, x1 };
      });
      const rows = assignRows(spans);
      const rowCount = Math.max(1, ...rows.map(r => r + 1));
      const height = LANE_HEAD + rowCount * ROW_H + LANE_PAD;
      out.push({
        lane, y, height,
        items: visible.map((ev, i) => ({
          ev, row: rows[i], x0: spans[i].x0, x1: spans[i].x1,
          isSpan: ev.end != null && ev.end! > ev.value,
          ey: y + LANE_HEAD + rows[i] * ROW_H + 4,
        })),
      });
      y += height;
    }
    return { lanes: out, totalHeight: y + 4 };
  }, [drawLanes, events, view, x]);

  // Resolve the hovered event's current on-screen position for the tooltip
  // (re-derived from layout each render, not snapshotted at hover time, so
  // it stays correct if the view pans/zooms while still hovering).
  const hoverItem = useMemo(() => {
    if (!hoveredId) return null;
    for (const { items } of layout.lanes) {
      const found = items.find(it => it.ev.id === hoveredId);
      if (found) return found;
    }
    return null;
  }, [hoveredId, layout]);

  // ── interactions ─────────────────────────────────────────────────────────
  // Wheel zoom needs preventDefault to stop the page from scrolling, but
  // React attaches wheel listeners passively — so bind it manually.
  const svgEl = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const el = svgEl.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setHoveredId(null);
      const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
      const rect = el.getBoundingClientRect();
      setView(v => {
        const pivot = xToValue(e.clientX - rect.left - MARGIN_X, v.min, v.max, innerW);
        return clampView({
          min: pivot - (pivot - v.min) * factor,
          max: pivot + (v.max - pivot) * factor,
        });
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [innerW, clampView]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { startX: e.clientX, view };
    setHoveredId(null);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dv = ((drag.current.startX - e.clientX) / innerW) * (view.max - view.min);
    setView(clampView({ min: drag.current.view.min + dv, max: drag.current.view.max + dv }));
  }
  function onPointerUp() { drag.current = null; }

  const tickTarget = Math.max(4, Math.floor(innerW / 90));
  const ticks = axis.kind === "year" && view.max - view.min <= CALENDAR_TICK_THRESHOLD_YEARS
    ? calendarTicks(view.min, view.max, tickTarget)
    : niceTicks(view.min, view.max, tickTarget, axis.kind === "year" ? 1 : 0)
        .map(v => ({ v, label: formatValue(v, axis) }));
  const height = maxHeight ? Math.min(layout.totalHeight, maxHeight) : layout.totalHeight;

  return (
    <div ref={ref} className="w-full select-none">
      <div className="flex items-center gap-1 justify-end mb-1">
        <ZoomBtn label="−" onClick={() => setView(v => clampView(zoomAround(v, 1.4)))} />
        <ZoomBtn label="+" onClick={() => setView(v => clampView(zoomAround(v, 1 / 1.4)))} />
        <ZoomBtn label="⟲" onClick={() => setView({ min: axis.min, max: axis.max })} />
      </div>
      <div style={{ maxHeight: maxHeight, overflowY: maxHeight ? "auto" : undefined, position: "relative" }}>
        <svg
          ref={svgEl}
          width={width} height={height}
          className="block touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          onDoubleClick={() => setView({ min: axis.min, max: axis.max })}
        >
          {/* axis strip + gridlines */}
          {ticks.map(t => (
            <g key={t.v}>
              <line x1={x(t.v)} y1={AXIS_H - 6} x2={x(t.v)} y2={layout.totalHeight}
                stroke="var(--border)" strokeWidth={1} />
              <text x={x(t.v)} y={AXIS_H - 10} textAnchor="middle"
                fontSize={11} fill="var(--text-muted)">
                {t.label}
              </text>
            </g>
          ))}
          <line x1={0} y1={AXIS_H} x2={width} y2={AXIS_H} stroke="var(--border)" />

          {layout.lanes.map(({ lane, y, height: lh, items }) => (
            <g key={lane.id}>
              {lane.id !== "__default" && (
                <>
                  <rect x={0} y={y} width={width} height={lh}
                    fill={lane.color ?? "var(--text-muted)"} opacity={0.05} />
                  <text x={6} y={y + 13} fontSize={11} fontWeight={700}
                    fill={lane.color ?? "var(--text-muted)"}>
                    {lane.label}
                  </text>
                </>
              )}
              <line x1={0} y1={y + lh} x2={width} y2={y + lh} stroke="var(--border)" opacity={0.6} />
              {items.map(({ ev, x0, x1, isSpan, ey }) => {
                const color = ev.color ?? lane.color ?? "var(--accent)";
                const selected = ev.id === selectedId;
                return (
                  <g key={ev.id} className="cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onSelect?.(selected ? null : ev); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseEnter={() => setHoveredId(ev.id)}
                    onMouseLeave={() => setHoveredId(id => id === ev.id ? null : id)}>
                    {isSpan ? (
                      <>
                        <rect x={x0} y={ey} width={x1 - x0} height={ROW_H - 8}
                          rx={5} fill={color} opacity={selected ? 0.95 : 0.7}
                          stroke={selected ? "var(--text)" : "none"} />
                        <text x={x0 + 5} y={ey + 13} fontSize={11} fill="#fff"
                          style={{ pointerEvents: "none" }}>
                          {truncate(ev.label, (x1 - x0) / 6.5)}
                        </text>
                      </>
                    ) : (
                      <>
                        {/* Invisible hit area spanning circle + label — a bare
                            circle is too small to tap reliably (unlike a span's
                            full-width bar), so cover the whole row instead. */}
                        <rect x={x0 - 6} y={ey - 3} width={Math.max(x1 - x0, 20)} height={ROW_H - 2}
                          fill="transparent" />
                        <circle cx={x0} cy={ey + 9} r={selected ? 6 : 4.5}
                          fill={color} stroke={selected ? "var(--text)" : "none"}
                          style={{ pointerEvents: "none" }} />
                        <text x={x0 + 8} y={ey + 13} fontSize={11} fill="var(--text)"
                          style={{ pointerEvents: "none" }}>
                          {truncate(ev.label, 24)}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>

        {hoverItem && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-(--border) bg-(--surface) shadow-lg p-2 text-xs"
            style={{
              left: clamp((hoverItem.x0 + hoverItem.x1) / 2, TOOLTIP_W / 2 + 4, Math.max(width - TOOLTIP_W / 2 - 4, TOOLTIP_W / 2 + 4)),
              top: Math.max(hoverItem.ey - 6, 4),
              width: TOOLTIP_W,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="font-semibold">{hoverItem.ev.label}</div>
            <div className="text-(--text-muted)">{eventDateLabel(hoverItem.ev, axis)}</div>
            {hoverItem.ev.info && (
              <p className="text-(--text-muted) mt-1"
                style={{ display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {hoverItem.ev.info}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function zoomAround(v: View, factor: number): View {
  const mid = (v.min + v.max) / 2;
  const half = ((v.max - v.min) / 2) * factor;
  return { min: mid - half, max: mid + half };
}

function truncate(s: string, maxChars: number): string {
  if (maxChars < 3) return "";
  return s.length > maxChars ? s.slice(0, Math.max(1, Math.floor(maxChars) - 1)) + "…" : s;
}

function ZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-7 h-7 rounded-lg border border-(--border) text-sm
        hover:border-(--accent) transition-colors">
      {label}
    </button>
  );
}
