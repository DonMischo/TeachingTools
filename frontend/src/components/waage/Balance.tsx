"use client";
/**
 * Der Waagen-Rahmen: Ständer, Balken, Schalen, Neigung — geteilt von allen
 * drei Modi der Gleichungswaage. Was in den Schalen liegt (Klötzchen,
 * Flächen, Atome), zeichnet der jeweilige Modus selbst und übergibt es hier.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// ── Maße (SVG-Einheiten) ──────────────────────────────────────────────────────
export const VBW = 1000;
export const VBH = 545;
export const PIVOT = { x: 500, y: 130 };
export const ARM = 320; // halbe Balkenlänge
export const HANG = 240; // Schnurlänge bis zur Schale
export const PAN_W = 330;
export const PAN_INNER = 300; // nutzbare Breite für den Inhalt
export const STACK_MAX_H = 140;
export const PAN_Y = PIVOT.y + HANG;
export const GAP = 7;
export const MAX_TILT = 7;
export const EASE = "cubic-bezier(.2,.9,.25,1)";

export type Box = { w: number; h: number; px: number; py: number };
export type Placed = Box & { tx: number; ty: number };

/** Legt Kästchen zeilenweise, erste Zeile unten, jede Zeile zentriert. */
export function flowLayout<T extends Box>(items: T[], maxW: number): { w: number; h: number } {
  const rows: T[][] = [];
  let row: T[] = [];
  let rowW = 0;
  for (const it of items) {
    if (row.length && rowW + GAP + it.w > maxW) {
      rows.push(row);
      row = [];
      rowW = 0;
    }
    rowW += row.length ? GAP + it.w : it.w;
    row.push(it);
  }
  if (row.length) rows.push(row);

  const widths = rows.map(r => r.reduce((s, it, i) => s + it.w + (i ? GAP : 0), 0));
  const w = Math.max(0, ...widths);
  let y = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const rowH = Math.max(...rows[i].map(it => it.h));
    let x = (w - widths[i]) / 2;
    for (const it of rows[i]) {
      it.px = x;
      it.py = y + (rowH - it.h); // in der Zeile unten bündig
      x += it.w + GAP;
    }
    y += rowH + GAP;
  }
  return { w, h: Math.max(0, y - GAP) };
}

const fitOf = (b: { w: number; h: number }) =>
  Math.min(1, b.w ? PAN_INNER / b.w : 1, b.h ? STACK_MAX_H / b.h : 1);

/**
 * Zeilenbreite so wählen, dass der Inhalt möglichst groß bleibt: eine breitere
 * Zeile wird zwar heruntergerechnet, spart aber Höhe. Breiter wird nur
 * genommen, wenn es wirklich etwas bringt.
 */
export function bestLayout<T extends Placed>(items: T[]): { w: number; h: number; scale: number } {
  let bestW = PAN_INNER;
  let best = -1;
  for (const maxW of [PAN_INNER, 380, 470, 580, 700]) {
    const f = fitOf(flowLayout(items, maxW));
    if (f > best + 0.01) {
      best = f;
      bestW = maxW;
    }
  }
  const box = flowLayout(items, bestW);
  for (const it of items) {
    it.tx = it.px - box.w / 2;
    it.ty = it.py - box.h;
  }
  return { ...box, scale: fitOf(box) };
}

/** Hält verschwundene Teile kurz im Baum, damit sie hinausfliegen können. */
export function useExitingItems<T extends { id: string }>(items: T[]): (T & { gone?: boolean })[] {
  const [shown, setShown] = useState<(T & { gone?: boolean })[]>(items);
  const prev = useRef(items);
  useEffect(() => {
    const ids = new Set(items.map(u => u.id));
    const gone = prev.current.filter(u => !ids.has(u.id)).map(u => ({ ...u, gone: true }));
    prev.current = items;
    if (!gone.length) {
      setShown(items);
      return;
    }
    setShown([...items, ...gone]);
    const t = setTimeout(() => setShown(items), 430);
    return () => clearTimeout(t);
  }, [items]);
  return shown;
}

/** Kurzes Nachwippen nach jedem Schritt. */
export function useWobble(): [number, () => void] {
  const [wobble, setWobble] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const kick = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setWobble(3.4);
    timers.current = [setTimeout(() => setWobble(-1.4), 300), setTimeout(() => setWobble(0), 620)];
  }, []);
  return [wobble, kick];
}

/** Neigung aus den beiden Lasten; links schwerer ⇒ links sinkt. */
export function tiltFor(left: number, right: number, wobble = 0): number {
  const norm = Math.max(1, Math.abs(left) + Math.abs(right));
  const balance = Math.max(-MAX_TILT, Math.min(MAX_TILT, ((left - right) / norm) * 22));
  return -balance + wobble;
}

/** Ein Teil in der Schale: gleitet an seinen Platz, fliegt hinein und hinaus. */
export function Piece({ tx, ty, gone, children }: { tx: number; ty: number; gone?: boolean; children: ReactNode }) {
  return (
    <g
      style={{
        transform: `translate(${tx}px, ${ty}px)`,
        transformBox: "view-box",
        transition: `transform 430ms ${EASE}`,
      }}
    >
      <g className={gone ? "gw-out" : "gw-in"}>{children}</g>
    </g>
  );
}

export type PanContent = {
  node: ReactNode;
  scale: number;
  label: string;
  empty?: boolean;
};

function Pan({ cx, tilt, content }: { cx: number; tilt: number; content: PanContent }) {
  return (
    <g
      style={{
        transform: `rotate(${-tilt}deg)`,
        transformBox: "view-box",
        transformOrigin: `${cx}px ${PIVOT.y}px`,
        transition: `transform 620ms ${EASE}`,
      }}
    >
      <line x1={cx} y1={PIVOT.y} x2={cx - PAN_W * 0.4} y2={PAN_Y} stroke="#94a3b8" strokeWidth={2.5} />
      <line x1={cx} y1={PIVOT.y} x2={cx + PAN_W * 0.4} y2={PAN_Y} stroke="#94a3b8" strokeWidth={2.5} />
      <rect x={cx - PAN_W / 2} y={PAN_Y} width={PAN_W} height={13} rx={6.5} fill="url(#gwMetal)" />
      <rect x={cx - PAN_W / 2 + 10} y={PAN_Y + 2} width={PAN_W - 20} height={3} rx={1.5} fill="#ffffff" opacity={0.25} />

      {content.empty && (
        <g opacity={0.45}>
          <rect x={cx - 21} y={PAN_Y - 44} width={42} height={40} rx={9}
            fill="none" stroke="var(--text-muted)" strokeWidth={1.6} strokeDasharray="5 4" />
          <text x={cx} y={PAN_Y - 23} textAnchor="middle" dominantBaseline="central"
            fontSize={19} fontWeight={800} fill="var(--text-muted)">0</text>
        </g>
      )}

      <g
        style={{
          transform: `translate(${cx}px, ${PAN_Y - 2}px) scale(${content.scale})`,
          transformBox: "view-box",
          transition: `transform 430ms ${EASE}`,
        }}
      >
        {content.node}
      </g>

      <text x={cx} y={PAN_Y + 52} textAnchor="middle" fontWeight={800} fill="var(--text)"
        fontSize={Math.min(30, 520 / Math.max(1, content.label.length))}>
        {content.label}
      </text>
    </g>
  );
}

export function Balance({
  tilt, left, right, ariaLabel, defs,
}: {
  tilt: number;
  left: PanContent;
  right: PanContent;
  ariaLabel: string;
  defs?: ReactNode;
}) {
  return (
    <svg viewBox={`0 0 ${VBW} ${VBH}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id="gwMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
        <radialGradient id="gwGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        {defs}
      </defs>

      <ellipse cx={VBW / 2} cy={300} rx={470} ry={250} fill="url(#gwGlow)" />

      {/* Ständer */}
      <rect x={PIVOT.x - 14} y={PIVOT.y} width={28} height={366} rx={9} fill="url(#gwMetal)" />
      <rect x={PIVOT.x - 120} y={496} width={240} height={22} rx={11} fill="url(#gwMetal)" />
      <ellipse cx={PIVOT.x} cy={526} rx={190} ry={8} fill="#000000" opacity={0.14} />

      {/* Balken samt Schalen */}
      <g
        style={{
          transform: `rotate(${tilt}deg)`,
          transformBox: "view-box",
          transformOrigin: `${PIVOT.x}px ${PIVOT.y}px`,
          transition: `transform 620ms ${EASE}`,
        }}
      >
        <rect x={PIVOT.x - ARM} y={PIVOT.y - 8} width={2 * ARM} height={16} rx={8} fill="url(#gwMetal)" />
        <circle cx={PIVOT.x - ARM} cy={PIVOT.y} r={9} fill="#64748b" />
        <circle cx={PIVOT.x + ARM} cy={PIVOT.y} r={9} fill="#64748b" />
        <Pan cx={PIVOT.x - ARM} tilt={tilt} content={left} />
        <Pan cx={PIVOT.x + ARM} tilt={tilt} content={right} />
      </g>

      <circle cx={PIVOT.x} cy={PIVOT.y} r={19} fill="var(--surface)" stroke="#38bdf8" strokeWidth={3} />
      <circle cx={PIVOT.x} cy={PIVOT.y} r={6} fill="#38bdf8" />
    </svg>
  );
}

/** Die Animationen der Waage — einmal je Seite einbinden. */
export function WaageStyles() {
  return (
    <style>{`
      .gw-in { animation: gwIn 400ms cubic-bezier(.2,1.3,.4,1) both; transform-box: fill-box; transform-origin: center; }
      .gw-out { animation: gwOut 420ms ease-in forwards; transform-box: fill-box; transform-origin: center; }
      @keyframes gwIn { from { opacity: 0; transform: translateY(-34px) scale(.4); } to { opacity: 1; transform: none; } }
      @keyframes gwOut { to { opacity: 0; transform: translateY(-52px) scale(.35) rotate(16deg); } }
      @keyframes gwFall { from { opacity: 1; transform: translateY(-10px) rotate(0deg); } to { opacity: 0; transform: translateY(120px) rotate(320deg); } }
      @keyframes gwPop { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: none; } }
      .gw-banner { animation: gwPop 320ms cubic-bezier(.2,1.3,.4,1) both; }
    `}</style>
  );
}

/** Konfetti für den gelösten Zustand. */
export function Konfetti({ seed }: { seed: number }) {
  const bits = Array.from({ length: 18 }, (_, i) => ({
    i,
    left: ((i * 37 + seed * 13) % 100),
    delay: ((i * 17 + seed * 7) % 50) / 100,
    dur: 1.5 + ((i * 11) % 10) / 10,
    emoji: ["🎉", "✨", "⭐", "🎊", "💜"][i % 5],
  }));
  return (
    <div className="pointer-events-none absolute inset-0">
      {bits.map(c => (
        <span key={c.i} className="absolute text-lg"
          style={{ left: `${c.left}%`, top: 0, animation: `gwFall ${c.dur}s ease-in ${c.delay}s both` }}>
          {c.emoji}
        </span>
      ))}
    </div>
  );
}

/** Der mitgeschriebene Rechenweg. */
export function Protokoll({ lines }: { lines: { left: string; right: string; op?: string }[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-xs uppercase tracking-widest text-[var(--text-muted)] mb-2">Rechenweg</div>
      <div className="flex flex-col gap-1 font-mono overflow-x-auto">
        {lines.map((l, i) => {
          const last = i === lines.length - 1;
          return (
            <div key={i}
              className={`grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-baseline ${
                last ? "text-[var(--text)]" : "text-[var(--text-muted)]"
              }`}
              style={{ fontSize: last ? "1.35rem" : "1rem", fontWeight: last ? 800 : 400 }}>
              <span className="text-right whitespace-nowrap">{l.left}</span>
              <span>=</span>
              <span className="whitespace-nowrap">{l.right}</span>
              <span className="text-[var(--accent)] whitespace-nowrap text-sm font-bold">
                {l.op ? `| ${l.op}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
