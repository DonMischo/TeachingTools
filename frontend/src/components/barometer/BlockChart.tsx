"use client";
import type { BarometerResults, BarometerScaleStyle } from "@/lib/api";
import { scaleLabel, scaleMean } from "@/lib/barometer";

type BlockQuestion = {
  id: number; text: string; scale_min: number; scale_max: number;
  scale_min_label: string | null; scale_max_label: string | null; scale_style: BarometerScaleStyle;
};

// Red -> amber -> grey -> lime -> green, ramped across the scale steps ("good" direction is
// always the smiley/scale_style's positive end).
const LIKERT_COLORS = ["#ef4444", "#f59e0b", "#9ca3af", "#84cc16", "#22c55e"];

function likertColor(q: BlockQuestion, v: number, i: number, n: number): string {
  if (q.scale_style === "zahlen") {
    const opacity = 0.25 + (0.75 * i) / Math.max(1, n - 1);
    return `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, transparent)`;
  }
  const pos = q.scale_style === "smileys_auf" ? v - q.scale_min : q.scale_max - v;
  const frac = n === 1 ? 0.5 : pos / (n - 1);
  const idx = Math.round(frac * (LIKERT_COLORS.length - 1));
  return LIKERT_COLORS[Math.min(LIKERT_COLORS.length - 1, Math.max(0, idx))];
}

export function BlockChart({ questions, results, chart }: {
  questions: BlockQuestion[]; results: Record<number, BarometerResults>; chart: string;
}) {
  const first = questions[0];
  const steps = Array.from({ length: first.scale_max - first.scale_min + 1 }, (_, i) => first.scale_min + i);

  if (chart === "mittelwerte") {
    return (
      <div className="flex flex-col gap-3">
        {questions.map(q => {
          const r = results[q.id] ?? { distribution: {}, count: 0 };
          const mean = scaleMean(q, r.distribution);
          const frac = mean == null ? 0 : (mean - q.scale_min) / (q.scale_max - q.scale_min);
          return (
            <div key={q.id} className="flex flex-col gap-1">
              <div className="text-sm">{q.text}</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 rounded-full bg-line overflow-hidden">
                  {mean != null && <div className="h-full bg-accent" style={{ width: `${frac * 100}%` }} />}
                </div>
                <span className="text-xs text-muted w-10 text-right">
                  {mean == null ? "–" : mean.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // likert
  return (
    <div className="flex flex-col gap-4">
      {questions.map(q => {
        const r = results[q.id] ?? { distribution: {}, count: 0 };
        const mean = scaleMean(q, r.distribution);
        const total = r.count;
        return (
          <div key={q.id} className="flex flex-col gap-1">
            <div className="text-sm">{q.text}</div>
            <div className="flex w-full h-5 rounded-full overflow-hidden border border-line">
              {total === 0
                ? <div className="w-full h-full bg-line" />
                : steps.map((v, i) => {
                  const c = r.distribution[String(v)] ?? 0;
                  if (c === 0) return null;
                  return (
                    <div key={v} title={`${scaleLabel(q, v)}: ${c}`}
                      style={{ width: `${(c / total) * 100}%`, background: likertColor(q, v, i, steps.length) }} />
                  );
                })}
            </div>
            <div className="text-xs text-muted">
              {total === 0 ? "–" : <>Ø {mean!.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · {total}</>}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {(first.scale_min_label || first.scale_max_label) && (
          <span>{first.scale_min_label} → {first.scale_max_label}</span>
        )}
        {steps.map((v, i) => (
          <span key={v} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: likertColor(first, v, i, steps.length) }} />
            {scaleLabel(first, v)}
          </span>
        ))}
      </div>
    </div>
  );
}
