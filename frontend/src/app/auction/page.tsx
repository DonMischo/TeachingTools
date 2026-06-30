"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, AuctionOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_LABEL: Record<string, string> = {
  waiting: "Wartend", bidding: "Gebote offen", closed: "Abgeschlossen",
};

export default function AuctionPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const canEdit = auth?.role === "teacher" || auth?.role === "admin";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState("");

  const { data: sessions = [], isLoading } = useQuery<AuctionOut[]>({
    queryKey: ["auction"],
    queryFn: () => api.auction.list(),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: () => api.auction.create({ title, description: description || null, prize_description: prize || null }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["auction"] });
      router.push(`/auction/host/${s.code}`);
    },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => api.auction.delete(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auction"] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">🏷 Punkte-Auktion</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Häuser bieten Hauspunkte für einen Preis. Nur Haussprecher können mitbieten.
        </p>
      </div>

      {canEdit && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-sm">Neue Auktion</h2>
          <input className="input" placeholder="Titel (z. B. Freistunde freiwählen)" value={title}
            onChange={e => setTitle(e.target.value)} />
          <textarea className="input resize-none text-sm" rows={2}
            placeholder="Beschreibung (optional)" value={description}
            onChange={e => setDescription(e.target.value)} />
          <input className="input" placeholder="Was gewinnt das Siegerhaus? (optional)" value={prize}
            onChange={e => setPrize(e.target.value)} />
          <button
            onClick={() => createMut.mutate()}
            disabled={!title.trim() || createMut.isPending}
            className="btn-primary self-start"
          >
            {createMut.isPending ? "Erstelle…" : "Auktion starten"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-[var(--text-muted)] text-sm">Laden…</div>
      ) : sessions.length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-muted)] text-sm">
          Noch keine Auktionen.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map(s => (
            <div key={s.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{s.title}</div>
                {s.prize_description && (
                  <div className="text-xs text-[var(--text-muted)] truncate">🏆 {s.prize_description}</div>
                )}
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {STATUS_LABEL[s.status] ?? s.status}
                  {s.winning_bid && <> · Gewonnen mit {s.winning_bid} Pts</>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => router.push(`/auction/host/${s.code}`)}
                  className="btn-secondary text-xs py-1 px-3">Öffnen</button>
                {canEdit && (
                  <button onClick={() => deleteMut.mutate(s.code)}
                    className="text-xs border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-xl px-3 py-1 transition-colors">
                    Löschen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
