"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api, setActiveGuestToken, ExitGameData, ExitGameSlide, ExitGameStyle, ExitGameTask, ExitGameAttemptSummary,
  ExitGameFragment, ExitGameAnswer, DdaAdaptation,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestSession } from "@/hooks/useGuestSession";
import { GuestExpired } from "@/components/GuestExpired";
import { PlayerIdentityForm } from "@/components/PlayerIdentityForm";
import { MathText } from "@/components/MathText";
import { TimelineGameBoard, timelineAnswerComplete } from "@/components/timeline/TimelineGameBoard";
import { specToBoard } from "@/components/timeline/game";
import { TimelineAnswer } from "@/components/timeline/types";

// ── Theming ────────────────────────────────────────────────────────────────
// Presets override the app's standard CSS variables, scoped to the player
// container only. customVars win over the preset; style.font sets the family.

const THEME_PRESETS: Record<string, Record<string, string>> = {
  dark: {
    "--bg": "#0b0f14", "--surface": "#111827", "--surface-hover": "#1c2736",
    "--border": "#1f2937", "--text": "#e5e7eb", "--text-muted": "#94a3b8", "--accent": "#60a5fa",
  },
  christmas: {
    "--bg": "#0f2417", "--surface": "#14532d", "--surface-hover": "#1a6638",
    "--border": "#166534", "--text": "#fef9c3", "--text-muted": "#bbf7d0", "--accent": "#ef4444",
  },
  halloween: {
    "--bg": "#120a1a", "--surface": "#1e1030", "--surface-hover": "#2a1745",
    "--border": "#3b1d5e", "--text": "#fde68a", "--text-muted": "#c4b5fd", "--accent": "#f97316",
  },
  pirate: {
    "--bg": "#1a130b", "--surface": "#292018", "--surface-hover": "#352a1f",
    "--border": "#44362a", "--text": "#f5e9d0", "--text-muted": "#c9b896", "--accent": "#d4a017",
  },
  cyberpunk: {
    "--bg": "#0a0a12", "--surface": "#12121f", "--surface-hover": "#1b1b30",
    "--border": "#2a2a45", "--text": "#e0f2fe", "--text-muted": "#7dd3fc", "--accent": "#f0abfc",
  },
};

function styleVars(style?: ExitGameStyle): React.CSSProperties {
  if (!style) return {};
  const vars: Record<string, string> = {
    ...(style.theme ? THEME_PRESETS[style.theme] ?? {} : {}),
    ...(style.customVars ?? {}),
  };
  const css: React.CSSProperties = { ...vars } as React.CSSProperties;
  if (style.font) css.fontFamily = style.font;
  if (vars["--bg"]) css.background = "var(--bg)";
  // Inherited colour is resolved on <body>, so redefining --text here alone
  // would leave the app's own text colour on the themed background.
  if (vars["--text"]) css.color = "var(--text)";
  return css;
}

// ── DDA level ─────────────────────────────────────────────────────────────
// The server re-rates the student after every answer and hands back the level
// it picked from the game's authored `dda.levels`. Everything the level says —
// hint budget, Richtzeit, extra example, easier alternative — is applied here;
// the server independently enforces the budget and the easier-task offer.

type DdaLevel = Record<string, unknown>;

function levelOf(adaptation: DdaAdaptation | null): DdaLevel | null {
  return adaptation?.contentParams?.scaffolding_level ?? null;
}

function levelNumber(level: DdaLevel | null, key: string): number | null {
  const v = level?.[key];
  return typeof v === "number" ? v : null;
}

function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// Authors write the correct answer first, so an unshuffled list gives the
// task away. The server checks answers by text, never by index, so the player
// is free to reorder them.
function shuffledAnswers(task: ExitGameTask): ExitGameAnswer[] {
  const answers = [...(task.answers ?? [])];
  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }
  return answers;
}

function mergeVariant(task: ExitGameTask, variantIdx: number | undefined): ExitGameTask {
  if (!task.variants || variantIdx === undefined) return task;
  const { variants: _drop, ...base } = task;
  return { ...base, ...task.variants[variantIdx] } as ExitGameTask;
}

// ── Media ─────────────────────────────────────────────────────────────────

function toVideoEmbed(src: string): { kind: "iframe" | "video"; url: string } {
  const yt = src.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([\w-]+)/);
  if (yt) return { kind: "iframe", url: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = src.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: "iframe", url: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { kind: "video", url: src };
}

// A media src is either an absolute URL or the name of a file from the
// assets/ folder of the uploaded ZIP, which the API serves per game.
function mediaUrl(src: string, exitgameId: number): string {
  if (/^(https?:)?\/\//.test(src) || src.startsWith("/") || src.startsWith("data:")) return src;
  return `/uploads/exitgames/${exitgameId}/assets/${src}`;
}

function MediaView({ media, exitgameId }: {
  media: NonNullable<ExitGameSlide["media"]>; exitgameId: number;
}) {
  const height = media.height ?? 360;
  if (media.kind === "image") {
    // `height` caps images too — a pictogram should not fill the column.
    return <img src={mediaUrl(media.src, exitgameId)} alt={media.alt ?? ""}
      style={media.height ? { maxHeight: media.height } : undefined}
      className="max-w-full rounded-lg" />;
  }
  if (media.kind === "html") {
    return <iframe src={media.src} style={{ height, width: "100%", border: 0 }} className="rounded-lg" />;
  }
  const v = toVideoEmbed(media.src);
  if (v.kind === "iframe") {
    return <iframe src={v.url} style={{ height, width: "100%", border: 0 }} className="rounded-lg" allowFullScreen />;
  }
  return <video src={v.url} controls style={{ maxHeight: height, width: "100%" }} className="rounded-lg" />;
}

// ── Single task widget ───────────────────────────────────────────────────

function SingleTaskWidget({
  task, taskIndex, slideId, hints, attemptId, alreadySolved, level, extraExample, onSolved, onAttemptChange,
}: {
  task: ExitGameTask; taskIndex: number; slideId: string; hints: string[]; attemptId: number; alreadySolved: boolean;
  level: DdaLevel | null; extraExample?: string;
  onSolved: (attempt: ExitGameAttemptSummary, fragments: ExitGameFragment[]) => void;
  onAttemptChange: (attempts: number, hintsShown: number, adaptation: DdaAdaptation | null) => void;
}) {
  const [activeTask, setActiveTask] = useState(task);
  const [variant, setVariant] = useState<"normal" | "easier">("normal");
  const [selected, setSelected] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [inputValue, setInputValue] = useState("");
  const [timelineAnswer, setTimelineAnswer] = useState<TimelineAnswer>({});
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(alreadySolved ? "right" : null);
  const [attempts, setAttempts] = useState(0);
  const [hintsShown, setHintsShown] = useState(0);
  const [showEasierOffer, setShowEasierOffer] = useState(false);
  const [solved, setSolved] = useState(alreadySolved);
  // Reshuffled only when the task itself changes (easier alternative taken).
  const answerOptions = useMemo(() => shuffledAnswers(activeTask), [activeTask]);
  const hintBudget = levelNumber(level, "hintCount") ?? 2;
  const richtzeit = levelNumber(level, "timeLimitSeconds");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(richtzeit);

  // Richtzeit is a guide, never a deadline: nothing is lost when it runs out,
  // it just releases a hint early for students who are stuck but not guessing.
  useEffect(() => {
    if (richtzeit == null || solved) { setSecondsLeft(null); return; }
    setSecondsLeft(richtzeit);
    const t = setInterval(() => setSecondsLeft(s => (s == null ? null : Math.max(0, s - 1))), 1000);
    return () => clearInterval(t);
  }, [richtzeit, solved]);
  const timeUp = secondsLeft === 0;

  const answerMut = useMutation({
    mutationFn: (answer: unknown) =>
      api.exitgame.attempts.postEvent(attemptId, slideId, "answer", { task_index: taskIndex, answer, variant }),
    onSuccess: (res) => {
      if (res.correct) {
        setFeedback("right");
        setSolved(true);
        onSolved(res.attempt, res.code_fragments);
      } else {
        setFeedback("wrong");
        setAttempts(a => a + 1);
        onAttemptChange(attempts + 1, hintsShown, res.adaptation);
        const mayTakeEasier = levelOf(res.adaptation)?.offerEasier !== false;
        if (attempts + 1 >= 2 && hintsShown >= hintBudget && task.easierAlternative && mayTakeEasier) {
          setShowEasierOffer(true);
        }
      }
    },
  });

  const hintMut = useMutation({
    mutationFn: (hintIndex: number) => api.exitgame.attempts.postEvent(attemptId, slideId, "hint", { hint_index: hintIndex }),
    onSuccess: () => setHintsShown(h => h + 1),
  });

  const easierMut = useMutation({
    mutationFn: () => api.exitgame.attempts.postEvent(attemptId, slideId, "easier_taken", { task_index: taskIndex }),
    onSuccess: () => {
      setActiveTask(task.easierAlternative!);
      setVariant("easier");
      setShowEasierOffer(false);
      setFeedback(null);
      setAttempts(0);
      setSelected(null);
      setMultiSelected(new Set());
      setInputValue("");
      setTimelineAnswer({});
    },
  });

  if (solved) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-500 flex items-center gap-2 flex-wrap">
        <span>✔ Richtig gelöst!</span>
        {task.codeFragment && (
          <span>🔑 Codeschnipsel: <span className="font-mono font-bold">{task.codeFragment}</span></span>
        )}
      </div>
    );
  }

  function submitSingle(text: string) {
    setSelected(text);
    answerMut.mutate(text);
  }
  function submitMulti() {
    answerMut.mutate([...multiSelected]);
  }
  function submitInput() {
    if (!inputValue.trim()) return;
    answerMut.mutate(inputValue.trim());
  }

  return (
    <div className="rounded-xl border border-[var(--border)] p-3 flex flex-col gap-2">
      {activeTask.question && <MathText text={activeTask.question} blockEquations className="text-sm font-medium" />}

      {(activeTask.kind === "single" || activeTask.kind === "true_false") && (
        <div className="flex flex-wrap gap-2">
          {answerOptions.map(a => (
            <button key={a.text} onClick={() => submitSingle(a.text)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                selected === a.text && feedback === "wrong" ? "border-red-400 text-red-400" : "border-[var(--border)] hover:border-[var(--accent)]"
              }`}>
              <MathText text={a.text} />
            </button>
          ))}
        </div>
      )}

      {activeTask.kind === "multi" && (
        <div className="flex flex-col gap-1.5">
          {answerOptions.map(a => (
            <label key={a.text} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={multiSelected.has(a.text)}
                onChange={() => setMultiSelected(prev => {
                  const next = new Set(prev);
                  next.has(a.text) ? next.delete(a.text) : next.add(a.text);
                  return next;
                })} />
              <MathText text={a.text} />
            </label>
          ))}
          <button onClick={submitMulti} className="btn-primary text-sm py-1 px-3 self-start">Prüfen</button>
        </div>
      )}

      {activeTask.kind === "input" && (
        <div className="flex flex-col gap-2">
          <input className="input text-sm py-1.5 w-full" value={inputValue} autoFocus
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submitInput(); }}
            placeholder="Deine Antwort…" />
          <button onClick={submitInput} disabled={!inputValue.trim() || answerMut.isPending}
            className="btn-primary text-sm py-1.5 px-4 self-start disabled:opacity-40">Prüfen</button>
        </div>
      )}

      {activeTask.kind === "timeline" && activeTask.timeline && (
        <div className="flex flex-col gap-2">
          <TimelineGameBoard
            board={specToBoard(activeTask.timeline)}
            answer={timelineAnswer}
            onChange={setTimelineAnswer}
            disabled={answerMut.isPending}
          />
          <button
            onClick={() => answerMut.mutate(timelineAnswer)}
            disabled={answerMut.isPending || !timelineAnswerComplete(specToBoard(activeTask.timeline), timelineAnswer)}
            className="btn-primary text-sm py-1.5 px-4 self-start disabled:opacity-40">
            Prüfen
          </button>
        </div>
      )}

      {feedback === "wrong" && <p className="text-xs text-red-400">Nicht ganz — versuch's nochmal.</p>}

      {secondsLeft != null && (
        <p className="text-xs text-[var(--text-muted)]">
          {timeUp ? "⏱ Richtzeit vorbei — lass dir Zeit, ein Hinweis ist frei." : `⏱ Richtzeit ${mmss(secondsLeft)}`}
        </p>
      )}

      {extraExample && level?.extraExample === true && (attempts > 0 || timeUp) && (
        <div className="rounded-lg border border-[var(--border)] p-2 text-xs flex flex-col gap-1">
          <span className="text-[var(--text-muted)]">Noch ein Beispiel:</span>
          <MathText text={extraExample} blockEquations />
        </div>
      )}

      {hints.length > 0 && (attempts > hintsShown || timeUp) && hintsShown < hintBudget && (
        <button onClick={() => hintMut.mutate(hintsShown)} disabled={hintMut.isPending}
          className="text-xs text-[var(--accent)] hover:underline self-start">
          💡 Hinweis anzeigen ({hintsShown}/{hintBudget})
        </button>
      )}
      {hints.slice(0, hintsShown).map((h, i) => (
        <p key={i} className="text-xs text-[var(--text-muted)] italic">💡 {h}</p>
      ))}

      {showEasierOffer && (
        <div className="rounded-lg border border-[var(--border)] p-2 flex items-center gap-2 text-xs">
          <span>Möchtest du eine leichtere Aufgabe probieren?</span>
          <button onClick={() => easierMut.mutate()} className="text-[var(--accent)] hover:underline">Ja</button>
          <button onClick={() => setShowEasierOffer(false)} className="text-[var(--text-muted)] hover:underline">Nein</button>
        </div>
      )}
    </div>
  );
}

// ── Door code ─────────────────────────────────────────────────────────────
// Every solved task hands out its `codeFragment`; the door wants them in
// order. A missing fragment is a "?" that jumps back to the task that owes it,
// so a student who skipped something can go and earn it.

function DoorCodePanel({
  slideId, attemptId, fragments, solved, onSolved, onReview,
}: {
  slideId: string; attemptId: number; fragments: ExitGameFragment[]; solved: boolean;
  onSolved: (attempt: ExitGameAttemptSummary, fragments: ExitGameFragment[]) => void;
  onReview: (targetSlideId: string) => void;
}) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const [openSlides, setOpenSlides] = useState<string[]>([]);

  const codeMut = useMutation({
    mutationFn: () => api.exitgame.attempts.postEvent(attemptId, slideId, "code", { code: value.trim() }),
    onSuccess: (res) => {
      if (res.correct) {
        setWrong(false);
        setOpenSlides([]);
        onSolved(res.attempt, res.code_fragments);
      } else {
        setWrong(true);
        setOpenSlides(res.open_slides ?? []);
      }
    },
  });

  return (
    <div className="rounded-xl border border-[var(--border)] p-3 flex flex-col gap-2">
      <p className="text-sm font-medium">🔑 Türcode</p>
      <div className="flex gap-1.5 flex-wrap">
        {fragments.map(f => (
          <button key={`${f.slide_id}:${f.task_index}`} onClick={() => onReview(f.slide_id)} disabled={f.earned}
            title={f.earned ? "Eingesammelt" : "Diese Aufgabe ist noch offen — hier tippen"}
            className={`font-mono text-sm px-2 py-1 rounded-lg border ${
              f.earned ? "border-[var(--border)]" : "border-dashed border-[var(--accent)] text-[var(--accent)]"
            }`}>
            {f.earned ? f.fragment : "?"}
          </button>
        ))}
      </div>

      {solved ? (
        <p className="text-sm text-green-500">✔ Die Tür ist offen!</p>
      ) : (
        <div className="flex flex-col gap-2">
          <input className="input text-sm py-1.5 w-full" value={value} placeholder="Code eingeben…"
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && value.trim()) codeMut.mutate(); }} />
          <button onClick={() => codeMut.mutate()} disabled={!value.trim() || codeMut.isPending}
            className="btn-primary text-sm py-1.5 px-4 self-start disabled:opacity-40">Tür öffnen</button>
        </div>
      )}

      {wrong && <p className="text-xs text-red-400">Der Code passt nicht.</p>}
      {openSlides.length > 0 && (
        <div className="text-xs flex flex-col gap-1">
          <span className="text-[var(--text-muted)]">Diese Aufgaben fehlen dir noch:</span>
          <div className="flex gap-2 flex-wrap">
            {openSlides.map(target => (
              <button key={target} onClick={() => onReview(target)} className="text-[var(--accent)] hover:underline">
                ↩ {target}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Task area (a task/door slide, possibly a worksheet of several tasks) ──

function TaskArea({
  slide, attemptId, solvedSlideIds, variantChoices, level, fragments, onSlideSolved, onAdaptation, onReview,
}: {
  slide: ExitGameSlide; attemptId: number; solvedSlideIds: string[];
  variantChoices: Record<string, number>; level: DdaLevel | null; fragments: ExitGameFragment[];
  onSlideSolved: (attempt: ExitGameAttemptSummary, fragments: ExitGameFragment[]) => void;
  onAdaptation: (adaptation: DdaAdaptation | null) => void;
  onReview: (targetSlideId: string) => void;
}) {
  const rawTasks = slide.tasks ?? (slide.task ? [slide.task] : []);
  const tasks = rawTasks.map((t, i) => mergeVariant(t, variantChoices[`${slide.id}:${i}`]));
  const wasAlreadySolved = useMemo(() => solvedSlideIds.includes(slide.id), [slide.id]);
  const [solvedIndices, setSolvedIndices] = useState<Set<number>>(new Set());
  const [totalAttempts, setTotalAttempts] = useState(0);

  const allSolved = wasAlreadySolved || solvedIndices.size === tasks.length;
  const doorFragments = fragments.filter(f => f.door_id === slide.id);

  return (
    <div className="flex flex-col gap-3">
      {tasks.map((t, i) => (
        <SingleTaskWidget key={i} task={t} taskIndex={i} slideId={slide.id} hints={slide.hints ?? []} attemptId={attemptId}
          alreadySolved={wasAlreadySolved || solvedIndices.has(i)}
          level={level} extraExample={slide.extraExample}
          onSolved={(attempt, frags) => {
            setSolvedIndices(prev => new Set(prev).add(i));
            // The answer response's attempt already reflects the solved state
            // server-side — pass it up so "Weiter" appears without a refetch.
            if (solvedIndices.size + 1 >= tasks.length) onSlideSolved(attempt, frags);
          }}
          onAttemptChange={(_a, _h, adaptation) => { setTotalAttempts(a => a + 1); onAdaptation(adaptation); }}
        />
      ))}

      {slide.type === "door" && doorFragments.length > 0 && (
        <DoorCodePanel slideId={slide.id} attemptId={attemptId} fragments={doorFragments}
          solved={solvedSlideIds.includes(slide.id)} onSolved={onSlideSolved} onReview={onReview} />
      )}

      {slide.type === "door" && totalAttempts >= 2 && !allSolved && slide.onFailReview && slide.onFailReview.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] p-2 text-xs flex flex-col gap-1">
          <span className="text-[var(--text-muted)]">Vielleicht hilft eine Wiederholung:</span>
          <div className="flex gap-2 flex-wrap">
            {slide.onFailReview.map(target => (
              <button key={target} onClick={() => onReview(target)} className="text-[var(--accent)] hover:underline">
                ↩ {target}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Completion ───────────────────────────────────────────────────────────

function CompletionCard({ completion, summary }: {
  completion: { message?: string; code?: string } | null;
  summary: ExitGameAttemptSummary;
}) {
  const minutes = Math.max(1, Math.round(summary.elapsed_seconds / 60));
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 flex flex-col items-center gap-3 text-center">
      <p className="text-4xl">🎉</p>
      <h2 className="text-xl font-bold">{completion?.message ?? "Geschafft! Du bist entkommen!"}</h2>
      {completion?.code && (
        <p className="text-sm">Dein Exit-Code: <span className="font-mono font-bold">{completion.code}</span></p>
      )}
      <p className="text-xs text-[var(--text-muted)] mt-2">
        ~{minutes} min · {summary.errors_total} Fehlversuche · {summary.hints_total} Hinweise
        {summary.easier_taken_total > 0 && <> · {summary.easier_taken_total} erleichterte Aufgabe(n)</>}
      </p>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ExitgamePlayPage() {
  const { code } = useParams<{ code: string }>();
  const { auth } = useAuth();
  const guest = useGuestSession(code);
  const qc = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  useEffect(() => { setMounted(true); }, []);
  const isGuest = mounted && !auth;

  // Attempt calls fired deep in child widgets read the active guest token from
  // the api module, so register it here (cleared for logged-in users).
  useEffect(() => { setActiveGuestToken(isGuest ? guest.token : null); }, [isGuest, guest.token]);

  async function handleGuestJoin(name: string) {
    try {
      await guest.join("exitgame", name);   // enables the start query once the token lands
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Beitritt fehlgeschlagen";
      setJoinError(/freigeschaltet/.test(msg) ? "Für dieses Spiel sind Gäste nicht freigeschaltet. Bitte melde dich an." : msg);
    }
  }

  const { data: start, isLoading, isError } = useQuery({
    queryKey: ["exitgame-attempt-start", code],
    queryFn: () => api.exitgame.attempts.start(code),
    enabled: !!auth || (isGuest && !!guest.token),
    retry: false,
  });

  const [idx, setIdx] = useState(0);
  const [reviewReturn, setReviewReturn] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [completion, setCompletion] = useState<{ message?: string; code?: string } | null>(null);
  const [finalSummary, setFinalSummary] = useState<ExitGameAttemptSummary | null>(null);
  const [fragments, setFragments] = useState<ExitGameFragment[]>([]);
  const [adaptation, setAdaptation] = useState<DdaAdaptation | null>(null);

  useEffect(() => {
    if (!start) return;
    setIdx(start.attempt.current_slide_idx || 0);
    setFragments(start.code_fragments ?? []);
    setAdaptation(start.adaptation);
  }, [start?.attempt.id]);

  const finishMut = useMutation({
    mutationFn: () => api.exitgame.attempts.finish(start!.attempt.id),
    onSuccess: (res) => {
      setCompletion(res.completion);
      setFinalSummary(res.attempt);
      setFinished(true);
    },
  });

  function viewSlide(newIdx: number) {
    if (!start) return;
    setIdx(newIdx);
    const slide = start.exitgame_data.slides[newIdx];
    api.exitgame.attempts.postEvent(start.attempt.id, slide.id, "view", { slide_index: newIdx });
  }

  function advance() {
    if (!start) return;
    if (reviewReturn != null) {
      setReviewReturn(null);
      viewSlide(reviewReturn);
      return;
    }
    const next = idx + 1;
    if (next >= start.exitgame_data.slides.length) {
      finishMut.mutate();
    } else {
      viewSlide(next);
    }
  }

  function skipSlide() {
    if (!start) return;
    api.exitgame.attempts.postEvent(start.attempt.id, start.exitgame_data.slides[idx].id, "skip", {});
    advance();
  }

  function jumpToReview(targetSlideId: string) {
    if (!start) return;
    const targetIdx = start.exitgame_data.slides.findIndex(s => s.id === targetSlideId);
    if (targetIdx === -1) return;
    api.exitgame.attempts.postEvent(start.attempt.id, start.exitgame_data.slides[idx].id, "review_jump", { target_slide_id: targetSlideId });
    setReviewReturn(idx);
    viewSlide(targetIdx);
  }

  if (!mounted) return null;
  // Guest's 60-min window elapsed → hard block, no rejoin.
  if (isGuest && guest.expired) return <GuestExpired gameIcon="🗝️" />;
  // Unauthenticated visitor picks a username before starting.
  if (isGuest && !guest.token) {
    return (
      <PlayerIdentityForm gameCode={code} gameIcon="🗝️" gameTitle="Exitgame"
        error={joinError} onJoin={(name) => handleGuestJoin(name)} />
    );
  }
  if (isLoading) return <div className="p-8 text-sm text-[var(--text-muted)]">Lade…</div>;
  if (isError || !start) return <div className="p-8 text-sm text-red-400">Diese Sitzung ist nicht verfügbar (geschlossen oder nicht gefunden).</div>;

  if (finished && finalSummary) {
    return (
      <div className="h-full overflow-y-auto flex flex-col gap-5 p-6 max-w-xl mx-auto w-full rounded-2xl" style={styleVars(start.exitgame_data.style)}>
        <CompletionCard completion={completion} summary={finalSummary} />
      </div>
    );
  }

  const data: ExitGameData = start.exitgame_data;
  const slide = data.slides[idx];
  const solvedSlideIds = start.attempt.solved_slide_ids;
  const isTaskSlide = slide.type === "task" || slide.type === "door";

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-5 p-6 max-w-xl mx-auto w-full rounded-2xl" style={styleVars(data.style)}>
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{data.title}</span>
        <span>{idx + 1}/{data.slides.length}</span>
      </div>

      {reviewReturn != null && (
        <button onClick={() => { setReviewReturn(null); viewSlide(reviewReturn); }}
          className="self-start text-xs text-[var(--accent)] hover:underline">
          🚪 Zurück zur Tür
        </button>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-3">
        <div className="text-xs text-[var(--text-muted)]">
          {slide.type === "explanation" ? "📖 Erklärung" : slide.type === "example" ? "💡 Beispiel" : slide.type === "task" ? "✏️ Aufgabe" : "🚪 Tür"}
        </div>
        {slide.title && <h2 className="font-semibold">{slide.title}</h2>}
        {slide.text && <MathText text={slide.text} blockEquations className="text-sm whitespace-pre-line" />}
        {slide.media && <MediaView media={slide.media} exitgameId={start.exitgame_id} />}

        {isTaskSlide ? (
          <TaskArea key={slide.id} slide={slide} attemptId={start.attempt.id} solvedSlideIds={solvedSlideIds}
            variantChoices={start.variant_choices ?? {}}
            level={levelOf(adaptation)} fragments={fragments}
            onSlideSolved={(attempt, frags) => {
              // Update the cached attempt directly from the answer response —
              // "Weiter" appears immediately, no round-trip needed.
              qc.setQueryData(["exitgame-attempt-start", code],
                (old: typeof start | undefined) => old ? { ...old, attempt } : old);
              if (frags) setFragments(frags);
            }}
            onAdaptation={(a) => { if (a) setAdaptation(a); }}
            onReview={jumpToReview}
          />
        ) : (
          <button onClick={advance} className="btn-primary text-sm py-1.5 px-4 self-start mt-1">Weiter →</button>
        )}

        {isTaskSlide && (solvedSlideIds.includes(slide.id)) && (
          <button onClick={advance} className="btn-primary text-sm py-1.5 px-4 self-start mt-1">Weiter →</button>
        )}

        {/* A task may be left open — the missing code fragment is what stops
            the student at the door, and the door links back here. */}
        {slide.type === "task" && !solvedSlideIds.includes(slide.id) && (
          <button onClick={skipSlide} className="text-xs text-[var(--text-muted)] hover:underline self-start">
            Später lösen →
          </button>
        )}
      </section>
    </div>
  );
}
