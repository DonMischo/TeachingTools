"use client";
import { AuswertungKnopf } from "@/components/sitzung/AuswertungKnopf";
import { lueckentextQuelle } from "@/lib/lueckentext/sitzung";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useToast } from "@/contexts/ToastContext";
import { SitzungKopf } from "@/components/sitzung/SitzungKopf";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { api } from "@/lib/api";

type RankingEntry = { pid: number; name: string; avatar: string; score: number; rank: number };

export default function LueckentextHostPage() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useToast();

  const [status, setStatus] = useState<"waiting" | "active" | "finished">("waiting");
  const [ranking, setRanking] = useState<RankingEntry[]>([]);

  const { connected } = useLiveSocket(
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
    <div className="page">
      <SitzungKopf titel="📝 Lückentext-Sitzung" code={code} pfad={`/aktivitaeten/lueckentext/play/${code}`} gast="lueckentext" live={connected}
        zurueck={{ href: "/aktivitaeten/lueckentexte", label: "Lückentexte" }}
        info={[status === "waiting" ? "Wartet auf Start" : status === "active" ? "Aktiv" : "Beendet"]} />

      <div className="flex gap-3 flex-wrap">
        {status === "waiting" && (
          <button onClick={handleStart} className="btn-primary w-full">▶ Starten</button>
        )}
        {status === "active" && (
          <button onClick={handleFinish}
            className="text-sm border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-xl px-4 py-1.5 transition-colors">
            ■ Beenden
          </button>
        )}
        {/* Auswertung jederzeit, auch während der Runde */}
        <div className="flex gap-3 items-center flex-wrap text-sm">
          <AuswertungKnopf titel="Lückentext" quelle={lueckentextQuelle(code)} />
          <Link href={`/aktivitaeten/lueckentext/review/${code}`} className="text-accent hover:underline">
            Einzelne Lücken →
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-sm">Rangliste</h2>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted">Noch keine Teilnehmer.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {ranking.map((r) => (
              <div key={r.pid} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
                <span className="w-6 text-center font-black text-accent">{r.rank}</span>
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
