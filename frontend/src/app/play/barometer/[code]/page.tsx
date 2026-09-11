"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useGuestSession } from "@/hooks/useGuestSession";
import { GuestExpired } from "@/components/GuestExpired";
import { PlayerIdentityForm } from "@/components/PlayerIdentityForm";
import { ResultChart } from "@/components/barometer/ResultChart";
import { BlockChart } from "@/components/barometer/BlockChart";
import { SlideForm } from "@/components/barometer/AnswerInput";
import type { BarometerAnswer, BarometerKind, BarometerResults, BarometerScaleStyle, BarometerShowIf } from "@/lib/api";
import { conditionMet, segmentsOf, slidesOf } from "@/lib/barometer";

type Question = {
  id: number; order: number; text: string;
  scale_min: number; scale_max: number;
  scale_min_label: string | null; scale_max_label: string | null;
  kind: BarometerKind; options: string[]; chart: string | null;
  same_slide: boolean; block: string | null; intro: string | null; show_if: BarometerShowIf | null;
  scale_style: BarometerScaleStyle; max_choices: number | null; num_min: number | null; num_max: number | null; unit: string | null;
};

type Phase =
  | { type: "lobby"; total_slides: number }
  | { type: "slide"; index: number; total: number; questions: Question[]; sent: boolean }
  | { type: "results"; index: number; questions: Question[]; results: Record<number, BarometerResults> }
  | { type: "self"; questions: Question[]; submitted: boolean }
  | { type: "closed" };

function myAnswersToRecord(myAnswers: Record<string, BarometerAnswer> | undefined): Record<number, BarometerAnswer> {
  const out: Record<number, BarometerAnswer> = {};
  if (!myAnswers) return out;
  for (const [k, v] of Object.entries(myAnswers)) out[Number(k)] = v;
  return out;
}

function submitPayload(questions: Question[], answers: Record<number, BarometerAnswer>) {
  const visible = new Set<number>();
  for (const seg of segmentsOf(questions)) {
    const gate = seg.type === "single" ? seg.question : seg.questions[0];
    const members = seg.type === "single" ? [seg.question] : seg.questions;
    if (conditionMet(gate, answers)) for (const q of members) visible.add(q.id);
  }
  const out: { question_id: number; value?: number; text?: string; choices?: number[] }[] = [];
  for (const q of questions) {
    if (!visible.has(q.id)) continue;
    const v = answers[q.id];
    if (v === undefined) continue;
    if (typeof v === "string") {
      if (!v.trim()) continue;
      out.push({ question_id: q.id, text: v });
    } else if (Array.isArray(v)) {
      out.push({ question_id: q.id, choices: v });
    } else {
      out.push({ question_id: q.id, value: v });
    }
  }
  return out;
}

export default function BarometerPlayPage() {
  const { code } = useParams<{ code: string }>();
  const { auth } = useAuth();
  const guest = useGuestSession(code);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>({ type: "lobby", total_slides: 0 });
  const [answers, setAnswers] = useState<Record<number, BarometerAnswer>>({});
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  const isGuest = mounted && !auth;

  async function handleGuestJoin(name: string) {
    try {
      await guest.join("barometer", name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Beitritt fehlgeschlagen";
      setJoinError(/freigeschaltet/.test(msg) ? "Für diese Umfrage sind Gäste nicht freigeschaltet. Bitte melde dich an." : msg);
    }
  }

  const gt = guest.token;
  const live = useLiveSocket(
    // Gäste verbinden erst, wenn sie ein Token haben.
    mounted && !(isGuest && !gt) ? `/api/barometer/${code}/ws?role=student${gt ? `&guest_token=${gt}` : ""}` : null,
    (msg) => {
      if (msg.event === "state") {
        if (msg.status === "closed") {
          setPhase({ type: "closed" });
          return;
        }
        setAnswers(myAnswersToRecord(msg.my_answers));
        if (msg.mode === "self") {
          setPhase({ type: "self", questions: msg.questions ?? [], submitted: Object.keys(msg.my_answers ?? {}).length > 0 });
        } else if (msg.current_slide >= 0 && msg.slide) {
          if (msg.results_visible) {
            setPhase({ type: "results", index: msg.current_slide, questions: msg.slide, results: msg.results ?? {} });
          } else {
            setPhase({ type: "slide", index: msg.current_slide, total: msg.total_slides, questions: msg.slide, sent: false });
          }
        } else {
          setPhase({ type: "lobby", total_slides: msg.total_slides ?? 0 });
        }
      } else if (msg.event === "slide") {
        setPhase({ type: "slide", index: msg.index, total: msg.total, questions: msg.questions, sent: false });
      } else if (msg.event === "results") {
        // Das results-Event traegt keine Fragen — die der gerade gezeigten Folie weiterverwenden.
        setPhase(prev => ({
          type: "results", index: msg.index, results: msg.results,
          questions: prev.type === "slide" || prev.type === "results" ? prev.questions : [],
        }));
      } else if (msg.event === "response_ack") {
        setAnswers(myAnswersToRecord(msg.my_answers));
      } else if (msg.event === "submitted") {
        setAnswers(myAnswersToRecord(msg.my_answers));
        setPhase(prev => prev.type === "slide" ? { ...prev, sent: true } : prev.type === "self" ? { ...prev, submitted: true } : prev);
      } else if (msg.event === "closed") {
        setPhase({ type: "closed" });
      }
    },
    {
      onOpen: () => setError(null),
      onRejected: (c) => {
        if (c === 4004) setError("Umfrage nicht gefunden.");
        else if (c === 4001) { if (isGuest) guest.markExpired(); else setError("Bitte einloggen, um teilzunehmen."); }
        else if (c === 4003) setError("Nur Schüler können an dieser Umfrage teilnehmen.");
      },
    },
  );

  function setAnswer(id: number, value: BarometerAnswer | undefined) {
    setAnswers(prev => {
      const next = { ...prev };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
    // Reopen a slide's "gespeichert" state when the answer changes again.
    setPhase(prev => prev.type === "slide" ? { ...prev, sent: false } : prev);
  }

  function submitSlide() {
    if (phase.type !== "slide") return;
    live.send({ action: "submit", answers: submitPayload(phase.questions, answers) });
  }

  function submitSelf() {
    if (phase.type !== "self") return;
    live.send({ action: "submit", answers: submitPayload(phase.questions, answers) });
  }

  if (!mounted) return null;

  // Guest's 60-min window elapsed → hard block, no rejoin.
  if (isGuest && guest.expired) return <GuestExpired gameIcon="📊" onRejoin={guest.rejoin} />;

  // Unauthenticated visitor picks a username before connecting.
  if (isGuest && !guest.token) {
    return (
      <PlayerIdentityForm
        gameCode={code}
        gameIcon="📊"
        gameTitle="Umfrage"
        error={joinError}
        onJoin={(name) => handleGuestJoin(name)}
      />
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center p-6 bg-[var(--bg)]">
        <div className="text-center text-[var(--text-muted)] text-sm">{error}</div>
      </div>
    );
  }

  const hasAnyAnswer = (questions: Question[]) => questions.some(q => answers[q.id] !== undefined);

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)]">
      <div className="min-h-full flex flex-col items-center justify-start p-6">
      <div className="w-full max-w-md flex flex-col gap-6">

        {phase.type === "lobby" && (
          <div className="text-center flex flex-col items-center gap-4">
            <div className="text-5xl animate-pulse">📊</div>
            <h1 className="text-xl font-bold">Umfrage beigetreten</h1>
            <p className="text-[var(--text-muted)] text-sm">
              Warte auf die erste Frage…
              {phase.total_slides > 0 && <> ({phase.total_slides} Folie{phase.total_slides !== 1 ? "n" : ""})</>}
            </p>
            <div className="flex gap-1 mt-2">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-[var(--accent)]"
                  style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {phase.type === "slide" && (
          <div className="flex flex-col gap-4">
            <div className="text-center text-xs text-[var(--text-muted)]">
              Folie {phase.index + 1} von {phase.total}
            </div>
            <SlideForm questions={phase.questions} answers={answers} onChange={setAnswer} />
            {!phase.sent ? (
              <button className="btn-primary disabled:opacity-40" disabled={!hasAnyAnswer(phase.questions)} onClick={submitSlide}>
                Absenden
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="text-center text-sm text-[var(--text-muted)]">
                  Antworten gespeichert ✓ — du kannst sie bis zur Auswertung ändern
                </div>
                <button className="btn-secondary" onClick={submitSlide}>Aktualisieren</button>
              </div>
            )}
          </div>
        )}

        {phase.type === "results" && (
          <div className="flex flex-col gap-4">
            {segmentsOf(phase.questions).map(seg => {
              if (seg.type === "block") {
                return (
                  <div key={seg.block} className="flex flex-col gap-2">
                    {seg.questions[0].intro && <h2 className="text-lg font-bold leading-snug">{seg.questions[0].intro}</h2>}
                    <BlockChart questions={seg.questions} results={phase.results} chart={seg.questions[0].chart ?? "likert"} />
                  </div>
                );
              }
              const q = seg.question;
              const r = phase.results[q.id] ?? { distribution: {}, count: 0 };
              return (
                <div key={q.id} className="flex flex-col gap-2">
                  {q.intro && <div className="text-sm text-[var(--text-muted)]">{q.intro}</div>}
                  <h2 className="text-lg font-bold leading-snug">{q.text}</h2>
                  {q.kind === "text" ? (
                    <p className="text-center text-xs text-[var(--text-muted)]">{r.count} Antwort{r.count !== 1 ? "en" : ""} — Die Lehrkraft wertet die Antworten aus.</p>
                  ) : (
                    <ResultChart question={q} distribution={r.distribution} count={r.count} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {phase.type === "self" && !phase.submitted && (() => {
          return (
            <div className="flex flex-col gap-6">
              {slidesOf(phase.questions).map((slideQuestions, i) => (
                <div key={i} className={i > 0 ? "pt-6 border-t border-[var(--border)]" : ""}>
                  <SlideForm questions={slideQuestions} answers={answers} onChange={setAnswer} />
                </div>
              ))}
              <button className="btn-primary disabled:opacity-40" disabled={Object.keys(answers).length === 0} onClick={submitSelf}>
                Absenden
              </button>
            </div>
          );
        })()}

        {phase.type === "self" && phase.submitted && (
          <div className="text-center flex flex-col items-center gap-4">
            <div className="text-5xl">✅</div>
            <p className="text-[var(--text-muted)] text-sm">Danke! Deine Antworten sind gespeichert.</p>
            <button className="btn-secondary text-sm" onClick={() => setPhase(prev => prev.type === "self" ? { ...prev, submitted: false } : prev)}>
              Antworten ändern
            </button>
          </div>
        )}

        {phase.type === "closed" && (
          <div className="text-center flex flex-col items-center gap-4">
            <div className="text-5xl">✅</div>
            <h1 className="text-xl font-bold">Umfrage beendet</h1>
            <p className="text-[var(--text-muted)] text-sm">Danke für deine Teilnahme!</p>
          </div>
        )}
      </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
