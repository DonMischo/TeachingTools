"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AvatarDisplay } from "@/components/AvatarPicker";

function matchBadge(match: string | null): string {
  if (match === "exact") return "✓ exakt";
  if (match === "near") return "~ nah dran";
  if (match === "wrong") return "✗ falsch";
  return "— nicht versucht";
}

function formatTime(seconds: number | null): string {
  if (seconds == null) return "—";
  return `${seconds.toFixed(1)}s`;
}

export default function LueckentextReviewPage() {
  const { code } = useParams<{ code: string }>();

  const { data: entries, isLoading, isError } = useQuery({
    queryKey: ["lueckentext-review", code],
    queryFn: () => api.lueckentexte.review(code),
  });

  if (isLoading) return <div className="p-8 text-sm text-[var(--text-muted)]">Lade…</div>;
  if (isError || !entries) return <div className="p-8 text-sm text-[var(--text-muted)]">Auswertung nicht gefunden.</div>;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Link href={`/aktivitaeten/lueckentext/host/${code}`} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Zurück zur Sitzung</Link>
          <h1 className="text-2xl font-black tracking-tight mt-1">📊 Auswertung</h1>
        </div>
        {entries.length > 0 && (
          <a href={api.lueckentexte.reportCsvUrl(code)}
            className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)] whitespace-nowrap">
            📄 Ergebnisse (CSV)
          </a>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Keine Teilnehmer.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <div key={entry.pid} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <AvatarDisplay avatarId={entry.avatar} size="sm" />
                <span className="font-semibold">{entry.name}</span>
              </div>
              <table className="text-xs border border-[var(--border)] rounded-lg overflow-hidden w-full">
                <thead>
                  <tr className="bg-[var(--surface)]">
                    <th className="text-left p-2">Lücke</th>
                    <th className="text-left p-2">Versuche</th>
                    <th className="text-left p-2">Hinweise</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Ergebnis</th>
                    <th className="text-left p-2">Zeit</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.gaps.map((gap) => {
                    const flagged = gap.attempts > 1 || gap.hints_used > 0;
                    return (
                      <tr
                        key={gap.gap_id}
                        className={`border-t border-[var(--border)] ${flagged ? "border-l-4 border-l-amber-400" : ""}`}
                      >
                        <td className="p-2">{gap.gap_id}</td>
                        <td className="p-2">{gap.attempts}</td>
                        <td className="p-2">{gap.hints_used}</td>
                        <td className="p-2">{gap.revealed ? "🔓 aufgedeckt" : "—"}</td>
                        <td className="p-2">{matchBadge(gap.match)}</td>
                        <td className="p-2">{gap.solved ? formatTime(gap.time_spent_seconds) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
