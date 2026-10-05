"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, AuswertungStudent, KlassePunkteEntry } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

const MEDALS = ["🥇", "🥈", "🥉"];

function KlassenTab({ isTeacher }: { isTeacher: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);

  const { data: preview = [], isLoading: previewLoading } = useQuery<KlassePunkteEntry[]>({
    queryKey: ["sf-klassen-preview"],
    queryFn: () => api.sportfest.auswertung.klassenPunktePreview(),
    enabled: showPreview,
    staleTime: 60_000,
  });

  const commitMut = useMutation({
    mutationFn: () => api.sportfest.auswertung.klassenPunkteCommit({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["haeuser"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast("Sportfest-Punkte vergeben!", "success");
    },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  // Group by jahrgang, sort jahrgang by best class total awarded desc
  const grouped = new Map<number | null, KlassePunkteEntry[]>();
  for (const e of preview) {
    const key = e.jahrgang;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  }
  // Sort classes within each jahrgang by awarded desc
  for (const arr of grouped.values()) arr.sort((a, b) => b.awarded - a.awarded);
  // Sort jahrgänge by their best class awarded desc
  const sortedJahrgaenge = [...grouped.entries()].sort((a, b) => {
    const bestA = a[1][0]?.awarded ?? 0;
    const bestB = b[1][0]?.awarded ?? 0;
    return bestB - bestA;
  });

  // For table: rows indexed by position within each jahrgang
  const maxRows = Math.max(...sortedJahrgaenge.map(([, arr]) => arr.length), 0);

  return (
    <div className="flex flex-col gap-4">
      {isTeacher && (
        <div className="flex gap-3 items-center flex-wrap">
          <button
            onClick={() => setShowPreview(true)}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            Klassen-Punkte Vorschau
          </button>
          {showPreview && preview.length > 0 && (
            <button
              onClick={() => commitMut.mutate()}
              disabled={commitMut.isPending}
              className="btn-primary text-sm py-1.5 px-3"
            >
              {commitMut.isPending ? "…" : "Punkte vergeben"}
            </button>
          )}
        </div>
      )}

      {!showPreview && (
        <div className="text-sm text-muted">
          Klicke auf "Klassen-Punkte Vorschau" um die normierten Punktzahlen zu sehen.
        </div>
      )}

      {previewLoading && <div className="text-sm text-muted">Laden…</div>}

      {showPreview && preview.length === 0 && !previewLoading && (
        <div className="text-sm text-muted">Keine Ergebnisse vorhanden.</div>
      )}

      {showPreview && preview.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="border-b border-line text-muted text-xs">
                <th className="text-left px-3 py-2">Platz</th>
                {sortedJahrgaenge.map(([jg]) => (
                  <th key={String(jg)} className="text-left px-3 py-2 border-l border-line">
                    Jg. {jg ?? "?"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }, (_, i) => (
                <tr key={i} className="border-b border-line/50">
                  <td className="px-3 py-2 font-bold text-center">{MEDALS[i] ?? i + 1}</td>
                  {sortedJahrgaenge.map(([jg, arr]) => {
                    const entry = arr[i];
                    return (
                      <td key={String(jg)} className="px-3 py-2 border-l border-line">
                        {entry ? (
                          <div>
                            <span className="font-semibold">{entry.klasse}</span>
                            <span className="ml-2 text-accent font-bold">{entry.awarded}</span>
                            <span className="ml-1 text-xs text-muted">Pkt</span>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SportfestRankingPage() {
  const { auth } = useAuth();
  const [tab, setTab] = useState<"gesamt" | "klassen">("gesamt");
  const [jahrgang, setJahrgang] = useState<number | "">("");
  const [geschlecht, setGeschlecht] = useState("");
  // Die Gesamtwertung ist eine vollständige Leistungsliste aller Kinder und
  // damit Lehrersache; der Server gibt sie Schüler:innen gar nicht mehr heraus.
  const isTeacher = auth?.role === "teacher" || auth?.role === "admin";

  const { data: ranking = [], isLoading } = useQuery<AuswertungStudent[]>({
    queryKey: ["sf-gesamt", jahrgang, geschlecht],
    queryFn: () => api.sportfest.auswertung.gesamt({
      jahrgang: jahrgang !== "" ? jahrgang : undefined,
      geschlecht: geschlecht || undefined,
    }),
    enabled: tab === "gesamt" && isTeacher,
    staleTime: 30_000,
  });

  return (
    <div className="page">
      <div>
        <Link href="/tools/sportfest" className="text-sm text-muted hover:text-fg transition-colors">← Sportfest</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">🏆 Gesamtranking</h1>
        {tab === "gesamt" && !isTeacher && (
          <p className="text-muted text-sm mt-1">
            Die Schülerwertung sehen nur Lehrkräfte. Die Siegerehrung je Disziplin
            steht unter <Link href="/tools/sportfest/disziplinen" className="underline">Disziplinranking</Link>.
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["gesamt", "klassen"] as const).filter(t => t !== "gesamt" || isTeacher).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-accent text-accent-fg"
                : "border border-line text-muted hover:border-muted"
            }`}>
            {t === "gesamt" ? "Schüler/innen" : "Klassen"}
          </button>
        ))}
      </div>

      {tab === "gesamt" && isTeacher && (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select value={jahrgang} onChange={e => setJahrgang(e.target.value ? Number(e.target.value) : "")}
              className="input text-sm py-1.5 w-32">
              <option value="">Alle Jahrgänge</option>
              {[5,6,7,8,9,10].map(j => <option key={j} value={j}>Jahrgang {j}</option>)}
            </select>
            <select value={geschlecht} onChange={e => setGeschlecht(e.target.value)}
              className="input text-sm py-1.5 w-36">
              <option value="">Alle</option>
              <option value="männlich">Männlich</option>
              <option value="weiblich">Weiblich</option>
            </select>
          </div>

          {isLoading ? (
            <div className="text-muted text-sm">Laden…</div>
          ) : ranking.length === 0 ? (
            <div className="flex items-center justify-center h-32 border border-dashed border-line rounded-2xl text-muted">
              Noch keine Ergebnisse vorhanden.
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-muted text-xs">
                    <th className="text-left px-4 py-3 w-12">#</th>
                    <th className="text-left px-4 py-3">Name / Klasse</th>
                    <th className="text-right px-4 py-3">Punkte</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((entry) => (
                    <tr key={entry.rank} className="border-b border-line/50 hover:bg-surface-hover">
                      <td className="px-4 py-2.5 text-center font-bold">
                        {MEDALS[entry.rank - 1] ?? entry.rank}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{entry.name ?? "Schüler/in"}</div>
                        <div className="text-xs text-muted">{entry.klasse}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-accent">
                        {entry.total_points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {(tab === "klassen" || !isTeacher) && <KlassenTab isTeacher={!!isTeacher} />}
    </div>
  );
}
