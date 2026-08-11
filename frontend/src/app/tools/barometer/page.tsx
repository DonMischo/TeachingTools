"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, BarometerSessionSummary, BarometerSessionOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useAvailability } from "@/hooks/useAvailability";

type QuestionDraft = { text: string; scale_min: number; scale_max: number; scale_min_label: string; scale_max_label: string };

const BLANK_Q = (): QuestionDraft => ({ text: "", scale_min: 1, scale_max: 6, scale_min_label: "sehr gut", scale_max_label: "schlecht" });

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
  const [questions, setQuestions] = useState<QuestionDraft[]>([BLANK_Q()]);

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
    setQuestions(s.questions.map(q => ({
      text: q.text, scale_min: q.scale_min, scale_max: q.scale_max,
      scale_min_label: q.scale_min_label ?? "", scale_max_label: q.scale_max_label ?? "",
    })));
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
    setQuestions([BLANK_Q()]);
    setShowCreate(false);
  }

  const questionBody = () => questions.filter(q => q.text.trim()).map(q => ({
    text: q.text.trim(),
    scale_min: q.scale_min,
    scale_max: q.scale_max,
    scale_min_label: q.scale_min_label || undefined,
    scale_max_label: q.scale_max_label || undefined,
  }));

  const createMut = useMutation({
    mutationFn: () => editingCode
      ? api.barometer.update(editingCode, { title: title.trim(), shared, questions: questionBody() })
      : api.barometer.create({ title: title.trim(), shared, questions: questionBody() }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["barometer"] });
      resetForm();
      router.push(`/tools/barometer/host/${s.code}`);
    },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => api.barometer.delete(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["barometer"] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  function addQuestion() { setQuestions(qs => [...qs, BLANK_Q()]); }
  function removeQuestion(i: number) { setQuestions(qs => qs.filter((_, j) => j !== i)); }
  function updateQuestion(i: number, patch: Partial<QuestionDraft>) {
    setQuestions(qs => qs.map((q, j) => j === i ? { ...q, ...patch } : q));
  }

  if (!isTeacher) {
    return <div className="p-8 text-[var(--text-muted)]">Nur für Lehrkräfte.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
      <button onClick={() => router.push("/tools")} className="self-start text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
        ← Tools
      </button>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-black tracking-tight">🧭 Meinungsbarometer</h1>
        {can("barometer", "host") && (
          <button onClick={() => showCreate ? resetForm() : setShowCreate(true)}
            className="shrink-0 text-sm px-5 py-2 bg-[var(--accent)] text-[var(--accent-text,#111)] font-semibold rounded-lg hover:opacity-90 transition-opacity">
            + Neue Umfrage
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-4">
          <div className="font-semibold text-sm">{editingCode ? "Umfrage bearbeiten" : "Neue Umfrage erstellen"}</div>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titel der Umfrage"
            className="input text-sm py-2"
          />

          <div className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <div key={i} className="border border-[var(--border)] rounded-xl p-3 flex flex-col gap-2 bg-[var(--bg)]">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] w-5 shrink-0">{i + 1}.</span>
                  <input
                    value={q.text}
                    onChange={e => updateQuestion(i, { text: e.target.value })}
                    placeholder="Frage…"
                    className="input text-sm py-1.5 flex-1"
                  />
                  {questions.length > 1 && (
                    <button onClick={() => removeQuestion(i)}
                      className="text-[var(--text-muted)] hover:text-red-400 text-sm px-1">✕</button>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap ml-7">
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    Skala
                    <input type="number" min={1} max={5} value={q.scale_min}
                      onChange={e => updateQuestion(i, { scale_min: Number(e.target.value) })}
                      className="input w-12 text-xs py-0.5 px-1" />
                    –
                    <input type="number" min={2} max={10} value={q.scale_max}
                      onChange={e => updateQuestion(i, { scale_max: Number(e.target.value) })}
                      className="input w-12 text-xs py-0.5 px-1" />
                  </div>
                  <input value={q.scale_min_label} onChange={e => updateQuestion(i, { scale_min_label: e.target.value })}
                    placeholder={`Beschriftung ${q.scale_min}`} className="input text-xs py-0.5 px-2 w-28" />
                  <input value={q.scale_max_label} onChange={e => updateQuestion(i, { scale_max_label: e.target.value })}
                    placeholder={`Beschriftung ${q.scale_max}`} className="input text-xs py-0.5 px-2 w-28" />
                </div>
              </div>
            ))}
          </div>

          <button onClick={addQuestion}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] border border-dashed border-[var(--border)] rounded-xl py-2 transition-colors">
            + Frage hinzufügen
          </button>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />
            Öffentlich — für alle Kolleg:innen im Tool-Pool sichtbar
          </label>

          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={!title.trim() || !questions.some(q => q.text.trim()) || createMut.isPending}
              className="btn-primary text-sm py-1.5 px-4 disabled:opacity-40"
            >
              {createMut.isPending ? "…" : editingCode ? "Speichern" : "Starten"}
            </button>
            <button onClick={resetForm} className="btn-secondary text-sm py-1.5 px-4">Abbrechen</button>
          </div>
        </div>
      )}

      {isLoading && <div className="text-[var(--text-muted)] text-sm">Laden…</div>}

      {!isLoading && sessions.length === 0 && !showCreate && (
        <div className="text-center text-[var(--text-muted)] text-sm mt-8">
          Noch keine Umfragen. Erstelle deine erste!
        </div>
      )}

      <div className="flex flex-col gap-2">
        {sessions.map(s => (
          <div key={s.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm flex items-center gap-2">
                {s.title}
                {s.shared && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-[var(--accent)]/20 text-[var(--accent)] rounded-full px-2 py-0.5">
                    Öffentlich
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {s.question_count} Frage{s.question_count !== 1 ? "n" : ""} ·{" "}
                {s.status === "closed" ? "Abgeschlossen" : "Aktiv"} ·{" "}
                {new Date(s.created_at).toLocaleDateString("de-DE")} · {s.created_by_name}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => router.push(`/tools/barometer/host/${s.code}`)}
                className="shrink-0 w-auto rounded-lg bg-[var(--accent)] text-black font-semibold py-1 px-3 text-xs hover:opacity-90 transition-opacity">Öffnen</button>
              {(s.created_by === auth?.teacher?.id || auth?.role === "admin") && (
                <>
                  <button onClick={() => api.barometer.get(s.code).then(loadIntoForm)}
                    className="shrink-0 w-auto border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)] rounded-lg px-2 py-1 text-xs transition-colors">✏️</button>
                  <button onClick={() => deleteMut.mutate(s.code)}
                    className="shrink-0 w-auto text-red-400 hover:text-red-300 border border-red-400/40 rounded-lg px-2 py-1 text-xs transition-colors">✕</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
