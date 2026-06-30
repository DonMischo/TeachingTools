"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, BingoOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

type PairDraft = { caller: string; answer: string };

const BLANK = (): PairDraft => ({ caller: "", answer: "" });

const STATUS_LABEL: Record<string, string> = {
  waiting: "Wartend", active: "Läuft", closed: "Beendet",
};

export default function BingoPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const canEdit = auth?.role === "teacher" || auth?.role === "admin";

  const [title, setTitle] = useState("");
  const [gridSize, setGridSize] = useState(3);
  const [pairs, setPairs] = useState<PairDraft[]>(() => Array.from({ length: 9 }, BLANK));

  const { data: sessions = [], isLoading } = useQuery<BingoOut[]>({
    queryKey: ["bingo"],
    queryFn: () => api.bingo.list(),
    staleTime: 30_000,
  });

  function updatePair(i: number, field: keyof PairDraft, val: string) {
    setPairs(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  }

  function setGrid(size: number) {
    setGridSize(size);
    const cells = size * size;
    setPairs(prev => {
      if (prev.length < cells) return [...prev, ...Array.from({ length: cells - prev.length }, BLANK)];
      return prev;
    });
  }

  const createMut = useMutation({
    mutationFn: () => {
      const validPairs = pairs.filter(p => p.caller.trim() && p.answer.trim());
      if (validPairs.length < gridSize * gridSize) {
        throw new Error(`Mindestens ${gridSize * gridSize} vollständige Paare benötigt`);
      }
      return api.bingo.create({ title, grid_size: gridSize, pairs: validPairs });
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["bingo"] });
      router.push(`/bingo/host/${s.code}`);
    },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => api.bingo.delete(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bingo"] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const cells = gridSize * gridSize;
  const validCount = pairs.filter(p => p.caller.trim() && p.answer.trim()).length;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">🎰 Bingo</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Vokabeln, Gleichungen, Daten – als Bingo-Spiel für die Klasse.
        </p>
      </div>

      {canEdit && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-4">
          <h2 className="font-semibold text-sm">Neue Bingo-Runde</h2>

          <div className="flex gap-3 flex-wrap">
            <input className="input flex-1 min-w-[200px]" placeholder="Titel (z. B. Französisch Vokabeln)"
              value={title} onChange={e => setTitle(e.target.value)} />
            <select className="input w-36" value={gridSize} onChange={e => setGrid(Number(e.target.value))}>
              <option value={3}>3 × 3 (9 Felder)</option>
              <option value={4}>4 × 4 (16 Felder)</option>
              <option value={5}>5 × 5 (25 Felder)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-[var(--text-muted)] px-1">
              <span>Aufrufen (Frage/Begriff)</span>
              <span>Antwort (auf Karte)</span>
              <span />
            </div>
            {pairs.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <input className="input text-sm py-1" placeholder={`Frage ${i + 1}`}
                  value={p.caller} onChange={e => updatePair(i, "caller", e.target.value)} />
                <input className="input text-sm py-1" placeholder={`Antwort ${i + 1}`}
                  value={p.answer} onChange={e => updatePair(i, "answer", e.target.value)} />
                <button onClick={() => setPairs(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-[var(--text-muted)] hover:text-red-400 text-lg w-6">✕</button>
              </div>
            ))}
            <button onClick={() => setPairs(prev => [...prev, BLANK()])}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] self-start mt-1">
              + Paar hinzufügen
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => createMut.mutate()}
              disabled={!title.trim() || validCount < cells || createMut.isPending}
              className="btn-primary"
            >
              {createMut.isPending ? "Erstelle…" : "Bingo starten"}
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              {validCount}/{cells} Paare ausgefüllt
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-[var(--text-muted)] text-sm">Laden…</div>
      ) : sessions.length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-muted)] text-sm">
          Noch keine Bingo-Runden.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map(s => (
            <div key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{s.title}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {s.grid_size}×{s.grid_size} · {s.total_pairs} Paare · {STATUS_LABEL[s.status] ?? s.status}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => router.push(`/bingo/host/${s.code}`)}
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
