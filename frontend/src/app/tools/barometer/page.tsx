"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, BarometerSessionSummary, BarometerSessionOut, BarometerMode } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useAvailability } from "@/hooks/useAvailability";
import { UploadErrorDialog } from "@/components/UploadErrorDialog";
import { parseUploadError, UploadError } from "@/lib/uploadError";
import {
  MAX_SMILEY_STEPS, blankBlock, blankQuestion, draftsToQuestions, questionsToDrafts,
  type DraftItem,
} from "@/lib/barometer";
import { QuestionDraftCard } from "@/components/barometer/QuestionDraftCard";
import { BlockDraftCard } from "@/components/barometer/BlockDraftCard";
import { UmfrageEinstellungen } from "@/components/barometer/UmfrageEinstellungen";
import { gastMinutenGueltig } from "@/lib/barometer";

export default function BarometerPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const isTeacher = auth?.role === "teacher" || auth?.role === "admin";
  const { can } = useAvailability();

  const [showCreate, setShowCreate] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [shared, setShared] = useState(false);
  const [mode, setMode] = useState<BarometerMode>("live");
  const [anonymous, setAnonymous] = useState(false);
  const [guestMinutes, setGuestMinutes] = useState<number | null>(null);
  const [items, setItems] = useState<DraftItem[]>([blankQuestion()]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: sessions = [], isLoading } = useQuery<BarometerSessionSummary[]>({
    queryKey: ["barometer"],
    queryFn: api.barometer.list,
    enabled: isTeacher,
    staleTime: 15_000,
  });

  function loadIntoForm(s: BarometerSessionOut) {
    setEditingCode(s.code);
    setTitle(s.title);
    setShared(s.shared);
    setMode(s.mode);
    setAnonymous(s.anonymous ?? false);
    setGuestMinutes(s.guest_minutes ?? null);
    setItems(questionsToDrafts(s.questions));
    setShowCreate(true);
  }

  // Deep-link from the host page's "Bearbeiten" button: /tools/barometer?edit=CODE
  useEffect(() => {
    if (!isTeacher) return;
    const editCode = new URLSearchParams(window.location.search).get("edit");
    if (editCode) {
      api.barometer.get(editCode).then(loadIntoForm).catch(() => toast("Umfrage nicht gefunden", "error"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  function resetForm() {
    setEditingCode(null);
    setTitle("");
    setShared(false);
    setMode("live");
    setAnonymous(false);
    setGuestMinutes(null);
    setItems([blankQuestion()]);
    setShowCreate(false);
  }

  const questionBody = () => draftsToQuestions(items);

  const hasInvalidOptions = items.some(it => {
    if (it.type === "question" && (it.kind === "choice" || it.kind === "multi") && it.text.trim()) {
      return it.options.map(o => o.trim()).filter(Boolean).length < 2;
    }
    return false;
  });
  const hasTooManySmileySteps = items.some(it => {
    const steps = it.scale_max - it.scale_min + 1;
    return it.scale_style !== "zahlen" && steps > MAX_SMILEY_STEPS;
  });

  const createMut = useMutation({
    mutationFn: () => editingCode
      ? api.barometer.update(editingCode, { title: title.trim(), shared, mode, anonymous, guest_minutes: guestMinutes, questions: questionBody() })
      : api.barometer.create({ title: title.trim(), shared, mode, anonymous, guest_minutes: guestMinutes, questions: questionBody() }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["barometer"] });
      resetForm();
      router.push(`/tools/barometer/host/${s.code}`);
    },
    onError: (e: unknown) => setUploadError(parseUploadError(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => api.barometer.delete(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["barometer"] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  async function handleTemplate() {
    const tpl = await api.barometer.template();
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "umfrage-vorlage.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const created = await api.barometer.upload(file);
      qc.invalidateQueries({ queryKey: ["barometer"] });
      router.push(`/tools/barometer/host/${created.code}`);
    } catch (err: unknown) {
      setUploadError(parseUploadError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addQuestion() { setItems(its => [...its, blankQuestion()]); }
  function addBlock() { setItems(its => [...its, blankBlock()]); }
  function removeItem(i: number) { setItems(its => its.filter((_, j) => j !== i)); }
  function updateItem(i: number, patch: Partial<DraftItem>) {
    setItems(its => its.map((it, j) => j === i ? ({ ...it, ...patch } as DraftItem) : it));
  }

  if (!isTeacher) {
    return <div className="p-8 text-muted">Nur für Lehrkräfte.</div>;
  }

  return (
    <div className="max-w-seite mx-auto w-full px-6 py-8 flex flex-col gap-6">
      <button onClick={() => router.push("/tools")} className="self-start text-sm text-muted hover:text-fg transition-colors">
        ← Tools
      </button>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-black tracking-tight">🧭 Umfrage</h1>
        {can("barometer", "host") && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleTemplate}
              className="text-sm border border-line rounded-lg px-3 py-2 hover:border-accent">
              📄 Vorlage
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="text-sm border border-line rounded-lg px-3 py-2 hover:border-accent disabled:opacity-40">
              {uploading ? "Lade hoch…" : "⬆️ Hochladen"}
            </button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
            <button onClick={() => showCreate ? resetForm() : setShowCreate(true)}
              className="btn-primary shrink-0 text-sm px-5 py-2">
              + Neue Umfrage
            </button>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="card p-5 flex flex-col gap-4">
          <div className="font-semibold text-sm">{editingCode ? "Umfrage bearbeiten" : "Neue Umfrage erstellen"}</div>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titel der Umfrage"
            className="input text-sm py-2"
          />

          <div className="flex gap-2">
            <button type="button" aria-pressed={mode === "live"} onClick={() => setMode("live")}
              className={`flex-1 text-xs rounded-lg px-3 py-2 border transition-colors ${mode === "live" ? "border-accent bg-accent/10 text-accent" : "border-line text-muted"}`}>
              Live – Frage für Frage
            </button>
            <button type="button" aria-pressed={mode === "self"} onClick={() => setMode("self")}
              className={`flex-1 text-xs rounded-lg px-3 py-2 border transition-colors ${mode === "self" ? "border-accent bg-accent/10 text-accent" : "border-line text-muted"}`}>
              Selbst ausfüllen – alle Fragen auf einer Seite
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {items.map((item, i) => item.type === "question" ? (
              <QuestionDraftCard key={item.uid} item={item} index={i} items={items}
                onChange={patch => updateItem(i, patch)} onRemove={() => removeItem(i)} canRemove={items.length > 1} />
            ) : (
              <BlockDraftCard key={item.uid} item={item} index={i} items={items}
                onChange={patch => updateItem(i, patch)} onRemove={() => removeItem(i)} canRemove={items.length > 1} />
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={addQuestion}
              className="flex-1 text-sm text-muted hover:text-fg border border-dashed border-line rounded-xl py-2 transition-colors">
              + Frage hinzufügen
            </button>
            <button onClick={addBlock}
              className="flex-1 text-sm text-muted hover:text-fg border border-dashed border-line rounded-xl py-2 transition-colors">
              + Aussagen-Block
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />
            Öffentlich — für alle Kolleg:innen im Tool-Pool sichtbar
          </label>

          <UmfrageEinstellungen key={editingCode ?? "neu"}
            anonymous={anonymous} onAnonymous={setAnonymous}
            guestMinutes={guestMinutes} onGuestMinutes={setGuestMinutes} />

          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={!title.trim() || questionBody().length === 0 || hasInvalidOptions || hasTooManySmileySteps || !gastMinutenGueltig(guestMinutes) || createMut.isPending}
              className="btn-primary text-sm py-1.5 px-4"
            >
              {createMut.isPending ? "…" : editingCode ? "Speichern" : "Starten"}
            </button>
            <button onClick={resetForm} className="btn-secondary text-sm py-1.5 px-4">Abbrechen</button>
          </div>
        </div>
      )}

      {isLoading && <div className="text-muted text-sm">Laden…</div>}

      {!isLoading && sessions.length === 0 && !showCreate && (
        <div className="text-center text-muted text-sm mt-8">
          Noch keine Umfragen. Erstelle deine erste!
        </div>
      )}

      <div className="flex flex-col gap-2">
        {sessions.map(s => (
          <div key={s.id} className="bg-surface border border-line rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm flex items-center gap-2">
                {s.title}
                {s.shared && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-accent/20 text-accent rounded-full px-2 py-0.5">
                    Öffentlich
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">
                {s.question_count} Frage{s.question_count !== 1 ? "n" : ""} ·{" "}
                {s.status === "closed" ? "Abgeschlossen" : "Aktiv"} ·{" "}
                {new Date(s.created_at).toLocaleDateString("de-DE")} · {s.created_by_name}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => router.push(`/tools/barometer/host/${s.code}`)}
                className="btn-primary shrink-0 w-auto py-1 px-3 text-xs">Öffnen</button>
              {(s.created_by === auth?.teacher?.id || auth?.role === "admin") && (
                <>
                  <button onClick={() => api.barometer.get(s.code).then(loadIntoForm)}
                    className="shrink-0 w-auto border border-line text-muted hover:text-fg hover:border-accent rounded-lg px-2 py-1 text-xs transition-colors">✏️</button>
                  <button onClick={() => deleteMut.mutate(s.code)}
                    className="shrink-0 w-auto text-red-400 hover:text-red-300 border border-red-400/40 rounded-lg px-2 py-1 text-xs transition-colors">🗑</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <UploadErrorDialog error={uploadError} onClose={() => setUploadError(null)} />
    </div>
  );
}
