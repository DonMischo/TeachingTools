"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  TimelineAnswer, TimelineAxis, TimelineEvent, TimelineGameSpec,
  TimelineLane, TimelineSetDetail, TimelineSolution,
} from "@/components/timeline/types";
import { TimelineCanvas } from "@/components/timeline/TimelineCanvas";
import { TimelineGameBoard, timelineAnswerComplete } from "@/components/timeline/TimelineGameBoard";
import {
  specToBoard, specToSolution, scoreLocally, itemValue, itemActual,
} from "@/components/timeline/game";
import { eventDateLabel, formatValue, niceStep } from "@/components/timeline/scale";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

type Tab = "ansehen" | "ueben" | "bearbeiten";

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

/** Filter key for an event — explicit category, falling back to the info text. */
function eventCategory(e: TimelineEvent): string | null {
  return (e.category ?? e.info) || null;
}

export default function ZeitstrahlDetailPage() {
  const { id } = useParams<{ id: string }>();
  const setId = Number(id);
  const { auth } = useAuth();
  const isTeacher = auth?.user_type === "teacher";
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: set, isLoading, isError } = useQuery<TimelineSetDetail>({
    queryKey: ["timeline", setId],
    queryFn: () => api.timelines.get(setId),
    enabled: Number.isFinite(setId) && !!auth,
  });

  const [tab, setTab] = useState<Tab>("ansehen");
  const [hiddenLanes, setHiddenLanes] = useState<Set<string>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<TimelineEvent | null>(null);

  // Distinct categories (falls back to `info`) for the filter chips.
  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const e of set?.events ?? []) {
      const c = eventCategory(e);
      if (c) seen.set(c, (seen.get(c) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"));
  }, [set?.events]);

  // Memoized: TimelineCanvas derives its zoom limits from the events array, so
  // a fresh array every render would rebind its listeners each time.
  const { visibleEvents, visibleLanes, focusRange } = useMemo(() => {
    if (!set) return { visibleEvents: [], visibleLanes: [], focusRange: null };
    const evs = set.events.filter(e => {
      if (e.lane && hiddenLanes.has(e.lane)) return false;
      const c = eventCategory(e);
      return !c || !hiddenCategories.has(c); // uncategorized can't be filtered away
    });
    const laneHas = new Set(evs.map(e => e.lane ?? "__default"));
    const lanes = set.lanes.filter(l =>
      !hiddenLanes.has(l.id) &&
      // Collapse lanes a category filter emptied, but keep genuinely empty
      // lanes visible when nothing is filtered.
      (hiddenCategories.size === 0 || laneHas.has(l.id)));

    // Reframe to the first→last remaining date whenever anything is filtered
    // out, so deselecting e.g. Rom leaves the medieval spans filling the view.
    const filtered = hiddenLanes.size > 0 || hiddenCategories.size > 0;
    let range: [number, number] | null = null;
    if (filtered && evs.length > 0) {
      let lo = Infinity, hi = -Infinity;
      for (const e of evs) {
        lo = Math.min(lo, e.value);
        hi = Math.max(hi, e.end ?? e.value);
      }
      range = [lo, hi];
    }
    return { visibleEvents: evs, visibleLanes: lanes, focusRange: range };
  }, [set, hiddenLanes, hiddenCategories]);

  if (!auth) return <div className="p-8 text-sm text-[var(--text-muted)]">Bitte einloggen.</div>;
  if (isLoading) return <div className="p-8 text-sm text-[var(--text-muted)]">Lade…</div>;
  if (isError || !set) return <div className="p-8 text-sm text-red-400">Zeitstrahl nicht gefunden.</div>;

  function toggleLane(laneId: string) {
    setHiddenLanes(prev => {
      const next = new Set(prev);
      next.has(laneId) ? next.delete(laneId) : next.add(laneId);
      return next;
    });
  }

  function toggleCategory(cat: string) {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5 p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          {isTeacher && (
            <Link href="/tools/zeitstrahl" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]">
              ← Bibliothek
            </Link>
          )}
          <h1 className="text-2xl font-black tracking-tight">📏 {set.title}</h1>
          {set.description && <p className="text-[var(--text-muted)] text-sm mt-1 max-w-2xl">{set.description}</p>}
        </div>
        <div className="flex gap-1 rounded-xl border border-[var(--border)] p-1">
          {(["ansehen", "ueben", ...(isTeacher ? ["bearbeiten"] as Tab[] : [])] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                tab === t ? "bg-[var(--accent)] text-white font-semibold" : "hover:bg-[var(--surface-hover)]"
              }`}>
              {t === "ansehen" ? "🔍 Ansehen" : t === "ueben" ? "🎯 Üben" : "✏️ Bearbeiten"}
            </button>
          ))}
        </div>
      </div>

      {/* lane toggles — the "parallel timelines" selector */}
      {set.lanes.length > 1 && tab !== "bearbeiten" && (
        <div className="flex flex-wrap gap-2">
          {set.lanes.map(l => {
            const hidden = hiddenLanes.has(l.id);
            return (
              <button key={l.id} onClick={() => toggleLane(l.id)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  hidden ? "opacity-40 border-[var(--border)]" : "border-transparent font-semibold"
                }`}
                style={hidden ? {} : { backgroundColor: `${l.color ?? "#64748b"}33`, color: l.color ?? undefined, borderColor: l.color ?? undefined }}>
                {hidden ? "○" : "●"} {l.label}
              </button>
            );
          })}
        </div>
      )}

      {/* category filter — deselect to hide, the view reframes to what's left.
          "Keine" then one chip is the quick way to isolate a single category. */}
      {categories.length > 1 && tab !== "bearbeiten" && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-[var(--text-muted)] mr-1">Filter:</span>
          <button onClick={() => setHiddenCategories(new Set())}
            className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] hover:border-[var(--accent)] transition-all">
            Alle
          </button>
          <button onClick={() => setHiddenCategories(new Set(categories.map(([c]) => c)))}
            className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] hover:border-[var(--accent)] transition-all">
            Keine
          </button>
          <span className="w-px h-4 bg-[var(--border)] mx-1" />
          {categories.map(([cat, n]) => {
            const off = hiddenCategories.has(cat);
            return (
              <button key={cat} onClick={() => toggleCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  off
                    ? "opacity-40 border-[var(--border)] line-through"
                    : "bg-[var(--accent)] text-white border-transparent font-semibold"
                }`}>
                {cat} <span className="opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {tab === "ansehen" && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <TimelineCanvas
            axis={set.axis} lanes={visibleLanes} events={visibleEvents}
            onSelect={setSelected} selectedId={selected?.id}
            viewRange={focusRange}
          />
          {selected && (
            <div className="mt-3 rounded-xl border border-[var(--border)] p-3 text-sm flex flex-col gap-1">
              <div>
                <span className="font-semibold">{selected.label}</span>
                <span className="text-[var(--text-muted)]"> — {eventDateLabel(selected, set.axis)}</span>
              </div>
              {selected.info && (
                <p className="text-[var(--text-muted)] whitespace-pre-line break-words">{selected.info}</p>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "ueben" && <PracticeTab set={set} visibleEvents={visibleEvents} isTeacher={isTeacher} />}
      {tab === "bearbeiten" && isTeacher && <EditTab set={set} onSaved={() => qc.invalidateQueries({ queryKey: ["timeline", setId] })} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Üben: local sort/spot rounds built from the visible events
// ─────────────────────────────────────────────────────────────────────────────

function PracticeTab({ set, visibleEvents, isTeacher }: {
  set: TimelineSetDetail; visibleEvents: TimelineEvent[]; isTeacher: boolean;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"sort" | "spot">("sort");
  const [tolerance, setTolerance] = useState(5);
  const [count, setCount] = useState(5);
  const [spec, setSpec] = useState<TimelineGameSpec | null>(null);
  const [answer, setAnswer] = useState<TimelineAnswer>({});
  const [result, setResult] = useState<{ ratio: number; results: Record<string, boolean> } | null>(null);

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
    setResult(scoreLocally(spec, answer));
  }

  async function copySpec(target: "caputh" | "exitgame") {
    const s = buildSpec();
    if (!s) return;
    const snippet = target === "caputh"
      ? { type: "timeline", question: `Ordne die Ereignisse auf dem ${set.axis.kind === "year" ? "Zeitstrahl" : "Zahlenstrahl"} zu.`, timeline: s }
      : { id: "zeitstrahl-1", type: "task", title: "Zeitstrahl", text: "Ordne die Einträge richtig zu.", task: { kind: "timeline", timeline: s } };
    await navigator.clipboard.writeText(JSON.stringify(snippet, null, 2));
    toast(target === "caputh" ? "Caputh-Frage kopiert — in dein Quiz-JSON einfügen" : "Exitgame-Slide kopiert — in dein Exitgame-JSON einfügen", "success");
  }

  const board = spec ? specToBoard(spec) : null;
  const solution: TimelineSolution | null = spec && result ? specToSolution(spec) : null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Modus
          <select value={mode} onChange={e => setMode(e.target.value as "sort" | "spot")} className="input text-sm py-1.5">
            <option value="sort">Einsortieren (ziehen)</option>
            <option value="spot">Fehler finden</option>
          </select>
        </label>
        {mode === "sort" && set.axis.kind === "year" && (
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Toleranz
            <select value={tolerance} onChange={e => setTolerance(Number(e.target.value))} className="input text-sm py-1.5">
              {TOLERANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
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
            <button onClick={() => copySpec("caputh")} className="text-xs border border-[var(--border)] rounded-lg px-2.5 py-1.5 hover:border-[var(--accent)]">
              🏕️ Als Caputh-Frage kopieren
            </button>
            <button onClick={() => copySpec("exitgame")} className="text-xs border border-[var(--border)] rounded-lg px-2.5 py-1.5 hover:border-[var(--accent)]">
              🗝️ Als Exitgame-Slide kopieren
            </button>
          </span>
        )}
      </div>
      {pool.length < 2 && (
        <p className="text-xs text-[var(--text-muted)]">Zu wenige sichtbare Einträge — blende mehr Spuren ein.</p>
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
              className="btn-primary text-sm py-1.5 px-5 self-start disabled:opacity-40">
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

// ─────────────────────────────────────────────────────────────────────────────
// Bearbeiten: meta / axis / lanes / events + save
// ─────────────────────────────────────────────────────────────────────────────

type Draft = {
  title: string; description: string; tags: string; grades: string;
  axis: TimelineAxis; lanes: TimelineLane[]; events: TimelineEvent[];
};

type EventDiff = {
  added: TimelineEvent[];
  removed: TimelineEvent[];
  changed: { before: TimelineEvent; after: TimelineEvent; fields: string[] }[];
  unchanged: number;
};

const DIFF_FIELDS = [
  "label", "value", "end", "lane", "category", "info", "exact_date", "exact_date_end", "color",
] as const;

/** Compare an uploaded export against the current draft, keyed on event id
 * (that's what the export round-trips). */
function diffEvents(current: TimelineEvent[], incoming: TimelineEvent[]): EventDiff {
  const cur = new Map(current.map(e => [e.id, e]));
  const inc = new Map(incoming.map(e => [e.id, e]));
  const diff: EventDiff = { added: [], removed: [], changed: [], unchanged: 0 };
  for (const e of incoming) {
    const before = cur.get(e.id);
    if (!before) { diff.added.push(e); continue; }
    const fields = DIFF_FIELDS.filter(f => {
      const a = before[f] ?? null;
      const b = e[f] ?? null;
      return a !== b;
    });
    if (fields.length) diff.changed.push({ before, after: e, fields: [...fields] });
    else diff.unchanged++;
  }
  for (const e of current) if (!inc.has(e.id)) diff.removed.push(e);
  return diff;
}

/** Cheap shape check before we show a diff — the server validates properly on
 * save, this just catches "wrong file entirely". */
function validateIncoming(d: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (!d || typeof d !== "object") return ["Datei enthält kein JSON-Objekt."];
  const axis = d.axis as { min?: unknown; max?: unknown } | undefined;
  if (!axis || typeof axis.min !== "number" || typeof axis.max !== "number") {
    problems.push("Feld 'axis' mit 'min'/'max' fehlt — ist das ein Zeitstrahl-Export?");
  }
  if (!Array.isArray(d.events)) {
    problems.push("Feld 'events' fehlt oder ist keine Liste.");
  } else {
    const ids = (d.events as TimelineEvent[]).map(e => e?.id);
    if (ids.some(i => !i)) problems.push("Mindestens ein Ereignis hat keine 'id'.");
    const dups = ids.filter((i, n) => i && ids.indexOf(i) !== n);
    if (dups.length) problems.push(`Doppelte ids: ${[...new Set(dups)].slice(0, 5).join(", ")}`);
  }
  return problems;
}

function DiffPanel({ diff, onApply, onCancel }: {
  diff: EventDiff; onApply: () => void; onCancel: () => void;
}) {
  const nothing = !diff.added.length && !diff.removed.length && !diff.changed.length;
  return (
    <div className="rounded-xl border border-[var(--accent)] bg-[var(--surface-hover)] p-3 flex flex-col gap-2 text-sm">
      <div className="font-semibold">Änderungen aus der hochgeladenen Datei</div>
      {nothing ? (
        <p className="text-[var(--text-muted)] text-xs">
          Keine Unterschiede zu den aktuellen Einträgen ({diff.unchanged} unverändert).
        </p>
      ) : (
        <>
          <div className="flex gap-3 text-xs flex-wrap">
            <span className="text-green-500">+{diff.added.length} neu</span>
            <span className="text-red-400">−{diff.removed.length} entfernt</span>
            <span className="text-yellow-500">~{diff.changed.length} geändert</span>
            <span className="text-[var(--text-muted)]">{diff.unchanged} unverändert</span>
          </div>
          <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5 text-xs">
            {diff.added.map(e => (
              <div key={`a-${e.id}`} className="text-green-500">+ {e.label}</div>
            ))}
            {diff.removed.map(e => (
              <div key={`r-${e.id}`} className="text-red-400">− {e.label}</div>
            ))}
            {diff.changed.map(c => (
              <div key={`c-${c.after.id}`} className="text-yellow-500">
                ~ {c.after.label}{" "}
                <span className="text-[var(--text-muted)]">({c.fields.join(", ")})</span>
              </div>
            ))}
          </div>
          {diff.removed.length > 0 && (
            <p className="text-xs text-red-400">
              Achtung: {diff.removed.length} Eintrag/Einträge fehlen in der Datei und werden entfernt.
            </p>
          )}
        </>
      )}
      <div className="flex gap-2 mt-1">
        <button onClick={onApply} disabled={nothing}
          className="btn-primary text-xs py-1 px-3 disabled:opacity-40">
          Übernehmen
        </button>
        <button onClick={onCancel}
          className="text-xs border border-[var(--border)] rounded-lg px-3 py-1 hover:border-[var(--accent)]">
          Verwerfen
        </button>
      </div>
    </div>
  );
}

function toDraft(set: TimelineSetDetail): Draft {
  return {
    title: set.title, description: set.description ?? "",
    tags: set.tags.join(", "), grades: set.grades.join(", "),
    axis: { ...set.axis }, lanes: set.lanes.map(l => ({ ...l })),
    events: set.events.map(e => ({ ...e })),
  };
}

function EditTab({ set, onSaved }: { set: TimelineSetDetail; onSaved: () => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(set));
  const uploadRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: Draft & { events: TimelineEvent[] }; diff: EventDiff } | null>(null);
  useEffect(() => { setDraft(toDraft(set)); setPending(null); }, [set]);

  const saveMut = useMutation({
    mutationFn: () => api.timelines.update(set.id, {
      title: draft.title,
      description: draft.description || null,
      tags: draft.tags.split(",").map(t => t.trim()).filter(Boolean),
      grades: draft.grades.split(",").map(g => parseInt(g.trim(), 10)).filter(n => Number.isFinite(n)),
      axis: draft.axis,
      lanes: draft.lanes,
      events: draft.events,
    }),
    onSuccess: () => { toast("Gespeichert", "success"); onSaved(); },
    onError: (e: Error) => {
      let msg = e.message;
      try {
        const parsed = JSON.parse(msg);
        msg = parsed.detail?.errors?.join("\n") ?? parsed.detail?.message ?? msg;
      } catch { /* raw message */ }
      toast(msg, "error");
    },
  });

  function patchEvent(idx: number, patch: Partial<TimelineEvent>) {
    setDraft(d => ({ ...d, events: d.events.map((e, i) => i === idx ? { ...e, ...patch } : e) }));
  }

  function addEvent() {
    const id = `ev-${Date.now().toString(36)}`;
    setDraft(d => ({
      ...d,
      events: [{ id, label: "Neues Ereignis", value: d.axis.min, end: null, lane: d.lanes[0]?.id ?? null, info: null }, ...d.events],
    }));
  }

  function addLane() {
    const id = `spur-${draft.lanes.length + 1}`;
    setDraft(d => ({ ...d, lanes: [...d.lanes, { id, label: `Spur ${d.lanes.length + 1}`, color: "#60a5fa" }] }));
  }

  function removeLane(laneId: string) {
    setDraft(d => ({
      ...d,
      lanes: d.lanes.filter(l => l.id !== laneId),
      events: d.events.map(e => e.lane === laneId ? { ...e, lane: null } : e),
    }));
  }

  function exportJson() {
    const body = {
      title: draft.title, description: draft.description || null,
      tags: draft.tags.split(",").map(t => t.trim()).filter(Boolean),
      grades: draft.grades.split(",").map(g => parseInt(g.trim(), 10)).filter(n => Number.isFinite(n)),
      axis: draft.axis, lanes: draft.lanes, events: draft.events,
    };
    const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.title.toLowerCase().replace(/[^a-zä-ü0-9]+/gi, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Read back an edited export and show what it would change, before
   * touching anything — a re-upload can silently delete events, so the diff
   * is confirmed rather than applied. */
  async function handleReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let incoming: Record<string, unknown>;
    try {
      incoming = JSON.parse(await file.text());
    } catch (err) {
      toast(`Ungültiges JSON: ${err instanceof Error ? err.message : err}`, "error");
      return;
    }
    const problems = validateIncoming(incoming);
    if (problems.length) {
      toast(problems.join("\n"), "error");
      return;
    }
    setPending({ data: incoming as unknown as Draft & { events: TimelineEvent[] }, diff: diffEvents(draft.events, (incoming.events as TimelineEvent[]) ?? []) });
  }

  function applyPending() {
    if (!pending) return;
    const d = pending.data as unknown as {
      title?: string; description?: string | null; tags?: string[]; grades?: number[];
      axis: TimelineAxis; lanes?: TimelineLane[]; events: TimelineEvent[];
    };
    setDraft({
      title: d.title ?? draft.title,
      description: d.description ?? "",
      tags: (d.tags ?? []).join(", "),
      grades: (d.grades ?? []).join(", "),
      axis: d.axis,
      lanes: d.lanes ?? [],
      events: d.events,
    });
    setPending(null);
    toast("Übernommen — zum Speichern noch auf „Speichern“ klicken.", "success");
  }

  const num = (v: string) => v.trim() === "" || v === "-" ? null : Number(v.replace(",", "."));

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-semibold">Bearbeiten</h2>
        <div className="flex gap-2">
          <button onClick={exportJson} className="text-xs border border-[var(--border)] rounded-lg px-2.5 py-1.5 hover:border-[var(--accent)]">
            ⬇ Als JSON exportieren
          </button>
          <button onClick={() => uploadRef.current?.click()}
            className="text-xs border border-[var(--border)] rounded-lg px-2.5 py-1.5 hover:border-[var(--accent)]">
            ⬆ JSON hochladen
          </button>
          <input ref={uploadRef} type="file" accept=".json,application/json" className="hidden"
            onChange={handleReupload} />
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="btn-primary text-sm py-1.5 px-5 disabled:opacity-40">
            {saveMut.isPending ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </div>

      {pending && (
        <DiffPanel diff={pending.diff} onApply={applyPending} onCancel={() => setPending(null)} />
      )}

      {/* meta + axis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Titel
          <input className="input text-sm" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Beschreibung
          <input className="input text-sm" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Tags (Komma-getrennt)
          <input className="input text-sm" value={draft.tags} onChange={e => setDraft(d => ({ ...d, tags: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Klassenstufen (z.B. 5, 6, 7)
          <input className="input text-sm" value={draft.grades} onChange={e => setDraft(d => ({ ...d, grades: e.target.value }))} />
        </label>
      </div>

      <div className="flex flex-wrap gap-3 items-end text-sm">
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Achse
          <select className="input text-sm py-1.5" value={draft.axis.kind}
            onChange={e => setDraft(d => ({ ...d, axis: { ...d.axis, kind: e.target.value as "year" | "number" } }))}>
            <option value="year">Jahre (Zeitleiste)</option>
            <option value="number">Zahlen (Zahlenstrahl)</option>
          </select>
        </label>
        {(["min", "max", "step"] as const).map(k => (
          <label key={k} className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            {k === "min" ? "Von" : k === "max" ? "Bis" : "Schritt (optional)"}
            <input className="input text-sm w-28" defaultValue={draft.axis[k] ?? ""}
              key={`${set.id}-${k}`}
              onBlur={e => setDraft(d => ({ ...d, axis: { ...d.axis, [k]: num(e.target.value) ?? (k === "step" ? undefined : d.axis[k]) } }))} />
          </label>
        ))}
        {draft.axis.kind === "number" && (
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Einheit
            <input className="input text-sm w-20" value={draft.axis.unit ?? ""}
              onChange={e => setDraft(d => ({ ...d, axis: { ...d.axis, unit: e.target.value || null } }))} />
          </label>
        )}
      </div>

      {/* lanes */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Spuren</h3>
          <button onClick={addLane} className="text-xs text-[var(--accent)] hover:underline">+ Spur</button>
        </div>
        <div className="flex flex-col gap-1.5">
          {draft.lanes.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2 text-sm">
              <input type="color" value={l.color ?? "#60a5fa"}
                onChange={e => setDraft(d => ({ ...d, lanes: d.lanes.map((x, j) => j === i ? { ...x, color: e.target.value } : x) }))}
                className="w-7 h-7 rounded cursor-pointer border border-[var(--border)] bg-transparent" />
              <input className="input text-sm flex-1" value={l.label}
                onChange={e => setDraft(d => ({ ...d, lanes: d.lanes.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))} />
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{l.id}</span>
              <button onClick={() => removeLane(l.id)} className="text-xs text-red-400 hover:underline">Entfernen</button>
            </div>
          ))}
          {draft.lanes.length === 0 && <p className="text-xs text-[var(--text-muted)]">Keine Spuren — alle Einträge liegen auf einer Linie.</p>}
        </div>
      </div>

      {/* events */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Einträge ({draft.events.length})</h3>
          <button onClick={addEvent} className="text-xs text-[var(--accent)] hover:underline">+ Eintrag</button>
        </div>
        <datalist id="tl-categories">
          {[...new Set(draft.events.map(e => e.category).filter(Boolean))].map(c => (
            <option key={c as string} value={c as string} />
          ))}
        </datalist>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[var(--text-muted)]">
                <th className="p-1.5 font-medium">Bezeichnung</th>
                <th className="p-1.5 font-medium w-28">Wert</th>
                <th className="p-1.5 font-medium w-28">Ende (Spanne)</th>
                <th className="p-1.5 font-medium w-36">Spur</th>
                <th className="p-1.5 font-medium w-32">Kategorie (Filter)</th>
                <th className="p-1.5 font-medium w-36">Exaktes Datum</th>
                <th className="p-1.5 font-medium w-36">Exaktes Enddatum</th>
                <th className="p-1.5 font-medium">Info</th>
                <th className="p-1.5" />
              </tr>
            </thead>
            <tbody>
              {draft.events.map((ev, i) => (
                <tr key={ev.id} className="border-t border-[var(--border)]">
                  <td className="p-1">
                    <input className="input text-xs w-full" value={ev.label} onChange={e => patchEvent(i, { label: e.target.value })} />
                  </td>
                  <td className="p-1">
                    <input className="input text-xs w-full" defaultValue={ev.value}
                      onBlur={e => { const v = num(e.target.value); if (v != null) patchEvent(i, { value: v }); }} />
                  </td>
                  <td className="p-1">
                    <input className="input text-xs w-full" defaultValue={ev.end ?? ""}
                      onBlur={e => patchEvent(i, { end: num(e.target.value) })} />
                  </td>
                  <td className="p-1">
                    <select className="input text-xs w-full py-1" value={ev.lane ?? ""}
                      onChange={e => patchEvent(i, { lane: e.target.value || null })}>
                      <option value="">—</option>
                      {draft.lanes.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                  </td>
                  <td className="p-1">
                    <input className="input text-xs w-full" value={ev.category ?? ""} list="tl-categories"
                      onChange={e => patchEvent(i, { category: e.target.value || null })} />
                  </td>
                  <td className="p-1">
                    <input className="input text-xs w-full" value={ev.exact_date ?? ""} placeholder="1942-01-20"
                      onChange={e => patchEvent(i, { exact_date: e.target.value || null })} />
                  </td>
                  <td className="p-1">
                    <input className="input text-xs w-full" value={ev.exact_date_end ?? ""} placeholder="nur bei Zeitspannen"
                      onChange={e => patchEvent(i, { exact_date_end: e.target.value || null })} />
                  </td>
                  <td className="p-1">
                    <input className="input text-xs w-full" value={ev.info ?? ""} onChange={e => patchEvent(i, { info: e.target.value || null })} />
                  </td>
                  <td className="p-1 text-right">
                    <button onClick={() => setDraft(d => ({ ...d, events: d.events.filter((_, j) => j !== i) }))}
                      className="text-red-400 hover:underline">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[var(--text-muted)]">
          Werte: Jahreszahlen als Zahl ({formatValue(-753, { kind: "year", min: -800, max: 0 })} = -753), Dezimalzahlen mit Komma oder Punkt.
          Exaktes Datum: im Format JJJJ-MM-TT (z.B. 1942-01-20) wird das Ereignis auf den genauen Tag positioniert und man kann bis auf
          den Tag heranzoomen; jeder andere Text (z.B. „21. April 753 v. Chr. (Überlieferung)") wird nur als Zusatzinfo angezeigt,
          ohne die Position zu verändern — nützlich für v.-Chr.-Daten oder unsichere/überlieferte Angaben.
        </p>
      </div>
    </section>
  );
}
