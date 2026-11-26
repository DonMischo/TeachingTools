"use client";
/**
 * Übung — Aufgaben zum Trainieren, im eigenen Tempo.
 *
 * Die Aufgaben würfelt der Server (api/task_generators.py) und prüft sie auch
 * dort: der Browser bekommt nur die Frage zu sehen, nie die Lösung. Die
 * Schwierigkeit steigt nach drei richtigen in Folge und fällt nach zwei
 * falschen — das Werkzeug sucht sich also selbst die Stufe, auf der es gerade
 * passt.
 *
 * Als Simulation statt als eigene Seite, damit derselbe QR-Beitritt gilt wie
 * bei den anderen Werkzeugen: Gäste ohne Konto üben mit dem Sitzungscode und
 * ihrem Gast-Token (`zugang`), Angemeldete ohne beides.
 */
import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PracticeTopicOut, type PracticeTaskOut, type PracticeAnswerOut, type PracticeZugang } from "@/lib/api";
import { MathText } from "@/components/MathText";
import { TimelineGameBoard, timelineAnswerComplete } from "@/components/timeline/TimelineGameBoard";
import { TimelineAnswer, TimelineSolution } from "@/components/timeline/types";
import { SimKopf } from "@/components/SimKopf";

function DifficultyStars({ level }: { level: number }) {
  return (
    <span className="text-sm" title={`Schwierigkeit ${level}/5`}>
      {"★".repeat(level)}{"☆".repeat(5 - level)}
    </span>
  );
}

/** Der Zählerstand zum gewählten Thema — er kommt vom Server, nicht aus dem Tab. */
function Fortschritt({ p }: { p: { difficulty: number; tasks_done: number; tasks_correct: number } }) {
  const quote = p.tasks_done ? Math.round((p.tasks_correct / p.tasks_done) * 100) : 0;
  return (
    <div aria-label="Fortschritt" className="flex flex-wrap items-center gap-3 text-sm">
      <DifficultyStars level={p.difficulty} />
      <span className="font-bold">{p.tasks_correct} von {p.tasks_done} richtig</span>
      {p.tasks_done > 0 && (
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className="w-24 h-1.5 rounded-full bg-surface-hover overflow-hidden">
            <span className="block h-full bg-accent" style={{ width: `${quote}%` }} />
          </span>
          {quote}%
        </span>
      )}
    </div>
  );
}

function PracticePanel({ topic, zugang }: { topic: PracticeTopicOut; zugang?: PracticeZugang }) {
  const qc = useQueryClient();
  const [task, setTask] = useState<PracticeTaskOut | null>(null);
  const [answer, setAnswer] = useState("");
  const [tlAnswer, setTlAnswer] = useState<TimelineAnswer>({});
  const [result, setResult] = useState<PracticeAnswerOut | null>(null);
  const [showHint, setShowHint] = useState(false);

  const newTaskMut = useMutation({
    mutationFn: () => api.practice.newTask(topic.id, zugang),
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
    mutationFn: () => api.practice.answer(task!.task_id, task?.board ? boardAnswer() : answer.trim(), zugang),
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
    <section className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold">{topic.label}</h2>
        {progress && <Fortschritt p={progress} />}
      </div>
      <p className="text-xs text-muted">{topic.description}</p>

      {!task ? (
        <button onClick={() => newTaskMut.mutate()} disabled={newTaskMut.isPending}
          className="btn-primary text-sm py-2 px-4 self-start">
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
                  className="btn-primary text-sm py-2 px-4 self-start">
                  Prüfen
                </button>
              </div>
              {task.hint && !showHint && (
                <button onClick={() => setShowHint(true)} className="text-xs text-accent hover:underline self-start">
                  💡 Hinweis anzeigen
                </button>
              )}
              {showHint && task.hint && (
                <p className="text-xs text-muted italic"><MathText text={`💡 ${task.hint}`} /></p>
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
                className="btn-primary text-sm py-2 px-4 self-start">
                Nächste Aufgabe →
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Die Themen nach Fach gebündelt — die Liste ist lang, das Fach ordnet sie. */
function nachFach(topics: PracticeTopicOut[]): [string, PracticeTopicOut[]][] {
  const map = new Map<string, PracticeTopicOut[]>();
  for (const t of topics) {
    const fach = t.subject || "Sonstiges";
    if (!map.has(fach)) map.set(fach, []);
    map.get(fach)!.push(t);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "de"));
}

export default function Uebung({ action, zugang }: {
  action?: ReactNode;
  /** Gesetzt, wenn ein Gast über den QR hereingekommen ist. */
  zugang?: PracticeZugang;
}) {
  const [selected, setSelected] = useState("");

  const { data: topics = [], isLoading, isError } = useQuery<PracticeTopicOut[]>({
    queryKey: ["practice-topics", zugang?.code ?? "ich"],
    queryFn: () => api.practice.topics(zugang),
  });

  const selectedTopic = topics.find(t => t.id === selected);

  return (
    <div className="flex flex-col gap-5 p-6 max-w-seite mx-auto w-full">
      <SimKopf titel="📚 Übung" action={action}>
        Aufgaben zum Trainieren — die Schwierigkeit passt sich deinem Können an.
      </SimKopf>

      {isError ? (
        <p className="text-sm text-muted">
          Die Themen ließen sich nicht laden. Melde dich an oder tritt über den Code deiner Lehrkraft bei.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="uebung-thema" className="text-xs font-bold text-muted uppercase tracking-wide">
            Thema
          </label>
          <select
            id="uebung-thema"
            value={selected}
            disabled={isLoading}
            onChange={e => setSelected(e.target.value)}
            className="input text-sm py-2 min-w-[16rem] max-w-full"
          >
            <option value="">{isLoading ? "Lade …" : "Thema wählen …"}</option>
            {nachFach(topics).map(([fach, ts]) => (
              <optgroup key={fach} label={fach}>
                {ts.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                    {t.grades.length > 0 && ` · Kl. ${t.grades.length > 1
                      ? `${t.grades[0]}–${t.grades[t.grades.length - 1]}` : t.grades[0]}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {selectedTopic
        ? <PracticePanel key={selectedTopic.id} topic={selectedTopic} zugang={zugang} />
        : !isLoading && !isError && (
            <p className="text-sm text-muted">
              Wähle oben ein Thema — darunter erscheinen die Aufgaben und dein Zählerstand.
            </p>
          )}
    </div>
  );
}
