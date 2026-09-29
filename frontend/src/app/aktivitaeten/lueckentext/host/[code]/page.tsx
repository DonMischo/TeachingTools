"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useToast } from "@/contexts/ToastContext";
import { JoinQR } from "@/components/JoinQR";
import { GuestAccessToggle } from "@/components/GuestAccessToggle";
import { useLanUrl } from "@/hooks/useLanUrl";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { api } from "@/lib/api";

type RankingEntry = { pid: number; name: string; avatar: string; score: number; rank: number };

export default function LueckentextHostPage() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useToast();
  const joinUrl = useLanUrl(`/aktivitaeten/lueckentext/play/${code}`);

  const [status, setStatus] = useState<"waiting" | "active" | "finished">("waiting");
  const [ranking, setRanking] = useState<RankingEntry[]>([]);

  useLiveSocket(
    `/api/lueckentexte/sessions/${code}/ws`,
    (msg) => {
      if (msg.event === "ranking") {
        setRanking(msg.ranking ?? []);
      }
    },
    { onRejected: () => toast("WebSocket-Fehler", "error") },
  );

  // Fetch state once for the current status.
  useEffect(() => {
    api.lueckentexte.sessionState(code).then((s) => {
      setStatus(s.status as "waiting" | "active" | "finished");
    }).catch(() => {});
  }, [code]);

  async function handleStart() {
    try {
      await api.lueckentexte.startSession(code);
      setStatus("active");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function handleFinish() {
    try {
      await api.lueckentexte.finishSession(code);
      setStatus("finished");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <Link href="/aktivitaeten/lueckentexte" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Lückentexte</Link>
          <h1 className="text-2xl font-black tracking-tight mt-1">📝 Lückentext-Sitzung</h1>
          <div className="text-xs text-[var(--text-muted)] mt-1 flex gap-3">
            <span className="font-mono tracking-widest">{code}</span>
            <span>{status === "waiting" ? "Wartet auf Start" : status === "active" ? "Aktiv" : "Beendet"}</span>
          </div>
        </div>
        {joinUrl && (
          <div className="flex flex-col items-center gap-1">
            <JoinQR url={joinUrl} />
            <span className="text-xs text-[var(--text-muted)]">/aktivitaeten/lueckentext/play/{code}</span>
            <GuestAccessToggle tool="lueckentext" code={code} />
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        {status === "waiting" && (
          <button onClick={handleStart} className="btn-primary">▶ Starten</button>
        )}
        {status === "active" && (
          <button onClick={handleFinish}
            className="text-sm border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-xl px-4 py-1.5 transition-colors">
            ■ Beenden
          </button>
        )}
        {status === "finished" && (
          <div className="flex gap-3 items-center flex-wrap text-sm">
            <Link href={`/aktivitaeten/lueckentext/review/${code}`} className="text-[var(--accent)] hover:underline">
              Auswertung →
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-sm">Rangliste</h2>
        {ranking.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Noch keine Teilnehmer.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {ranking.map((r) => (
              <div key={r.pid} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <span className="w-6 text-center font-black text-[var(--accent)]">{r.rank}</span>
                <AvatarDisplay avatarId={r.avatar} size="sm" />
                <span className="flex-1 font-medium truncate">{r.name}</span>
                <span className="font-semibold">{r.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
