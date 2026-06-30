"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── Widget registry ────────────────────────────────────────────────────────

type WidgetId = "clock" | "timer" | "stopwatch";

type WidgetMeta = { id: WidgetId; label: string; defaultPos: { x: number; y: number } };

const WIDGETS: WidgetMeta[] = [
  { id: "clock",     label: "Uhr",       defaultPos: { x: 40,  y: 40  } },
  { id: "timer",     label: "Timer",     defaultPos: { x: 300, y: 40  } },
  { id: "stopwatch", label: "Stoppuhr",  defaultPos: { x: 600, y: 40  } },
];

// ── Persistence ────────────────────────────────────────────────────────────

type SavedWidget = { enabled: boolean; x: number; y: number };
type SavedState  = Record<WidgetId, SavedWidget>;

const STORAGE_KEY = "classroom_widgets_v1";

function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return Object.fromEntries(
    WIDGETS.map(w => [w.id, { enabled: true, x: w.defaultPos.x, y: w.defaultPos.y }])
  ) as SavedState;
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
      className="absolute rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl select-none"
      style={{ left: pos.x, top: pos.y, minWidth: 220 }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] cursor-grab active:cursor-grabbing rounded-t-2xl"
        style={{ background: "var(--surface-hover)" }}
      >
        <span className="text-[var(--text-muted)] text-xs select-none">⠿</span>
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
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
      <div className="text-5xl font-black tabular-nums tracking-tight text-[var(--text)]">
        {time.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div className="text-xs text-[var(--text-muted)] mt-1">
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
          <span className="text-[var(--text-muted)]">:</span>
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
          <button onClick={reset} className="text-sm border border-[var(--border)] rounded-xl px-3 py-1 hover:bg-[var(--surface-hover)]">
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
            <button onClick={lap} className="text-sm border border-[var(--border)] rounded-xl px-3 py-1 hover:bg-[var(--surface-hover)]">Runde</button>
          </>
        )}
        {(elapsed > 0 && !running) && (
          <button onClick={reset} className="text-sm border border-[var(--border)] rounded-xl px-3 py-1 hover:bg-[var(--surface-hover)]">Reset</button>
        )}
      </div>
      {laps.length > 0 && (
        <div className="w-full max-h-32 overflow-y-auto flex flex-col gap-0.5 mt-1">
          {laps.map((l, i) => (
            <div key={i} className="flex justify-between text-xs text-[var(--text-muted)] px-1">
              <span>Runde {laps.length - i}</span>
              <span className="font-mono">{fmt(l)}</span>
            </div>
          ))}
        </div>
      )}
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
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-[var(--bg)]">

      {/* Back button */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-4 left-4 z-50 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
      >
        ← Zurück
      </button>

      {/* Toggle panel button */}
      <button
        onClick={() => setShowPanel(v => !v)}
        className="absolute top-4 right-4 z-50 rounded-lg border border-[var(--border)] text-[var(--text)] text-xs py-1.5 px-3 hover:bg-[var(--surface-hover)] transition-colors"
      >
        ⚙ Widgets
      </button>

      {/* Widget selector panel */}
      {showPanel && (
        <div className="absolute top-12 right-4 z-50 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl p-4 flex flex-col gap-2 min-w-[180px]">
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Widgets</div>
          {WIDGETS.map(w => (
            <label key={w.id} className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => toggle(w.id)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${widgets[w.id].enabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${widgets[w.id].enabled ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm">{w.label}</span>
            </label>
          ))}
          <div className="border-t border-[var(--border)] mt-1 pt-2">
            <button
              onClick={() => {
                const reset = Object.fromEntries(
                  WIDGETS.map(w => [w.id, { enabled: true, x: w.defaultPos.x, y: w.defaultPos.y }])
                ) as SavedState;
                setWidgets(reset);
                saveState(reset);
              }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
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

      {/* Empty state */}
      {!widgets.clock.enabled && !widgets.timer.enabled && !widgets.stopwatch.enabled && (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)] text-sm">
          Keine Widgets aktiv — über ⚙ Widgets aktivieren.
        </div>
      )}
    </div>
  );
}
