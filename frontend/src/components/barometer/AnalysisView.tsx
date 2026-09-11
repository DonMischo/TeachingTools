"use client";
import type { BarometerAnalysis } from "@/lib/api";

export function AnalysisView({ analysis }: { analysis: BarometerAnalysis }) {
  const groups = [...analysis.groups].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...groups.map(g => g.count), 1);

  return (
    <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-4 mt-2">
      <div>
        <div className="font-semibold text-sm mb-1">🤖 KI-Auswertung</div>
        <p className="text-sm text-[var(--text-muted)]">{analysis.summary}</p>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-col gap-3">
          {groups.map((g, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{g.title}</span>
                <span className="text-[var(--text-muted)]">{g.count}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                <div className="h-full bg-[var(--accent)]" style={{ width: `${(g.count / maxCount) * 100}%` }} />
              </div>
              {g.description && <p className="text-xs text-[var(--text-muted)]">{g.description}</p>}
              {g.examples.slice(0, 3).map((ex, j) => (
                <p key={j} className="text-xs italic text-[var(--text-muted)]">„{ex}“</p>
              ))}
            </div>
          ))}
        </div>
      )}

      {analysis.unique_ideas.length > 0 && (
        <div>
          <div className="font-semibold text-sm mb-2">✨ Besondere Ideen</div>
          <div className="flex flex-col gap-2">
            {analysis.unique_ideas.map((idea, i) => (
              <div key={i} className="border-l-4 border-[var(--accent)] bg-[var(--bg)] rounded-r-lg px-3 py-2">
                <div className="text-sm font-semibold">{idea.idea}</div>
                {idea.reason && <div className="text-xs text-[var(--text-muted)]">{idea.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-[var(--text-muted)]">
        Hochgeladen am {new Date(analysis.uploaded_at).toLocaleString("de-DE")}
      </div>
    </div>
  );
}
