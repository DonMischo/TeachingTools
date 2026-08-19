"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/contexts/ToastContext";
import { JoinQR } from "@/components/JoinQR";
import { GuestAccessToggle } from "@/components/GuestAccessToggle";
import { useLanUrl } from "@/hooks/useLanUrl";

type Bid = { house_id: number; house_name: string; amount: number; student_id: number | null };

type LiveState = {
  status: string;
  title: string;
  description: string | null;
  prize_description: string | null;
  bids: Bid[];
  winner_house_id: number | null;
  winner_name: string | null;
  winning_bid: number | null;
};

export default function AuctionHostPage() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const joinUrl = useLanUrl(`/play/auction/${code}`);
  const [live, setLive] = useState<LiveState>({
    status: "waiting", title: "", description: null, prize_description: null,
    bids: [], winner_house_id: null, winner_name: null, winning_bid: null,
  });

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/api/auction/${code}/ws?role=teacher`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "state") {
        setLive(msg);
      } else if (msg.event === "bid_update") {
        setLive(prev => ({ ...prev, bids: msg.bids }));
      } else if (msg.event === "bidding_open") {
        setLive(prev => ({ ...prev, status: "bidding" }));
      } else if (msg.event === "bidding_closed") {
        setLive(prev => ({ ...prev, status: "closed", bids: msg.bids }));
      } else if (msg.event === "awarded") {
        setLive(prev => ({
          ...prev,
          winner_house_id: msg.winner_house_id,
          winner_name: msg.winner_name,
          winning_bid: msg.winning_bid,
        }));
        toast(`🏆 ${msg.winner_name} gewinnt mit ${msg.winning_bid} Punkten!`, "success");
      }
    };
    ws.onerror = () => toast("WebSocket-Fehler", "error");
    return () => ws.close();
  }, [code]);

  function send(msg: object) {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(msg));
  }

  const maxBid = live.bids.length > 0 ? Math.max(...live.bids.map(b => b.amount)) : 0;
  const winner = live.bids.find(b => b.amount === maxBid);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <Link href="/tools/auction" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Auktion</Link>
          <h1 className="text-2xl font-black tracking-tight mt-1">🏷 {live.title || "…"}</h1>
          {live.prize_description && (
            <div className="text-sm text-[var(--text-muted)] mt-0.5">🏆 {live.prize_description}</div>
          )}
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Code: <b className="text-[var(--text)]">{code}</b>
            {live.status === "waiting" && " · Noch nicht geöffnet"}
            {live.status === "bidding" && " · Gebote laufen"}
            {live.status === "closed" && " · Abgeschlossen"}
          </div>
        </div>
        {joinUrl && (
          <div className="flex flex-col items-center gap-1">
            <JoinQR url={joinUrl} />
            <span className="text-xs text-[var(--text-muted)]">/play/auction/{code}</span>
            <GuestAccessToggle tool="auction" code={code} />
          </div>
        )}
      </div>

      {/* Bids */}
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-sm">Gebote ({live.bids.length})</h2>
        {live.bids.length === 0 ? (
          <div className="text-[var(--text-muted)] text-sm">Noch keine Gebote eingegangen.</div>
        ) : (
          [...live.bids].sort((a, b) => b.amount - a.amount).map(bid => (
            <div key={bid.house_id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${bid.amount === maxBid ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] bg-[var(--surface)]"}`}>
              <div className="flex-1 font-semibold text-sm">{bid.house_name}</div>
              <div className="font-mono font-bold text-lg text-[var(--accent)]">{bid.amount}</div>
              {live.status === "closed" && !live.winner_house_id && (
                <button
                  onClick={() => send({ action: "award", house_id: bid.house_id, amount: bid.amount })}
                  className="btn-primary text-xs py-1 px-3">
                  Vergeben
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Winner */}
      {live.winner_house_id && (
        <div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent)]/10 p-4 text-center">
          <div className="text-2xl mb-1">🏆</div>
          <div className="font-bold text-lg">{live.winner_name}</div>
          <div className="text-sm text-[var(--text-muted)]">gewinnt mit {live.winning_bid} Punkten</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Punkte wurden vom Haus abgezogen.</div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        {live.status === "waiting" && (
          <button onClick={() => send({ action: "open_bidding" })} className="btn-primary">
            Gebote öffnen
          </button>
        )}
        {live.status === "bidding" && (
          <button onClick={() => send({ action: "close_bidding" })} className="btn-secondary">
            Gebote schließen
          </button>
        )}
        {live.status === "closed" && !live.winner_house_id && winner && (
          <button
            onClick={() => send({ action: "award", house_id: winner.house_id, amount: winner.amount })}
            className="btn-primary">
            Höchstgebot vergeben ({winner.house_name}, {maxBid} Pts)
          </button>
        )}
      </div>
    </div>
  );
}
