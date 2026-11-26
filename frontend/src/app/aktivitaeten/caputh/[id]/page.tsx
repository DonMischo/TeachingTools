"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type Scope, scopeBody } from "@/components/ScopeSelect";
import { CaputhSitzungen } from "@/components/caputh/CaputhSitzungen";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { VorlagenEditor } from "@/components/vorlagen/VorlagenEditor";
import { CaputhForm, type CaputhJson } from "@/components/vorlagen/CaputhForm";

export default function CaputhDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { auth } = useAuth();
  const quizId = Number(id);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["caputh", quizId],
    queryFn: () => api.capuths.get(quizId),
  });

  const [teamMode, setTeamMode] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart(scope: Scope) {
    if (!scope || !quiz) return;
    setStarting(true);
    setError(null);
    try {
      const session = await api.capuths.createSession(quizId, scopeBody(scope), quiz.max_points, teamMode);
      router.push(`/aktivitaeten/caputh/host/${session.join_code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Starten");
      setStarting(false);
    }
  }

  if (auth?.role !== "teacher" && auth?.role !== "admin") {
    return <div className="p-8 text-muted">Nur für Lehrkräfte.</div>;
  }
  if (isLoading) return <p className="p-6 text-muted">Wird geladen…</p>;
  if (!quiz) return <p className="p-6 text-red-500">Caputh nicht gefunden.</p>;

  return (
    <div className="p-6 max-w-seite mx-auto w-full">
      <Link href="/aktivitaeten/caputh" className="text-sm text-muted hover:text-fg">
        ← Caputh-Bibliothek
      </Link>

      <h1 className="text-2xl font-bold mb-1 mt-2">{quiz.title}</h1>
      {quiz.description && <p className="text-muted mb-4">{quiz.description}</p>}
      <p className="text-sm text-muted mb-4">
        {quiz.question_count} Fragen · Standard-Zeit {quiz.time_limit_default}s
      </p>

      <div className="mb-6">
        <VorlagenEditor
          title="Caputh bearbeiten"
          load={() => api.capuths.exportJson(quizId) as Promise<CaputhJson>}
          render={(v, set) => <CaputhForm value={v} onChange={set} upload={file => api.capuths.uploadAsset(quizId, file)} />}
          save={data => api.capuths.update(quizId, data)}
          fileName={`caputh_${quizId}.json`}
          onSaved={r => {
            qc.invalidateQueries({ queryKey: ["caputh", quizId] });
            qc.invalidateQueries({ queryKey: ["capuths"] });
            toast(r.warning ?? "Gespeichert", r.warning ? "error" : "success");
          }}
        />
      </div>

      {/* Question list */}
      <div className="mb-8 space-y-2">
        {quiz.questions.map((q, i) => (
          <div key={q.id} className="flex items-start gap-3 p-3 border border-line bg-surface rounded-sm">
            <span className="text-xs font-mono bg-page px-1.5 py-0.5 rounded-sm mt-0.5 text-muted">
              {q.type}
            </span>
            <span className="text-sm">{i + 1}. {q.question_text}</span>
          </div>
        ))}
      </div>

      <CaputhSitzungen quizId={quizId} neu={{
        onStart: handleStart, laeuft: starting, label: "Sitzung erstellen & Raum öffnen",
        hinweis: sc => <>
          {sc?.kind === "group" && "Klassenübergreifend: jede beteiligte Klasse bekommt Punkte nach ihrer eigenen Trefferquote. "}
          {error && <span className="text-bad">{error}</span>}
        </>,
        extra: (
          <label className="flex items-center gap-2 cursor-pointer text-sm w-fit">
            <input type="checkbox" checked={teamMode} onChange={e => setTeamMode(e.target.checked)} />
            Team-Modus (Schüler wählen ein Team beim Beitreten)
          </label>
        ),
      }} />
    </div>
  );
}
