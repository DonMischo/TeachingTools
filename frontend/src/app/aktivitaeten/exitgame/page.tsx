"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ExitGameOut, GeneratorInfo } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAvailability } from "@/hooks/useAvailability";
import { UploadErrorDialog } from "@/components/UploadErrorDialog";
import { parseUploadError, UploadError } from "@/lib/uploadError";

function GeneratorsHintPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const { data: generators = [] } = useQuery<GeneratorInfo[]>({
    queryKey: ["generators"], queryFn: api.generators.list,
  });

  function promptBlock(): string {
    const lines = generators.map(g =>
      `- ${g.id} (${g.subject}${g.source === "custom" ? ", eigener Generator" : ""}): ${g.description}`
    );
    return (
      "Auf der Übungsseite dieser App gibt es bereits automatisch generierte Aufgaben zu folgenden Themen " +
      "(prozedural erzeugt, unbegrenzt viele Varianten, passen sich der Schwierigkeit an):\n" + lines.join("\n") +
      "\n\nWenn eines dieser Themen zum Exitgame passt, kannst du im Text der Slides darauf verweisen " +
      "(z.B. 'Übe danach weiter auf der Übungsseite: Thema \"" + (generators[0]?.label ?? "…") + "\"')."
    );
  }

  async function copy() {
    await navigator.clipboard.writeText(promptBlock());
    toast("In Zwischenablage kopiert", "success");
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 flex flex-col gap-3 z-[70]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">🧮 Registrierte Aufgaben-Generatoren</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Diese Themen erzeugen auf der Übungsseite automatisch beliebig viele Aufgaben. Exitgame-Aufgaben
          selbst werden weiterhin fest im JSON geschrieben — hier siehst du, worauf du in Erklärtexten
          verweisen kannst, und kannst die Liste in einen KI-Prompt kopieren.
        </p>
        <ul className="flex flex-col gap-2">
          {generators.map(g => (
            <li key={g.id} className="rounded-lg border border-[var(--border)] p-2.5 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-semibold">{g.id}</span>
                <span className="px-1.5 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">{g.subject}</span>
                {g.grades.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                    Kl. {g.grades.length > 1 ? `${g.grades[0]}–${g.grades[g.grades.length - 1]}` : g.grades[0]}
                  </span>
                )}
                {g.source === "custom" && <span className="px-1.5 py-0.5 rounded-full border border-[var(--accent)] text-[var(--accent)]">eigener</span>}
              </div>
              <p className="text-[var(--text-muted)] mt-1">{g.description}</p>
            </li>
          ))}
          {generators.length === 0 && <p className="text-xs text-[var(--text-muted)]">Keine Generatoren registriert.</p>}
        </ul>
        <button onClick={copy} className="btn-primary text-sm py-1.5 px-4 self-start">
          📋 In AI-Prompt kopieren
        </button>
      </div>
    </>
  );
}

export default function ExitgamePage() {
  const qc = useQueryClient();
  const { can } = useAvailability();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const [showGenerators, setShowGenerators] = useState(false);

  const { data: games = [], isLoading } = useQuery<ExitGameOut[]>({
    queryKey: ["exitgames"], queryFn: api.exitgame.list,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.exitgame.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exitgames"] }),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const created = await api.exitgame.upload(file);
      qc.invalidateQueries({ queryKey: ["exitgames"] });
      router.push(`/games/exitgame/${created.id}`);
    } catch (err: unknown) {
      setUploadError(parseUploadError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleTemplate() {
    const tpl = await api.exitgame.template();
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exitgame-vorlage.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href="/games" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Spiele</Link>
          <h1 className="text-2xl font-black tracking-tight mt-1">🗝️ Exitgame</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Selbstständiges Exit-Game — Schüler lösen Aufgaben in ihrem eigenen Tempo.
          </p>
        </div>
        {can("exitgame", "upload") && (
          <div className="flex gap-2">
            <button onClick={() => setShowGenerators(true)} className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]">
              🧮 Generatoren
            </button>
            <button onClick={handleTemplate} className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]">
              📄 Vorlage
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="btn-primary text-sm py-1.5 px-4 disabled:opacity-40">
              {uploading ? "Lade hoch…" : "+ Exitgame hochladen"}
            </button>
            <input ref={fileRef} type="file" accept=".json,.zip" className="hidden" onChange={handleUpload} />
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Lade…</p>
      ) : games.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Noch keine Exitgames — lade eins hoch, um zu starten.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {games.map(g => (
            <div key={g.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
              <Link href={`/games/exitgame/${g.id}`} className="font-semibold hover:text-[var(--accent)] transition-colors">
                {g.title}
              </Link>
              {g.description && <p className="text-xs text-[var(--text-muted)]">{g.description}</p>}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">{g.subject || "—"}</span>
                {g.grade && <span className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">Klasse {g.grade}</span>}
                <span className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">{g.slide_count} Slides</span>
                {g.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">{t}</span>
                ))}
              </div>
              <div className="flex justify-end mt-1">
                <button onClick={() => { if (confirm(`"${g.title}" wirklich löschen?`)) deleteMut.mutate(g.id); }}
                  className="text-xs text-red-400 hover:underline">
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadErrorDialog error={uploadError} onClose={() => setUploadError(null)} />
      {showGenerators && <GeneratorsHintPanel onClose={() => setShowGenerators(false)} />}
    </div>
  );
}
