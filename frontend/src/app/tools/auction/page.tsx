"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, AuctionSetOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability } from "@/hooks/useAvailability";

export default function AuctionLibraryPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const canEdit = auth?.role === "teacher" || auth?.role === "admin";
  const { can } = useAvailability();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState("");

  const { data: sets = [], isLoading } = useQuery<AuctionSetOut[]>({
    queryKey: ["auction-sets"],
    queryFn: () => api.auction.listSets(),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: () => api.auction.create({ title, description: description || null, prize_description: prize || null }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["auction-sets"] });
      router.push(`/tools/auction/host/${s.code}`);
    },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  if (!canEdit) {
    return <div className="p-8 text-muted">Nur für Lehrkräfte.</div>;
  }

  return (
    <div className="page">
      <div>
        <Link href="/tools" className="text-sm text-muted hover:text-fg">← Tools</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">🏷 Auktions-Bibliothek</h1>
        <p className="text-muted text-sm mt-1">
          Häuser bieten Hauspunkte für einen Preis. Nur Haussprecher können mitbieten. Von allen Kolleg·innen nutzbar.
        </p>
      </div>

      {canEdit && can("auktion", "host") && (
        <div className="card p-4 flex flex-col gap-3">
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
        <div className="text-muted text-sm">Laden…</div>
      ) : sets.length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-line rounded-2xl text-muted text-sm">
          Noch keine Auktionen.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sets.map(s => (
            <li key={s.id}>
              <Link
                href={`/tools/auction/${s.id}`}
                className="block rounded-xl border border-line bg-surface p-4 hover:border-accent transition-colors"
              >
                <div className="font-semibold text-sm truncate">{s.title}</div>
                {s.prize_description && (
                  <div className="text-xs text-muted truncate">🏆 {s.prize_description}</div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
