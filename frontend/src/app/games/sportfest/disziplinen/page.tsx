"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, AuswertungDisciplineEntry } from "@/lib/api";

const DISC_LABELS: Record<string, string> = {
  sprint: "🏃 Sprint",
  ausdauerlauf: "🏃 Ausdauer",
  weitsprung: "↔️ Weitsprung",
  ballwurf: "⚾ Ballwurf",
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function SportfestDisziplinenPage() {
  const [overall, setOverall] = useState(false);
  const [jahrgang, setJahrgang] = useState<number | "">("");

  const { data: entries = [], isLoading } = useQuery<AuswertungDisciplineEntry[]>({
    queryKey: ["sf-disziplin", overall, jahrgang],
    queryFn: () => api.sportfest.auswertung.disziplin({
      overall,
      jahrgang: jahrgang !== "" ? jahrgang : undefined,
    }),
    staleTime: 30_000,
  });

  // Group by discipline
  const byDisc = entries.reduce<Record<string, AuswertungDisciplineEntry[]>>((acc, e) => {
    (acc[e.discipline_id] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      <div>
        <Link href="/games/sportfest" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">← Sportfest</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">📊 Disziplinranking</h1>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <select value={jahrgang} onChange={e => setJahrgang(e.target.value ? Number(e.target.value) : "")}
          className="input text-sm py-1.5 w-36">
          <option value="">Alle Jahrgänge</option>
          {[5,6,7,8,9,10].map(j => <option key={j} value={j}>Jahrgang {j}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={overall} onChange={e => setOverall(e.target.checked)}
            className="accent-[var(--accent)]" />
          Jahrgangsübergreifend
        </label>
      </div>

      {isLoading ? (
        <div className="text-[var(--text-muted)] text-sm">Laden…</div>
      ) : Object.keys(byDisc).length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-muted)]">
          Noch keine Ergebnisse vorhanden.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(byDisc).map(([discId, discEntries]) => (
            <div key={discId} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] font-semibold text-sm">
                {DISC_LABELS[discId] ?? discId}
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {discEntries.slice(0, 10).map(e => (
                    <tr key={e.rank} className="border-b border-[var(--border)]/50">
                      <td className="px-3 py-2 w-8 text-center">{MEDALS[e.rank - 1] ?? e.rank}</td>
                      <td className="px-2 py-2">
                        <div>{e.name ?? "Schüler/in"}</div>
                        <div className="text-[var(--text-muted)]">{e.klasse}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {e.value != null ? e.value : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-[var(--accent)]">
                        {e.points ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
