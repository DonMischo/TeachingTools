"use client";
// Interactive game board for the two Zeitstrahl mechanics:
//   sort — items start in a pool; the player places each one on the line
//          (tap a chip to pick it up, tap the line to drop it). A placed flag
//          answers to the same tap-pick-up-tap-place gesture, and still to a
//          drag; dragging it well below the line unplaces it.
//   spot — items sit at their displayed (possibly wrong) position; the player
//          taps the ones that are misplaced.
// Fully controlled: `answer` + `onChange`. Pass `solution` (and, if the server
// scored, `itemResults`) after the reveal to switch to the read-only overlay.
// Touch-first: everything works with taps + drags, no hover required.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TimelineAnswer, TimelineBoard, TimelineSolution,
} from "./types";
import {
  assignRows, calendarTicks, estimateTextWidth, formatPlacement, formatValue,
  isoDateToYear, isoHasMonth, niceTicks, positionCorrect,
  snapValue, useContainerWidth, valueToX, xToValue,
} from "./scale";

const MARGIN_X = 14;
const TICK_AREA = 26;      // below the line
const SOLUTION_ROW_H = 18; // reveal labels below the line
const LINE_H = 13;         // one line of wrapped chip text
const CHIP_MAX_W = 170;
const CHIP_MAX_LINES = 3;

type View = { min: number; max: number };

export function TimelineGameBoard({
  board, answer, onChange, disabled, solution, itemResults,
}: {
  board: TimelineBoard;
  answer: TimelineAnswer;
  onChange?: (a: TimelineAnswer) => void;
  disabled?: boolean;
  solution?: TimelineSolution | null;
  /** Server-scored per-item correctness (authoritative when present). */
  itemResults?: Record<string, boolean> | null;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const axis = board.axis;
  const innerW = Math.max(80, width - 2 * MARGIN_X);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Picked up and waiting for a tap on the line — a pool chip or a placed flag.
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; removing: boolean; moved: boolean } | null>(null);
  // Touch drags on a phone always jitter a few pixels, so a press only counts
  // as a drag once it clears a threshold — everything shorter stays a tap.
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [view, setView] = useState<View>({ min: axis.min, max: axis.max });
  // A pan and a tap-to-place are the same gesture until the pointer moves, so
  // track the movement and only place if it stayed put.
  const pan = useRef<{ startX: number; view: View; moved: boolean } | null>(null);

  const isSort = board.mode === "sort";
  const placements = answer.placements ?? {};
  const flagged = new Set(answer.flagged ?? []);
  const interactive = !disabled && !solution && !!onChange;

  const fullSpan = axis.max - axis.min;
  const clampView = useCallback((v: View): View => {
    const minSpan = axis.step && axis.step > 0
      ? axis.step * 4
      : axis.kind === "year" ? Math.max(1, fullSpan / 500) : fullSpan / 500;
    const span = Math.min(Math.max(v.max - v.min, minSpan), fullSpan);
    const min = Math.max(axis.min, Math.min(v.min, axis.max - span));
    return { min, max: min + span };
  }, [axis.min, axis.max, axis.step, axis.kind, fullSpan]);

  // Reset the view whenever a new round starts on a different axis.
  useEffect(() => {
    setView({ min: axis.min, max: axis.max });
  }, [axis.min, axis.max]);

  const x = (v: number) => MARGIN_X + valueToX(v, view.min, view.max, innerW);
  const valueAt = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return snapValue(xToValue(clientX - rect.left - MARGIN_X, view.min, view.max, innerW), axis);
  };

  // Wheel zoom needs preventDefault (React binds wheel passively).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
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

  // Items currently shown as flags on the line.
  const flags = useMemo(() => {
    const list = isSort
      ? board.items.filter(it => placements[it.id] != null)
          .map(it => ({ ...it, at: placements[it.id] }))
      // spot: draw at the day-precise displayed position when there is one,
      // otherwise two same-year items would sit on top of each other.
      : board.items.map(it => ({
        ...it,
        at: (it.exact_date ? isoDateToYear(it.exact_date) : null) ?? it.value ?? axis.min,
      }));
    const laid = list.map(it => ({ ...it, chip: chipLayout(it.label) }));
    const spans = laid.map(it => {
      const cx = x(it.at);
      return { x0: cx - it.chip.w / 2, x1: cx + it.chip.w / 2 };
    });
    const rows = assignRows(spans, 4);
    return laid.map((it, i) => ({ ...it, row: rows[i] }));
  }, [board.items, placements, isSort, axis, innerW, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const flagRows = Math.max(1, ...flags.map(f => f.row + 1));
  const rowH = Math.max(30, ...flags.map(f => f.chip.h + 10));
  const lineY = 12 + flagRows * rowH + 16;

  // Reveal: correct-position labels below the line.
  const solutionMarks = useMemo(() => {
    if (!solution) return [];
    const marks = solution.items.map(it => ({
      ...it,
      correctAt: it.misplaced
        ? (it.actual_effective ?? it.actual ?? it.value_effective ?? it.value)
        : (it.value_effective ?? it.value),
    }));
    const spans = marks.map(m => {
      const w = estimateTextWidth(m.label) + 10;
      const cx = x(m.correctAt);
      return { x0: cx - w / 2, x1: cx + w / 2 };
    });
    const rows = assignRows(spans, 4);
    return marks.map((m, i) => ({ ...m, row: rows[i] }));
  }, [solution, innerW, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const solutionRows = Math.max(0, ...solutionMarks.map(m => m.row + 1));
  const height = lineY + TICK_AREA + (solution ? 6 + solutionRows * SOLUTION_ROW_H : 0) + 6;

  const pool = isSort ? board.items.filter(it => placements[it.id] == null) : [];

  function resultFor(id: string): boolean | null {
    if (itemResults && id in itemResults) return itemResults[id];
    if (!solution) return null;
    const sol = solution.items.find(it => it.id === id);
    if (!sol) return null;
    if (solution.mode === "spot") return flagged.has(id) === sol.misplaced;
    if (solution.scoring === "order") return null; // rank, not per-item position
    return positionCorrect(
      axis,
      { value: sol.value, effective: sol.value_effective ?? sol.value, hasMonth: isoHasMonth(sol.exact_date) },
      placements[id],
      solution.tolerance,
    );
  }

  // ── interactions ─────────────────────────────────────────────────────────
  function onLineTap(e: React.PointerEvent) {
    if (!interactive || !isSort || !selected) return;
    onChange!({ placements: { ...placements, [selected]: valueAt(e.clientX) } });
    setSelected(null);
  }

  function onFlagPointerDown(e: React.PointerEvent, id: string) {
    if (!interactive) return;
    e.stopPropagation();
    if (!isSort) {
      const next = new Set(flagged);
      next.has(id) ? next.delete(id) : next.add(id);
      onChange!({ flagged: [...next] });
      return;
    }
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDrag({ id, removing: false, moved: false });
  }

  function onSvgPointerDown(e: React.PointerEvent) {
    if (drag) return;
    pan.current = { startX: e.clientX, view, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drag && isSort) {
      const start = dragStart.current;
      if (!drag.moved && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
      const rect = svgRef.current!.getBoundingClientRect();
      const removing = e.clientY - rect.top > lineY + 46;
      if (removing !== drag.removing || !drag.moved) setDrag({ ...drag, removing, moved: true });
      onChange!({ placements: { ...placements, [drag.id]: valueAt(e.clientX) } });
      return;
    }
    if (!pan.current) return;
    const dx = e.clientX - pan.current.startX;
    if (Math.abs(dx) > 3) pan.current.moved = true;
    if (!pan.current.moved) return;
    const dv = (-dx / innerW) * (pan.current.view.max - pan.current.view.min);
    setView(clampView({ min: pan.current.view.min + dv, max: pan.current.view.max + dv }));
  }

  /** True when the release belonged to a flag, so the line must not also
   *  handle it as a placing tap. */
  function releaseDrag(): boolean {
    if (!drag) return false;
    if (isSort && drag.removing) {
      const next = { ...placements };
      delete next[drag.id];
      onChange!({ placements: next });
      setSelected(s => (s === drag.id ? null : s));
    } else if (isSort && !drag.moved) {
      // Tapped, not dragged: pick the flag up again — the next tap on the line
      // moves it, which is far easier on a phone than dragging it there.
      setSelected(s => (s === drag.id ? null : drag.id));
    }
    setDrag(null);
    dragStart.current = null;
    return true;
  }

  function onSvgPointerUp(e: React.PointerEvent) {
    const panned = pan.current?.moved ?? false;
    pan.current = null;
    const onFlag = releaseDrag();
    if (!panned && !onFlag) onLineTap(e);
  }

  // Show month/day ticks once zoomed tight enough for them to be legible;
  // otherwise whole years. (A month round shows years until you zoom in.)
  const tickTarget = Math.max(3, Math.floor(innerW / 80));
  const ticks = axis.kind === "year" && view.max - view.min <= 3
    ? calendarTicks(view.min, view.max, tickTarget)
    : niceTicks(view.min, view.max, tickTarget, axis.kind === "year" ? 1 : 0)
        .map(v => ({ v, label: formatValue(v, axis) }));
  const zoomed = view.max - view.min < fullSpan - 1e-9;

  return (
    <div ref={ref} className="w-full select-none">
      <div className="flex items-center justify-end gap-1 mb-1">
        <ZoomBtn label="−" onClick={() => setView(v => clampView(zoomAround(v, 1.4)))} />
        <ZoomBtn label="+" onClick={() => setView(v => clampView(zoomAround(v, 1 / 1.4)))} />
        <ZoomBtn label="⟲" onClick={() => setView({ min: axis.min, max: axis.max })} disabled={!zoomed} />
      </div>
      <svg
        ref={svgRef} width={width} height={height}
        className={`block touch-none ${zoomed ? "cursor-grab active:cursor-grabbing" : ""}`}
        onPointerDown={onSvgPointerDown}
        onPointerUp={onSvgPointerUp}
        onPointerMove={onPointerMove}
        onPointerLeave={() => { pan.current = null; releaseDrag(); }}
        onDoubleClick={() => setView({ min: axis.min, max: axis.max })}
      >
        {/* line + ticks */}
        <line x1={MARGIN_X - 6} y1={lineY} x2={width - MARGIN_X + 6} y2={lineY}
          stroke="var(--text-muted)" strokeWidth={2} />
        {ticks.map(t => (
          <g key={t.v}>
            <line x1={x(t.v)} y1={lineY - 5} x2={x(t.v)} y2={lineY + 5}
              stroke="var(--text-muted)" strokeWidth={1.5} />
            <text x={x(t.v)} y={lineY + 18} textAnchor="middle" fontSize={10.5}
              fill="var(--text-muted)">
              {t.label}
            </text>
          </g>
        ))}
        {/* minor step ticks when snapping is on and they are sparse enough */}
        {axis.step && innerW / ((view.max - view.min) / axis.step) > 7 &&
          stepTicks(view.min, view.max, axis.step).map(t => (
            <line key={t} x1={x(t)} y1={lineY - 3} x2={x(t)} y2={lineY + 3}
              stroke="var(--text-muted)" strokeWidth={0.75} opacity={0.5} />
          ))}

        {/* tap-to-place hint zone */}
        {interactive && isSort && selected && (
          <rect x={0} y={0} width={width} height={lineY + 12}
            fill="var(--accent)" opacity={0.06} rx={8} />
        )}

        {/* placed / displayed item flags (above the line) */}
        {flags.map(f => {
          const cx = x(f.at);
          const chipH = f.chip.h;
          const topY = lineY - 14 - f.row * rowH - chipH;
          const w = f.chip.w;
          const res = resultFor(f.id);
          const isFlagged = !isSort && flagged.has(f.id);
          const removing = drag?.id === f.id && drag.removing;
          const picked = isSort && selected === f.id;
          const stroke = res == null
            ? (picked ? "var(--accent)" : isFlagged ? "#f87171" : "var(--border)")
            : res ? "#4ade80" : "#f87171";
          const fill = res == null
            ? (isFlagged ? "rgba(248,113,113,0.18)" : "var(--surface)")
            : res ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)";
          return (
            <g key={f.id} opacity={removing ? 0.35 : 1}
              className={interactive ? "cursor-pointer" : undefined}
              onPointerDown={(e) => onFlagPointerDown(e, f.id)}>
              <line x1={cx} y1={topY + chipH} x2={cx} y2={lineY}
                stroke={stroke} strokeWidth={1.5} />
              <circle cx={cx} cy={lineY} r={4} fill={stroke} />
              <rect x={cx - w / 2} y={topY} width={w} height={chipH} rx={6}
                fill={fill} stroke={stroke} strokeWidth={picked ? 2.5 : 1.5} />
              <text x={cx} textAnchor="middle" fontSize={11.5}
                fontWeight={600} fill="var(--text)" style={{ pointerEvents: "none" }}>
                {f.chip.lines.map((line, i) => (
                  <tspan key={i} x={cx} y={topY + 14 + i * LINE_H}>{line}</tspan>
                ))}
              </text>
              {isSort && (
                <text x={cx} y={topY + chipH + 11} textAnchor="middle" fontSize={9.5}
                  fill="var(--text-muted)" style={{ pointerEvents: "none" }}>
                  {formatPlacement(f.at, axis)}
                </text>
              )}
              {!isSort && !solution && isFlagged && (
                <text x={cx + w / 2 - 2} y={topY - 2} textAnchor="end" fontSize={11} fill="#f87171"
                  style={{ pointerEvents: "none" }}>✗</text>
              )}
              {res != null && (
                <text x={cx + w / 2 + 3} y={topY + 15} fontSize={12}
                  fill={res ? "#4ade80" : "#f87171"} style={{ pointerEvents: "none" }}>
                  {res ? "✓" : "✗"}
                </text>
              )}
            </g>
          );
        })}

        {/* reveal: correct positions below the line */}
        {solution && solutionMarks.map(m => {
          const cx = x(m.correctAt);
          const ly = lineY + TICK_AREA + m.row * SOLUTION_ROW_H;
          return (
            <g key={m.id}>
              <path d={`M ${cx - 5} ${lineY + 8} L ${cx + 5} ${lineY + 8} L ${cx} ${lineY + 1} Z`}
                fill="#4ade80" />
              <line x1={cx} y1={lineY + 8} x2={cx} y2={ly + 4} stroke="#4ade80"
                strokeWidth={1} opacity={0.5} />
              <text x={cx} y={ly + 13} textAnchor="middle" fontSize={10}
                fill="#4ade80">
                {m.label} ({formatValue(m.correctAt, axis)})
              </text>
            </g>
          );
        })}
      </svg>

      {/* pool (sort mode) */}
      {isSort && !solution && pool.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {pool.map(it => (
            <button key={it.id} disabled={!interactive}
              onClick={() => interactive && setSelected(p => p === it.id ? null : it.id)}
              className={`px-3 py-1.5 rounded-xl border text-sm font-semibold transition-all text-left max-w-[16rem] ${
                selected === it.id
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)] scale-105"
                  : "border-[var(--border)] hover:border-[var(--accent)]"
              }`}>
              {it.label}
            </button>
          ))}
        </div>
      )}
      {interactive && isSort && (
        <p className="text-xs text-[var(--text-muted)] mt-1.5">
          {selected
            ? "Tippe auf den Strahl, um zu platzieren."
            : pool.length > 0
              ? "Tippe eine Karte an, dann auf die richtige Stelle. Platzierte Karten antippen und neu setzen — oder ziehen; nach unten ziehen entfernt sie."
              : "Alles platziert — zum Korrigieren eine Karte antippen und neu setzen, oder sie ziehen."}
        </p>
      )}
      {interactive && !isSort && (
        <p className="text-xs text-[var(--text-muted)] mt-1.5">
          Tippe alle Einträge an, die an der falschen Stelle sitzen.
        </p>
      )}
    </div>
  );
}

/** Sort-mode completeness — parents enable their submit button with this. */
export function timelineAnswerComplete(board: TimelineBoard, answer: TimelineAnswer): boolean {
  if (board.mode === "spot") return true; // flagging nothing is a legal answer
  const placements = answer.placements ?? {};
  return board.items.every(it => placements[it.id] != null);
}

/** Break a label across up to CHIP_MAX_LINES lines so long names like
 * "Deutsch-Französischer Krieg" stay inside their card instead of bleeding
 * out of it. */
export function wrapLabel(s: string, maxChars = 20, maxLines = CHIP_MAX_LINES): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  let dropped = false;
  for (const word of words) {
    const cand = cur ? `${cur} ${word}` : word;
    if (cand.length <= maxChars) {
      cur = cand;
      continue;
    }
    if (cur) lines.push(cur);
    if (lines.length >= maxLines) { dropped = true; cur = ""; break; }
    cur = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
  }
  if (cur) {
    if (lines.length < maxLines) lines.push(cur);
    else dropped = true;
  }
  if (lines.length === 0) return [s.slice(0, maxChars)];
  if (dropped) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.endsWith("…") ? last : `${last.slice(0, maxChars - 1)}…`;
  }
  return lines;
}

function chipLayout(label: string): { lines: string[]; w: number; h: number } {
  const lines = wrapLabel(label);
  const widest = Math.max(...lines.map(l => estimateTextWidth(l, 11.5)));
  return {
    lines,
    w: Math.min(CHIP_MAX_W, Math.max(40, widest + 16)),
    h: lines.length * LINE_H + 9,
  };
}

function zoomAround(v: View, factor: number): View {
  const mid = (v.min + v.max) / 2;
  const half = ((v.max - v.min) / 2) * factor;
  return { min: mid - half, max: mid + half };
}

function ZoomBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-7 h-7 rounded-lg border border-[var(--border)] text-sm
        hover:border-[var(--accent)] transition-colors disabled:opacity-30">
      {label}
    </button>
  );
}

function stepTicks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out.slice(0, 400);
}
