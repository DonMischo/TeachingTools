"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, BingoSetOut, BingoOut, ClassOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { ClassSelect } from "@/components/ClassSelect";

const STATUS_COLOR: Record<string, string> = {
  waiting: "#6b7280",
  active: "#22c55e",
  closed: "#ef4444",
};
const STATUS_LABEL: Record<string, string> = {
  waiting: "Wartend", active: "Läuft", closed: "Beendet",
};

export default function BingoSetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const setId = Number(id);
  const router = useRouter();
  const { auth } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canEdit = auth?.role === "teacher" || auth?.role === "admin";

  const { data: sets = [], isLoading: setsLoading } = useQuery<BingoSetOut[]>({
    queryKey: ["bingo-sets"],
    queryFn: () => api.bingo.listSets(),
  });
  const set = sets.find(s => s.id === setId);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<BingoOut[]>({
    queryKey: ["bingo", setId],
    queryFn: () => api.bingo.list(setId),
    enabled: !!setId,
  });

  const { data: classes = [] } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    staleTime: 60_000,
  });

  const [classId, setClassId] = useState<number | "">("");

  const startMut = useMutation({
    mutationFn: () => api.bingo.startSet(setId, classId === "" ? null : classId),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["bingo", setId] });
      router.push(`/games/bingo/host/${s.code}`);
    },
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => api.bingo.delete(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bingo", setId] }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });
  const closeMut = useMutation({
    mutationFn: (code: string) => api.bingo.close(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bingo", setId] }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });
  const resetMut = useMutation({
    mutationFn: (code: string) => api.bingo.reset(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bingo", setId] }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  if (!canEdit) return <div className="p-8 text-[var(--text-muted)]">Nur für Lehrkräfte.</div>;
  if (setsLoading) return <div className="p-6 text-[var(--text-muted)] text-sm">Laden…</div>;
  if (!set) return <div className="p-6 text-red-500 text-sm">Bingo-Set nicht gefunden.</div>;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <div>
        <Link href="/games/bingo" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Bingo-Bibliothek</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">🎰 {set.title}</h1>
        <div className="text-xs text-[var(--text-muted)] flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
          {set.subject && <span>{set.subject}</span>}
          <span>{set.grid_size}×{set.grid_cols ?? set.grid_size} · {set.total_pairs} Paare</span>
          {set.max_points > 0 && <span>{set.max_points} Pkt.</span>}
        </div>
        {set.description && <p className="text-sm text-[var(--text-muted)] mt-2">{set.description}</p>}
      </div>

      {canEdit && (
        <div className="flex items-center gap-3 flex-wrap">
          <ClassSelect value={classId} onChange={setClassId} className="input text-sm py-2 w-56" />
          <button
            onClick={() => startMut.mutate()}
            disabled={startMut.isPending}
            className="text-sm px-5 py-2 bg-[var(--accent)] text-[var(--accent-text,#111)] font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {startMut.isPending ? "Startet…" : "▶ Neue Runde starten"}
          </button>
          <span className="text-xs text-[var(--text-muted)]">Gäste-Punkte gehen an die gewählte Klasse.</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="font-semibold text-sm text-[var(--text-muted)] uppercase tracking-wide">Runden</div>
        {sessionsLoading ? (
          <div className="text-[var(--text-muted)] text-sm">Laden…</div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Noch keine Runde gestartet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map(s => (
              <li key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[s.status] ?? "#6b7280" }} />
                <span className="flex-1 text-sm text-[var(--text-muted)]">
                  {STATUS_LABEL[s.status] ?? s.status}
                  {s.class_id != null && ` · ${classes.find(c => c.id === s.class_id)?.code ?? `Klasse ${s.class_id}`}`}
                  {" · "}{new Date(s.created_at).toLocaleDateString("de-DE")}
                </span>
                {canEdit && (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => router.push(`/games/bingo/host/${s.code}`)} className="btn-secondary text-xs py-1 px-3">
                      Öffnen
                    </button>
                    {s.status === "active" && (
                      <button onClick={() => closeMut.mutate(s.code)} disabled={closeMut.isPending}
                        className="text-xs border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-xl px-3 py-1 transition-colors disabled:opacity-40">
                        Beenden
                      </button>
                    )}
                    {s.status !== "waiting" && (
                      <button onClick={() => resetMut.mutate(s.code)} disabled={resetMut.isPending}
                        className="text-xs border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] rounded-xl px-3 py-1 transition-colors disabled:opacity-40">
                        Zurücksetzen
                      </button>
                    )}
                    <button onClick={() => deleteMut.mutate(s.code)} disabled={deleteMut.isPending}
                      className="text-xs border border-red-400/30 text-red-400/70 hover:bg-red-400/10 hover:text-red-400 rounded-xl px-3 py-1 transition-colors disabled:opacity-40">
                      Löschen
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
