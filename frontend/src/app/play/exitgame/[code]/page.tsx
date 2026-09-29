"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setActiveGuestToken, ExitGameData, ExitGameAttemptSummary, ExitGameFragment, DdaAdaptation } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestSession } from "@/hooks/useGuestSession";
import { GuestExpired } from "@/components/GuestExpired";
import { PlayerIdentityForm } from "@/components/PlayerIdentityForm";
import { MathText } from "@/components/MathText";
import { CompletionCard, MediaView, TaskArea, levelOf, styleVars } from "@/components/exitgame/FolienTeile";
import GebaeudeSpiel from "@/components/exitgame/GebaeudeSpiel";

type Ansicht = "folien" | "gebaeude";
const ANSICHT_SPEICHER = "hp_exitgame_ansicht";

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
  // Folien oder Gebäude: jeder wählt selbst; ?ansicht=gebaeude legt den Anfang fest.
  const [ansicht, setAnsicht] = useState<Ansicht>("folien");
  useEffect(() => {
    let gemerkt: string | null = null;
    try { gemerkt = localStorage.getItem(ANSICHT_SPEICHER); } catch { /* ohne Speicher */ }
    const a = new URLSearchParams(window.location.search).get("ansicht") ?? gemerkt;
    if (a === "folien" || a === "gebaeude") setAnsicht(a);
  }, []);
  function waehleAnsicht(a: Ansicht) {
    setAnsicht(a);
    try { localStorage.setItem(ANSICHT_SPEICHER, a); } catch { /* egal */ }
  }

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
  if (isGuest && guest.expired) return <GuestExpired gameIcon="🗝️" onRejoin={guest.rejoin} />;
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
  // Update the cached attempt directly from the answer response —
  // "Weiter" appears immediately, no round-trip needed.
  function slideSolved(attempt: ExitGameAttemptSummary, frags: ExitGameFragment[]) {
    qc.setQueryData(["exitgame-attempt-start", code],
      (old: typeof start | undefined) => old ? { ...old, attempt } : old);
    if (frags) setFragments(frags);
  }
  const umschalter = (
    <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 text-xs" role="group" aria-label="Ansicht">
      {([["folien", "📄 Folien"], ["gebaeude", "🏢 Gebäude"]] as [Ansicht, string][]).map(([a, t]) => (
        <button key={a} onClick={() => waehleAnsicht(a)} aria-pressed={ansicht === a}
          className={`px-2 py-0.5 rounded-md font-bold ${ansicht === a ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)]"}`}>
          {t}
        </button>
      ))}
    </div>
  );

  if (ansicht === "gebaeude") {
    return (
      <div className="h-full overflow-y-auto flex flex-col gap-3 p-4 max-w-[var(--seite-breite)] mx-auto w-full rounded-2xl" style={styleVars(data.style)}>
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{data.title}</span>
          {umschalter}
        </div>
        <GebaeudeSpiel code={code} attempt={start.attempt} exitgameId={start.exitgame_id} data={data}
          variantChoices={start.variant_choices ?? {}} fragments={fragments} adaptation={adaptation}
          onSlideSolved={slideSolved} onAdaptation={setAdaptation} onFinish={() => finishMut.mutate()} />
      </div>
    );
  }

  const slide = data.slides[idx];
  const solvedSlideIds = start.attempt.solved_slide_ids;
  const isTaskSlide = slide.type === "task" || slide.type === "door";

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-5 p-6 max-w-xl mx-auto w-full rounded-2xl" style={styleVars(data.style)}>
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{data.title}</span>
        <span className="flex items-center gap-2">{umschalter}{idx + 1}/{data.slides.length}</span>
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
            onSlideSolved={slideSolved}
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
