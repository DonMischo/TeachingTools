"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, BarometerSessionSummary, BarometerQuestionIn } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

type QuestionDraft = { text: string; scale_min: number; scale_max: number; scale_min_label: string; scale_max_label: string };

const BLANK_Q = (): QuestionDraft => ({ text: "", scale_min: 1, scale_max: 6, scale_min_label: "", scale_max_label: "" });

export default function BarometerPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const isTeacher = auth?.role === "teacher" || auth?.role === "admin";

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([BLANK_Q()]);

  const { data: sessions = [], isLoading } = useQuery<BarometerSessionSummary[]>({
    queryKey: ["barometer"],
    queryFn: api.barometer.list,
    enabled: isTeacher,
    staleTime: 15_000,
  });

  const createMut = useMutation({
    mutationFn: () => api.barometer.create({
      title: title.trim(),
      questions: questions.filter(q => q.text.trim()).map(q => ({
        text: q.text.trim(),
        scale_min: q.scale_min,
        scale_max: q.scale_max,
        scale_min_label: q.scale_min_label || undefined,
        scale_max_label: q.scale_max_label || undefined,
      })),
    }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["barometer"] });
      router.push(`/barometer/host/${s.code}`);
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
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">📊 Meinungsbarometer</h1>
        <button onClick={() => setShowCreate(v => !v)} className="btn-primary text-sm py-1.5 px-4">
          + Neue Umfrage
        </button>
      </div>

      {showCreate && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-4">
          <div className="font-semibold text-sm">Neue Umfrage erstellen</div>

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

          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={!title.trim() || !questions.some(q => q.text.trim()) || createMut.isPending}
              className="btn-primary text-sm py-1.5 px-4 disabled:opacity-40"
            >
              {createMut.isPending ? "…" : "Starten"}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm py-1.5 px-4">Abbrechen</button>
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
              <div className="font-semibold text-sm">{s.title}</div>
              <div className="text-xs text-[var(--text-muted)]">
                {s.question_count} Frage{s.question_count !== 1 ? "n" : ""} ·{" "}
                {s.status === "closed" ? "Abgeschlossen" : "Aktiv"} ·{" "}
                {new Date(s.created_at).toLocaleDateString("de-DE")}
              </div>
            </div>
            <button onClick={() => router.push(`/barometer/host/${s.code}`)}
              className="btn-primary text-xs py-1 px-3">Öffnen</button>
            <button onClick={() => deleteMut.mutate(s.code)}
              className="text-red-400 hover:text-red-300 border border-red-400/40 rounded-lg px-2 py-1 text-xs transition-colors">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
