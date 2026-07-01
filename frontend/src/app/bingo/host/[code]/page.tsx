"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/contexts/ToastContext";
import QRCode from "qrcode";
import { useLanUrl } from "@/hooks/useLanUrl";

type CalledItem = { index: number; caller: string; answer: string };
type Player = { name: string; avatar: string };
type LineEvent = { student_name: string; line: string };

type LiveState = {
  status: string;
  title: string;
  grid_size: number;
  total_pairs: number;
  called_count: number;
  called_indices: number[];
  last_called: CalledItem | null;
  bingo_count: number;
  players: Player[];
  called_pairs: CalledItem[];
};

type BingoEvent = { student_name: string; student_id: number };

export default function BingoHostPage() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const joinUrl = useLanUrl(`/play/bingo/${code}`);
  const [live, setLive] = useState<LiveState>({
    status: "waiting", title: "", grid_size: 3, total_pairs: 0,
    called_count: 0, called_indices: [], last_called: null, bingo_count: 0, players: [], called_pairs: [],
  });
  const [winners, setWinners] = useState<BingoEvent[]>([]);
  const [lines, setLines] = useState<LineEvent[]>([]);

  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, { width: 160, margin: 1 }).then(setQrUrl).catch(() => {});
  }, [joinUrl]);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/api/bingo/${code}/ws?role=teacher`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "state") {
        setLive(msg);
      } else if (msg.event === "started") {
        setLive(prev => ({ ...prev, status: "active" }));
      } else if (msg.event === "called") {
        const item: CalledItem = { index: msg.index, caller: msg.caller, answer: msg.answer };
        setLive(prev => ({
          ...prev,
          called_count: msg.called_count,
          called_indices: [...prev.called_indices, msg.index],
          last_called: item,
          called_pairs: [...prev.called_pairs, item],
        }));
      } else if (msg.event === "line") {
        setLines(prev => [...prev, { student_name: msg.student_name, line: msg.line }]);
        toast(`📋 ${msg.student_name}: ${msg.line}`, "success");
      } else if (msg.event === "player_bingo") {
        setWinners(prev => [...prev, { student_name: msg.student_name, student_id: msg.student_id }]);
        toast(`🎉 BINGO! ${msg.student_name}`, "success");
      } else if (msg.event === "bingo_count") {
        setLive(prev => ({ ...prev, bingo_count: msg.count }));
      } else if (msg.event === "closed") {
        setLive(prev => ({ ...prev, status: "closed" }));
      } else if (msg.event === "players") {
        setLive(prev => ({ ...prev, players: msg.players ?? [] }));
      } else if (msg.event === "reset") {
        setWinners([]);
        setLines([]);
        setLive(prev => ({ ...prev, called_pairs: [] }));
      }
    };
    ws.onerror = () => toast("WebSocket-Fehler", "error");
    return () => ws.close();
  }, [code]);

  function send(msg: object) {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(msg));
  }

  const remaining = live.total_pairs - live.called_count;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <Link href="/bingo" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Bingo</Link>
          <h1 className="text-2xl font-black tracking-tight mt-1">🎰 {live.title || "…"}</h1>
          <div className="text-xs text-[var(--text-muted)] mt-1 flex gap-3">
            <span>{live.grid_size}×{live.grid_size}</span>
            <span>{live.called_count}/{live.total_pairs} Begriffe gerufen</span>
            <span>{live.bingo_count} Bingo{live.bingo_count !== 1 ? "s" : ""}</span>
          </div>
        </div>
        {qrUrl && (
          <div className="flex flex-col items-center gap-1">
            <img src={qrUrl} alt="QR" className="rounded-xl border border-[var(--border)]" style={{ width: 90, height: 90 }} />
            <span className="text-xs text-[var(--text-muted)]">/play/bingo/{code}</span>
          </div>
        )}
      </div>

      {/* Currently called */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center min-h-[120px] flex flex-col items-center justify-center">
        {live.last_called ? (
          <>
            <div className="text-3xl font-black tracking-tight text-[var(--accent)]">
              {live.last_called.caller}
            </div>
            <div className="text-sm text-[var(--text-muted)] mt-1">
              Antwort: <span className="text-[var(--text)] font-medium">{live.last_called.answer}</span>
            </div>
          </>
        ) : (
          <div className="text-[var(--text-muted)] text-sm">Noch nichts gerufen</div>
        )}
      </div>

      {/* Line completions */}
      {lines.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h2 className="font-semibold text-sm">📋 Reihen</h2>
          <div className="flex flex-wrap gap-1.5">
            {lines.map((l, i) => (
              <div key={i} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-3 py-1.5 text-xs font-medium text-[var(--accent)]">
                <span className="font-bold">{l.student_name}</span> · {l.line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bingo winners */}
      {winners.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h2 className="font-semibold text-sm">🎉 Bingo!</h2>
          {winners.map((w, i) => (
            <div key={i} className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm font-medium text-[var(--accent)]">
              {w.student_name}
            </div>
          ))}
        </div>
      )}

      {/* Lobby — player list (waiting) */}
      {live.status === "waiting" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold">
            {live.players.length === 0
              ? "Warte auf Schüler…"
              : `${live.players.length} Schüler online`}
          </p>
          {live.players.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {live.players.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
                  style={{ background: "var(--accent)18", color: "var(--accent)", border: "1px solid var(--accent)40" }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={{ background: "var(--accent)", color: "white" }}>
                    {p.name[0]?.toUpperCase()}
                  </span>
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        {live.status === "waiting" && (
          <button onClick={() => send({ action: "start" })} className="btn-primary">
            Spiel starten
          </button>
        )}
        {live.status === "active" && (
          <>
            <button
              onClick={() => send({ action: "call_next" })}
              disabled={remaining === 0}
              className="btn-primary"
            >
              {remaining > 0 ? `Nächsten Begriff rufen (${remaining} übrig)` : "Alle Begriffe gerufen"}
            </button>
            <button onClick={() => send({ action: "close" })}
              className="text-sm border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-xl px-4 py-1.5 transition-colors">
              Spiel beenden
            </button>
          </>
        )}
        {live.status === "closed" && (
          <div className="text-[var(--text-muted)] text-sm">Spiel beendet.</div>
        )}
        {live.status !== "waiting" && (
          <button onClick={() => send({ action: "reset" })}
            className="text-sm border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] rounded-xl px-4 py-1.5 transition-colors">
            Zurücksetzen
          </button>
        )}
      </div>

      {/* Already called list */}
      {live.called_pairs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-sm">Bereits gerufen ({live.called_pairs.length})</h2>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {[...live.called_pairs].reverse().map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                <span className="font-semibold min-w-0 truncate text-[var(--accent)]">{item.caller}</span>
                <span className="text-[var(--text-muted)] shrink-0">→</span>
                <span className="text-[var(--text)] truncate">{item.answer}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
