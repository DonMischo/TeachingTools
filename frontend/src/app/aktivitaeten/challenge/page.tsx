"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type ChallengeSatzInfo } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAvailability } from "@/hooks/useAvailability";
import { UploadErrorDialog } from "@/components/UploadErrorDialog";
import { parseUploadError, UploadError } from "@/lib/uploadError";

export default function ChallengeSeite() {
  const qc = useQueryClient();
  const { can } = useAvailability();
  const { toast } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);

  const { data: saetze = [], isLoading } = useQuery<ChallengeSatzInfo[]>({
    queryKey: ["challenge", "sets"], queryFn: api.challenge.list,
  });

  const loeschen = useMutation({
    mutationFn: (id: number) => api.challenge.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenge", "sets"] }),
  });

  async function hochladen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const neu = await api.challenge.upload(file);
      qc.invalidateQueries({ queryKey: ["challenge", "sets"] });
      if (neu.warnungen?.length) toast(`Hochgeladen, aber: ${neu.warnungen.join(" · ")}`, "error");
      router.push(`/aktivitaeten/challenge/${neu.id}`);
    } catch (err: unknown) {
      setUploadError(parseUploadError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function vorlage() {
    const tpl = await api.challenge.template();
    const url = URL.createObjectURL(new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "challenge-vorlage.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href="/aktivitaeten" className="text-sm text-muted hover:text-fg">← Aktivitäten</Link>
          <h1 className="text-2xl font-black tracking-tight mt-1">⚔️ Challenge</h1>
          <p className="text-muted text-sm mt-1">
            Leistungsüberprüfung als Minispiel — Fakten den passenden Aufgaben zuordnen.
          </p>
        </div>
        {can("challenge", "upload") && (
          <div className="flex gap-2">
            <button onClick={vorlage} className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent">
              📄 Vorlage
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-primary text-sm py-1.5 px-4">
              {uploading ? "Lade hoch…" : "+ Challenge hochladen"}
            </button>
            <input ref={fileRef} type="file" accept=".json,.zip" className="hidden" onChange={hochladen} />
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : saetze.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Challenge — lade einen Satz hoch, um zu starten.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
          {saetze.map(s => (
            <div key={s.id} className="card p-4 flex flex-col gap-2">
              <Link href={`/aktivitaeten/challenge/${s.id}`} className="font-semibold hover:text-accent transition-colors">
                {s.title}
              </Link>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="px-2 py-0.5 rounded-full border border-line text-muted">{s.subject || "—"}</span>
                <span className="px-2 py-0.5 rounded-full border border-line text-muted">{s.fakten} Fakten</span>
                <span className="px-2 py-0.5 rounded-full border border-line text-muted">{s.challenges} Challenges</span>
              </div>
              <div className="flex justify-end mt-1">
                <button onClick={() => { if (confirm(`"${s.title}" wirklich löschen?`)) loeschen.mutate(s.id); }}
                  className="text-xs text-red-400 hover:underline" aria-label={`${s.title} löschen`}>
                  🗑 Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadErrorDialog error={uploadError} onClose={() => setUploadError(null)} />
    </div>
  );
}
