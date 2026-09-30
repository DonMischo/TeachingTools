"use client";
import { useMemo, useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";

const ROWS = 10;
const COLS = 10;
// All geometry below is in SVG viewBox units — the board is drawn once and
// scaled to fit its container, so it never overflows (no scrollbar).
const BEAD = 30; // slot width (bead diameter 26 + gap)
const BR = 13; // bead radius
const SLACK = BEAD * COLS; // a full row of travel (10× bead) like a real abacus
const TRACK_W = COLS * BEAD + SLACK;
const ROW_H = 42; // vertical space per wire
const LABEL_L = 150; // left value-label column
const LABEL_R = 185; // right contribution column
const GAP = 16;
const TX = LABEL_L + GAP; // track left edge
const VBW = TX + TRACK_W + GAP + LABEL_R; // viewBox width
const VBH = ROWS * ROW_H; // viewBox height

type Mode = "single" | "place";

function fmt(n: number) {
  return n.toLocaleString("de-DE");
}

/**
 * `vorgabe` (TaskCrawler-Station): `{ reiter: "single" | "place" }` legt die Ansicht fest
 * (»Alle gleich« / »Stellenwert«) und blendet die Umschaltung aus.
 */
export default function Abakus({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festerModus = wahl(vorgabe, "reiter", ["single", "place"] as const);
  // One physical abacus: how many beads are pushed to the active (left) side per row.
  const [active, setActive] = useState<number[]>(() => Array(ROWS).fill(0));
  const [mode, setMode] = useState<Mode>(festerModus ?? "single");

  // Value per bead for a given row. Bottom row = ones, magnitude grows upward.
  const perBead = (row: number) => (mode === "single" ? 1 : Math.pow(10, ROWS - 1 - row));

  const contributions = active.map((a, r) => a * perBead(r));
  const total = useMemo(
    () => contributions.reduce((s, c) => s + c, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, mode],
  );

  function clickBead(row: number, index: number) {
    setActive(prev => {
      const next = [...prev];
      // Clicking an active bead pulls it (and everything after) back;
      // clicking an inactive bead pushes it (and everything before) over.
      next[row] = index < prev[row] ? index : index + 1;
      return next;
    });
  }

  const reset = () => setActive(Array(ROWS).fill(0));

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🧮 Abakus</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Schiebe die Kugeln und lies die Zahl ab. Wechsle zwischen „Alle gleich" und
            „Stellenwert" — dieselben Kugeln, zwei Zahlen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button
            onClick={reset}
            className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]"
          >
            ↺ Zurücksetzen
          </button>
        </div>
      </div>

      {/* Mode switch */}
      {!festerModus && <div className="inline-flex self-start rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
        {([
          ["single", "Alle gleich", "jede Kugel = 1, zusammen bis 100"],
          ["place", "Stellenwert", "Reihen = Einer, Zehner, Hunderter …"],
        ] as const).map(([m, label, hint]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            title={hint}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === m
                ? "bg-[var(--accent)] text-[var(--accent-text,#111)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>}

      {/* Digit readout */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-5 flex items-baseline gap-3">
        <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Wert</span>
        <span className="text-4xl sm:text-5xl font-black tabular-nums" style={{ color: "var(--accent)" }}>
          {fmt(total)}
        </span>
      </div>

      {/* Abacus board — one scalable SVG, fits any width without a scrollbar */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="w-full h-auto mx-auto"
          style={{ maxWidth: `calc(60vh * ${VBW} / ${VBH})` }}
          role="group"
          aria-label="Abakus"
        >
          <defs>
            <radialGradient id="beadRed" cx="0.35" cy="0.3" r="0.75">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
              <stop offset="0.4" stopColor="#e0524a" />
              <stop offset="1" stopColor="#c33d36" />
            </radialGradient>
            <radialGradient id="beadBlue" cx="0.35" cy="0.3" r="0.75">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
              <stop offset="0.4" stopColor="#4a78d0" />
              <stop offset="1" stopColor="#3a5fb0" />
            </radialGradient>
          </defs>

          {active.map((a, r) => {
            const cy = r * ROW_H + ROW_H / 2;
            const contrib = contributions[r];
            return (
              <g key={r}>
                {/* per-bead value */}
                <text
                  x={LABEL_L} y={cy} textAnchor="end" dominantBaseline="central"
                  fontSize={18} fontWeight={600} fill="var(--text-muted)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmt(perBead(r))}
                </text>

                {/* wire */}
                <line
                  x1={TX} y1={cy} x2={TX + TRACK_W} y2={cy}
                  stroke="var(--border)" strokeWidth={3} strokeLinecap="round"
                />

                {/* beads */}
                {Array.from({ length: COLS }, (_, i) => {
                  const isActive = i < a;
                  const slotLeft = isActive ? i * BEAD : TRACK_W - (COLS - i) * BEAD;
                  const cx = TX + slotLeft + BEAD / 2;
                  return (
                    <g
                      key={i}
                      onClick={() => clickBead(r, i)}
                      style={{
                        transform: `translateX(${cx}px)`,
                        transition: "transform 0.22s ease-out",
                        cursor: "pointer",
                      }}
                    >
                      <circle
                        cx={0} cy={cy} r={BR}
                        fill={i < 5 ? "url(#beadRed)" : "url(#beadBlue)"}
                        stroke="#00000022" strokeWidth={1}
                        opacity={isActive ? 1 : 0.92}
                        aria-label={`Reihe ${r + 1}, Kugel ${i + 1}`}
                      />
                    </g>
                  );
                })}

                {/* row contribution */}
                <text
                  x={TX + TRACK_W + GAP} y={cy} textAnchor="start" dominantBaseline="central"
                  fontSize={18} fill={a > 0 ? "var(--text)" : "var(--text-muted)"}
                  fontWeight={a > 0 ? 600 : 400} opacity={a > 0 ? 1 : 0.5}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {mode === "single" ? a : contrib > 0 ? `= ${fmt(contrib)}` : "0"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        {mode === "single"
          ? "Jede der 100 Kugeln zählt 1 — zusammen ergeben alle 100."
          : "Jede Reihe ist eine Stelle: unten die Einer, darüber Zehner, Hunderter und so weiter."}
      </p>
    </div>
  );
}
