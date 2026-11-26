"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, BingoSetDetail, BingoOut } from "@/lib/api";
import { SitzungListe, SitzungAktion, type SitzungEintrag } from "@/components/sitzung/SitzungListe";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { type Scope, scopeBody } from "@/components/ScopeSelect";

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

  const { data: set, isLoading: setsLoading } = useQuery<BingoSetDetail>({
    queryKey: ["bingo-set", setId],
    queryFn: () => api.bingo.getSet(setId),
    enabled: !!setId,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<BingoOut[]>({
    queryKey: ["bingo", setId],
    queryFn: () => api.bingo.list(setId),
    enabled: !!setId,
  });

  const startMut = useMutation({
    mutationFn: (scope: Scope) => api.bingo.startSet(setId, scopeBody(scope)),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["bingo", setId] });
      router.push(`/aktivitaeten/bingo/host/${s.code}`);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bingo", setId] }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });
  const resetMut = useMutation({
    mutationFn: (code: string) => api.bingo.reset(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bingo", setId] }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  if (!canEdit) return <div className="p-8 text-muted">Nur für Lehrkräfte.</div>;
  if (setsLoading) return <div className="p-6 text-muted text-sm">Laden…</div>;
  if (!set) return <div className="p-6 text-red-500 text-sm">Bingo-Set nicht gefunden.</div>;

  return (
    <div className="page">
      <div>
        <Link href="/aktivitaeten/bingo" className="text-sm text-muted hover:text-fg">← Bingo-Bibliothek</Link>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <h1 className="text-2xl font-black tracking-tight">🎰 {set.title}</h1>
          {set.can_edit && (
            <Link href={`/aktivitaeten/bingo/${setId}/edit`}
              className="text-xs px-3 py-1.5 border border-line rounded-lg text-muted hover:border-accent hover:text-accent transition-colors">
              ✎ Bearbeiten
            </Link>
          )}
        </div>
        <div className="text-xs text-muted flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
          {set.subject && <span>{set.subject}</span>}
          <span>{set.grid_size}×{set.grid_cols ?? set.grid_size} · {set.total_pairs} Paare</span>
          {set.max_points > 0 && <span>{set.max_points} Pkt.</span>}
        </div>
        {set.description && <p className="text-sm text-muted mt-2">{set.description}</p>}
      </div>

      <SitzungListe
        titel="Runden"
        leer="Noch keine Runde gestartet."
        laedt={sessionsLoading}
        neu={{
          onStart: sc => startMut.mutate(sc), laeuft: startMut.isPending, ohneKlasse: true, label: "Neue Runde starten",
          hinweis: sc => sc?.kind === "group"
            ? "Klassenübergreifend: Punkte gehen an die Klasse, die jeder Spieler beim Beitritt wählt."
            : "Gäste-Punkte gehen an die gewählte Klasse.",
        }}
        eintraege={sessions.map((s): SitzungEintrag => ({
          code: s.code,
          status: {
            label: STATUS_LABEL[s.status] ?? s.status,
            ton: s.status === "active" ? "live" : s.status === "waiting" ? "wartet" : "aus",
          },
          klasse: s.scope_label || "ohne Klasse",
          info: [
            new Date(s.created_at).toLocaleDateString("de-DE"),
            ...(s.awarded ? ["ausgewertet"] : []),
            // Bei einer klassenübergreifenden Runde steht hier, was jede
            // Klasse bekommen hat — sonst nur die eine Zahl.
            ...s.points_by_class.map(c => `${c.class_code}: ${c.points} Pkt.`),
          ],
          aktionen: <>
            <SitzungAktion art="haupt" href={`/aktivitaeten/bingo/host/${s.code}`}>Dashboard</SitzungAktion>
            {s.status === "active" && (
              <SitzungAktion art="gefahr" onClick={() => closeMut.mutate(s.code)} disabled={closeMut.isPending}>Beenden</SitzungAktion>
            )}
            {/* Zu früh beendet: zurückholen, solange nicht ausgewertet ist.
                Danach wäre ein zweites Schließen eine zweite Punktevergabe. */}
            {s.status === "closed" && !s.awarded && (
              <SitzungAktion onClick={() => reopenMut.mutate(s.code)} disabled={reopenMut.isPending}>Wieder öffnen</SitzungAktion>
            )}
            {s.status !== "waiting" && (
              <SitzungAktion onClick={() => resetMut.mutate(s.code)} disabled={resetMut.isPending}>Zurücksetzen</SitzungAktion>
            )}
            <SitzungAktion art="gefahr" onClick={() => { if (confirm("Runde löschen?")) deleteMut.mutate(s.code); }} disabled={deleteMut.isPending}>Löschen</SitzungAktion>
          </>,
        }))}
      />
    </div>
  );
}
