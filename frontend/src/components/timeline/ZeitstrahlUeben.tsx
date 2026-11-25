"use client";
/**
 * Üben am Zeitstrahl: Einsortieren oder Fehler finden, lokal gewertet
 * (components/timeline/game.ts). Läuft auf der Seite der Lehrkraft und im
 * geteilten Zeitstrahl hinter dem QR; dort meldet `onRunde` jede geprüfte
 * Runde an den Sitzungsstand.
 */
import { useState } from "react";
import type {
  TimelineAnswer, TimelineAxis, TimelineEvent, TimelineGameSpec,
  TimelineSetDetail, TimelineSolution,
} from "@/components/timeline/types";
import { TimelineGameBoard, timelineAnswerComplete } from "@/components/timeline/TimelineGameBoard";
import { specToBoard, specToSolution, scoreLocally, itemValue, itemActual } from "@/components/timeline/game";
import { niceStep } from "@/components/timeline/scale";
import { useToast } from "@/contexts/ToastContext";

/** How far a "Fehler finden" item may be shoved off its true position, as a
 * fraction of the event's own duration. Big enough to be findable, small
 * enough that it stays a plausible mistake rather than an obvious outlier. */
const WRONG_MIN_RATIO = 0.15;
const WRONG_MAX_RATIO = 0.30;

/** Explicit tolerance choices for position scoring (axis units = years). 0 =
 * exact (the year, or the month/day if an exact_date is given); the deep-time
 * options are for erdgeschichtliche Achsen. */
const TOLERANCE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Exakt (Jahr/Datum)" },
  { value: 1, label: "± 1 Jahr" },
  { value: 2, label: "± 2 Jahre" },
  { value: 3, label: "± 3 Jahre" },
  { value: 5, label: "± 5 Jahre" },
  { value: 10, label: "± 10 Jahre" },
  { value: 15, label: "± 15 Jahre" },
  { value: 100, label: "± 1 Jahrhundert" },
  { value: 1000, label: "± 1 Jahrtausend" },
  { value: 1_000_000, label: "± 1 Mio. Jahre" },
  { value: 5_000_000, label: "± 5 Mio. Jahre" },
  { value: 10_000_000, label: "± 10 Mio. Jahre" },
];

/** Narrow a round's axis to the events it actually uses, padded and rounded
 * outward to a nice step. Without this a handful of modern events on a
 * deep-time axis share a single pixel. Never widens past the source axis. */
function focusedAxis(values: number[], axis: TimelineAxis): TimelineAxis {
  const finite = values.filter(v => Number.isFinite(v));
  if (finite.length === 0) return axis;
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  const span = hi - lo;
  const pad = span > 0 ? span * 0.25 : Math.max(1, Math.abs(lo || 1) * 0.05);
  lo -= pad;
  hi += pad;
  const step = niceStep((hi - lo) / 6);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  lo = Math.max(lo, axis.min);
  hi = Math.min(hi, axis.max);
  if (!(hi > lo)) return axis;
  return { ...axis, min: lo, max: hi };
}

export type RundenErgebnis = { ratio: number; results: Record<string, boolean> };

/** Runden aus den sichtbaren Ereignissen; `isTeacher` zeigt die Kopier-Knöpfe. */
export function PracticeTab({ set, visibleEvents, isTeacher, onRunde }: {
  set: TimelineSetDetail; visibleEvents: TimelineEvent[]; isTeacher: boolean;
  onRunde?: (ergebnis: RundenErgebnis) => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"sort" | "spot">("sort");
  const [tolerance, setTolerance] = useState(5);
  const [count, setCount] = useState(5);
  const [spec, setSpec] = useState<TimelineGameSpec | null>(null);
  const [answer, setAnswer] = useState<TimelineAnswer>({});
  const [result, setResult] = useState<RundenErgebnis | null>(null);

  const pool = visibleEvents;

  function buildSpec(): TimelineGameSpec | null {
    const n = Math.min(count, pool.length);
    if (n < 2) return null;
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
    // Carry exact_date through: without it two events from the same year land
    // on the same spot and the round is unsortable/unscoreable.
    const items = picked.map(ev => ({
      id: ev.id, label: ev.label, value: ev.value, info: ev.info ?? null,
      ...(ev.exact_date ? { exact_date: ev.exact_date } : {}),
    }));
    if (mode === "spot") {
      // A misplaced item has to be wrong-but-plausible. Scaling the offset by
      // the axis span (as this used to) is useless on a timeline that runs to
      // deep time — an 80-Mio-year shove is not a subtle error. Scale by the
      // event's OWN duration instead: Zwischenkriegszeit 1918–1939 = 21 y, so
      // it moves by at most ~6 years and stays a judgement call.
      const values = picked.map(p => p.value).sort((a, b) => a - b);
      const avgGap = values.length > 1
        ? (values[values.length - 1] - values[0]) / (values.length - 1)
        : 0;
      const order = items.map((_, i) => i).sort(() => Math.random() - 0.5);
      for (const i of order.slice(0, Math.max(1, Math.round(n / 3)))) {
        const src = picked[i];
        const it = items[i];
        const duration = src.end != null && src.end > src.value ? src.end - src.value : 0;
        // Point events have no duration to scale by — fall back to the typical
        // spacing of this round's items, so the shift stays in the neighbourhood.
        const base = duration > 0 ? duration
          : avgGap > 0 ? avgGap
            : (set.axis.max - set.axis.min) * 0.02;
        const magnitude = base * (WRONG_MIN_RATIO + Math.random() * (WRONG_MAX_RATIO - WRONG_MIN_RATIO));
        const dir = Math.random() < 0.5 ? -1 : 1;
        const place = (d: number) =>
          Math.min(set.axis.max, Math.max(set.axis.min, src.value + d * magnitude));
        let displayed = place(dir);
        if (displayed === src.value) displayed = place(-dir); // clamped at an axis edge
        if (set.axis.kind === "year") displayed = Math.round(displayed);
        // Must actually differ, or it isn't a misplaced item at all (and the
        // engine rejects a spot round with nothing wrong in it).
        if (displayed === src.value) displayed = src.value + (dir || 1);
        const m = it as {
          actual?: number | null; exact_date?: string | null; exact_date_actual?: string | null;
        };
        m.actual = src.value;
        if (m.exact_date) {
          // The precise date is the TRUE spot — it must move to the answer
          // side, or it would both leak the solution and contradict the
          // (deliberately wrong) year we're displaying.
          m.exact_date_actual = m.exact_date;
          delete m.exact_date;
        }
        it.value = displayed;
      }
    }
    // A round of five 20th-century events on a 541-Mio-year axis would be
    // unplayable — every answer sits in one invisible pixel. Frame the round
    // on its own items instead, rounded outward to a tick-friendly range so
    // it reads like an axis a teacher chose, not a tight box around the
    // answers. This also tightens the default scoring tolerance (5% of span).
    const marks = items.flatMap(it => {
      const a = itemActual(it);
      return a != null ? [itemValue(it), a] : [itemValue(it)];
    });
    const ends = picked.map(p => (p.end != null && p.end > p.value ? p.end : p.value));
    return {
      mode, axis: focusedAxis([...marks, ...ends], set.axis), items,
      // Placements are always judged by position; the Toleranz dropdown is the
      // single knob for how strict that is. Number axes (Zahlenstrahl) have no
      // year-based tolerance to pick and keep their step-based default.
      scoring: mode === "sort" ? "position" : null,
      ...(mode === "sort" && set.axis.kind === "year" ? { tolerance } : {}),
    };
  }

  function start() {
    const s = buildSpec();
    if (!s) return;
    setSpec(s);
    setAnswer({});
    setResult(null);
  }

  function check() {
    if (!spec) return;
    const r = scoreLocally(spec, answer);
    setResult(r);
    onRunde?.(r);
  }

  async function copySpec(target: "caputh" | "exitgame") {
    const s = buildSpec();
    if (!s) return;
    const snippet = target === "caputh"
      ? { type: "timeline", question: `Ordne die Ereignisse auf dem ${set.axis.kind === "year" ? "Zeitstrahl" : "Zahlenstrahl"} zu.`, timeline: s }
      : { id: "zeitstrahl-1", type: "task", title: "Zeitstrahl", text: "Ordne die Einträge richtig zu.", task: { kind: "timeline", timeline: s } };
    await navigator.clipboard.writeText(JSON.stringify(snippet, null, 2));
    toast(target === "caputh" ? "Caputh-Frage kopiert — in dein Quiz-JSON einfügen" : "TaskCrawler-Slide kopiert — in dein TaskCrawler-JSON einfügen", "success");
  }

  const board = spec ? specToBoard(spec) : null;
  const solution: TimelineSolution | null = spec && result ? specToSolution(spec) : null;

  return (
    <section className="card p-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Modus
          <select value={mode} onChange={e => setMode(e.target.value as "sort" | "spot")} className="input text-sm py-1.5">
            <option value="sort">Einsortieren (ziehen)</option>
            <option value="spot">Fehler finden</option>
          </select>
        </label>
        {mode === "sort" && set.axis.kind === "year" && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Toleranz
            <select value={tolerance} onChange={e => setTolerance(Number(e.target.value))} className="input text-sm py-1.5">
              {TOLERANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          Einträge
          <select value={count} onChange={e => setCount(Number(e.target.value))} className="input text-sm py-1.5">
            {[3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={start} className="btn-primary text-sm py-1.5 px-4" disabled={pool.length < 2}>
          {spec ? "Neue Runde" : "Runde starten"}
        </button>
        {isTeacher && (
          <span className="flex gap-2 ml-auto">
            <button onClick={() => copySpec("caputh")} className="text-xs border border-line rounded-lg px-2.5 py-1.5 hover:border-accent">
              🏕️ Als Caputh-Frage kopieren
            </button>
            <button onClick={() => copySpec("exitgame")} className="text-xs border border-line rounded-lg px-2.5 py-1.5 hover:border-accent">
              🗝️ Als TaskCrawler-Slide kopieren
            </button>
          </span>
        )}
      </div>
      {pool.length < 2 && (
        <p className="text-xs text-muted">Zu wenige sichtbare Einträge — blende mehr Spuren ein.</p>
      )}

      {board && spec && (
        <>
          <TimelineGameBoard
            board={board}
            answer={answer}
            onChange={setAnswer}
            solution={solution}
            itemResults={result?.results ?? null}
          />
          {!result ? (
            <button onClick={check}
              disabled={!timelineAnswerComplete(board, answer)}
              className="btn-primary text-sm py-1.5 px-5 self-start">
              Prüfen
            </button>
          ) : (
            <p className={`text-sm font-semibold ${result.ratio >= 1 ? "text-green-500" : result.ratio >= 0.5 ? "text-yellow-500" : "text-red-400"}`}>
              {result.ratio >= 1 ? "🎉 Alles richtig!" : `${Math.round(result.ratio * 100)} % richtig — grün zeigt die korrekten Positionen.`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
