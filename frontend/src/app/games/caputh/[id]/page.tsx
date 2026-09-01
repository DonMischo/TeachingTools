"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Scope, ScopeSelect, scopeBody } from "@/components/ScopeSelect";
import { useAuth } from "@/contexts/AuthContext";

export default function CaputhDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { auth } = useAuth();
  const quizId = Number(id);

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["caputh", quizId],
    queryFn: () => api.capuths.get(quizId),
  });

  const [scope, setScope] = useState<Scope>(null);
  const [teamMode, setTeamMode] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!scope || !quiz) return;
    setStarting(true);
    setError(null);
    try {
      const session = await api.capuths.createSession(quizId, scopeBody(scope), quiz.max_points, teamMode);
      router.push(`/games/caputh/host/${session.join_code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Starten");
      setStarting(false);
    }
  }

  if (auth?.role !== "teacher" && auth?.role !== "admin") {
    return <div className="p-8 text-[var(--text-muted)]">Nur für Lehrkräfte.</div>;
  }
  if (isLoading) return <p className="p-6 text-[var(--text-muted)]">Wird geladen…</p>;
  if (!quiz) return <p className="p-6 text-red-500">Caputh nicht gefunden.</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <Link href="/games/caputh" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
        ← Caputh-Bibliothek
      </Link>

      <h1 className="text-2xl font-bold mb-1 mt-2">{quiz.title}</h1>
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
          <label className="label">Klasse oder Kurs/WPF</label>
          <ScopeSelect value={scope} onChange={setScope} />
          {scope?.kind === "group" && (
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Klassenübergreifend: jede beteiligte Klasse bekommt Punkte nach ihrer eigenen
              Trefferquote.
            </p>
          )}
        </div>
        <label className="flex items-center gap-3 cursor-pointer text-sm">
          <div
            onClick={() => setTeamMode(v => !v)}
            className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${teamMode ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${teamMode ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          Team-Modus (Schüler wählen ein Team beim Beitreten)
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          disabled={!scope || starting}
          onClick={handleStart}
          className="btn-primary disabled:opacity-40"
        >
          {starting ? "Starte…" : "Session erstellen & Raum öffnen"}
        </button>
      </div>
    </div>
  );
}
