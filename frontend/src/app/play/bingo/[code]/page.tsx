"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useAuth } from "@/contexts/AuthContext";
import { PlayerIdentityForm, ScopeClassOption } from "@/components/PlayerIdentityForm";
import { GuestExpired } from "@/components/GuestExpired";
import { AVATARS, AvatarDisplay } from "@/components/AvatarPicker";
import { useSavedPlayer, newAnonToken } from "@/hooks/useSavedPlayer";
import { useHubIdentity } from "@/hooks/useHubIdentity";
import { useGuestSession } from "@/hooks/useGuestSession";
import { api } from "@/lib/api";

type Cell = { pair_index: number; answer: string };
type CardState = { grid_size: number; grid_cols: number; cells: Cell[]; marked_positions: number[]; has_bingo: boolean };
type GameState = { status: string; last_called: { caller: string; answer: string } | null; called_indices: number[] };
type Player = { name: string; avatar: string };

type Phase =
  | { kind: "join" }
  | { kind: "waiting"; name: string }
  | { kind: "playing"; name: string }
  | { kind: "closed" };

export default function BingoPlayPage() {
  const { code } = useParams<{ code: string }>();
  const { auth } = useAuth();
  const guest = useGuestSession(code);
  const { saved, save: saveSaved, loaded: savedLoaded } = useSavedPlayer("bingo_session", code);

  const [phase, setPhase] = useState<Phase>({ kind: "join" });
  const [joinError, setJoinError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const playerNameRef = useRef("");
  // Klassenübergreifende Runde (Kurs/WPF): Gäste sagen beim Beitritt, für
  // welche Klasse sie spielen — sonst zählen ihre Punkte für keine.
  const [scopeClasses, setScopeClasses] = useState<ScopeClassOption[]>([]);

  const [card, setCard] = useState<CardState | null>(null);
  const [game, setGame] = useState<GameState>({ status: "waiting", last_called: null, called_indices: [] });
  const [bingo, setBingo] = useState(false);
  const [wrongPositions, setWrongPositions] = useState<number[]>([]);
  const [score, setScore] = useState<{ points: number; ratio: number; max_points: number; correct: number; total_called: number } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Läuft die Runde für einen Kurs/WPF, muss vor dem Beitritt die Klasse
  // feststehen. Bei einer Klassenrunde liefert der Server nichts zu wählen.
  useEffect(() => {
    api.play.scope(code)
      .then(sc => setScopeClasses(sc.needs_class_choice ? sc.classes : []))
      .catch(() => {});
  }, [code]);

  // Auto-connect when logged in (resume saved session or new)
  useEffect(() => {
    if (!mounted || !savedLoaded || !auth?.student) return;
    const name = auth.student.username ?? auth.student.display_name;
    const avatar = saved?.avatar ?? AVATARS[Math.floor(Math.random() * AVATARS.length)].id;
    connect(saved?.token ?? newAnonToken(), name, avatar);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, savedLoaded, auth?.student?.id]);

  // Pfad der Live-Verbindung; null, solange noch niemand beigetreten ist.
  const [socketPath, setSocketPath] = useState<string | null>(null);

  function connect(token: string, name: string, avatar: string, gtoken?: string | null, classId?: number | null) {
    setJoinError(null);
    setConnecting(true);
    saveSaved({ token, name, avatar });
    playerNameRef.current = name;
    const gt = gtoken ?? guest.token;
    setSocketPath(`/api/bingo/${code}/ws?role=student&token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}${gt ? `&guest_token=${gt}` : ""}${classId ? `&class_id=${classId}` : ""}`);
  }

  const live = useLiveSocket(
    socketPath,
    (msg) => {
      const name = playerNameRef.current;
      if (msg.event === "state") {
        setGame({ status: msg.status, last_called: msg.last_called, called_indices: msg.called_indices ?? [] });
        if (Array.isArray(msg.players)) setPlayers(msg.players);
        if (msg.status === "closed") setPhase({ kind: "closed" });
        else if (msg.status === "active" && card) setPhase({ kind: "playing", name });
        else setPhase({ kind: "waiting", name });
      } else if (msg.event === "players") {
        setPlayers(Array.isArray(msg.players) ? msg.players : []);
      } else if (msg.event === "card") {
        setCard({ grid_size: msg.grid_size, grid_cols: msg.grid_cols ?? msg.grid_size, cells: msg.cells, marked_positions: msg.marked_positions, has_bingo: msg.has_bingo });
      } else if (msg.event === "started") {
        setGame(prev => ({ ...prev, status: "active" }));
        setPhase(prev => ({ kind: "playing", name: prev.kind === "waiting" ? prev.name : name }));
      } else if (msg.event === "called") {
        setGame(prev => ({
          ...prev,
          last_called: { caller: msg.caller, answer: msg.answer },
          called_indices: [...prev.called_indices, msg.index],
        }));
      } else if (msg.event === "mark_ack") {
        setCard(prev => prev ? { ...prev, marked_positions: msg.marked_positions } : prev);
      } else if (msg.event === "bingo") {
        setCard(prev => prev ? { ...prev, marked_positions: msg.marked_positions, has_bingo: true } : prev);
        setBingo(true);
      } else if (msg.event === "closed") {
        setGame(prev => ({ ...prev, status: "closed" }));
        setPhase({ kind: "closed" });
      } else if (msg.event === "wrong_mark") {
        setWrongPositions(prev => prev.includes(msg.position) ? prev : [...prev, msg.position]);
      } else if (msg.event === "score") {
        setScore({ points: msg.points, ratio: msg.ratio, max_points: msg.max_points, correct: msg.correct, total_called: msg.total_called });
      } else if (msg.event === "reset") {
        setWrongPositions([]);
        setBingo(false);
        setScore(null);
        setCard(prev => prev ? { ...prev, marked_positions: [], has_bingo: false } : prev);
        setGame({ status: "waiting", last_called: null, called_indices: [] });
        setPhase({ kind: "waiting", name: playerNameRef.current });
      }
    },
    {
      onOpen: () => setConnecting(false),
      onClose: () => setConnecting(false),
      onRejected: (c) => {
        setConnecting(false);
        // Pfad vergessen, damit ein erneuter Beitritt wirklich neu verbindet.
        setSocketPath(null);
        if (c === 4004) setJoinError("Bingo-Runde nicht gefunden.");
        else if (c === 4001) guest.markExpired();  // guest token missing/expired → hard block
      },
    },
  );

  async function handleGuestJoin(name: string, avatar: string, _teamId?: number | null, classId?: number | null) {
    try {
      let gt = guest.token;
      if (!auth && !gt) gt = (await guest.join("bingo", name)).token;
      connect(saved?.token ?? newAnonToken(), name, avatar, gt, classId ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Beitritt fehlgeschlagen";
      setJoinError(/freigeschaltet/.test(msg) ? "Für diese Runde sind Gäste nicht freigeschaltet. Bitte melde dich an." : msg);
    }
  }

  // Aus dem Playhub durchgereicht — Gäste sind dort schon vorgestellt worden.
  useHubIdentity(
    code,
    mounted && savedLoaded && !auth?.student && scopeClasses.length === 0 && phase.kind === "join",
    (id) => { void handleGuestJoin(id.name, id.avatar); },
  );

  function markCell(pos: number) {
    if (game.status !== "active" || !card) return;
    if (card.marked_positions.includes(pos) || wrongPositions.includes(pos)) return;
    live.send({ action: "mark", position: pos });
  }

  // Guest's 60-min window elapsed → hard block, no rejoin.
  if (mounted && guest.expired && !auth) return <GuestExpired gameIcon="🎰" onRejoin={guest.rejoin} />;

  // ── Join screen ──────────────────────────────────────────────────────────────
  if (!mounted || (phase.kind === "join" && !auth?.student)) {
    return (
      <PlayerIdentityForm
        gameCode={code}
        gameIcon="🎰"
        error={joinError}
        submitting={connecting}
        classes={scopeClasses}
        onJoin={handleGuestJoin}
      />
    );
  }

  // Logged-in auto-connect — show spinner while connecting
  if (phase.kind === "join" && auth?.student) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)] text-sm animate-pulse">Verbinde…</p>
      </div>
    );
  }

  // ── Waiting screen ───────────────────────────────────────────────────────────
  if (phase.kind === "waiting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[var(--bg)]">
        <div className="text-5xl">🎰</div>
        <p className="font-semibold text-lg">{phase.name}</p>
        <p className="text-[var(--text-muted)] text-sm animate-pulse">Warte auf Spielstart…</p>
        {players.length > 0 && (
          <div className="w-full max-w-xs mt-2">
            <p className="text-xs text-[var(--text-muted)] text-center mb-2">{players.length} Spieler beigetreten</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {players.map((p, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <AvatarDisplay avatarId={p.avatar} size="md" />
                  <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Closed screen ────────────────────────────────────────────────────────────
  if (phase.kind === "closed") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[var(--bg)] text-center">
        <div className="text-4xl">🎰</div>
        {bingo && <p className="font-black text-xl text-[var(--accent)]">🎉 BINGO!</p>}
        <p className="text-[var(--text-muted)] text-sm">Spiel beendet.</p>
        {score && (
          <div className="w-full max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col items-center gap-2 mt-2">
            <p className="text-4xl font-black" style={{ color: "var(--accent)" }}>{score.points}</p>
            <p className="text-sm font-semibold">von {score.max_points} Punkten</p>
            <p className="text-xs text-[var(--text-muted)]">
              {score.correct} von {score.total_called} gerufenen Feldern markiert ({Math.round(score.ratio * 100)} %)
            </p>
            <div className="w-full h-2 rounded-full bg-[var(--border)] mt-1 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${score.ratio * 100}%`, background: "var(--accent)" }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────────
  const cols = card?.grid_cols ?? card?.grid_size ?? 4;

  return (
    <div className="min-h-screen flex flex-col items-center gap-5 p-5 pb-10 bg-[var(--bg)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center min-h-[72px] flex items-center justify-center mt-2">
        {game.last_called ? (
          <div className="text-2xl font-black text-[var(--accent)]">{game.last_called.caller}</div>
        ) : (
          <span className="text-[var(--text-muted)] text-sm animate-pulse">Noch nichts gerufen…</span>
        )}
      </div>

      {bingo && (
        <div className="w-full max-w-sm rounded-2xl py-4 text-center font-black text-2xl"
          style={{ background: "var(--accent)", color: "white" }}>
          🎉 BINGO!
        </div>
      )}

      {card ? (
        <div className="w-full max-w-sm">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {card.cells.map((cell, pos) => {
              const isMarked = card.marked_positions.includes(pos);
              const isWrong = wrongPositions.includes(pos);
              return (
                <button
                  key={pos}
                  onClick={() => markCell(pos)}
                  disabled={isMarked || isWrong}
                  className={`aspect-square min-w-0 overflow-hidden rounded-xl border-2 font-semibold transition-all duration-150 flex items-center justify-center p-1 text-center leading-tight break-words hyphens-auto ${
                    isMarked ? "scale-95 border-[var(--accent)]"
                    : isWrong ? "scale-95 border-red-500 cursor-not-allowed"
                    : "border-[var(--border)] text-[var(--text-muted)] cursor-pointer hover:scale-105"
                  }`}
                  style={{
                    fontSize: cell.answer.length > 12 ? "9px" : cell.answer.length > 8 ? "10px" : "12px",
                    ...(isMarked ? { background: "var(--accent)", color: "white" }
                      : isWrong ? { background: "#ef444433", color: "#ef4444" }
                      : {}),
                  }}
                >
                  {cell.answer}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Felder antippen wenn der Begriff gerufen wurde
          </p>
        </div>
      ) : (
        <p className="text-[var(--text-muted)] text-sm">Lade Karte…</p>
      )}
    </div>
  );
}
