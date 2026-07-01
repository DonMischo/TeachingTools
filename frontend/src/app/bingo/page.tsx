"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, BingoOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_COLOR: Record<string, string> = {
  waiting: "#6b7280",
  active: "#22c55e",
  closed: "#ef4444",
};
const STATUS_LABEL: Record<string, string> = {
  waiting: "Wartend", active: "Läuft", closed: "Beendet",
};

export default function BingoPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const canEdit = auth?.role === "teacher" || auth?.role === "admin";

  const { data: sessions = [], isLoading } = useQuery<BingoOut[]>({
    queryKey: ["bingo"],
    queryFn: () => api.bingo.list(),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => api.bingo.delete(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bingo"] }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  const closeMut = useMutation({
    mutationFn: (code: string) => api.bingo.close(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bingo"] }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  const resetMut = useMutation({
    mutationFn: (code: string) => api.bingo.reset(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bingo"] }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        // Store in sessionStorage and open /bingo/new pre-filled
        sessionStorage.setItem("bingo_import", JSON.stringify(data));
        router.push("/bingo/new?import=1");
      } catch {
        toast("Ungültiges JSON", "error");
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🎰 Bingo</h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            Vokabeln, Gleichungen, Daten – als Bingo-Spiel für die Klasse.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/api/bingo/template"
              download="bingo_vorlage.json"
              className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              Vorlage
            </a>
            <label className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer">
              Hochladen
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
            </label>
            <button onClick={() => router.push("/bingo/new")} className="btn-primary text-sm">
              + Neue Runde
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-[var(--text-muted)] text-sm">Laden…</div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 border border-dashed border-[var(--border)] rounded-2xl gap-3">
          <p className="text-[var(--text-muted)] text-sm">Noch keine Bingo-Runden.</p>
          {canEdit && (
            <button onClick={() => router.push("/bingo/new")} className="btn-secondary text-sm">
              Erste Runde erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map(s => (
            <div key={s.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
              {/* Title row */}
              <div className="flex items-start gap-3">
                <span
                  className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: STATUS_COLOR[s.status] ?? "#6b7280" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{s.title}</div>
                  <div className="text-xs text-[var(--text-muted)] flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                    {s.subject && <span>{s.subject}</span>}
                    <span>{s.grid_size}×{s.grid_cols ?? s.grid_size} · {s.total_pairs} Paare</span>
                    {s.max_points > 0 && <span>{s.max_points} Pkt.</span>}
                    <span>{STATUS_LABEL[s.status] ?? s.status}</span>
                  </div>
                  {s.tags && s.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.tags.map((t: string) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                          style={{ background: "var(--accent)22", color: "var(--accent)" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="flex gap-2 flex-wrap border-t border-[var(--border)] pt-3">
                  <button
                    onClick={() => router.push(`/bingo/host/${s.code}`)}
                    className="btn-primary text-xs py-1.5 px-4"
                  >
                    {s.status === "waiting" ? "▶ Starten" : "Öffnen"}
                  </button>
                  {s.status === "active" && (
                    <button
                      onClick={() => closeMut.mutate(s.code)}
                      disabled={closeMut.isPending}
                      className="text-xs border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-xl px-3 py-1.5 transition-colors disabled:opacity-40"
                    >
                      Beenden
                    </button>
                  )}
                  {s.status !== "waiting" && (
                    <button
                      onClick={() => resetMut.mutate(s.code)}
                      disabled={resetMut.isPending}
                      className="text-xs border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] rounded-xl px-3 py-1.5 transition-colors disabled:opacity-40"
                    >
                      Zurücksetzen
                    </button>
                  )}
                  <button
                    onClick={() => deleteMut.mutate(s.code)}
                    disabled={deleteMut.isPending}
                    className="text-xs border border-red-400/30 text-red-400/70 hover:bg-red-400/10 hover:text-red-400 rounded-xl px-3 py-1.5 transition-colors disabled:opacity-40 ml-auto"
                  >
                    Löschen
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
