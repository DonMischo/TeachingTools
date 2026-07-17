"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, PracticeTopicOut, PracticeTaskOut, PracticeAnswerOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { MathText } from "@/components/MathText";
import { TimelineGameBoard, timelineAnswerComplete } from "@/components/timeline/TimelineGameBoard";
import { TimelineAnswer, TimelineSolution } from "@/components/timeline/types";

function DifficultyStars({ level }: { level: number }) {
  return (
    <span className="text-sm" title={`Schwierigkeit ${level}/5`}>
      {"★".repeat(level)}{"☆".repeat(5 - level)}
    </span>
  );
}

function PracticePanel({ topic }: { topic: PracticeTopicOut }) {
  const qc = useQueryClient();
  const [task, setTask] = useState<PracticeTaskOut | null>(null);
  const [answer, setAnswer] = useState("");
  const [tlAnswer, setTlAnswer] = useState<TimelineAnswer>({});
  const [result, setResult] = useState<PracticeAnswerOut | null>(null);
  const [showHint, setShowHint] = useState(false);

  const newTaskMut = useMutation({
    mutationFn: () => api.practice.newTask(topic.id),
    onSuccess: (t) => {
      setTask(t);
      setAnswer("");
      setTlAnswer({});
      setResult(null);
      setShowHint(false);
    },
  });
  // Board tasks submit the placed value as the answer string; the server
  // checks it against the accept list exactly like a typed answer.
  const boardAnswer = () => {
    const placed = Object.values(tlAnswer.placements ?? {})[0];
    return placed != null ? String(placed).replace(".", ",") : "";
  };
  const answerMut = useMutation({
    mutationFn: () => api.practice.answer(task!.task_id, task?.board ? boardAnswer() : answer.trim()),
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: ["practice-topics"] });
    },
  });

  // After the check, show the correct spot on the board (green marker).
  const boardSolution: TimelineSolution | null = (task?.board && result) ? {
    mode: "sort",
    axis: task.board.axis,
    scoring: "position",
    tolerance: task.board.axis.step ?? null,
    items: task.board.items.map(it => ({
      id: it.id, label: it.label, misplaced: false,
      value: result.solution != null
        ? Number(String(result.solution).replace(",", "."))
        : Object.values(tlAnswer.placements ?? {})[0] ?? 0,
    })),
  } : null;

  const progress = result?.progress ?? task?.progress ?? topic.progress;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold">{topic.label}</h2>
        {progress && (
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <DifficultyStars level={progress.difficulty} />
            <span>{progress.tasks_done} Aufgaben · {progress.tasks_correct} richtig</span>
          </div>
        )}
      </div>

      {!task ? (
        <button onClick={() => newTaskMut.mutate()} disabled={newTaskMut.isPending}
          className="btn-primary text-sm py-2 px-4 self-start disabled:opacity-40">
          ▶ Aufgabe holen
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <MathText text={task.question} blockEquations className="text-base" />
          {task.image_svg && (
            // Trusted server-generated SVG (api/task_generators.py), not user content.
            <div className="self-center max-w-full [&_svg]:max-w-full [&_svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: task.image_svg }} />
          )}

          {task.board && (
            <TimelineGameBoard
              board={task.board}
              answer={tlAnswer}
              onChange={setTlAnswer}
              disabled={!!result || answerMut.isPending}
              solution={boardSolution}
              itemResults={result ? { [task.board.items[0]?.id ?? "zahl"]: result.correct } : null}
            />
          )}

          {!result ? (
            <>
              <div className="flex flex-col gap-2">
                {!task.board ? (
                  <input className="input text-sm py-2 w-full" value={answer} autoFocus
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && answer.trim()) answerMut.mutate(); }}
                    placeholder="Deine Antwort…" />
                ) : null}
                <button onClick={() => answerMut.mutate()}
                  disabled={(task.board ? !timelineAnswerComplete(task.board, tlAnswer) : !answer.trim()) || answerMut.isPending}
                  className="btn-primary text-sm py-2 px-4 self-start disabled:opacity-40">
                  Prüfen
                </button>
              </div>
              {task.hint && !showHint && (
                <button onClick={() => setShowHint(true)} className="text-xs text-[var(--accent)] hover:underline self-start">
                  💡 Hinweis anzeigen
                </button>
              )}
              {showHint && task.hint && (
                <p className="text-xs text-[var(--text-muted)] italic"><MathText text={`💡 ${task.hint}`} /></p>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {result.correct ? (
                <p className="text-sm text-green-500">✔ Richtig!{result.leveled === "up" && " Schwierigkeit erhöht — stark!"}</p>
              ) : (
                <p className="text-sm text-red-400">
                  ✘ Leider falsch. Lösung: <span className="font-mono">{result.solution}</span>
                  {result.leveled === "down" && " — die nächsten Aufgaben werden etwas leichter."}
                </p>
              )}
              <button onClick={() => newTaskMut.mutate()} disabled={newTaskMut.isPending}
                className="btn-primary text-sm py-2 px-4 self-start disabled:opacity-40">
                Nächste Aufgabe →
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function UebungPage() {
  const { auth } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: topics = [], isLoading } = useQuery<PracticeTopicOut[]>({
    queryKey: ["practice-topics"], queryFn: api.practice.topics, enabled: !!auth,
  });

  if (!auth) return <div className="p-8 text-sm text-[var(--text-muted)]">Bitte einloggen.</div>;

  const selectedTopic = topics.find(t => t.id === selected);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">📚 Übung</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Aufgaben zum Trainieren — die Schwierigkeit passt sich deinem Können an.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Lade…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {topics.map(t => (
            <button key={t.id} onClick={() => setSelected(prev => prev === t.id ? null : t.id)}
              className={`text-left rounded-2xl border p-4 transition-colors ${
                selected === t.id ? "border-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)]"
              } bg-[var(--surface)]`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-sm">{t.label}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {t.subject}
                  {t.grades.length > 0 && ` · Kl. ${t.grades.length > 1 ? `${t.grades[0]}–${t.grades[t.grades.length - 1]}` : t.grades[0]}`}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t.description}</p>
              {t.progress && (
                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                  <DifficultyStars level={t.progress.difficulty} /> · {t.progress.tasks_done} Aufgaben gemacht
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedTopic && <PracticePanel key={selectedTopic.id} topic={selectedTopic} />}
    </div>
  );
}
