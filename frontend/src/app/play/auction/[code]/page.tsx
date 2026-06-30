"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type Phase =
  | { type: "waiting"; title: string; description: string | null; prize: string | null }
  | { type: "bidding"; title: string; description: string | null; prize: string | null; my_bid: number | null }
  | { type: "closed"; bids: { house_id: number; house_name: string; amount: number }[]; winner_house_id: number | null; winner_name: string | null; winning_bid: number | null }
  | { type: "error"; message: string };

export default function AuctionPlayPage() {
  const { code } = useParams<{ code: string }>();
  const { auth } = useAuth();
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const [phase, setPhase] = useState<Phase>({ type: "waiting", title: "", description: null, prize: null });
  const [bidInput, setBidInput] = useState("");

  const studentId = auth?.student?.id ?? 0;

  useEffect(() => {
    if (!auth?.student) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${proto}://${window.location.host}/api/auction/${code}/ws?role=haussprecher&student_id=${studentId}`
    );
    wsRef.current = ws;

    ws.onclose = (e) => {
      if (e.code === 4003) setPhase({ type: "error", message: "Du bist nicht als Haussprecher eingetragen." });
      if (e.code === 4004) setPhase({ type: "error", message: "Auktion nicht gefunden." });
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "state") {
        if (msg.status === "waiting") {
          setPhase({ type: "waiting", title: msg.title, description: msg.description, prize: msg.prize_description });
        } else if (msg.status === "bidding") {
          setPhase({ type: "bidding", title: msg.title, description: msg.description, prize: msg.prize_description, my_bid: msg.my_bid });
        } else {
          setPhase(prev => ({ type: "closed", bids: [], winner_house_id: msg.winner_house_id, winner_name: msg.winner_name, winning_bid: msg.winning_bid }));
        }
      } else if (msg.event === "bidding_open") {
        setPhase(prev => prev.type === "waiting"
          ? { type: "bidding", title: prev.title, description: prev.description, prize: prev.prize, my_bid: null }
          : prev);
      } else if (msg.event === "bid_ack") {
        setPhase(prev => prev.type === "bidding" ? { ...prev, my_bid: msg.amount } : prev);
        setBidInput("");
      } else if (msg.event === "bidding_closed") {
        setPhase({ type: "closed", bids: msg.bids ?? [], winner_house_id: null, winner_name: null, winning_bid: null });
      } else if (msg.event === "awarded") {
        setPhase(prev => prev.type === "closed"
          ? { ...prev, winner_house_id: msg.winner_house_id, winner_name: msg.winner_name, winning_bid: msg.winning_bid }
          : prev);
      }
    };

    return () => ws.close();
  }, [code, auth, studentId]);

  function bid() {
    const amount = parseInt(bidInput);
    if (!amount || amount <= 0) return;
    wsRef.current?.send(JSON.stringify({ action: "bid", amount }));
  }

  if (!auth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[var(--bg)]">
        <div className="text-4xl">🏷</div>
        <p className="text-[var(--text-muted)] text-sm">Bitte einloggen, um mitzubieten.</p>
        <button onClick={() => router.push("/")} className="btn-secondary text-sm py-1.5 px-4">Zur Startseite</button>
      </div>
    );
  }

  if (phase.type === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)]">
        <div className="text-center text-[var(--text-muted)] text-sm">{phase.message}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg)]">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {(phase.type === "waiting" || phase.type === "bidding") && (
          <>
            <div className="text-center">
              <div className="text-4xl mb-3">🏷</div>
              <h1 className="text-xl font-bold">{phase.title}</h1>
              {phase.description && <p className="text-[var(--text-muted)] text-sm mt-1">{phase.description}</p>}
              {phase.prize && (
                <div className="mt-2 text-sm font-medium text-[var(--accent)]">🏆 {phase.prize}</div>
              )}
            </div>

            {phase.type === "waiting" ? (
              <div className="text-center text-[var(--text-muted)] text-sm animate-pulse">
                Warte auf Auktionsstart…
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {phase.my_bid !== null && (
                  <div className="text-center text-sm text-green-400">
                    Aktuelles Gebot: <b>{phase.my_bid} Punkte</b> ✓
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="number" min={1}
                    className="input flex-1 text-center text-lg font-bold"
                    placeholder="Punkte bieten"
                    value={bidInput}
                    onChange={e => setBidInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && bid()}
                  />
                  <button onClick={bid} disabled={!bidInput} className="btn-primary px-6">
                    Bieten
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)] text-center">
                  Gebote können bis zum Schließen aktualisiert werden.
                </p>
              </div>
            )}
          </>
        )}

        {phase.type === "closed" && (
          <div className="text-center flex flex-col items-center gap-4">
            {phase.winner_house_id ? (
              <>
                <div className="text-5xl">🏆</div>
                <h1 className="text-xl font-bold">{phase.winner_name} gewinnt!</h1>
                <p className="text-[var(--text-muted)] text-sm">mit {phase.winning_bid} Punkten</p>
              </>
            ) : (
              <>
                <div className="text-5xl">🔒</div>
                <h1 className="text-xl font-bold">Auktion geschlossen</h1>
                <p className="text-[var(--text-muted)] text-sm">Warte auf Ergebnis…</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
