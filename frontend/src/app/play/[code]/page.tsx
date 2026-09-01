"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { wsUrl } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { PlayerIdentityForm, ScopeClassOption, Team } from "@/components/PlayerIdentityForm";
import { GuestExpired } from "@/components/GuestExpired";
import { useSavedPlayer, SavedPlayer } from "@/hooks/useSavedPlayer";
import { useHubIdentity } from "@/hooks/useHubIdentity";
import { readPlayIdentity, clearPlayIdentity, type PlayIdentity } from "@/lib/playIdentity";
import { useGuestSession } from "@/hooks/useGuestSession";
import { QuestionTypeBadge } from "@/components/QuestionTypeBadge";
import { MathText } from "@/components/MathText";
import { TimelineGameBoard, timelineAnswerComplete } from "@/components/timeline/TimelineGameBoard";
import { TimelineAnswer, TimelineBoard, TimelineSolution } from "@/components/timeline/types";

type Answer = { id: number; text: string; order: number };
type Question = {
  id: number;
  type: string;
  question_text: string;
  image_path: string | null;
  time_limit: number | null;
  answers: Answer[];
  timeline?: TimelineBoard | null;
};

type Phase =
  | { kind: "join" }
  | { kind: "waiting"; participantId: number; name: string; avatar: string }
  | { kind: "preview"; participantId: number; avatar: string; questionText: string; imagePath: string | null; timeLimit: number; questionType: string }
  | { kind: "question"; question: Question; participantId: number; chosen: number[]; avatar: string; answered: boolean; timeLimit: number }
  | { kind: "reveal"; question: Question; chosen: number[]; correct: number[] | null; isCorrect: boolean | null; scoreRatio: number | null; counts: Record<number, number>; avatar: string; myRank: number | null; myDelta: number | null; timelineSolution: TimelineSolution | null }
  | { kind: "finished"; points: number; title: string; avatar: string; finalRanking: RankEntry[]; scoreRatio: number };

type RankEntry = { pid: number; name: string; avatar: string; score: number; delta: number; rank: number };

const COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];

function Confetti({ ratio }: { ratio: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const intensity = ratio >= 0.95 ? 150 : ratio >= 0.80 ? 90 : ratio >= 0.65 ? 50 : ratio >= 0.50 ? 20 : 0;
    if (intensity === 0) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const COLS = ["#e21b3c","#1368ce","#d89e00","#26890c","#a855f7","#ec4899","#f97316"];
    const particles = Array.from({ length: intensity }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
      w: 8 + Math.random() * 8, h: 6 + Math.random() * 6,
      color: COLS[Math.floor(Math.random() * COLS.length)],
      vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 0.2,
    }));
    let raf: number;
    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const p of particles) {
        ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(p.rot);
        ctx!.fillStyle = p.color; ctx!.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx!.restore();
        p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        if (p.y > canvas!.height) { p.y = -20; p.x = Math.random() * canvas!.width; }
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [ratio]);
  if (ratio < 0.50) return null;
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-10" style={{ width: "100%", height: "100%" }} />;
}

function Podium({ ranking }: { ranking: { pid: number; name: string; avatar: string; score: number; rank: number }[] }) {
  const top3 = ranking.filter(r => r.rank <= 3).sort((a, b) => {
    const order = [2, 1, 3]; // left=silver, center=gold, right=bronze
    return order.indexOf(a.rank) - order.indexOf(b.rank);
  });
  if (top3.length === 0) return null;
  const heights: Record<number, number> = { 1: 180, 2: 140, 3: 110 };
  const labels: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const bgs: Record<number, string> = {
    1: "linear-gradient(180deg,#fbbf24,#d97706)",
    2: "linear-gradient(180deg,#94a3b8,#64748b)",
    3: "linear-gradient(180deg,#cd7c33,#a0522d)",
  };
  return (
    <div className="flex items-end justify-center gap-3 mt-4">
      {top3.map((r) => (
        <div key={r.pid} className="flex flex-col items-center gap-1">
          <AvatarDisplay avatarId={r.avatar} size="sm" />
          <span className="text-white font-semibold text-xs text-center max-w-[64px] truncate">{r.name}</span>
          <span className="text-white/70 font-mono text-xs">{r.score.toFixed(1)}</span>
          <div
            className="w-20 flex items-start justify-center rounded-t-xl pt-2 text-2xl font-black"
            style={{ height: `${heights[r.rank]}px`, background: bgs[r.rank] }}
          >{labels[r.rank]}</div>
        </div>
      ))}
    </div>
  );
}

function StudentCountdown({ seconds, stopped }: { seconds: number; stopped: boolean }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (stopped || remaining <= 0) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining, stopped]);

  const pct = seconds > 0 ? remaining / seconds : 0;
  const color = pct > 0.5 ? "#26890c" : pct > 0.25 ? "#d89e00" : "#e21b3c";

  return (
    <div className="w-full h-2 bg-indigo-900">
      <div
        className="h-full transition-all duration-1000"
        style={{ width: `${pct * 100}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function PlayPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const ws = useRef<WebSocket | null>(null);
  const { auth } = useAuth();
  const guest = useGuestSession(code);

  const { saved, save: saveSaved, clear: clearSaved, loaded: savedLoaded } = useSavedPlayer("quiz_participant", code);

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "join" });
  const [joinError, setJoinError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [tlAnswer, setTlAnswer] = useState<TimelineAnswer>({});
  const [teamMode, setTeamMode] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Klassenübergreifende Runde (Kurs/WPF): Gäste sagen beim Beitritt, für
  // welche Klasse sie spielen — sonst zählt ihre Leistung für keine.
  const [scopeClasses, setScopeClasses] = useState<ScopeClassOption[]>([]);
  // Im Playhub gewählt — dann bleibt hier höchstens noch die Teamwahl.
  const [hubIdentity, setHubIdentity] = useState<PlayIdentity | null>(null);

  useEffect(() => {
    setMounted(true);
    setHubIdentity(readPlayIdentity(code));
    // Sitzung laden — und falls der Code gar keiner Caputh-Runde gehört,
    // an das Werkzeug weiterreichen, dem er gehört.
    api.capuths.getSession(code).then(s => {
      if (s.team_mode) {
        setTeamMode(true);
        api.capuths.listTeams(code).then(setTeams).catch(() => {});
      }
      if (s.group_id != null) {
        api.play.scope(code)
          .then(sc => setScopeClasses(sc.needs_class_choice ? sc.classes : []))
          .catch(() => {});
      }
      setSessionLoaded(true);
    }).catch(() => {
      // Kein Caputh-Code — der Playhub weiß, welchem Werkzeug er gehört.
      api.play.resolve(code)
        .then(({ matches }) => {
          const other = matches.find(m => m.tool !== "caputh");
          if (other) router.replace(other.join_url);
        })
        .catch(() => {})
        .finally(() => setSessionLoaded(true));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function connectWs(participantId: number, playerName: string, playerAvatar: string, gtoken?: string | null) {
    const gt = gtoken ?? guest.token;
    const socket = new WebSocket(
      wsUrl(`/api/sessions/${code}/ws?role=student&participant_id=${participantId}${gt ? `&guest_token=${gt}` : ""}`)
    );
    ws.current = socket;

    // 4001 = guest token missing/expired → hard block (no rejoin).
    socket.onclose = (e) => { if (e.code === 4001) guest.markExpired(); };

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.event === "joined") {
        setPhase({ kind: "waiting", participantId, name: playerName, avatar: playerAvatar });

      } else if (msg.event === "state") {
        // Reconnect fallback for waiting room
        if (msg.status === "waiting") {
          setPhase({ kind: "waiting", participantId, name: playerName, avatar: playerAvatar });
        }

      } else if (msg.event === "question_preview") {
        setPhase({
          kind: "preview",
          participantId,
          avatar: playerAvatar,
          questionText: msg.question_text,
          imagePath: msg.image_path,
          timeLimit: msg.time_limit,
          questionType: msg.question_type ?? "single",
        });

      } else if (msg.event === "question_answering") {
        const answers: Answer[] = msg.answers;
        setPhase((prev) => ({
          kind: "question",
          question: {
            id: msg.question_id,
            type: msg.question_type ?? "single",
            // keep question text+image from preview phase so student still sees them
            question_text: prev.kind === "preview" ? prev.questionText : "",
            image_path: prev.kind === "preview" ? prev.imagePath : null,
            time_limit: msg.time_limit,
            answers,
            timeline: msg.timeline ?? null,
          },
          participantId,
          chosen: [],
          avatar: playerAvatar,
          answered: false,
          timeLimit: msg.time_limit,
        }));

      } else if (msg.event === "answer_received") {
        setPhase((prev) => {
          if (prev.kind !== "question") return prev;
          return { ...prev, answered: true };
        });

      } else if (msg.event === "reveal") {
        setPhase((prev) => {
          const chosen = prev.kind === "question" ? prev.chosen : [];
          const av = "avatar" in prev ? prev.avatar : playerAvatar;
          const question = prev.kind === "question" ? prev.question
            : { id: 0, type: "survey", question_text: "", image_path: null, time_limit: null, answers: [] };
          const correct: number[] | null = msg.correct_answer_ids;
          const ratios: Record<string, number> = msg.score_ratios ?? {};
          const scoreRatio = ratios[String(participantId)] ?? null;
          const isCorrect =
            question.type === "timeline"
              ? scoreRatio !== null && scoreRatio >= 0.999
            : correct === null ? null
            : question.type === "umrechnung"
              ? scoreRatio !== null && scoreRatio > 0
              : correct.length === chosen.length && chosen.every((id: number) => correct.includes(id));
          return { kind: "reveal", question, chosen, correct, isCorrect, scoreRatio, counts: msg.answer_counts, avatar: av, myRank: null, myDelta: null, timelineSolution: msg.timeline_solution ?? null };
        });

      } else if (msg.event === "ranking") {
        const myEntry = (msg.ranking as RankEntry[]).find((r) => r.pid === participantId) ?? null;
        setPhase((prev) => {
          if (prev.kind !== "reveal") return prev;
          return { ...prev, myRank: myEntry?.rank ?? null, myDelta: myEntry?.delta ?? null };
        });

      } else if (msg.event === "kicked") {
        ws.current?.close();
        setPhase({ kind: "join" });
        clearSaved();

      } else if (msg.event === "renamed") {
        const newName = msg.name as string;
        saveSaved({ participantId, name: newName, avatar: playerAvatar });
        setPhase((prev) => {
          if (prev.kind === "waiting") return { ...prev, name: newName };
          return prev;
        });

      } else if (msg.event === "finished") {
        setPhase((prev) => ({
          kind: "finished",
          points: msg.points_awarded,
          title: msg.quiz_title,
          avatar: "avatar" in prev ? prev.avatar : playerAvatar,
          finalRanking: msg.final_ranking ?? [],
          scoreRatio: msg.score_ratio ?? 0,
        }));
      }
    };
  }

  async function handleJoin(joinName: string, avatar: string, teamId?: number | null, classId?: number | null) {
    if (teamMode && teamId == null) { setJoinError("Bitte wähle ein Team."); return; }
    clearPlayIdentity(code);
    setConnecting(true);
    setJoinError(null);
    try {
      // Unauthenticated players first obtain a 60-min guest token (the backend
      // enforces the teacher's "Gäste erlauben" opt-in and 403s if it's off).
      let guestToken = guest.token;
      if (!auth && !guestToken) {
        guestToken = (await guest.join("caputh", joinName)).token;
      }
      const res = await api.capuths.joinSession(code, joinName, avatar, teamMode ? teamId! : null, guestToken, classId ?? null);
      saveSaved({ participantId: res.participant_id, name: res.name, avatar });
      connectWs(res.participant_id, res.name, avatar, guestToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Beitritt fehlgeschlagen";
      setJoinError(/freigeschaltet/.test(msg) ? "Für diese Sitzung sind Gäste nicht freigeschaltet. Bitte melde dich an." : msg);
      setConnecting(false);
    }
  }

  // Aus dem Playhub durchgereicht: ohne Teamwahl gibt es hier nichts mehr zu fragen.
  useHubIdentity(
    code,
    mounted && savedLoaded && sessionLoaded && !teamMode && scopeClasses.length === 0 && phase.kind === "join",
    (id) => { void handleJoin(id.name, id.avatar, null); },
  );

  function handleRejoin(s: SavedPlayer) {
    if (s.participantId == null) return;
    setConnecting(true);
    setJoinError(null);
    connectWs(s.participantId, s.name, s.avatar);
  }

  function sendAnswer(ids: number[]) {
    ws.current?.send(JSON.stringify({ action: "answer", answer_ids: ids }));
  }

  function toggleChoice(phase: Extract<Phase, { kind: "question" }>, answerId: number) {
    const q = phase.question;
    const { chosen } = phase;
    if (q.type === "single" || q.type === "true_false") {
      const next = [answerId];
      setPhase({ ...phase, chosen: next });
      sendAnswer(next);
    } else if (q.type === "multi") {
      const next = chosen.includes(answerId) ? chosen.filter((id) => id !== answerId) : [...chosen, answerId];
      setPhase({ ...phase, chosen: next });
    } else {
      const next = [answerId];
      setPhase({ ...phase, chosen: next });
      sendAnswer(next);
    }
  }

  useEffect(() => {
    if (phase.kind === "question") { setTextInput(""); setTlAnswer({}); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind === "question" ? (phase as Extract<Phase, { kind: "question" }>).question.id : null]);

  useEffect(() => () => ws.current?.close(), []);

  // ── Join screen ────────────────────────────────────────────────────
  if (!mounted) return null;

  // Guest's 60-min window elapsed → hard block, no rejoin.
  if (guest.expired && !auth) return <GuestExpired gameIcon="🏕️" onRejoin={guest.rejoin} />;

  if (phase.kind === "join") {
    if (!savedLoaded) return null;
    return (
      <PlayerIdentityForm
        gameCode={code}
        gameIcon="🏕️"
        error={joinError}
        submitting={connecting}
        teams={teamMode ? teams : []}
        classes={scopeClasses}
        identity={hubIdentity}
        savedSession={hubIdentity ? null : (saved && saved.participantId != null ? saved : null)}
        onRejoin={() => saved && handleRejoin(saved)}
        onJoin={handleJoin}
      />
    );
  }

  // ── Waiting ────────────────────────────────────────────────────────
  if (phase.kind === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col items-center justify-center gap-6 p-6">
        <AvatarDisplay avatarId={phase.avatar} size="lg" />
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white">{phase.name}</h2>
          <p className="text-white/60 mt-2">Warte auf den Lehrer…</p>
        </div>
        <div className="flex gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full bg-yellow-400"
              style={{ animation: `toon-bounce 0.9s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Preview ────────────────────────────────────────────────────────
  if (phase.kind === "preview") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col items-center justify-center gap-5 p-6 text-white">
        <QuestionTypeBadge type={phase.questionType} size="lg" />
        {phase.imagePath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/uploads/quizzes/${phase.imagePath}`} alt="" className="max-h-48 rounded-xl object-contain shadow-xl" />
        )}
        <h2 className="text-3xl font-bold text-center max-w-sm whitespace-pre-line leading-snug"><MathText text={phase.questionText} /></h2>
        <p className="text-white/50 text-base animate-pulse mt-2">Warte auf Antworten…</p>
        <AvatarDisplay avatarId={phase.avatar} size="md" />
      </div>
    );
  }

  // ── Question ───────────────────────────────────────────────────────
  if (phase.kind === "question") {
    const q = phase.question;
    const isMulti = q.type === "multi";
    const isSort = q.type === "sort";
    const isUmrechnung = q.type === "umrechnung";
    const hasAnswered = phase.answered || (phase.chosen.length > 0 && (q.type === "single" || q.type === "true_false" || q.type === "survey"));
    const sortComplete = isSort && phase.chosen.length === q.answers.length;

    if (q.type === "timeline" && q.timeline) {
      const board = q.timeline;
      const submitTl = () => {
        if (phase.answered) return;
        ws.current?.send(JSON.stringify({ action: "answer", timeline_answer: tlAnswer }));
      };
      return (
        <div className="flex flex-col h-dvh bg-indigo-800 text-white overflow-hidden">
          <StudentCountdown seconds={phase.timeLimit} stopped={phase.answered} />
          <div className="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-y-auto">
            {q.question_text && (
              <h2 className="text-xl font-bold text-center whitespace-pre-line leading-snug">
                <MathText text={q.question_text} />
              </h2>
            )}
            <div className="self-center"><QuestionTypeBadge type={q.type} size="sm" /></div>
            <div className="bg-[var(--bg)] text-[var(--text)] rounded-2xl p-3">
              <TimelineGameBoard board={board} answer={tlAnswer} onChange={setTlAnswer} disabled={phase.answered} />
            </div>
            {phase.answered ? (
              <p className="text-yellow-300 text-sm animate-pulse text-center">✓ Antwort gesendet</p>
            ) : (
              <button onClick={submitTl}
                disabled={!timelineAnswerComplete(board, tlAnswer)}
                className="w-full py-3 bg-yellow-400 text-black font-bold text-lg rounded-2xl disabled:opacity-40">
                Antwort abschicken ✓
              </button>
            )}
          </div>
        </div>
      );
    }

    if (isUmrechnung) {
      const ansText = q.answers[0]?.text ?? "";
      const parts = ansText.split(" ");
      const unit = parts.length > 1 && !/^\d+$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : "";
      const submitText = () => {
        if (!textInput.trim() || phase.answered) return;
        ws.current?.send(JSON.stringify({ action: "answer", answer_text: textInput.trim().replace(/\s/g, "") }));
      };
      return (
        <div className="flex flex-col h-dvh bg-indigo-800 text-white overflow-hidden">
          <StudentCountdown seconds={phase.timeLimit} stopped={phase.answered} />
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 overflow-y-auto">
            {q.image_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/uploads/quizzes/${q.image_path}`} alt="" className="max-h-32 rounded-xl object-contain" />
            )}
            <p className="text-white/60 text-lg font-semibold">Rechne um:</p>
            {q.question_text && <h2 className="text-3xl font-bold text-center whitespace-pre-line leading-snug"><MathText text={q.question_text} /></h2>}
            <QuestionTypeBadge type={q.type} size="md" />
            {phase.answered ? (
              <p className="text-yellow-300 text-sm animate-pulse mt-2">✓ Antwort gesendet</p>
            ) : (
              <div className="flex items-center gap-3 mt-2">
                <span className="text-white/70 text-2xl font-bold">=</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitText()}
                  className="bg-white/20 text-white text-2xl font-bold text-center rounded-xl px-4 py-3 w-40 outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-white/30"
                  placeholder="?"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                {unit && <span className="text-white text-xl font-semibold">{unit}</span>}
                <button
                  onClick={submitText}
                  disabled={!textInput.trim()}
                  className="px-4 py-3 bg-yellow-400 text-black font-bold rounded-xl disabled:opacity-40 hover:bg-yellow-300 transition-colors"
                >✓</button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-dvh bg-indigo-800 text-white overflow-hidden">
        {/* Countdown bar */}
        <StudentCountdown seconds={phase.timeLimit} stopped={hasAnswered || sortComplete} />

        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4 overflow-y-auto">
          {q.image_path && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/uploads/quizzes/${q.image_path}`} alt="" className="max-h-32 rounded-xl object-contain" />
          )}
          {q.question_text && <h2 className="text-2xl font-bold text-center whitespace-pre-line leading-snug"><MathText text={q.question_text} /></h2>}
          <QuestionTypeBadge type={q.type} size="md" />
          {(hasAnswered || (isSort && phase.answered)) && (
            <p className="text-yellow-300 text-sm animate-pulse">✓ Antwort gesendet</p>
          )}
          {isSort && !phase.answered && (
            <p className="text-white/60 text-xs text-center">Tippe die Antworten in der richtigen Reihenfolge an ({phase.chosen.length}/{q.answers.length})</p>
          )}
        </div>

        {isSort ? (
          <div className="flex flex-col gap-2 p-4 shrink-0">
            {q.answers.map((a, i) => {
              const rank = phase.chosen.indexOf(a.id);
              const isRanked = rank !== -1;
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    if (phase.answered) return;
                    const newChosen = isRanked
                      ? phase.chosen.filter(id => id !== a.id)
                      : [...phase.chosen, a.id];
                    setPhase({ ...phase, chosen: newChosen });
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-left transition-all duration-150 ${
                    isRanked ? "ring-2 ring-white scale-95" : "hover:scale-102 active:scale-95"
                  }`}
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                >
                  <span className="w-7 h-7 rounded-full bg-black/30 flex items-center justify-center text-base font-black flex-shrink-0">
                    {isRanked ? rank + 1 : "○"}
                  </span>
                  <span className="flex-1 text-lg"><MathText text={a.text} /></span>
                </button>
              );
            })}
            {sortComplete && !phase.answered && (
              <button
                onClick={() => sendAnswer(phase.chosen)}
                className="w-full py-3 mt-1 bg-yellow-400 text-black font-bold text-lg rounded-2xl"
              >
                Reihenfolge bestätigen ✓
              </button>
            )}
          </div>
        ) : (
        <>
        <div className="grid grid-cols-2 gap-3 p-4 shrink-0">
          {q.answers.map((a, i) => (
            <button
              key={a.id}
              onClick={() => !hasAnswered && toggleChoice(phase, a.id)}
              disabled={hasAnswered && !isMulti}
              className={`py-6 px-4 rounded-2xl font-bold text-center text-white text-xl whitespace-pre-line leading-snug transition-all duration-150 ${
                phase.chosen.includes(a.id) ? "ring-4 ring-white scale-95" : "hover:scale-105 active:scale-95"
              }`}
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            >
              <MathText text={a.text} />
            </button>
          ))}
        </div>

        {isMulti && phase.chosen.length > 0 && (
          <div className="p-4 pt-0 shrink-0">
            <button
              onClick={() => sendAnswer(phase.chosen)}
              className="w-full py-4 bg-yellow-400 text-black font-bold text-lg rounded-2xl"
            >
              Antwort abschicken ✓
            </button>
          </div>
        )}
        </>
        )}
      </div>
    );
  }

  // ── Reveal ─────────────────────────────────────────────────────────
  if (phase.kind === "reveal") {
    const q = phase.question;
    const totalVotes = Object.values(phase.counts).reduce((a, b) => a + b, 0);
    const pctScore = phase.scoreRatio !== null ? Math.round(phase.scoreRatio * 100) : null;

    let feedbackIcon = "📊";
    let feedbackColor = "text-white";
    let feedbackText = "Umfrage";
    if (phase.isCorrect === true) { feedbackIcon = "✅"; feedbackColor = "text-green-400"; feedbackText = "Richtig!"; }
    else if (phase.isCorrect === false && pctScore === null) { feedbackIcon = "❌"; feedbackColor = "text-red-400"; feedbackText = "Falsch"; }
    else if (pctScore !== null && pctScore > 0 && pctScore < 100) { feedbackIcon = "🟡"; feedbackColor = "text-yellow-400"; feedbackText = `${pctScore}% richtig`; }
    else if (pctScore === 0) { feedbackIcon = "❌"; feedbackColor = "text-red-400"; feedbackText = "Keine Punkte"; }

    return (
      <div className="flex flex-col min-h-screen bg-gray-900 text-white">
        {/* Personal feedback header */}
        <div className="flex flex-col items-center gap-2 pt-8 pb-4 px-6">
          <AvatarDisplay avatarId={phase.avatar} size="lg" />
          <p className="text-5xl mt-2">{feedbackIcon}</p>
          <p className={`text-2xl font-black ${feedbackColor}`}>{feedbackText}</p>
          {phase.myRank !== null && (
            <div className="mt-1 text-center">
              <p className="text-yellow-300 text-xl font-black">Platz {phase.myRank}</p>
              {phase.myDelta !== null && phase.myDelta > 0 && (
                <p className="text-green-400 text-base">+{phase.myDelta.toFixed(2)} Punkte</p>
              )}
            </div>
          )}
        </div>

        {/* Timeline reveal: own placements vs. correct positions */}
        {q.type === "timeline" && phase.timelineSolution?.axis && (
          <div className="px-4 pb-4">
            <div className="bg-[var(--bg)] text-[var(--text)] rounded-2xl p-3">
              <TimelineGameBoard
                board={{
                  mode: phase.timelineSolution.mode,
                  axis: phase.timelineSolution.axis,
                  scoring: phase.timelineSolution.scoring,
                  items: phase.timelineSolution.items.map(it =>
                    phase.timelineSolution!.mode === "spot"
                      ? { id: it.id, label: it.label, value: it.value }
                      : { id: it.id, label: it.label }),
                }}
                answer={tlAnswer}
                solution={phase.timelineSolution}
              />
            </div>
          </div>
        )}

        {/* Answer diagram */}
        {q.answers.length > 0 && (
          <div className="flex-1 flex flex-col gap-2 px-4 pb-4">
            {q.type === "umrechnung" ? (
              <div className={`rounded-xl px-4 py-5 text-center ${phase.isCorrect ? "bg-green-700" : "bg-gray-700"}`}>
                <p className="text-white/70 text-sm mb-1">Richtige Antwort:</p>
                <p className="text-2xl font-black text-white"><MathText text={q.answers[0]?.text ?? ""} /></p>
              </div>
            ) : q.type === "sort" && phase.correct ? (
              // Sort reveal: show correct order, indicate which positions student got right
              phase.correct.map((cid, pos) => {
                const a = q.answers.find(x => x.id === cid);
                if (!a) return null;
                const myPos = phase.chosen.indexOf(cid);
                const gotIt = myPos === pos;
                return (
                  <div key={cid} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${gotIt ? "bg-green-700" : "bg-gray-700"}`}>
                    <span className="w-7 h-7 rounded-full bg-black/30 flex items-center justify-center text-sm font-black flex-shrink-0">{pos + 1}</span>
                    <span className="flex-1 font-bold text-base"><MathText text={a.text} /></span>
                    {myPos !== -1 && <span className="text-sm font-mono text-white/60">dein Platz: {myPos + 1}</span>}
                    <span className="text-lg">{gotIt ? "✓" : myPos !== -1 ? "✗" : ""}</span>
                  </div>
                );
              })
            ) : (
            q.answers.map((a, i) => {
              const count = phase.counts[a.id] ?? 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isCorrect = phase.correct?.includes(a.id);
              const iChose = phase.chosen.includes(a.id);
              const dimmed = phase.correct !== null && !isCorrect;
              return (
                <div key={a.id} className={`rounded-xl overflow-hidden ${dimmed ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: isCorrect ? "#26890c" : COLORS[i % COLORS.length] }}>
                    <span className="flex-1 font-bold text-base whitespace-pre-line"><MathText text={a.text} /></span>
                    <span className="text-sm font-mono">{count} ({pct}%)</span>
                    {iChose && <span className="text-lg">{isCorrect ? "✓" : "✗"}</span>}
                  </div>
                  <div className="h-2 bg-black/20">
                    <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: isCorrect ? "#4ade80" : "rgba(255,255,255,0.4)" }} />
                  </div>
                </div>
              );
            })
            )}
          </div>
        )}
        <p className="text-center text-gray-500 text-sm pb-4">Warte auf nächste Frage…</p>
      </div>
    );
  }

  // ── Finished ───────────────────────────────────────────────────────
  if (phase.kind === "finished") {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-yellow-400 via-orange-400 to-pink-500 flex flex-col items-center justify-center gap-4 p-6 text-center overflow-hidden">
        <Confetti ratio={phase.scoreRatio} />
        <AvatarDisplay avatarId={phase.avatar} size="lg" />
        <h1 className="text-3xl font-bold text-white drop-shadow relative z-20">{phase.title}</h1>
        <div className="bg-white/20 backdrop-blur rounded-3xl px-8 py-4 relative z-20">
          <p className="text-white text-lg">Eure Klasse hat</p>
          <p className="text-6xl font-black text-white drop-shadow">{phase.points}</p>
          <p className="text-white text-lg">Punkte gewonnen! 🎉</p>
        </div>
        {phase.finalRanking.length > 0 && (
          <div className="w-full max-w-xs relative z-20">
            <Podium ranking={phase.finalRanking} />
          </div>
        )}
      </div>
    );
  }

  return null;
}
