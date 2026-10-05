"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// ── Widget registry ────────────────────────────────────────────────────────

type WidgetId = "clock" | "timer" | "stopwatch" | "workmode" | "notes";

type WidgetMeta = { id: WidgetId; label: string; defaultPos: { x: number; y: number } };

const WIDGETS: WidgetMeta[] = [
  { id: "clock",     label: "Uhr",         defaultPos: { x: 40,  y: 40  } },
  { id: "timer",     label: "Timer",       defaultPos: { x: 300, y: 40  } },
  { id: "stopwatch", label: "Stoppuhr",    defaultPos: { x: 600, y: 40  } },
  { id: "workmode",  label: "Arbeitsform", defaultPos: { x: 40,  y: 320 } },
  { id: "notes",     label: "Notizen",     defaultPos: { x: 300, y: 320 } },
];

// ── Persistence ────────────────────────────────────────────────────────────

type SavedWidget = { enabled: boolean; x: number; y: number };
type SavedState  = Record<WidgetId, SavedWidget>;

const STORAGE_KEY = "classroom_widgets_v1";

function defaultState(): SavedState {
  return Object.fromEntries(
    WIDGETS.map(w => [w.id, { enabled: true, x: w.defaultPos.x, y: w.defaultPos.y }])
  ) as SavedState;
}

function loadState(): SavedState {
  const defaults = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Merge over defaults so widgets added after a user's last visit
    // (e.g. workmode/notes) get sane positions instead of being undefined.
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
}

function saveState(s: SavedState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// ── Drag hook ──────────────────────────────────────────────────────────────

function useDraggable(
  id: WidgetId,
  pos: { x: number; y: number },
  onMove: (id: WidgetId, x: number, y: number) => void,
) {
  const dragging = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y };

    function move(ev: MouseEvent) {
      if (!dragging.current) return;
      const nx = Math.max(0, dragging.current.ox + ev.clientX - dragging.current.startX);
      const ny = Math.max(0, dragging.current.oy + ev.clientY - dragging.current.startY);
      onMove(id, nx, ny);
    }
    function up() {
      dragging.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [id, pos.x, pos.y, onMove]);

  return { onMouseDown };
}

// ── Widget shell ───────────────────────────────────────────────────────────

function WidgetShell({
  id, label, pos, onMove, children,
}: {
  id: WidgetId; label: string; pos: { x: number; y: number };
  onMove: (id: WidgetId, x: number, y: number) => void;
  children: React.ReactNode;
}) {
  const { onMouseDown } = useDraggable(id, pos, onMove);

  return (
    <div
      className="absolute rounded-2xl border border-(--border) bg-(--surface) shadow-xl select-none"
      style={{ left: pos.x, top: pos.y, minWidth: 220 }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center gap-2 px-4 py-2 border-b border-(--border) cursor-grab active:cursor-grabbing rounded-t-2xl"
        style={{ background: "var(--surface-hover)" }}
      >
        <span className="text-(--text-muted) text-xs select-none">⠿</span>
        <span className="text-xs font-semibold text-(--text-muted) uppercase tracking-wider">{label}</span>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

// ── Clock widget ───────────────────────────────────────────────────────────

function ClockWidget() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="text-center">
      <div className="text-5xl font-black tabular-nums tracking-tight text-(--text)">
        {time.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div className="text-xs text-(--text-muted) mt-1">
        {time.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
      </div>
    </div>
  );
}

// ── Timer widget ───────────────────────────────────────────────────────────

function TimerWidget() {
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null); // ms
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalMs = remaining ?? (minutes * 60 + seconds) * 1000;
  const totalSet = (minutes * 60 + seconds) * 1000;
  const pct = totalSet > 0 ? Math.max(0, (totalMs / totalSet) * 100) : 0;

  const display = remaining != null ? remaining : totalMs;
  const mm = Math.floor(display / 60000).toString().padStart(2, "0");
  const ss = Math.floor((display % 60000) / 1000).toString().padStart(2, "0");

  function start() {
    const ms = remaining ?? (minutes * 60 + seconds) * 1000;
    if (ms <= 0) return;
    setRemaining(ms);
    setRunning(true);
    setFinished(false);
    const end = Date.now() + ms;
    intervalRef.current = setInterval(() => {
      const left = end - Date.now();
      if (left <= 0) {
        setRemaining(0);
        setRunning(false);
        setFinished(true);
        clearInterval(intervalRef.current!);
      } else {
        setRemaining(left);
      }
    }, 100);
  }

  function pause() {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setRemaining(null);
    setFinished(false);
  }

  useEffect(() => {
    if (!finished) return;
    try {
      const ctx = new AudioContext();
      const beeps = [0, 0.35, 0.7];
      beeps.forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.5, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.3);
      });
    } catch {}
  }, [finished]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // Ring dimensions
  const r = 52, cx = 64, cy = 64;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * (pct / 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="128" height="128" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="8"/>
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={finished ? "#f87171" : "var(--accent)"}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.1s linear" }}
        />
        <text
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="middle"
          fill="var(--text)"
          style={{ transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px`, fontSize: 24, fontWeight: 700, fontFamily: "monospace" }}
        >
          {mm}:{ss}
        </text>
      </svg>

      {!running && remaining == null && (
        <div className="flex gap-2 items-center">
          <input type="number" min={0} max={99}
            className="input w-14 text-center text-sm py-1"
            value={minutes} onChange={e => setMinutes(Math.max(0, parseInt(e.target.value) || 0))} />
          <span className="text-(--text-muted)">:</span>
          <input type="number" min={0} max={59}
            className="input w-14 text-center text-sm py-1"
            value={seconds} onChange={e => setSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))} />
        </div>
      )}

      {finished && (
        <div className="text-red-400 text-sm font-bold animate-pulse">Zeit abgelaufen!</div>
      )}

      <div className="flex gap-2">
        {!running ? (
          <button onClick={start} disabled={totalMs <= 0} className="btn-primary text-sm py-1 px-4">
            {remaining != null && !finished ? "Weiter" : "Start"}
          </button>
        ) : (
          <button onClick={pause} className="btn-secondary text-sm py-1 px-4">Pause</button>
        )}
        {(running || remaining != null) && (
          <button onClick={reset} className="text-sm border border-(--border) rounded-xl px-3 py-1 hover:bg-(--surface-hover)">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ── Stopwatch widget ───────────────────────────────────────────────────────

function StopwatchWidget() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const startRef = useRef<number>(0);
  const baseRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function fmt(ms: number) {
    const m = Math.floor(ms / 60000).toString().padStart(2, "0");
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
    const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, "0");
    return `${m}:${s}.${cs}`;
  }

  function start() {
    startRef.current = Date.now();
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(baseRef.current + (Date.now() - startRef.current));
    }, 50);
  }

  function pause() {
    setRunning(false);
    baseRef.current += Date.now() - startRef.current;
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  function reset() {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    baseRef.current = 0;
    setElapsed(0);
    setLaps([]);
  }

  function lap() {
    setLaps(prev => [elapsed, ...prev]);
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <div className="flex flex-col items-center gap-3 min-w-[200px]">
      <div className="text-4xl font-black tabular-nums tracking-tight">{fmt(elapsed)}</div>
      <div className="flex gap-2">
        {!running ? (
          <button onClick={start} className="btn-primary text-sm py-1 px-4">Start</button>
        ) : (
          <>
            <button onClick={pause} className="btn-secondary text-sm py-1 px-3">Pause</button>
            <button onClick={lap} className="text-sm border border-(--border) rounded-xl px-3 py-1 hover:bg-(--surface-hover)">Runde</button>
          </>
        )}
        {(elapsed > 0 && !running) && (
          <button onClick={reset} className="text-sm border border-(--border) rounded-xl px-3 py-1 hover:bg-(--surface-hover)">Reset</button>
        )}
      </div>
      {laps.length > 0 && (
        <div className="w-full max-h-32 overflow-y-auto flex flex-col gap-0.5 mt-1">
          {laps.map((l, i) => (
            <div key={i} className="flex justify-between text-xs text-(--text-muted) px-1">
              <span>Runde {laps.length - i}</span>
              <span className="font-mono">{fmt(l)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Workmode widget ────────────────────────────────────────────────────────

type WorkMode = "einzel" | "partner" | "gruppe" | "plenum";
const WORK_MODES: { id: WorkMode; label: string; icon: string }[] = [
  { id: "einzel",  label: "Einzelarbeit",  icon: "🧍" },
  { id: "partner", label: "Partnerarbeit", icon: "🧑‍🤝‍🧑" },
  { id: "gruppe",  label: "Gruppenarbeit", icon: "👨‍👩‍👧‍👦" },
  { id: "plenum",  label: "Plenum",        icon: "🏛️" },
];
const WORKMODE_KEY = "classroom_workmode_v1";

function WorkModeWidget() {
  const [mode, setMode] = useState<WorkMode | null>(() => {
    try { return (localStorage.getItem(WORKMODE_KEY) as WorkMode) || null; } catch { return null; }
  });

  function select(m: WorkMode) {
    setMode(m);
    try { localStorage.setItem(WORKMODE_KEY, m); } catch {}
  }

  const active = WORK_MODES.find(m => m.id === mode);

  return (
    <div className="flex flex-col items-center gap-3 min-w-[220px]">
      {active && (
        <div className="text-center">
          <div className="text-5xl">{active.icon}</div>
          <div className="text-sm font-semibold mt-1">{active.label}</div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {WORK_MODES.map(m => (
          <button key={m.id} onClick={() => select(m.id)} title={m.label}
            className={`w-11 h-11 rounded-xl border flex items-center justify-center text-xl transition-colors ${
              mode === m.id ? "border-(--accent) bg-(--accent)/10" : "border-(--border) hover:border-(--text-muted)"
            }`}>
            {m.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Notes widget (tiptap) ──────────────────────────────────────────────────

const NOTES_KEY = "classroom_notes_v1";

function NotesWidget() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: (() => { try { return localStorage.getItem(NOTES_KEY) || ""; } catch { return ""; } })(),
    onUpdate: ({ editor }) => {
      try { localStorage.setItem(NOTES_KEY, editor.getHTML()); } catch {}
    },
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-2 min-w-[260px]">
      <div className="flex gap-1">
        <button onClick={() => editor.chain().focus().toggleBold().run()}
          className={`w-7 h-7 rounded-sm border text-xs font-bold flex items-center justify-center ${editor.isActive("bold") ? "border-(--accent) text-(--accent)" : "border-(--border) text-(--text-muted)"}`}>B</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`w-7 h-7 rounded-sm border text-xs italic flex items-center justify-center ${editor.isActive("italic") ? "border-(--accent) text-(--accent)" : "border-(--border) text-(--text-muted)"}`}>I</button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`w-7 h-7 rounded-sm border text-xs flex items-center justify-center ${editor.isActive("bulletList") ? "border-(--accent) text-(--accent)" : "border-(--border) text-(--text-muted)"}`}>•</button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`w-7 h-7 rounded-sm border text-xs flex items-center justify-center ${editor.isActive("orderedList") ? "border-(--accent) text-(--accent)" : "border-(--border) text-(--text-muted)"}`}>1.</button>
      </div>
      <div className="prose-sm max-w-none text-sm min-h-[100px] max-h-[240px] overflow-y-auto rounded-lg border border-(--border) p-2 bg-(--bg)">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ClassroomPage() {
  const router = useRouter();
  const [widgets, setWidgets] = useState<SavedState>(() => loadState());
  const [showPanel, setShowPanel] = useState(false);

  const move = useCallback((id: WidgetId, x: number, y: number) => {
    setWidgets(prev => {
      const next = { ...prev, [id]: { ...prev[id], x, y } };
      saveState(next);
      return next;
    });
  }, []);

  function toggle(id: WidgetId) {
    setWidgets(prev => {
      const next = { ...prev, [id]: { ...prev[id], enabled: !prev[id].enabled } };
      saveState(next);
      return next;
    });
  }

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-(--bg)">

      {/* Back button */}
      <button
        onClick={() => router.push("/tools")}
        className="absolute top-4 left-4 z-50 text-sm text-(--text-muted) hover:text-(--text) transition-colors"
      >
        ← Tools
      </button>

      {/* Toggle panel button */}
      <button
        onClick={() => setShowPanel(v => !v)}
        className="absolute top-4 right-4 z-50 rounded-lg border border-(--border) text-(--text) text-xs py-1.5 px-3 hover:bg-(--surface-hover) transition-colors"
      >
        ⚙ Widgets
      </button>

      {/* Widget selector panel */}
      {showPanel && (
        <div className="absolute top-12 right-4 z-50 rounded-2xl border border-(--border) bg-(--surface) shadow-xl p-4 flex flex-col gap-2 min-w-[180px]">
          <div className="text-xs font-semibold text-(--text-muted) uppercase tracking-wider mb-1">Widgets</div>
          {WIDGETS.map(w => (
            <label key={w.id} className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => toggle(w.id)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${widgets[w.id].enabled ? "bg-(--accent)" : "bg-(--border)"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${widgets[w.id].enabled ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm">{w.label}</span>
            </label>
          ))}
          <div className="border-t border-(--border) mt-1 pt-2">
            <button
              onClick={() => {
                const reset = defaultState();
                setWidgets(reset);
                saveState(reset);
              }}
              className="text-xs text-(--text-muted) hover:text-(--text)"
            >
              Positionen zurücksetzen
            </button>
          </div>
        </div>
      )}

      {/* Widgets */}
      {widgets.clock.enabled && (
        <WidgetShell id="clock" label="Uhr" pos={widgets.clock} onMove={move}>
          <ClockWidget />
        </WidgetShell>
      )}
      {widgets.timer.enabled && (
        <WidgetShell id="timer" label="Timer" pos={widgets.timer} onMove={move}>
          <TimerWidget />
        </WidgetShell>
      )}
      {widgets.stopwatch.enabled && (
        <WidgetShell id="stopwatch" label="Stoppuhr" pos={widgets.stopwatch} onMove={move}>
          <StopwatchWidget />
        </WidgetShell>
      )}
      {widgets.workmode.enabled && (
        <WidgetShell id="workmode" label="Arbeitsform" pos={widgets.workmode} onMove={move}>
          <WorkModeWidget />
        </WidgetShell>
      )}
      {widgets.notes.enabled && (
        <WidgetShell id="notes" label="Notizen" pos={widgets.notes} onMove={move}>
          <NotesWidget />
        </WidgetShell>
      )}

      {/* Empty state */}
      {WIDGETS.every(w => !widgets[w.id].enabled) && (
        <div className="absolute inset-0 flex items-center justify-center text-(--text-muted) text-sm">
          Keine Widgets aktiv — über ⚙ Widgets aktivieren.
        </div>
      )}
    </div>
  );
}
