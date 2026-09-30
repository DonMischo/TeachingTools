"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TimelineSetOut } from "@/components/timeline/types";
import { useToast } from "@/contexts/ToastContext";
import { UploadErrorDialog } from "@/components/UploadErrorDialog";
import { parseUploadError, UploadError } from "@/lib/uploadError";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability } from "@/hooks/useAvailability";

export default function ZeitstrahlPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();
  const { auth } = useAuth();
  const { can } = useAvailability();
  const isTeacher = auth?.user_type === "teacher";
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);

  const { data: sets = [], isLoading } = useQuery<TimelineSetOut[]>({
    queryKey: ["timelines"], queryFn: api.timelines.list, enabled: !!auth,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.timelines.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timelines"] }),
    onError: (e: Error) => toast(e.message, "error"),
  });

  const examplesMut = useMutation({
    mutationFn: api.timelines.importExamples,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["timelines"] });
      toast(created.length > 0
        ? `${created.length} Beispiel-Zeitstrahlen importiert`
        : "Beispiele sind bereits importiert", "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const created = await api.timelines.upload(file);
      qc.invalidateQueries({ queryKey: ["timelines"] });
      router.push(`/aktivitaeten/zeitstrahl/${created.id}`);
    } catch (err: unknown) {
      setUploadError(parseUploadError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleTemplate() {
    const tpl = await api.timelines.template();
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zeitstrahl-vorlage.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!auth) {
    return (
      <div className="p-8 text-sm text-[var(--text-muted)]">
        Bitte einloggen, um die Zeitstrahl-Bibliothek zu sehen.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📏 Zeitstrahl</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Zeitleisten mit parallelen Spuren, Zahlenstrahlen und Skalen — anzeigen, üben, in Caputh &amp; TaskCrawler einbauen.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isTeacher && can("zeitstrahl", "create") && (
            <button onClick={() => examplesMut.mutate()} disabled={examplesMut.isPending}
              className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)] disabled:opacity-40">
              🌍 Beispiele laden
            </button>
          )}
          {can("zeitstrahl", "upload") && (
            <>
              <button onClick={handleTemplate}
                className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]">
                📄 Vorlage
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="btn-primary text-sm py-1.5 px-4 disabled:opacity-40">
                {uploading ? "Lade hoch…" : "+ Zeitstrahl hochladen"}
              </button>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Lade…</p>
      ) : sets.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Noch keine Zeitstrahlen — lade die Beispiele oder eine eigene JSON-Datei hoch.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
          {sets.map(s => (
            <div key={s.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
              <Link href={`/aktivitaeten/zeitstrahl/${s.id}`} className="font-semibold hover:text-[var(--accent)] transition-colors">
                {s.title}
              </Link>
              {s.description && <p className="text-xs text-[var(--text-muted)]">{s.description}</p>}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                  {s.axis.kind === "year" ? "Zeitleiste" : "Zahlenstrahl"}
                </span>
                <span className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                  {s.event_count} Einträge
                </span>
                {s.lane_count > 1 && (
                  <span className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                    {s.lane_count} Spuren
                  </span>
                )}
                {s.grades.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                    Kl. {s.grades.length > 1 ? `${s.grades[0]}–${s.grades[s.grades.length - 1]}` : s.grades[0]}
                  </span>
                )}
                {s.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">{t}</span>
                ))}
              </div>
              <div className="flex justify-end mt-1">
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
