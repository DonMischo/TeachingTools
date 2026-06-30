"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, BingoCardOut } from "@/lib/api";

type GameState = {
  status: string;
  last_called: { index: number; caller: string; answer: string } | null;
  called_indices: number[];
};

export default function BingoPlayPage() {
  const { code } = useParams<{ code: string }>();
  const { auth } = useAuth();
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const [card, setCard] = useState<BingoCardOut | null>(null);
  const [game, setGame] = useState<GameState>({ status: "waiting", last_called: null, called_indices: [] });
  const [bingo, setBingo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);

  const studentId = auth?.student?.id ?? 0;

  // Fetch card once authenticated
  useEffect(() => {
    if (!studentId) return;
    setLoadingCard(true);
    api.bingo.getOrCreateCard(code, studentId)
      .then(setCard)
      .catch(e => setError(e.message ?? "Karte konnte nicht geladen werden"))
      .finally(() => setLoadingCard(false));
  }, [code, studentId]);

  // WebSocket
  useEffect(() => {
    if (!studentId) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${proto}://${window.location.host}/api/bingo/${code}/ws?role=student&student_id=${studentId}`
    );
    wsRef.current = ws;

    ws.onclose = (e) => {
      if (e.code === 4004) setError("Bingo-Runde nicht gefunden.");
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "state") {
        setGame({ status: msg.status, last_called: msg.last_called, called_indices: msg.called_indices });
      } else if (msg.event === "started") {
        setGame(prev => ({ ...prev, status: "active" }));
      } else if (msg.event === "called") {
        setGame(prev => ({
          ...prev,
          last_called: { index: msg.index, caller: msg.caller, answer: msg.answer },
          called_indices: [...prev.called_indices, msg.index],
        }));
      } else if (msg.event === "mark_ack") {
        setCard(prev => prev ? { ...prev, marked_positions: msg.marked_positions } : prev);
      } else if (msg.event === "bingo") {
        setCard(prev => prev ? { ...prev, marked_positions: msg.marked_positions, has_bingo: true } : prev);
        setBingo(true);
      } else if (msg.event === "closed") {
        setGame(prev => ({ ...prev, status: "closed" }));
      }
    };

    return () => ws.close();
  }, [code, studentId]);

  function markCell(pos: number) {
    if (game.status !== "active" || !card) return;
    const cell = card.cells[pos];
    if (!game.called_indices.includes(cell.pair_index)) return;
    if (card.marked_positions.includes(pos)) return;
    wsRef.current?.send(JSON.stringify({ action: "mark", position: pos }));
  }

  if (!auth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[var(--bg)]">
        <div className="text-4xl">🎰</div>
        <p className="text-[var(--text-muted)] text-sm">Bitte einloggen, um mitzuspielen.</p>
        <button onClick={() => router.push("/")} className="btn-secondary text-sm py-1.5 px-4">Zur Startseite</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)]">
        <div className="text-center text-[var(--text-muted)] text-sm">{error}</div>
      </div>
    );
  }

  const gs = card?.grid_size ?? 3;

  return (
    <div className="min-h-screen flex flex-col items-center gap-6 p-6 bg-[var(--bg)]">

      {/* Current call */}
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center min-h-[80px] flex items-center justify-center">
        {game.status === "waiting" ? (
          <span className="text-[var(--text-muted)] text-sm animate-pulse">Warte auf Spielstart…</span>
        ) : game.last_called ? (
          <div>
            <div className="text-2xl font-black text-[var(--accent)]">{game.last_called.caller}</div>
          </div>
        ) : (
          <span className="text-[var(--text-muted)] text-sm">Noch nichts gerufen</span>
        )}
      </div>

      {/* Bingo banner */}
      {bingo && (
        <div className="w-full max-w-sm rounded-2xl bg-[var(--accent)] text-center py-4 font-black text-2xl"
          style={{ color: "var(--accent-text, #111)" }}>
          🎉 BINGO!
        </div>
      )}

      {/* Card */}
      {loadingCard ? (
        <div className="text-[var(--text-muted)] text-sm">Lade Karte…</div>
      ) : card ? (
        <div className="w-full max-w-sm">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${gs}, 1fr)` }}
          >
            {card.cells.map((cell, pos) => {
              const isMarked = card.marked_positions.includes(pos);
              const isCalled = game.called_indices.includes(cell.pair_index);
              const canMark = isCalled && !isMarked && game.status === "active";
              return (
                <button
                  key={pos}
                  onClick={() => markCell(pos)}
                  disabled={!canMark && !isMarked}
                  className={`aspect-square rounded-xl border-2 text-sm font-semibold transition-all duration-150 flex items-center justify-center p-1 text-center leading-tight ${
                    isMarked
                      ? "bg-[var(--accent)] border-[var(--accent)] scale-95"
                      : canMark
                      ? "border-[var(--accent)] animate-pulse cursor-pointer hover:scale-105"
                      : "border-[var(--border)] text-[var(--text-muted)] cursor-default"
                  }`}
                  style={isMarked ? { color: "var(--accent-text, #111)" } : undefined}
                >
                  {cell.answer}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)] text-center mt-3">
            Leuchtende Felder anklicken wenn der Begriff gerufen wurde
          </p>
        </div>
      ) : null}

      {game.status === "closed" && !bingo && (
        <div className="text-center text-[var(--text-muted)] text-sm">Spiel beendet. Kein Bingo diesmal!</div>
      )}
    </div>
  );
}
