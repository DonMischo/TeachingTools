"use client";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, BingoSetOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability } from "@/hooks/useAvailability";

export default function BingoLibraryPage() {
  const { auth } = useAuth();
  const { can } = useAvailability();
  const { toast } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  // Any logged-in user may author Bingo sets (students land in the shared pool);
  // hosting a live round stays teacher-only (enforced on /aktivitaeten/bingo/new).
  const canEdit = !!auth;

  const { data: sets = [], isLoading } = useQuery<BingoSetOut[]>({
    queryKey: ["bingo-sets"],
    queryFn: () => api.bingo.listSets(),
    staleTime: 15_000,
  });

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        // Store in sessionStorage and open /aktivitaeten/bingo/new pre-filled
        sessionStorage.setItem("bingo_import", JSON.stringify(data));
        router.push("/aktivitaeten/bingo/new?import=1");
      } catch {
        toast("Ungültiges JSON", "error");
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  }

  if (!auth) {
    return <div className="p-8 text-[var(--text-muted)]">Bitte einloggen.</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/aktivitaeten" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Aktivitäten</Link>
          <h1 className="text-2xl font-black tracking-tight mt-1">🎰 Bingo-Bibliothek</h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            Vokabeln, Gleichungen, Daten – als Bingo-Spiel für die Klasse. Von allen Kolleg·innen nutzbar.
          </p>
        </div>
        {canEdit && can("bingo", "create") && (
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
            <button onClick={() => router.push("/aktivitaeten/bingo/new")}
              className="text-xs px-3 py-1.5 bg-[var(--accent)] text-[var(--accent-text,#111)] font-semibold rounded-lg hover:opacity-90 transition-opacity">
              + Neu erstellen
            </button>
          </div>
        )}
      </div>

      {/* Library */}
      {isLoading ? (
        <div className="text-[var(--text-muted)] text-sm">Laden…</div>
      ) : sets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 border border-dashed border-[var(--border)] rounded-2xl gap-3">
          <p className="text-[var(--text-muted)] text-sm">Noch keine Bingo-Sets.</p>
          {canEdit && can("bingo", "create") && (
            <button onClick={() => router.push("/aktivitaeten/bingo/new")}
              className="text-sm px-4 py-1.5 border border-[var(--border)] rounded-lg text-[var(--text)] font-semibold hover:bg-[var(--surface-hover)] transition-colors">
              Erstes Set erstellen
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sets.map(s => (
            <li key={s.id}>
              <Link
                href={`/aktivitaeten/bingo/${s.id}`}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent)] transition-colors"
              >
                <div className="font-semibold truncate">{s.title}</div>
                <div className="text-xs text-[var(--text-muted)] flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                  {s.subject && <span>{s.subject}</span>}
                  <span>{s.grid_size}×{s.grid_cols ?? s.grid_size} · {s.total_pairs} Paare</span>
                  {s.max_points > 0 && <span>{s.max_points} Pkt.</span>}
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
