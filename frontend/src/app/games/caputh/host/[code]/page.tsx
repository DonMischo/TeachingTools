"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { QuestionTypeBadge } from "@/components/QuestionTypeBadge";
import { MathText } from "@/components/MathText";
import { wsUrl } from "@/lib/utils";
import { TimelineGameBoard } from "@/components/timeline/TimelineGameBoard";
import { TimelineBoard, TimelineSolution } from "@/components/timeline/types";

// ─── Types ──────────────────────────────────────────────────────────────────

type Answer = { id: number; text: string; order: number };

type QuestionInfo = {
  id: number;
  idx: number;
  total: number;
  text: string;
  imagePath: string | null;
  timeLimit: number;
  previewTime: number | null;
  type: string;
};

type RankEntry = {
  pid: number;
  name: string;
  avatar: string;
  score: number;
  delta: number;
  rank: number;
};

type Participant = { id: number; name: string; avatar: string };

type HostPhase =
  | { kind: "connecting" }
  | { kind: "waiting"; participantCount: number; participants: Participant[] }
  | { kind: "preview"; q: QuestionInfo; participantCount: number }
  | { kind: "answering"; q: QuestionInfo; answers: Answer[]; timeLimit: number; counts: Record<number, number>; responses: number; participantCount: number; timeline: TimelineBoard | null }
  | { kind: "revealed"; q: QuestionInfo; answers: Answer[]; correctIds: number[] | null; counts: Record<number, number>; isLast: boolean; timelineSolution: TimelineSolution | null }
  | { kind: "ranking"; ranking: RankEntry[]; isLast: boolean }
  | { kind: "finished"; pointsAwarded: number; title: string; finalRanking: RankEntry[]; scoreRatio: number; isReplay: boolean };

const COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];

// ─── Countdown component ─────────────────────────────────────────────────────

function Countdown({
  seconds,
  onZero,
}: {
  seconds: number;
  onZero?: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const calledRef = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    calledRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      if (!calledRef.current) {
        calledRef.current = true;
        onZero?.();
      }
      return;
    }
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining, onZero]);

  const pct = seconds > 0 ? remaining / seconds : 0;
  const color = pct > 0.5 ? "#26890c" : pct > 0.25 ? "#d89e00" : "#e21b3c";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="text-5xl font-black tabular-nums"
        style={{ color }}
      >
        {remaining}
      </div>
      <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Confetti ────────────────────────────────────────────────────────────────

function Confetti({ ratio }: { ratio: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const intensity = ratio >= 0.95 ? 200 : ratio >= 0.80 ? 130 : ratio >= 0.65 ? 70 : ratio >= 0.50 ? 30 : 0;
    if (intensity === 0) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const COLORS_C = ["#e21b3c", "#1368ce", "#d89e00", "#26890c", "#a855f7", "#ec4899", "#f97316"];
    const particles = Array.from({ length: intensity }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: 8 + Math.random() * 8,
      h: 6 + Math.random() * 6,
      color: COLORS_C[Math.floor(Math.random() * COLORS_C.length)],
      vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.2,
    }));

    let raf: number;
    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const p of particles) {
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        if (p.y > canvas!.height) {
          p.y = -20;
          p.x = Math.random() * canvas!.width;
        }
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [ratio]);

  if (ratio < 0.50) return null;
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

// ─── Podium (Siegertreppe) ────────────────────────────────────────────────────

function Podium({ ranking }: { ranking: RankEntry[] }) {
  const top3 = ranking.filter(r => r.rank <= 3).sort((a, b) => {
    const order = [2, 1, 3];
    return order.indexOf(a.rank) - order.indexOf(b.rank);
  });
  if (top3.length === 0) return null;
  const heights: Record<number, number> = { 1: 200, 2: 160, 3: 130 };
  const labels: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const bgs: Record<number, string> = {
    1: "linear-gradient(180deg,#fbbf24,#d97706)",
    2: "linear-gradient(180deg,#94a3b8,#64748b)",
    3: "linear-gradient(180deg,#cd7c33,#a0522d)",
  };
  return (
    <div className="flex items-end justify-center gap-4 mt-6">
      {top3.map((r) => (
        <div key={r.pid} className="flex flex-col items-center gap-2">
          <AvatarDisplay avatarId={r.avatar} size="md" />
          <span className="text-white font-semibold text-sm text-center max-w-[80px] truncate">{r.name}</span>
          <span className="text-white font-mono text-xs">{r.score.toFixed(1)}</span>
          <div
            className="w-24 flex items-start justify-center rounded-t-xl pt-2 text-3xl font-black"
            style={{ height: `${heights[r.rank]}px`, background: bgs[r.rank] }}
          >
            {labels[r.rank]}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ConfirmState = { msg: string; onYes: () => void } | null;

// ─── Main component ──────────────────────────────────────────────────────────

export default function HostPage() {
  const { code } = useParams<{ code: string }>();
  const ws = useRef<WebSocket | null>(null);
  const [phase, setPhase] = useState<HostPhase>({ kind: "connecting" });
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [showJoinQR, setShowJoinQR] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(null);
  const [mounted, setMounted] = useState(false);
  const [teamMode, setTeamMode] = useState(false);
  const [teams, setTeams] = useState<{ id: number; name: string; color: string | null }[]>([]);
  const [newTeamName, setNewTeamName] = useState("");

  useEffect(() => { setMounted(true); }, []);

  function reloadTeams() {
    fetch(`/api/sessions/${code}/teams`, { credentials: "include" })
      .then(r => r.json()).then(setTeams).catch(() => {});
  }

  function addTeam() {
    if (!newTeamName.trim()) return;
    fetch(`/api/sessions/${code}/teams`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTeamName.trim() }),
    }).then(() => { setNewTeamName(""); reloadTeams(); }).catch(() => {});
  }

  function removeTeam(teamId: number) {
    fetch(`/api/sessions/${code}/teams/${teamId}`, { method: "DELETE", credentials: "include" })
      .then(() => reloadTeams()).catch(() => {});
  }

  // Store current question+answers across phase transitions
  const currentQ = useRef<QuestionInfo | null>(null);
  const currentAnswers = useRef<Answer[]>([]);

  useEffect(() => {
    // Fetch real LAN IP so QR works even when teacher opened via localhost
    fetch("/server-ip")
      .then((r) => r.json())
      .then((d) => { if (d.ip) setLanIp(d.ip); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const socket = new WebSocket(wsUrl(`/api/sessions/${code}/ws?role=teacher`));
    ws.current = socket;

    socket.onopen = () =>
      setPhase({ kind: "waiting", participantCount: 0, participants: [] });

    socket.onclose = () =>
      setPhase((prev) => (prev.kind === "connecting" ? prev : { kind: "connecting" }));

    socket.onmessage = (e) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg: any = JSON.parse(e.data);

      if (msg.event === "state") {
        // Waiting room initial state
        setPhase({ kind: "waiting", participantCount: msg.participant_count, participants: [] });
        if (msg.team_mode) { setTeamMode(true); reloadTeams(); }

      } else if (msg.event === "participant_joined") {
        setPhase((prev) => {
          if (prev.kind !== "waiting") return prev;
          return {
            ...prev,
            participantCount: msg.count,
            participants: [...prev.participants, { id: msg.participant_id, name: msg.name, avatar: msg.avatar }],
          };
        });

      } else if (msg.event === "participant_left") {
        setPhase((prev) => {
          if (prev.kind === "waiting") {
            return {
              ...prev,
              participantCount: msg.count,
              participants: prev.participants.filter((p) => p.id !== msg.participant_id),
            };
          }
          if (prev.kind === "answering") {
            return { ...prev, participantCount: Math.max(0, prev.participantCount - 1) };
          }
          return prev;
        });

      } else if (msg.event === "participant_renamed") {
        setPhase((prev) => {
          if (prev.kind !== "waiting") return prev;
          return {
            ...prev,
            participants: prev.participants.map((p) =>
              p.id === msg.participant_id ? { ...p, name: msg.name } : p
            ),
          };
        });

      } else if (msg.event === "question_preview") {
        const q: QuestionInfo = {
          id: msg.question_id,
          idx: msg.question_idx,
          total: msg.total_questions,
          text: msg.question_text,
          imagePath: msg.image_path,
          timeLimit: msg.time_limit,
          previewTime: msg.preview_time ?? null,
          type: msg.question_type,
        };
        currentQ.current = q;
        currentAnswers.current = [];
        setPhase((prev) => ({
          kind: "preview",
          q,
          participantCount: msg.participant_count ?? (
            prev.kind === "waiting" || prev.kind === "preview" || prev.kind === "answering"
              ? prev.participantCount : 0
          ),
        }));

      } else if (msg.event === "question_answering") {
        const answers: Answer[] = msg.answers;
        currentAnswers.current = answers;
        const q = currentQ.current!;
        setPhase((prev) => ({
          kind: "answering",
          q,
          answers,
          timeLimit: msg.time_limit,
          counts: Object.fromEntries(answers.map((a: Answer) => [a.id, 0])),
          responses: 0,
          participantCount: msg.participant_count ?? (prev.kind === "preview" ? prev.participantCount : 0),
          timeline: msg.timeline ?? null,
        }));

      } else if (msg.event === "answer_update") {
        setPhase((prev) => {
          if (prev.kind !== "answering") return prev;
          return {
            ...prev,
            counts: msg.answer_counts,
            responses: msg.response_count,
            participantCount: msg.participant_count ?? prev.participantCount,
          };
        });

      } else if (msg.event === "reveal") {
        setPhase({
          kind: "revealed",
          q: currentQ.current!,
          answers: currentAnswers.current,
          correctIds: msg.correct_answer_ids,
          counts: msg.answer_counts,
          isLast: msg.is_last,
          timelineSolution: msg.timeline_solution ?? null,
        });

      } else if (msg.event === "ranking") {
        setPhase({
          kind: "ranking",
          ranking: msg.ranking,
          isLast: msg.is_last,
        });

      } else if (msg.event === "finished") {
        setPhase({
          kind: "finished",
          pointsAwarded: msg.points_awarded,
          title: msg.quiz_title,
          finalRanking: msg.final_ranking ?? [],
          scoreRatio: msg.score_ratio ?? 0,
          isReplay: msg.is_replay ?? false,
        });
      }
    };

    return () => socket.close();
  }, [code]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function send(action: string, extra?: Record<string, any>) {
    ws.current?.send(JSON.stringify({ action, ...extra }));
  }

  const origin = mounted ? window.location.origin : "";
  const displayOrigin = (mounted && lanIp)
    ? `${window.location.protocol}//${lanIp}:${window.location.port || (window.location.protocol === "https:" ? "443" : "80")}`
    : origin;
  const joinUrl = `${displayOrigin}/play/${code}`;

  const confirmModal = confirmDialog ? (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setConfirmDialog(null)}>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-4 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <p className="text-[var(--text)] text-base">{confirmDialog.msg}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setConfirmDialog(null)} className="btn-secondary px-4 py-2">Abbrechen</button>
          <button onClick={() => { confirmDialog.onYes(); setConfirmDialog(null); }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 font-semibold">Ja</button>
        </div>
      </div>
    </div>
  ) : null;

  const qrOverlay = showJoinQR ? (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setShowJoinQR(false)}>
      <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl" onClick={e => e.stopPropagation()}>
        <QRCodeSVG value={joinUrl} size={200} bgColor="#ffffff" fgColor="#1e1b4b" level="M" />
        <p className="text-2xl font-black font-mono text-indigo-900 tracking-widest">{code}</p>
        <p className="text-gray-400 text-xs">{joinUrl}</p>
      </div>
    </div>
  ) : null;

  const qrBtn = (
    <button
      onClick={() => setShowJoinQR(true)}
      className="fixed top-3 left-14 z-40 w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 hover:text-white shadow-lg"
      title="QR-Code zeigen"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 110 2H4v2a1 1 0 01-2 0V4zm10-1h3a1 1 0 110 2h-2v2a1 1 0 01-2 0V4a1 1 0 011-1zM3 13a1 1 0 011 1v2h2a1 1 0 110 2H4a1 1 0 01-1-1v-3a1 1 0 011-1zm14 1a1 1 0 10-2 0v2h-2a1 1 0 100 2h3a1 1 0 001-1v-3zM7 7h2v2H7V7zm0 4h2v2H7v-2zm4-4h2v2h-2V7zm0 4h2v2h-2v-2z" clipRule="evenodd" />
      </svg>
    </button>
  );

  // ── Connecting ─────────────────────────────────────────────────────────────
  if (phase.kind === "connecting") {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        Verbinde mit Session {code}…
      </div>
    );
  }

  // ── Finished ───────────────────────────────────────────────────────────────
  if (phase.kind === "finished") {
    return (
      <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
        <Confetti ratio={phase.scoreRatio} />
        {confirmModal}
        {qrBtn}
        {qrOverlay}

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 relative z-20 overflow-y-auto">
          <p className="text-6xl">🏆</p>
          <h1 className="text-4xl font-bold text-center">{phase.title}</h1>
          {phase.isReplay ? (
            <p className="text-base text-gray-400 text-center bg-gray-800 rounded-xl px-4 py-2">
              🔁 Wiederholung — keine weiteren Punkte (bereits {phase.pointsAwarded} vergeben)
            </p>
          ) : (
            <p className="text-xl text-gray-300 text-center">
              Klasse erhält{" "}
              <span className="font-bold text-yellow-400">{phase.pointsAwarded} Hauspunkte</span>!
            </p>
          )}
          <div className="flex gap-3 flex-wrap justify-center mt-2">
            <button
              onClick={() => setConfirmDialog({ msg: "Session zurücksetzen und nochmal spielen?", onYes: () => send("restart") })}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl"
            >
              ↺ Nochmal spielen
            </button>
            <a
              href={`/api/sessions/${code}/report?fmt=csv`}
              download
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl flex items-center gap-2"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
              </svg>
              Auswertung (CSV)
            </a>
          </div>
        </div>

        {/* Slim ranking sidebar */}
        {phase.finalRanking.length > 0 && (
          <div className="w-52 border-l border-gray-700 flex flex-col relative z-20 shrink-0">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400 px-3 py-2 border-b border-gray-700 shrink-0">
              🏆 Ranking
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
              {phase.finalRanking.map((r) => (
                <div key={r.pid} className="flex items-center gap-2 px-3 py-2">
                  <span className="text-sm font-black w-5 text-center text-yellow-400 shrink-0">
                    {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
                  </span>
                  <AvatarDisplay avatarId={r.avatar} size="sm" />
                  <span className="flex-1 text-xs truncate">{r.name}</span>
                  <span className="text-xs font-mono text-yellow-300 shrink-0">{r.score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Waiting room ───────────────────────────────────────────────────────────
  if (phase.kind === "waiting") {
    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white p-6">
        {confirmModal}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm bg-gray-700 px-3 py-1 rounded font-mono">{code}</span>
          <span className="text-sm text-gray-400">{phase.participantCount} Teilnehmer</span>
        </div>

        <div className="flex-1 flex gap-8 items-start justify-center pt-4 px-4">
          {/* QR Code */}
          <div className="flex flex-col items-center gap-4 flex-shrink-0">
            <div className="bg-white p-4 rounded-3xl shadow-2xl">
              <QRCodeSVG value={joinUrl} size={220} bgColor="#ffffff" fgColor="#1e1b4b" level="M" />
            </div>
            <p className="text-gray-400 text-sm">oder Code eingeben:</p>
            <p className="text-5xl font-black font-mono tracking-[0.2em] text-yellow-400">{code}</p>
            <p className="text-gray-500 text-xs break-all max-w-[240px] text-center">{joinUrl}</p>
          </div>

          {/* Participants + start */}
          <div className="flex flex-col gap-4 min-w-0 flex-1 max-w-lg">
            {teamMode && (
              <div className="bg-gray-800 rounded-2xl p-4 flex flex-col gap-2">
                <p className="text-yellow-400 text-sm font-semibold">👥 Team-Modus</p>
                <div className="flex flex-wrap gap-2">
                  {teams.map(t => (
                    <span key={t.id} className="flex items-center gap-1 text-xs bg-gray-700 px-2 py-1 rounded-lg">
                      {t.name}
                      <button onClick={() => removeTeam(t.id)} className="text-red-400 hover:text-red-300 ml-0.5">✕</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 outline-none"
                    placeholder="Team-Name…"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addTeam()}
                  />
                  <button onClick={addTeam} className="btn-primary text-sm px-3 rounded-lg font-semibold">+</button>
                </div>
              </div>
            )}
            <p className="text-gray-300 text-lg font-semibold">
              {phase.participantCount === 0 ? "Warte auf Teilnehmer…" : `${phase.participantCount} Teilnehmer beigetreten`}
            </p>
            <div className="flex flex-wrap gap-3 min-h-[80px]">
              {phase.participants.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-1 group relative">
                  <AvatarDisplay avatarId={p.avatar} size="md" />
                  <span className="text-xs text-gray-400 max-w-[56px] truncate text-center">{p.name}</span>
                  <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
                    <button
                      title="Umbenennen"
                      onClick={() => {
                        const name = prompt("Neuer Name:", p.name);
                        if (name?.trim()) send("rename", { participant_id: p.id, name: name.trim() });
                      }}
                      className="bg-blue-600 text-white text-xs px-1 rounded"
                    >✎</button>
                    <button
                      title="Rauswerfen"
                      onClick={() => { if (confirm(`${p.name} rauswerfen?`)) send("kick", { participant_id: p.id }); }}
                      className="bg-red-600 text-white text-xs px-1 rounded"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => send("start")}
                disabled={phase.participantCount === 0}
                className="btn-primary px-10 py-4 text-xl font-bold rounded-2xl disabled:opacity-40"
              >
                Caputh starten 🚀
              </button>
              <button
                onClick={() => setConfirmDialog({ msg: "Session zurücksetzen? Alle Antworten werden gelöscht.", onYes: () => send("restart") })}
                className="btn-secondary px-5 py-4 text-sm font-medium rounded-xl"
                title="Session zurücksetzen"
              >
                ↺ Zurücksetzen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview phase ──────────────────────────────────────────────────────────
  if (phase.kind === "preview") {
    const { q } = phase;
    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        {qrOverlay}
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
          <button onClick={() => setShowJoinQR(true)} className="font-mono text-gray-400 hover:text-white transition-colors" title="QR zeigen">{code}</button>
          <span className="text-gray-300 font-semibold">
            Frage {q.idx + 1} / {q.total}
          </span>
          <span className="text-gray-500 text-sm">{phase.participantCount} Teilnehmer</span>
        </div>

        {/* Question content — large for beamer */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          {q.imagePath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/uploads/quizzes/${q.imagePath}`}
              alt=""
              className="max-h-64 rounded-xl object-contain shadow-xl"
            />
          )}
          <h2 className="text-4xl font-bold text-center max-w-3xl leading-snug whitespace-pre-line"><MathText text={q.text} /></h2>
          <div className="flex items-center gap-3 mt-1">
            <QuestionTypeBadge type={q.type} size="md" />
            <span className="text-gray-500 text-sm">Antwortzeit: {q.timeLimit}s</span>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="flex items-center justify-center gap-4 px-6 py-5 bg-gray-800 border-t border-gray-700">
          {q.previewTime ? (
            <div className="flex items-center gap-4">
              <Countdown key={q.id} seconds={q.previewTime} onZero={() => send("show_answers")} />
              <span className="text-gray-400 text-sm">Antworten erscheinen gleich…</span>
            </div>
          ) : (
            <button
              onClick={() => send("show_answers")}
              className="btn-primary px-10 py-4 text-xl font-bold rounded-2xl"
            >
              Antworten zeigen →
            </button>
          )}
          <button
            onClick={() => send("next")}
            className="btn-secondary px-5 py-4 text-sm font-medium rounded-xl"
          >
            Überspringen
          </button>
        </div>
      </div>
    );
  }

  // ── Answering phase ────────────────────────────────────────────────────────
  if (phase.kind === "answering") {
    const { q, answers, timeLimit, counts, responses, participantCount } = phase;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        {qrOverlay}
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
          <button onClick={() => setShowJoinQR(true)} className="font-mono text-gray-400 hover:text-white transition-colors" title="QR zeigen">{code}</button>
          <span className="text-gray-300 font-semibold">Frage {q.idx + 1} / {q.total}</span>
          <span className="text-green-400 text-sm font-medium">
            {responses} / {participantCount} geantwortet
          </span>
        </div>

        {/* Question + countdown */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-700">
          <div className="flex-1">
            {q.imagePath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/uploads/quizzes/${q.imagePath}`} alt="" className="h-24 rounded-lg object-contain mb-2" />
            )}
            <h2 className="text-2xl font-bold whitespace-pre-line leading-snug"><MathText text={q.text} /></h2>
            <div className="mt-1"><QuestionTypeBadge type={q.type} size="sm" /></div>
          </div>
          <div className="ml-8 flex-shrink-0">
            <Countdown seconds={timeLimit} onZero={() => send("next")} />
          </div>
        </div>

        {/* Answer grid with live bars */}
        {q.type === "timeline" && phase.timeline ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 min-h-0 overflow-y-auto">
            <p className="text-gray-400 text-sm">
              {phase.timeline.mode === "sort"
                ? "Schüler ziehen die Karten an die richtige Stelle…"
                : "Schüler suchen die falsch platzierten Einträge…"}
            </p>
            <div className="w-full max-w-3xl bg-[var(--bg)] text-[var(--text)] rounded-2xl p-4">
              <TimelineGameBoard board={phase.timeline} answer={{}} disabled />
            </div>
          </div>
        ) : q.type === "sort" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
            <p className="text-gray-400 text-sm mb-2">Schüler sortieren die Antworten…</p>
            {answers.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 w-full max-w-lg bg-gray-800 rounded-xl px-4 py-3">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}>{i + 1}</span>
                <span className="flex-1 font-semibold"><MathText text={a.text} /></span>
              </div>
            ))}
          </div>
        ) : q.type === "umrechnung" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            <p className="text-gray-400 text-base">Schüler geben einen Zahlenwert ein…</p>
            <div className="flex items-center gap-3 bg-gray-800 rounded-2xl px-8 py-5">
              <span className="text-gray-400 text-xl font-bold">=</span>
              <span className="text-white/30 text-4xl font-black w-32 text-center border-2 border-dashed border-gray-600 rounded-xl py-2">?</span>
              {answers[0] && (() => {
                const parts = answers[0].text.split(" ");
                const unit = parts.length > 1 && !/^\d+$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : "";
                return unit ? <span className="text-white text-2xl font-semibold">{unit}</span> : null;
              })()}
            </div>
            <p className="text-green-400 font-bold text-lg">{counts[answers[0]?.id ?? 0] ?? 0} richtig</p>
          </div>
        ) : (
        <div className="flex-1 grid grid-cols-2 gap-3 p-6">
          {answers.map((a, i) => {
            const count = counts[a.id] ?? 0;
            const pct = total > 0 ? count / total : 0;
            return (
              <div
                key={a.id}
                className="relative rounded-2xl overflow-hidden flex flex-col justify-end"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              >
                {/* Live bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-20 transition-all duration-500"
                  style={{ height: `${pct * 100}%` }}
                />
                <div className="relative p-4 flex justify-between items-end">
                  <span className="text-lg font-bold"><MathText text={a.text} /></span>
                  <span className="text-3xl font-black">{count}</span>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Controls */}
        <div className="flex justify-center px-6 py-4 bg-gray-800 border-t border-gray-700">
          <button
            onClick={() => send("next")}
            className="px-8 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-400"
          >
            Jetzt auflösen →
          </button>
        </div>
      </div>
    );
  }

  // ── Revealed phase ─────────────────────────────────────────────────────────
  if (phase.kind === "revealed") {
    const { q, answers, correctIds, counts } = phase;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        {qrOverlay}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
          <button onClick={() => setShowJoinQR(true)} className="font-mono text-gray-400 hover:text-white transition-colors" title="QR zeigen">{code}</button>
          <span className="text-gray-300 font-semibold">Auflösung – Frage {q.idx + 1} / {q.total}</span>
          <div />
        </div>

        <div className="flex-1 flex flex-col gap-4 p-6 min-h-0 overflow-y-auto">
          <h2 className="text-2xl font-bold whitespace-pre-line leading-snug"><MathText text={q.text} /></h2>
          <div className="flex flex-col gap-3 flex-1 justify-center">
            {q.type === "timeline" && phase.timelineSolution?.axis ? (
              <div className="w-full max-w-3xl mx-auto bg-[var(--bg)] text-[var(--text)] rounded-2xl p-4">
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
                  answer={{}}
                  solution={phase.timelineSolution}
                />
              </div>
            ) : q.type === "umrechnung" ? (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-green-900/40 border border-green-700 rounded-2xl px-8 py-5 text-center">
                  <p className="text-gray-400 text-sm mb-1">Richtige Antwort:</p>
                  <p className="text-4xl font-black text-green-300"><MathText text={answers[0]?.text ?? ""} /></p>
                </div>
                <p className="text-gray-300 text-base">
                  <span className="text-green-400 font-bold text-xl">{counts[answers[0]?.id ?? 0] ?? 0}</span>
                  {" Schüler hatten die richtige Zahl"}
                </p>
              </div>
            ) : q.type === "sort" ? (
              // Sort: show answers in correct order
              (correctIds ?? []).map((cid, pos) => {
                const a = answers.find(x => x.id === cid);
                if (!a) return null;
                return (
                  <div key={cid} className="flex items-center gap-3 bg-green-900/40 border border-green-700 rounded-xl px-4 py-3">
                    <span className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-base font-black flex-shrink-0">{pos + 1}</span>
                    <span className="flex-1 font-semibold text-lg">{a.text}</span>
                  </div>
                );
              })
            ) : (
            answers.map((a, i) => {
              const isCorrect = correctIds?.includes(a.id);
              const count = counts[a.id] ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const barColor = isCorrect ? "#4ade80" : COLORS[i % COLORS.length];
              return (
                <div key={a.id} className={`${!isCorrect && correctIds !== null ? "opacity-55" : ""}`}>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-black"
                      style={{ backgroundColor: isCorrect ? "#26890c" : COLORS[i % COLORS.length] }}>
                      {isCorrect ? "✓" : ""}
                    </div>
                    <span className="font-semibold text-lg whitespace-pre-line leading-snug flex-1"><MathText text={a.text} /></span>
                    <span className="font-mono font-bold text-xl">{count}</span>
                    <span className="text-gray-400 text-base w-12 text-right">{pct}%</span>
                  </div>
                  <div className="h-5 bg-gray-700 rounded-full overflow-hidden ml-9">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })
            )}
          </div>
        </div>

        <div className="flex justify-center px-6 py-4 bg-gray-800 border-t border-gray-700">
          <button
            onClick={() => send("next")}
            className="btn-primary px-8 py-3 font-bold rounded-xl text-lg"
          >
            Ranking zeigen 🏆
          </button>
        </div>
      </div>
    );
  }

  // ── Ranking slide ───────────────────────────────────────────────────────────
  if (phase.kind === "ranking") {
    const { ranking, isLast } = phase;
    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        {qrOverlay}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
          <button onClick={() => setShowJoinQR(true)} className="font-mono text-gray-400 hover:text-white transition-colors" title="QR zeigen">{code}</button>
          <span className="text-gray-300 font-semibold text-xl">🏆 Zwischenranking</span>
          <div />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 overflow-y-auto">
          {ranking.slice(0, 10).map((r) => (
            <div
              key={r.pid}
              className="flex items-center gap-4 bg-gray-800 rounded-2xl px-5 py-3 w-full max-w-lg"
            >
              <span className="text-2xl font-black w-10 text-center text-yellow-400">
                {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
              </span>
              <AvatarDisplay avatarId={r.avatar} size="sm" />
              <span className="flex-1 text-lg font-semibold">{r.name}</span>
              <div className="text-right">
                <div className="font-mono font-bold text-yellow-300 text-lg">{r.score.toFixed(2)}</div>
                {r.delta > 0 && <div className="text-green-400 text-sm">+{r.delta.toFixed(2)}</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center px-6 py-4 bg-gray-800 border-t border-gray-700">
          <button
            onClick={() => send("next")}
            className="btn-primary px-8 py-3 font-bold rounded-xl text-lg"
          >
            {isLast ? "Caputh beenden 🏁" : "Nächste Frage →"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
