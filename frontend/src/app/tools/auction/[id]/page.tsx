"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, AuctionSetOut, AuctionOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_LABEL: Record<string, string> = {
  waiting: "Wartend", bidding: "Gebote offen", closed: "Abgeschlossen",
};

export default function AuctionSetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const setId = Number(id);
  const router = useRouter();
  const { auth } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canEdit = auth?.role === "teacher" || auth?.role === "admin";

  const { data: sets = [], isLoading: setsLoading } = useQuery<AuctionSetOut[]>({
    queryKey: ["auction-sets"],
    queryFn: () => api.auction.listSets(),
  });
  const set = sets.find(s => s.id === setId);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<AuctionOut[]>({
    queryKey: ["auction", setId],
    queryFn: () => api.auction.list(setId),
    enabled: !!setId,
  });

  const startMut = useMutation({
    mutationFn: () => api.auction.startSet(setId),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["auction", setId] });
      router.push(`/tools/auction/host/${s.code}`);
    },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => api.auction.delete(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auction", setId] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  if (!canEdit) return <div className="p-8 text-[var(--text-muted)]">Nur für Lehrkräfte.</div>;
  if (setsLoading) return <div className="p-6 text-[var(--text-muted)] text-sm">Laden…</div>;
  if (!set) return <div className="p-6 text-red-500 text-sm">Auktion nicht gefunden.</div>;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div>
        <Link href="/tools/auction" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Auktions-Bibliothek</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">🏷 {set.title}</h1>
        {set.prize_description && <div className="text-sm text-[var(--text-muted)] mt-1">🏆 {set.prize_description}</div>}
        {set.description && <p className="text-sm text-[var(--text-muted)] mt-2">{set.description}</p>}
      </div>

      {canEdit && (
        <button
          onClick={() => startMut.mutate()}
          disabled={startMut.isPending}
          className="btn-primary self-start disabled:opacity-40"
        >
          {startMut.isPending ? "Startet…" : "▶ Neue Auktion starten"}
        </button>
      )}

      <div className="flex flex-col gap-3">
        <div className="font-semibold text-sm text-[var(--text-muted)] uppercase tracking-wide">Durchläufe</div>
        {sessionsLoading ? (
          <div className="text-[var(--text-muted)] text-sm">Laden…</div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Noch keine Auktion gestartet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map(s => (
              <li key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 flex items-center gap-3">
                <span className="flex-1 text-sm text-[var(--text-muted)]">
                  {STATUS_LABEL[s.status] ?? s.status}
                  {s.winning_bid && <> · Gewonnen mit {s.winning_bid} Pts</>}
                  {" · "}{new Date(s.created_at).toLocaleDateString("de-DE")}
                </span>
                {canEdit && (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => router.push(`/tools/auction/host/${s.code}`)} className="btn-secondary text-xs py-1 px-3">
                      Öffnen
                    </button>
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
