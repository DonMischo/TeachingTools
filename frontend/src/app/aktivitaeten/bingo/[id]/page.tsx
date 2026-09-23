"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, BingoSetOut, BingoOut } from "@/lib/api";
import { SessionGrid, SessionAction, type SessionCardItem } from "@/components/SessionGrid";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { Scope, ScopeSelect, scopeBody } from "@/components/ScopeSelect";

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

  const [scope, setScope] = useState<Scope>(null);

  const startMut = useMutation({
    mutationFn: () => api.bingo.startSet(setId, scopeBody(scope)),
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

  const reopenMut = useMutation({
    mutationFn: (code: string) => api.bingo.reopen(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bingo-sessions", setId] }),
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
          <ScopeSelect value={scope} onChange={setScope} className="input text-sm py-2 w-56" />
          <button
            onClick={() => startMut.mutate()}
            disabled={startMut.isPending}
            className="text-sm px-5 py-2 bg-[var(--accent)] text-[var(--accent-text,#111)] font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {startMut.isPending ? "Startet…" : "▶ Neue Runde starten"}
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            {scope?.kind === "group"
              ? "Klassenübergreifend: Punkte gehen an die Klasse, die jeder Spieler beim Beitritt wählt."
              : "Gäste-Punkte gehen an die gewählte Klasse."}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="font-semibold text-sm text-[var(--text-muted)] uppercase tracking-wide">Runden</div>
        {sessionsLoading ? (
          <div className="text-[var(--text-muted)] text-sm">Laden…</div>
        ) : (
          <SessionGrid
            items={sessions.map((s): SessionCardItem => ({
              code: s.code,
              title: s.scope_label || "Ohne Klasse",
              status: {
                label: STATUS_LABEL[s.status] ?? s.status,
                tone: s.status === "active" ? "live" : s.status === "waiting" ? "waiting" : "done",
              },
              meta: [
                new Date(s.created_at).toLocaleDateString("de-DE"),
                ...(s.awarded ? ["ausgewertet"] : []),
                // Bei einer klassenübergreifenden Runde steht hier, was jede
                // Klasse bekommen hat — sonst nur die eine Zahl.
                ...s.points_by_class.map(c => `${c.class_code}: ${c.points} Pkt.`),
              ],
            }))}
            empty="Noch keine Runde gestartet."
            renderActions={canEdit ? (item) => (
              <>
                <SessionAction onClick={() => router.push(`/games/bingo/host/${item.code}`)}>
                  Öffnen
                </SessionAction>
                {sessions.find(x => x.code === item.code)?.status === "active" && (
                  <SessionAction danger onClick={() => closeMut.mutate(item.code)} disabled={closeMut.isPending}>
                    Beenden
                  </SessionAction>
                )}
                {/* Zu früh beendet: zurückholen, solange nicht ausgewertet ist.
                    Danach wäre ein zweites Schließen eine zweite Punktevergabe. */}
                {sessions.find(x => x.code === item.code)?.status === "closed"
                  && !sessions.find(x => x.code === item.code)?.awarded && (
                  <SessionAction onClick={() => reopenMut.mutate(item.code)} disabled={reopenMut.isPending}>
                    Wieder öffnen
                  </SessionAction>
                )}
                {sessions.find(x => x.code === item.code)?.status !== "waiting" && (
                  <SessionAction onClick={() => resetMut.mutate(item.code)} disabled={resetMut.isPending}>
                    ↺ Zurücksetzen
                  </SessionAction>
                )}
                <SessionAction danger onClick={() => deleteMut.mutate(item.code)} disabled={deleteMut.isPending}>
                  ✕
                </SessionAction>
              </>
            ) : undefined}
          />
        )}
      </div>
    </div>
  );
}
