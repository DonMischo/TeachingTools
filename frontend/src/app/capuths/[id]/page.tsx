"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SessionsDrawer } from "./SessionsDrawer";

export default function CaputhDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const quizId = Number(id);
  const queryClient = useQueryClient();

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["caputh", quizId],
    queryFn: () => api.capuths.get(quizId),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: api.classes.list,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["caputh-sessions", quizId],
    queryFn: () => api.capuths.listSessions(quizId),
    refetchInterval: 15_000,
  });

  const [classId, setClassId] = useState<number | "">("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);

  async function handleReset(code: string) {
    if (!confirm(`Session ${code} zurücksetzen? Alle Antworten werden gelöscht.`)) return;
    try {
      await api.capuths.resetSession(code);
      queryClient.invalidateQueries({ queryKey: ["caputh-sessions", quizId] });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Reset fehlgeschlagen");
    }
  }

  async function handleStart() {
    if (!classId || !quiz) return;
    setStarting(true);
    setError(null);
    try {
      const session = await api.capuths.createSession(quizId, Number(classId), quiz.max_points);
      router.push(`/capuths/host/${session.join_code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Starten");
      setStarting(false);
    }
  }

  if (isLoading) return <p className="p-6 text-[var(--text-muted)]">Wird geladen…</p>;
  if (!quiz) return <p className="p-6 text-red-500">Caputh nicht gefunden.</p>;

  // Sort: active/waiting first, then finished newest-first
  const sortedSessions = [...sessions].sort((a, b) => {
    const rank = (s: typeof a) => s.status === "active" ? 0 : s.status === "waiting" ? 1 : 2;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return (b.finished_at ?? b.started_at ?? "") > (a.finished_at ?? a.started_at ?? "") ? 1 : -1;
  });

  return (
    <div className="relative flex h-full min-h-0">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="text-sm text-[var(--text-muted)] hover:text-white">
            ← Zurück
          </button>
          <button
            onClick={() => setSessionsOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--text-muted)] transition-colors"
          >
            <span>Sessions</span>
            {sessions.length > 0 && (
              <span className="bg-[var(--accent)] text-black font-bold text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {sessions.length}
              </span>
            )}
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-1">{quiz.title}</h1>
        {quiz.description && <p className="text-[var(--text-muted)] mb-4">{quiz.description}</p>}
        <p className="text-sm text-[var(--text-muted)] mb-6">
          {quiz.question_count} Fragen · Standard-Zeit {quiz.time_limit_default}s
        </p>

        {/* Question list */}
        <div className="mb-8 space-y-2">
          {quiz.questions.map((q, i) => (
            <div key={q.id} className="flex items-start gap-3 p-3 border border-[var(--border)] bg-[var(--surface)] rounded">
              <span className="text-xs font-mono bg-[var(--bg)] px-1.5 py-0.5 rounded mt-0.5 text-[var(--text-muted)]">
                {q.type}
              </span>
              <span className="text-sm">{i + 1}. {q.question_text}</span>
            </div>
          ))}
        </div>

        {/* Start session */}
        <div className="border-t border-[var(--border)] pt-6 space-y-4">
          <h2 className="font-semibold">Neue Session</h2>
          <div>
            <label className="label">Klasse</label>
            <select
              className="input"
              value={classId}
              onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Klasse wählen…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name} ({c.code})</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            disabled={!classId || starting}
            onClick={handleStart}
            className="btn-primary disabled:opacity-40"
          >
            {starting ? "Starte…" : "Session erstellen & Raum öffnen"}
          </button>
        </div>
      </div>

      <SessionsDrawer
        open={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        sessions={sortedSessions}
        classes={classes}
        onReset={handleReset}
        onOpen={(code) => router.push(`/capuths/host/${code}`)}
      />
    </div>
  );
}
