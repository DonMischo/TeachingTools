"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, LueckentextSetOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { UploadErrorDialog } from "@/components/UploadErrorDialog";
import { parseUploadError, UploadError } from "@/lib/uploadError";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability } from "@/hooks/useAvailability";

export default function LueckentextePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();
  const { auth } = useAuth();
  const { can } = useAvailability();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);

  const { data: sets = [], isLoading } = useQuery<LueckentextSetOut[]>({
    queryKey: ["lueckentexte"], queryFn: api.lueckentexte.list, enabled: !!auth,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.lueckentexte.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lueckentexte"] }),
    // A set with sessions comes back as 409 with a sentence worth reading —
    // the raw JSON body would hide it.
    onError: (e: Error) => toast(parseUploadError(e, "Löschen fehlgeschlagen").message, "error"),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const created = await api.lueckentexte.upload(file);
      qc.invalidateQueries({ queryKey: ["lueckentexte"] });
      router.push(`/games/lueckentexte/${created.id}`);
    } catch (err: unknown) {
      setUploadError(parseUploadError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleTemplate() {
    const tpl = await api.lueckentexte.template();
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lueckentext-vorlage.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!auth) {
    return (
      <div className="p-8 text-sm text-[var(--text-muted)]">
        Bitte einloggen, um die Lückentext-Bibliothek zu sehen.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📝 Lückentext</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Lückentexte mit Wortbank, Freitext oder Multiple-Choice — anzeigen, üben, in Caputh &amp; Exitgame einbauen.
          </p>
        </div>
        {can("lueckentext", "upload") && (
          <div className="flex gap-2 flex-nowrap shrink-0">
            <button onClick={handleTemplate}
              className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)] whitespace-nowrap">
              📄 Vorlage
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="btn-primary text-sm py-1.5 px-4 disabled:opacity-40 whitespace-nowrap">
              {uploading ? "Lade hoch…" : "+ Lückentext hochladen"}
            </button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Lade…</p>
      ) : sets.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Noch keine Lückentexte — lade eine eigene JSON-Datei hoch.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sets.map(s => (
            <div key={s.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
              <Link href={`/games/lueckentexte/${s.id}`} className="font-semibold hover:text-[var(--accent)] transition-colors">
                {s.title}
              </Link>
              {s.description && <p className="text-xs text-[var(--text-muted)]">{s.description}</p>}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                  {s.gap_count} Lücken
                </span>
                {s.grades.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                    Kl. {s.grades.length > 1 ? `${s.grades[0]}–${s.grades[s.grades.length - 1]}` : s.grades[0]}
                  </span>
                )}
                {s.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">{t}</span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-1 gap-2">
                <div className="flex gap-3 text-xs">
                  <a href={`/api/lueckentexte/${s.id}/export.pdf?filled=0`} className="text-[var(--text-muted)] hover:underline">
                    📄 PDF (leer)
                  </a>
                  <a href={`/api/lueckentexte/${s.id}/export.pdf?filled=1`} className="text-[var(--text-muted)] hover:underline">
                    📄 PDF (gefüllt)
                  </a>
                </div>
                <button onClick={() => { if (confirm(`"${s.title}" wirklich löschen?`)) deleteMut.mutate(s.id); }}
                  className="text-xs text-red-400 hover:underline">
                  Löschen
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
