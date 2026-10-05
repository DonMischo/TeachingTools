"use client";
import type { BarometerAnalysis } from "@/lib/api";

// Essenz der Freitext-Antworten als Balken — genau das, was die KI zurueckgibt, ohne Fliesstext.
// Beschriftung ueber dem Balken, damit lange Antworten auch auf dem Handy lesbar bleiben.
export function AnalysisView({ analysis }: { analysis: BarometerAnalysis }) {
  const answers = [...analysis.answers].sort((a, b) => b.count - a.count);
  const max = Math.max(...answers.map(a => a.count), 1);

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3 mt-1">
      <div className="text-xs font-semibold text-muted">🤖 Essenz der Antworten</div>
      <div className="flex flex-col gap-2">
        {answers.map((a, i) => (
          <div key={i} data-testid="essenz-zeile" className="flex flex-col gap-0.5">
            <div className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 wrap-break-word">{a.text}</span>
              <span className="tabular-nums text-muted shrink-0">{a.count}</span>
            </div>
            <div className="h-2.5 rounded-full bg-line overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(a.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted">
        KI-Auswertung vom {new Date(analysis.uploaded_at).toLocaleString("de-DE")}
      </div>
    </div>
  );
}
