"use client";
/**
 * Bausteine des TaskCrawler-Spielers: Thema, Medien, Aufgaben, Türcode,
 * Abschluss. Genutzt von der Folienansicht (play/taskcrawler/[code]) und vom
 * Gebäude (GebaeudeSpiel).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  api, ExitGameSlide, ExitGameStyle, ExitGameTask, ExitGameAttemptSummary,
  ExitGameFragment, ExitGameAnswer, DdaAdaptation,
} from "@/lib/api";
import { MathText } from "@/components/MathText";
import { krabbeln } from "@/lib/krabbler";
import { TimelineGameBoard, timelineAnswerComplete } from "@/components/timeline/TimelineGameBoard";
import { specToBoard } from "@/components/timeline/game";
import { toVideoEmbed } from "@/lib/embed";
import { TimelineAnswer } from "@/components/timeline/types";
import KartenBrett from "@/components/karten/KartenBrett";
import type { KartenAntwort, KartenBrettDaten } from "@/lib/karten/quiz";
import type { SicherungsAbschnitt } from "@/lib/taskcrawler/ergebnisPdf";
import { SimKnopf } from "./SimStation";
import { Vorlesen } from "@/components/maus/Stufenkopf";

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

export function styleVars(style?: ExitGameStyle): React.CSSProperties {
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

export type DdaLevel = Record<string, unknown>;

export function levelOf(adaptation: DdaAdaptation | null): DdaLevel | null {
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

// A media src is either an absolute URL or the name of a file from the
// assets/ folder of the uploaded ZIP, which the API serves per game.
/**
 * Text der letzten Erklärung bzw. des letzten Beispiels vor dieser Folie —
 * die Krabbler zeigen ihn während der Sperre zum Nachlesen. Gibt es keine,
 * die Station selbst bzw. die letzte davor mit Text (manche Stationen bringen
 * Info und Frage auf einer Folie). Formel-Dollar weg.
 */
export function letzteInfo(slides: ExitGameSlide[], slideId: string): string | undefined {
  const text = (s: ExitGameSlide) => [s.title, s.text].filter(Boolean).join("\n\n").replace(/\$\$?/g, "");
  const ab = slides.findIndex(s => s.id === slideId);
  for (let i = ab - 1; i >= 0; i--) {
    const s = slides[i];
    if ((s.type === "explanation" || s.type === "example") && (s.title || s.text)) return text(s);
  }
  for (let i = ab; i >= 0; i--) if (slides[i].title || slides[i].text) return text(slides[i]);
  return undefined;
}

/** Überschrift und Text einer Folie mit Vorlese-Knopf. */
export function FolienText({ slide }: { slide: ExitGameSlide }) {
  const ref = useRef<HTMLDivElement>(null);
  if (!slide.title && !slide.text) return null;
  return (
    <div className="flex items-start gap-2">
      <div ref={ref} className="flex-1 min-w-0 flex flex-col gap-3">
        {slide.title && <h2 className="font-semibold">{slide.title}</h2>}
        {slide.text && <MathText text={slide.text} blockEquations className="text-sm whitespace-pre-line" />}
      </div>
      <Vorlesen ziel={ref} titel="Text vorlesen" />
    </div>
  );
}

export function mediaUrl(src: string, exitgameId: number): string {
  if (/^(https?:)?\/\//.test(src) || src.startsWith("/") || src.startsWith("data:")) return src;
  return `/uploads/exitgames/${exitgameId}/assets/${src}`;
}

export function MediaView({ media, exitgameId }: {
  media: NonNullable<ExitGameSlide["media"]>; exitgameId: number;
}) {
  const height = media.height ?? 360;
  if (media.kind === "image") {
    // `height` caps images too — a pictogram should not fill the column.
    // `self-start` matters: the surrounding column is a flex container, and a
    // stretched flex item would widen the image without its height following.
    return <img src={mediaUrl(media.src, exitgameId)} alt={media.alt ?? ""}
      style={media.height ? { maxHeight: media.height } : undefined}
      className="max-w-full h-auto w-auto self-start rounded-lg" />;
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
  task, taskIndex, slideId, hints, attemptId, alreadySolved, level, extraExample, info, onSolved, onAttemptChange,
}: {
  task: ExitGameTask; taskIndex: number; slideId: string; hints: string[]; attemptId: number; alreadySolved: boolean;
  level: DdaLevel | null; extraExample?: string; info?: string;
  onSolved: (attempt: ExitGameAttemptSummary, fragments: ExitGameFragment[]) => void;
  onAttemptChange: (attempts: number, hintsShown: number, adaptation: DdaAdaptation | null) => void;
}) {
  const [activeTask, setActiveTask] = useState(task);
  const [variant, setVariant] = useState<"normal" | "easier">("normal");
  const [selected, setSelected] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [inputValue, setInputValue] = useState("");
  const [timelineAnswer, setTimelineAnswer] = useState<TimelineAnswer>({});
  const [kartenAntwort, setKartenAntwort] = useState<KartenAntwort>({ antworten: {} });
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
  const vorleseRef = useRef<HTMLDivElement>(null);

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
        krabbeln({ info });
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
      setKartenAntwort({ antworten: {} });
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
    <div ref={vorleseRef} className="rounded-xl border border-line p-3 flex flex-col gap-2">
      {/* Vorlesen: Frage, Antworten, Beispiel und Hinweise (data-vorlesen), keine Knöpfe wie »Prüfen« */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {activeTask.question && <span data-vorlesen><MathText text={activeTask.question} blockEquations className="text-sm font-medium" /></span>}
        </div>
        <Vorlesen ziel={vorleseRef} titel="Aufgabe vorlesen" />
      </div>
      {activeTask.sim && <SimKnopf sim={activeTask.sim} frage={activeTask.question} />}

      {(activeTask.kind === "single" || activeTask.kind === "true_false") && (
        <div className="flex flex-wrap gap-2">
          {answerOptions.map(a => (
            <button key={a.text} onClick={() => submitSingle(a.text)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                selected === a.text && feedback === "wrong" ? "border-red-400 text-red-400" : "border-line hover:border-accent"
              }`} data-vorlesen>
              <MathText text={a.text} />
            </button>
          ))}
        </div>
      )}

      {activeTask.kind === "multi" && (
        <div className="flex flex-col gap-1.5">
          {answerOptions.map(a => (
            <label key={a.text} className="flex items-center gap-2 text-sm cursor-pointer" data-vorlesen>
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
            className="btn-primary text-sm py-1.5 px-4 self-start">Prüfen</button>
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
            className="btn-primary text-sm py-1.5 px-4 self-start">
            Prüfen
          </button>
        </div>
      )}

      {activeTask.kind === "karte" && activeTask.karte && (
        <div className="flex flex-col gap-2">
          <KartenBrett brett={activeTask.karte as unknown as KartenBrettDaten} antwort={kartenAntwort}
            onChange={setKartenAntwort} disabled={answerMut.isPending} />
          <button
            onClick={() => answerMut.mutate(kartenAntwort)}
            disabled={answerMut.isPending || !Object.values(kartenAntwort.antworten).some(Boolean)}
            className="btn-primary text-sm py-1.5 px-4 self-start">
            Prüfen
          </button>
        </div>
      )}

      {feedback === "wrong" && <p className="text-xs text-red-400">Nicht ganz — versuch's nochmal.</p>}

      {secondsLeft != null && (
        <p className="text-xs text-muted">
          {timeUp ? "⏱ Richtzeit vorbei — lass dir Zeit, ein Hinweis ist frei." : `⏱ Richtzeit ${mmss(secondsLeft)}`}
        </p>
      )}

      {extraExample && level?.extraExample === true && (attempts > 0 || timeUp) && (
        <div className="rounded-lg border border-line p-2 text-xs flex flex-col gap-1">
          <span className="text-muted" data-vorlesen>Noch ein Beispiel:</span>
          <span data-vorlesen><MathText text={extraExample} blockEquations /></span>
        </div>
      )}

      {hints.length > 0 && (attempts > hintsShown || timeUp) && hintsShown < hintBudget && (
        <button onClick={() => hintMut.mutate(hintsShown)} disabled={hintMut.isPending}
          className="text-xs text-accent hover:underline self-start">
          💡 Hinweis anzeigen ({hintsShown}/{hintBudget})
        </button>
      )}
      {hints.slice(0, hintsShown).map((h, i) => (
        <p key={i} className="text-xs text-muted italic" data-vorlesen>💡 Hinweis: {h}</p>
      ))}

      {showEasierOffer && (
        <div className="rounded-lg border border-line p-2 flex items-center gap-2 text-xs">
          <span>Möchtest du eine leichtere Aufgabe probieren?</span>
          <button onClick={() => easierMut.mutate()} className="text-accent hover:underline">Ja</button>
          <button onClick={() => setShowEasierOffer(false)} className="text-muted hover:underline">Nein</button>
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
        krabbeln();
        setOpenSlides(res.open_slides ?? []);
      }
    },
  });

  return (
    <div className="rounded-xl border border-line p-3 flex flex-col gap-2">
      <p className="text-sm font-medium">🔑 Türcode</p>
      <div className="flex gap-1.5 flex-wrap">
        {fragments.map(f => (
          <button key={`${f.slide_id}:${f.task_index}`} onClick={() => onReview(f.slide_id)} disabled={f.earned}
            title={f.earned ? "Eingesammelt" : "Diese Aufgabe ist noch offen — hier tippen"}
            className={`font-mono text-sm px-2 py-1 rounded-lg border ${
              f.earned ? "border-line" : "border-dashed border-accent text-accent"
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
            className="btn-primary text-sm py-1.5 px-4 self-start">Tür öffnen</button>
        </div>
      )}

      {wrong && <p className="text-xs text-red-400">Der Code passt nicht.</p>}
      {openSlides.length > 0 && (
        <div className="text-xs flex flex-col gap-1">
          <span className="text-muted">Diese Aufgaben fehlen dir noch:</span>
          <div className="flex gap-2 flex-wrap">
            {openSlides.map(target => (
              <button key={target} onClick={() => onReview(target)} className="text-accent hover:underline">
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

export function TaskArea({
  slide, attemptId, solvedSlideIds, variantChoices, level, fragments, info, onSlideSolved, onAdaptation, onReview,
}: {
  slide: ExitGameSlide; attemptId: number; solvedSlideIds: string[];
  /** letzter Erklärtext (letzteInfo) — bei falscher Antwort zum Nachlesen eingeblendet */
  info?: string;
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
          level={level} extraExample={slide.extraExample} info={info}
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
        <div className="rounded-lg border border-line p-2 text-xs flex flex-col gap-1">
          <span className="text-muted">Vielleicht hilft eine Wiederholung:</span>
          <div className="flex gap-2 flex-wrap">
            {slide.onFailReview.map(target => (
              <button key={target} onClick={() => onReview(target)} className="text-accent hover:underline">
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

export function CompletionCard({ completion, summary, sicherung, titel, akzent, name: startName }: {
  completion: { message?: string; code?: string } | null;
  summary: ExitGameAttemptSummary;
  /** Merksätze aus /finish — dann gibt es das PDF */
  sicherung?: SicherungsAbschnitt[];
  titel?: string;
  akzent?: string;
  name?: string;
}) {
  const minutes = Math.max(1, Math.round(summary.elapsed_seconds / 60));
  const [name, setName] = useState(startName ?? "");
  // kommt der Name erst später (Anmeldung lädt noch), übernehmen — solange nichts getippt wurde
  useEffect(() => { if (startName) setName(n => n || startName); }, [startName]);
  const [laedt, setLaedt] = useState(false);
  const anzahl = sicherung?.reduce((n, a) => n + a.eintraege.length, 0) ?? 0;
  async function pdf() {
    setLaedt(true);
    try {
      const { speichereErgebnisPdf } = await import("@/lib/taskcrawler/ergebnisPdf");
      await speichereErgebnisPdf({ titel: titel ?? "", abschnitte: sicherung ?? [], name: name.trim() || undefined, akzent });
    } finally { setLaedt(false); }
  }
  return (
    <section className="card p-8 flex flex-col items-center gap-3 text-center">
      <p className="text-4xl">🎉</p>
      <h2 className="text-xl font-bold">{completion?.message ?? "Geschafft! Du bist entkommen!"}</h2>
      {completion?.code && (
        <p className="text-sm">Dein Exit-Code: <span className="font-mono font-bold">{completion.code}</span></p>
      )}
      <p className="text-xs text-muted mt-2">
        ~{minutes} min · {summary.errors_total} Fehlversuche · {summary.hints_total} Hinweise
        {summary.easier_taken_total > 0 && <> · {summary.easier_taken_total} erleichterte Aufgabe(n)</>}
      </p>
      {anzahl > 0 && (
        <div className="mt-3 w-full max-w-sm rounded-xl border border-line p-3 flex flex-col gap-2 text-left" data-ergebnissicherung>
          <p className="text-sm font-bold">📄 Ergebnissicherung</p>
          <p className="text-xs text-muted">{anzahl} Merksätze aus diesem TaskCrawler als PDF zum Aufheben.</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Dein Name (steht oben im PDF)"
            className="rounded-lg border border-line bg-page px-2 py-1 text-sm" aria-label="Name fürs PDF" />
          <button onClick={pdf} disabled={laedt} className="btn-primary text-sm py-1.5 px-4 self-start">
            {laedt ? "Erstelle PDF …" : "⬇️ PDF herunterladen"}
          </button>
        </div>
      )}
    </section>
  );
}
