"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TimelineSetOut } from "@/components/timeline/types";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

export default function ZeitstrahlPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();
  const { auth } = useAuth();
  const isTeacher = auth?.user_type === "teacher";
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: sets = [], isLoading } = useQuery<TimelineSetOut[]>({
    queryKey: ["timelines"], queryFn: api.timelines.list, enabled: isTeacher,
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
      router.push(`/tools/zeitstrahl/${created.id}`);
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
      try {
        const parsed = JSON.parse(msg);
        msg = parsed.detail?.errors?.join("\n") ?? parsed.detail?.message ?? msg;
      } catch { /* not JSON, use raw message */ }
      toast(msg, "error");
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

  if (!isTeacher) {
    return (
      <div className="p-8 text-sm text-[var(--text-muted)]">
        Die Zeitstrahl-Bibliothek ist für Lehrkräfte — Schüler öffnen einen geteilten Zeitstrahl über den Link ihrer Lehrkraft.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📏 Zeitstrahl</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Zeitleisten mit parallelen Spuren, Zahlenstrahlen und Skalen — anzeigen, üben, in Caputh &amp; Exitgame einbauen.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => examplesMut.mutate()} disabled={examplesMut.isPending}
            className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)] disabled:opacity-40">
            🌍 Beispiele laden
          </button>
          <button onClick={handleTemplate}
            className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]">
            📄 Vorlage
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="btn-primary text-sm py-1.5 px-4 disabled:opacity-40">
            {uploading ? "Lade hoch…" : "+ Zeitstrahl hochladen"}
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Lade…</p>
      ) : sets.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Noch keine Zeitstrahlen — lade die Beispiele oder eine eigene JSON-Datei hoch.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sets.map(s => (
            <div key={s.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
              <Link href={`/tools/zeitstrahl/${s.id}`} className="font-semibold hover:text-[var(--accent)] transition-colors">
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
    </div>
  );
}
