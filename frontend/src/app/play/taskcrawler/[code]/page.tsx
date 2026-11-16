"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setActiveGuestToken, ExitGameAbschluss, ExitGameData, ExitGameAttemptSummary, ExitGameFragment, DdaAdaptation } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestSession } from "@/hooks/useGuestSession";
import { GuestExpired } from "@/components/GuestExpired";
import { PlayerIdentityForm } from "@/components/PlayerIdentityForm";
import { SimKnopf, SimZugang } from "@/components/exitgame/SimStation";
import { CompletionCard, FolienText, MediaView, TaskArea, letzteInfo, levelOf, styleVars } from "@/components/exitgame/FolienTeile";
import BossArea from "@/components/exitgame/BossArea";
import { STANDARD_AVATAR, TIERE, gespeicherterAvatar, speichereAvatar } from "@/components/gebaeude/avatar";
import GebaeudeSpiel from "@/components/exitgame/GebaeudeSpiel";
import { STILE, type Stil } from "@/components/gebaeude/szene";

type Ansicht = "folien" | "gebaeude" | "verlies" | "ebene" | "frei";
const ANSICHTEN: [Ansicht, string][] = [["folien", "📄 Text"], ["gebaeude", "🏢 Gebäude"], ["verlies", "🗝️ Verlies"], ["ebene", "🗺️ Ebene"], ["frei", "🌲 3D-Welt"]];
const istAnsicht = (a: unknown): a is Ansicht => ANSICHTEN.some(([x]) => x === a);
const istStil = (s: unknown): s is Stil => typeof s === "string" && s in STILE;
/** je Sitzungscode: die eigene Wahl gilt nur für dieses Spiel */
const ansichtSchluessel = (code: string) => `hp_exitgame_ansicht_${code}`;
const stilSchluessel = (code: string) => `hp_exitgame_stil_${code}`;

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

  async function handleGuestJoin(name: string, tier: string) {
    // Das Tier vom Beitritt wird die Spielfigur im Gebäude — außer man hat schon eine gewählt.
    if (!gespeicherterAvatar() && TIERE.some(t => t.id === tier)) speichereAvatar({ ...STANDARD_AVATAR, tier });
    try {
      // Spielstand nach Namen: derselbe Name im selben Browser setzt den Versuch fort
      await guest.join("exitgame", name, { fortsetzen: true });   // enables the start query once the token lands
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
  const [abschluss, setAbschluss] = useState<ExitGameAbschluss | null>(null);
  const [finalSummary, setFinalSummary] = useState<ExitGameAttemptSummary | null>(null);
  const [fragments, setFragments] = useState<ExitGameFragment[]>([]);
  const [adaptation, setAdaptation] = useState<DdaAdaptation | null>(null);
  // Ansicht und Stil: Legt das Spiel sie fest ("gebaeude": {"ansicht", "stil"}), gilt das
  // und es gibt keine Auswahl. Sonst wählt jeder selbst (?ansicht=… oder die eigene Wahl).
  const [ansicht, setAnsicht] = useState<Ansicht | null>(null);
  const [stil, setStil] = useState<Stil | null>(null);
  useEffect(() => {
    let gemerkt: string | null = null, stilGemerkt: string | null = null;
    try {
      gemerkt = localStorage.getItem(ansichtSchluessel(code));
      stilGemerkt = localStorage.getItem(stilSchluessel(code));
    } catch { /* ohne Speicher */ }
    const a = new URLSearchParams(window.location.search).get("ansicht") ?? gemerkt;
    if (istAnsicht(a)) setAnsicht(a);
    if (istStil(stilGemerkt)) setStil(stilGemerkt);
  }, [code]);
  function waehleAnsicht(a: Ansicht) {
    setAnsicht(a);
    try { localStorage.setItem(ansichtSchluessel(code), a); } catch { /* egal */ }
  }
  function waehleStil(s: Stil) {
    setStil(s);
    try { localStorage.setItem(stilSchluessel(code), s); } catch { /* egal */ }
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
      setAbschluss(res);
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
      <PlayerIdentityForm gameCode={code} gameIcon="🗝️" gameTitle="TaskCrawler"
        error={joinError} onJoin={(name, tier) => handleGuestJoin(name, tier)} />
    );
  }
  if (isLoading) return <div className="p-8 text-sm text-muted">Lade…</div>;
  if (isError || !start) return <div className="p-8 text-sm text-red-400">Diese Sitzung ist nicht verfügbar (geschlossen oder nicht gefunden).</div>;

  if (finished && finalSummary) {
    return (
      <div className="h-full overflow-y-auto flex flex-col gap-5 p-6 max-w-xl mx-auto w-full rounded-2xl" style={styleVars(start.exitgame_data.style)}>
        <CompletionCard completion={completion} summary={finalSummary} sicherung={abschluss?.ergebnissicherung}
          titel={abschluss?.title ?? start.exitgame_data.title} akzent={start.exitgame_data.style?.customVars?.["--accent"]}
          name={isGuest ? guest.session?.name : auth?.student ? `${auth.student.vorname} ${auth.student.nachname}` : undefined} />
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
  const { ansicht: ansichtDesSpiels, stil: stilDesSpiels, stile: stileDesSpiels } = data.gebaeude ?? {};
  const festeAnsicht = istAnsicht(ansichtDesSpiels) ? ansichtDesSpiels : null;
  const festerStil = istStil(stilDesSpiels) ? stilDesSpiels : null;
  // je Abschnitt ein Stil; wo einer fehlt, gilt "stil"
  const festeStile = Array.isArray(stileDesSpiels) ? stileDesSpiels.map(s => (istStil(s) ? s : undefined)) : null;
  // Legt das Spiel eine 2.5D-Ansicht fest, bleibt daneben immer die Textfassung (Folien) wählbar.
  const erlaubt = festeAnsicht === null ? ANSICHTEN
    : festeAnsicht === "folien" ? [] : ANSICHTEN.filter(([a]) => a === festeAnsicht || a === "folien");
  const aktiv: Ansicht = ansicht && erlaubt.some(([a]) => a === ansicht) ? ansicht : festeAnsicht ?? "folien";
  const umschalter = erlaubt.length < 2 ? null : (
    <div className="inline-flex rounded-lg border border-line p-0.5 text-xs" role="group" aria-label="Ansicht">
      {erlaubt.map(([a, t]) => (
        <button key={a} onClick={() => waehleAnsicht(a)} aria-pressed={aktiv === a}
          className={`px-2 py-0.5 rounded-md font-bold ${aktiv === a ? "bg-accent text-accent-fg" : "text-muted"}`}>
          {t}
        </button>
      ))}
    </div>
  );
  const stilWahl = festerStil || festeStile ? null : (
    <select value={stil ?? ""} onChange={e => waehleStil(e.target.value as Stil)} aria-label="Stil"
      className="rounded-lg border border-line bg-surface px-1.5 py-0.5 text-xs">
      <option value="" disabled>🎨 Stil</option>
      {(Object.keys(STILE) as Stil[]).map(s => <option key={s} value={s}>{STILE[s].name}</option>)}
    </select>
  );

  // Werkzeuge an den Stationen (z. B. Geschichte der Medien) treffen sich im Live-Raum dieser Sitzung
  const mitZugang = (inhalt: React.ReactNode) => (
    <SimZugang.Provider value={{ code, token: isGuest ? guest.token : null }}>{inhalt}</SimZugang.Provider>
  );

  if (aktiv !== "folien") {
    return mitZugang(
      <div className="h-full overflow-y-auto flex flex-col gap-3 p-4 max-w-seite mx-auto w-full rounded-2xl" style={styleVars(data.style)}>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{data.title}</span>
          <span className="flex items-center gap-2">{stilWahl}{umschalter}</span>
        </div>
        <GebaeudeSpiel code={code} attempt={start.attempt} exitgameId={start.exitgame_id} data={data}
          variantChoices={start.variant_choices ?? {}} fragments={fragments} adaptation={adaptation}
          onSlideSolved={slideSolved} onAdaptation={setAdaptation} onFinish={() => finishMut.mutate()}
          art={aktiv === "gebaeude" ? "haus" : aktiv}
          stil={festerStil ?? (festeStile ? undefined : stil) ?? undefined} stile={festeStile ?? undefined} />
      </div>
    );
  }

  const slide = data.slides[idx];
  const solvedSlideIds = start.attempt.solved_slide_ids;
  const isTaskSlide = slide.type === "task" || slide.type === "door";

  return mitZugang(
    // Boss-Folie: das Challenge-Spiel bekommt die volle Breite
    <div className={`h-full overflow-y-auto flex flex-col gap-5 p-6 mx-auto w-full rounded-2xl ${slide.type === "boss" ? "max-w-seite" : "max-w-xl"}`} style={styleVars(data.style)}>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{data.title}</span>
        <span className="flex items-center gap-2">{umschalter}{idx + 1}/{data.slides.length}</span>
      </div>

      {reviewReturn != null && (
        <button onClick={() => { setReviewReturn(null); viewSlide(reviewReturn); }}
          className="self-start text-xs text-accent hover:underline">
          🚪 Zurück zur Tür
        </button>
      )}

      <section className="card p-5 flex flex-col gap-3">
        <div className="text-xs text-muted">
          {slide.type === "explanation" ? "📖 Erklärung" : slide.type === "example" ? "💡 Beispiel" : slide.type === "task" ? "✏️ Aufgabe" : slide.type === "boss" ? "⚔️ Boss" : "🚪 Tür"}
        </div>
        <FolienText slide={slide} />
        {slide.media && <MediaView media={slide.media} exitgameId={start.exitgame_id} />}
        {slide.sim && <SimKnopf sim={slide.sim} frage={slide.title} zurueck="✓ Zurück zur Folie" />}

        {slide.type === "boss" ? (
          <BossArea slide={slide} attemptId={start.attempt.id} onSlideSolved={slideSolved} onFertig={advance} />
        ) : isTaskSlide ? (
          <TaskArea key={slide.id} slide={slide} attemptId={start.attempt.id} solvedSlideIds={solvedSlideIds}
            variantChoices={start.variant_choices ?? {}}
            level={levelOf(adaptation)} fragments={fragments} info={letzteInfo(data.slides, slide.id)}
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
          <button onClick={skipSlide} className="text-xs text-muted hover:underline self-start">
            Später lösen →
          </button>
        )}
      </section>
    </div>
  );
}
