"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ExitGameOut, GeneratorInfo } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAvailability } from "@/hooks/useAvailability";
import { UploadErrorDialog } from "@/components/UploadErrorDialog";
import { VorlageInteraktivDialog } from "@/components/exitgame/VorlageInteraktivDialog";
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
      "\n\nWenn eines dieser Themen zum TaskCrawler passt, kannst du im Text der Slides darauf verweisen " +
      "(z.B. 'Übe danach weiter auf der Übungsseite: Thema \"" + (generators[0]?.label ?? "…") + "\"')."
    );
  }

  async function copy() {
    await navigator.clipboard.writeText(promptBlock());
    toast("In Zwischenablage kopiert", "success");
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-60" onClick={onClose} />
      <div className="card fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-lg max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto shadow-2xl p-5 flex flex-col gap-3 z-70">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">🧮 Registrierte Aufgaben-Generatoren</h3>
          <button onClick={onClose} className="text-muted hover:text-fg text-lg leading-none">×</button>
        </div>
        <p className="text-xs text-muted">
          Diese Themen erzeugen auf der Übungsseite automatisch beliebig viele Aufgaben. TaskCrawler-Aufgaben
          selbst werden weiterhin fest im JSON geschrieben — hier siehst du, worauf du in Erklärtexten
          verweisen kannst, und kannst die Liste in einen KI-Prompt kopieren.
        </p>
        <ul className="flex flex-col gap-2">
          {generators.map(g => (
            <li key={g.id} className="rounded-lg border border-line p-2.5 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-semibold">{g.id}</span>
                <span className="px-1.5 py-0.5 rounded-full border border-line text-muted">{g.subject}</span>
                {g.grades.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full border border-line text-muted">
                    Kl. {g.grades.length > 1 ? `${g.grades[0]}–${g.grades[g.grades.length - 1]}` : g.grades[0]}
                  </span>
                )}
                {g.source === "custom" && <span className="px-1.5 py-0.5 rounded-full border border-accent text-accent">eigener</span>}
              </div>
              <p className="text-muted mt-1">{g.description}</p>
            </li>
          ))}
          {generators.length === 0 && <p className="text-xs text-muted">Keine Generatoren registriert.</p>}
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
  const [showVorlage, setShowVorlage] = useState(false);

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
      router.push(`/aktivitaeten/taskcrawler/${created.id}`);
    } catch (err: unknown) {
      setUploadError(parseUploadError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Schlanke Vorlage (Folien) oder interaktive Vorlage (2.5D: Gebäude, Verlies, Stationen, Werkzeuge) */
  async function handleTemplate(interaktiv = false, werkzeuge?: string[]) {
    const tpl = interaktiv ? await api.exitgame.templateInteraktiv(werkzeuge) : await api.exitgame.template();
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = interaktiv ? "taskcrawler-vorlage-interaktiv.json" : "taskcrawler-vorlage.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href="/aktivitaeten" className="text-sm text-muted hover:text-fg">← Aktivitäten</Link>
          <h1 className="text-2xl font-black tracking-tight mt-1">🗝️ TaskCrawler</h1>
          <p className="text-muted text-sm mt-1">
            Der TaskCrawler — Schüler lösen Aufgaben in ihrem eigenen Tempo.
          </p>
        </div>
        {can("exitgame", "upload") && (
          <div className="flex gap-2">
            <button onClick={() => setShowGenerators(true)} className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent">
              🧮 Generatoren
            </button>
            <button onClick={() => handleTemplate()} title="Schlanke Vorlage: alle Bausteine für Folien-TaskCrawler"
              className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent">
              📄 Vorlage
            </button>
            <button onClick={() => setShowVorlage(true)} title="Vorlage für die 2.5D-Ansicht: Gebäude, Verlies, Ebene, Stationen, Monster, Werkzeuge"
              className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent">
              🏰 Vorlage interaktiv
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="btn-primary text-sm py-1.5 px-4">
              {uploading ? "Lade hoch…" : "+ TaskCrawler hochladen"}
            </button>
            <input ref={fileRef} type="file" accept=".json,.zip" className="hidden" onChange={handleUpload} />
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : games.length === 0 ? (
        <p className="text-sm text-muted">Noch keine TaskCrawler — lade einen hoch, um zu starten.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
          {games.map(g => (
            <div key={g.id} className="card p-4 flex flex-col gap-2">
              <Link href={`/aktivitaeten/taskcrawler/${g.id}`} className="font-semibold hover:text-accent transition-colors">
                {g.title}
              </Link>
              {g.description && <p className="text-xs text-muted">{g.description}</p>}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="px-2 py-0.5 rounded-full border border-line text-muted">{g.subject || "—"}</span>
                {g.grade && <span className="px-2 py-0.5 rounded-full border border-line text-muted">Klasse {g.grade}</span>}
                <span className="px-2 py-0.5 rounded-full border border-line text-muted">{g.slide_count} Slides</span>
                {g.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full border border-line text-muted">{t}</span>
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
      {showVorlage && (
        <VorlageInteraktivDialog onClose={() => setShowVorlage(false)}
          onDownload={w => { setShowVorlage(false); handleTemplate(true, w); }} />
      )}
    </div>
  );
}
