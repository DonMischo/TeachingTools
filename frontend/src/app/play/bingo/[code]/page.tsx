"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { wsUrl } from "@/lib/utils";

type Cell = { pair_index: number; answer: string };
type CardState = { grid_size: number; grid_cols: number; cells: Cell[]; marked_positions: number[]; has_bingo: boolean };
type GameState = { status: string; last_called: { caller: string; answer: string } | null; called_indices: number[] };

type Phase =
  | { kind: "join" }
  | { kind: "waiting"; name: string }
  | { kind: "playing"; name: string }
  | { kind: "closed" };

const STORAGE_KEY = (code: string) => `bingo_session_${code}`;

function loadSaved(code: string): { token: string; name: string } | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY(code)) ?? "null"); } catch { return null; }
}
function saveSaved(code: string, token: string, name: string) {
  try { localStorage.setItem(STORAGE_KEY(code), JSON.stringify({ token, name })); } catch {}
}
function newToken() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function BingoPlayPage() {
  const { code } = useParams<{ code: string }>();
  const wsRef = useRef<WebSocket | null>(null);

  const [phase, setPhase] = useState<Phase>({ kind: "join" });
  const [nameInput, setNameInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ token: string; name: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  const [card, setCard] = useState<CardState | null>(null);
  const [game, setGame] = useState<GameState>({ status: "waiting", last_called: null, called_indices: [] });
  const [bingo, setBingo] = useState(false);

  useEffect(() => {
    setSaved(loadSaved(code));
    setMounted(true);
  }, [code]);

  function connect(token: string, name: string) {
    setJoinError(null);
    saveSaved(code, token, name);
    const url = wsUrl(`/api/bingo/${code}/ws?role=student&token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onclose = (e) => {
      if (e.code === 4004) setJoinError("Bingo-Runde nicht gefunden.");
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "state") {
        setGame({ status: msg.status, last_called: msg.last_called, called_indices: msg.called_indices ?? [] });
        if (msg.status === "closed") setPhase({ kind: "closed" });
        else if (msg.status === "active" && card) setPhase({ kind: "playing", name });
        else setPhase({ kind: "waiting", name });
      } else if (msg.event === "card") {
        setCard({ grid_size: msg.grid_size, grid_cols: msg.grid_cols ?? msg.grid_size, cells: msg.cells, marked_positions: msg.marked_positions, has_bingo: msg.has_bingo });
      } else if (msg.event === "started") {
        setGame(prev => ({ ...prev, status: "active" }));
        setPhase({ kind: "playing", name });
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
      }
    };
  }

  function joinNew() {
    const n = nameInput.trim();
    if (!n) return;
    connect(newToken(), n);
  }

  function rejoin() {
    if (!saved) return;
    connect(saved.token, saved.name);
  }

  function markCell(pos: number) {
    if (game.status !== "active" || !card) return;
    const cell = card.cells[pos];
    if (!game.called_indices.includes(cell.pair_index)) return;
    if (card.marked_positions.includes(pos)) return;
    wsRef.current?.send(JSON.stringify({ action: "mark", position: pos }));
  }

  // ── Join screen ──────────────────────────────────────────────────────────
  if (!mounted || phase.kind === "join") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 bg-[var(--bg)]">
        <div className="text-5xl">🎰</div>
        <h1 className="text-2xl font-black tracking-tight text-center">Bingo beitreten</h1>
        <p className="text-sm text-[var(--text-muted)] font-mono tracking-widest">{code}</p>

        {joinError && (
          <p className="text-red-400 text-sm text-center">{joinError}</p>
        )}

        {saved && (
          <div className="w-full max-w-xs flex flex-col gap-2">
            <button
              onClick={rejoin}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Weiterspielen als {saved.name}
            </button>
            <button
              onClick={() => setSaved(null)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] text-center"
            >
              Neuer Name
            </button>
          </div>
        )}

        {!saved && (
          <div className="w-full max-w-xs flex flex-col gap-3">
            <input
              autoFocus
              className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-4 py-3 text-center text-lg font-semibold outline-none focus:border-[var(--accent)]"
              placeholder="Dein Name"
              maxLength={30}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && joinNew()}
            />
            <button
              onClick={joinNew}
              disabled={!nameInput.trim()}
              className="w-full py-3 rounded-xl font-bold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Beitreten
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Waiting screen ───────────────────────────────────────────────────────
  if (phase.kind === "waiting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[var(--bg)]">
        <div className="text-5xl">🎰</div>
        <p className="font-semibold text-lg">{phase.name}</p>
        <p className="text-[var(--text-muted)] text-sm animate-pulse">Warte auf Spielstart…</p>
      </div>
    );
  }

  if (phase.kind === "closed") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 bg-[var(--bg)]">
        <div className="text-4xl">🎰</div>
        <p className="text-[var(--text-muted)] text-sm text-center">Spiel beendet.{!bingo ? " Kein Bingo diesmal!" : ""}</p>
      </div>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────
  const cols = card?.grid_cols ?? card?.grid_size ?? 4;

  return (
    <div className="min-h-screen flex flex-col items-center gap-5 p-5 pb-10 bg-[var(--bg)]">

      {/* Current call */}
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center min-h-[72px] flex items-center justify-center mt-2">
        {game.last_called ? (
          <div className="text-2xl font-black text-[var(--accent)]">{game.last_called.caller}</div>
        ) : (
          <span className="text-[var(--text-muted)] text-sm animate-pulse">Noch nichts gerufen…</span>
        )}
      </div>

      {/* Bingo banner */}
      {bingo && (
        <div className="w-full max-w-sm rounded-2xl py-4 text-center font-black text-2xl"
          style={{ background: "var(--accent)", color: "white" }}>
          🎉 BINGO!
        </div>
      )}

      {/* Card */}
      {card ? (
        <div className="w-full max-w-sm">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {card.cells.map((cell, pos) => {
              const isMarked = card.marked_positions.includes(pos);
              const isCalled = game.called_indices.includes(cell.pair_index);
              const canMark = isCalled && !isMarked && game.status === "active";
              return (
                <button
                  key={pos}
                  onClick={() => markCell(pos)}
                  disabled={!canMark && !isMarked}
                  className={`aspect-square rounded-xl border-2 text-xs font-semibold transition-all duration-150 flex items-center justify-center p-1 text-center leading-tight ${
                    isMarked
                      ? "scale-95 border-[var(--accent)]"
                      : canMark
                      ? "border-[var(--accent)] animate-pulse cursor-pointer hover:scale-105"
                      : "border-[var(--border)] text-[var(--text-muted)] cursor-default"
                  }`}
                  style={isMarked ? { background: "var(--accent)", color: "white" } : undefined}
                >
                  {cell.answer}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)] text-center mt-3">
            Leuchtende Felder antippen wenn der Begriff gerufen wurde
          </p>
        </div>
      ) : (
        <p className="text-[var(--text-muted)] text-sm">Lade Karte…</p>
      )}
    </div>
  );
}
