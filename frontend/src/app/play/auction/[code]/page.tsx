"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { wsUrl } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestSession } from "@/hooks/useGuestSession";
import { useHubIdentity } from "@/hooks/useHubIdentity";
import { GuestExpired } from "@/components/GuestExpired";

type AuctionState = {
  status: string;
  title: string;
  description: string | null;
  prize_description: string | null;
  is_haussprecher: boolean;
  my_bid: number | null;
  winner_house_id: number | null;
  winner_name: string | null;
  winning_bid: number | null;
  players: string[];
};

const STORAGE_KEY = (code: string) => `auction_session_${code}`;

function loadSaved(code: string): { token: string } | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY(code)) ?? "null"); } catch { return null; }
}
function saveSaved(code: string, token: string) {
  try { localStorage.setItem(STORAGE_KEY(code), JSON.stringify({ token })); } catch {}
}
function newToken() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function AuctionPlayPage() {
  const { code } = useParams<{ code: string }>();
  const { auth } = useAuth();
  const guest = useGuestSession(code);
  const wsRef = useRef<WebSocket | null>(null);

  const [nameInput, setNameInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [connected, setConnected] = useState(false);

  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [bidInput, setBidInput] = useState("");

  useEffect(() => { setMounted(true); }, []);

  // Auto-connect when logged in
  useEffect(() => {
    if (!mounted || !auth?.student) return;
    const name = `${auth.student.vorname} ${auth.student.nachname}`;
    const saved = loadSaved(code);
    connect(saved?.token ?? newToken(), name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, auth?.student?.id]);

  function connect(token: string, name: string, gtoken?: string | null) {
    if (wsRef.current) wsRef.current.close();
    setJoinError(null);
    saveSaved(code, token);
    const gt = gtoken ?? guest.token;
    const url = wsUrl(`/api/auction/${code}/ws?token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}${gt ? `&guest_token=${gt}` : ""}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onclose = (e) => {
      if (e.code === 4004) setJoinError("Auktion nicht gefunden.");
      else if (e.code === 4001 && !auth) guest.markExpired();  // guest token missing/expired → hard block
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "state") {
        setAuctionState(prev => ({
          status: msg.status,
          title: msg.title,
          description: msg.description ?? null,
          prize_description: msg.prize_description ?? null,
          is_haussprecher: msg.is_haussprecher ?? prev?.is_haussprecher ?? false,
          my_bid: msg.my_bid ?? null,
          winner_house_id: msg.winner_house_id ?? null,
          winner_name: msg.winner_name ?? null,
          winning_bid: msg.winning_bid ?? null,
          players: msg.players ?? prev?.players ?? [],
        }));
        setConnected(true);
      } else if (msg.event === "players") {
        setAuctionState(prev => prev ? { ...prev, players: msg.players ?? [] } : prev);
      } else if (msg.event === "bidding_open") {
        setAuctionState(prev => prev ? { ...prev, status: "bidding" } : prev);
      } else if (msg.event === "bid_ack") {
        setAuctionState(prev => prev ? { ...prev, my_bid: msg.amount } : prev);
        setBidInput("");
      } else if (msg.event === "bidding_closed") {
        setAuctionState(prev => prev ? { ...prev, status: "closed" } : prev);
      } else if (msg.event === "awarded") {
        setAuctionState(prev => prev ? {
          ...prev,
          winner_house_id: msg.winner_house_id,
          winner_name: msg.winner_name,
          winning_bid: msg.winning_bid,
        } : prev);
      }
    };
  }

  async function joinNew() {
    await joinAs(nameInput.trim());
  }

  async function joinAs(n: string) {
    if (!n) return;
    try {
      // Unauthenticated visitors first obtain a 60-min guest token (backend
      // enforces the "Gäste erlauben" opt-in and 403s if it's off).
      let gt = guest.token;
      if (!auth && !gt) gt = (await guest.join("auction", n)).token;
      connect(newToken(), n, gt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Beitritt fehlgeschlagen";
      setJoinError(/freigeschaltet/.test(msg) ? "Für diese Auktion sind Gäste nicht freigeschaltet. Bitte melde dich an." : msg);
    }
  }

  // Aus dem Playhub durchgereicht — der Gast-Token liegt dort schon bereit.
  useHubIdentity(code, mounted && !connected && !auth?.student, (id) => {
    void joinAs(id.name);
  });

  function bid() {
    const amount = parseInt(bidInput);
    if (!amount || amount <= 0) return;
    wsRef.current?.send(JSON.stringify({ action: "bid", amount }));
  }

  // Guest's 60-min window elapsed → hard block, no rejoin.
  if (mounted && !auth && guest.expired) return <GuestExpired gameIcon="🏷" />;

  // ── Join screen (only when not logged in) ───────────────────────────────
  if (!mounted || !connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 bg-[var(--bg)]">
        <div className="text-5xl">🏷</div>
        <h1 className="text-2xl font-black tracking-tight text-center">Auktion beitreten</h1>
        <p className="text-sm text-[var(--text-muted)] font-mono tracking-widest">{code}</p>

        {joinError && <p className="text-red-400 text-sm text-center">{joinError}</p>}

        {auth?.student && !joinError && (
          <p className="text-[var(--text-muted)] text-sm animate-pulse">Verbinde…</p>
        )}

        {!auth?.student && (
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

  if (!auctionState) return null;

  const { status, title, description, prize_description, is_haussprecher, my_bid, winner_house_id, winner_name, winning_bid, players } = auctionState;

  // ── Closed / awarded ─────────────────────────────────────────────────────
  if (status === "closed" || winner_house_id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[var(--bg)] text-center">
        {winner_house_id ? (
          <>
            <div className="text-5xl">🏆</div>
            <h1 className="text-xl font-bold">{winner_name} gewinnt!</h1>
            <p className="text-[var(--text-muted)] text-sm">mit {winning_bid} Punkten</p>
          </>
        ) : (
          <>
            <div className="text-5xl">🔒</div>
            <h1 className="text-xl font-bold">Auktion geschlossen</h1>
            <p className="text-[var(--text-muted)] text-sm animate-pulse">Warte auf Ergebnis…</p>
          </>
        )}
      </div>
    );
  }

  // ── Active (waiting / bidding) ────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg)]">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <div className="text-center">
          <div className="text-4xl mb-3">🏷</div>
          <h1 className="text-xl font-bold">{title}</h1>
          {description && <p className="text-[var(--text-muted)] text-sm mt-1">{description}</p>}
          {prize_description && (
            <div className="mt-2 text-sm font-medium text-[var(--accent)]">🏆 {prize_description}</div>
          )}
        </div>

        {status === "waiting" && (
          <>
            <div className="text-center text-[var(--text-muted)] text-sm animate-pulse">
              Warte auf Auktionsstart…
            </div>
            {players.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-muted)] text-center mb-2">{players.length} Teilnehmer</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {players.map((p, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-lg font-medium"
                      style={{ background: "var(--accent)22", color: "var(--accent)" }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {status === "bidding" && is_haussprecher && (
          <div className="flex flex-col gap-3">
            {my_bid !== null && (
              <div className="text-center text-sm text-green-400">
                Aktuelles Gebot: <b>{my_bid} Punkte</b> ✓
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

        {status === "bidding" && !is_haussprecher && (
          <div className="text-center text-[var(--text-muted)] text-sm">
            Auktion läuft — Gebote werden abgegeben…
          </div>
        )}
      </div>
    </div>
  );
}
