"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, BarometerSessionOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { JoinQR } from "@/components/JoinQR";
import { useLanUrl } from "@/hooks/useLanUrl";
import { wsUrl } from "@/lib/utils";

type Distribution = Record<number, number>;

type LiveState = {
  status: string;
  current_question_idx: number;
  results_visible: boolean;
  total_questions: number;
  participants: number;
  distributions: Record<number, Distribution>; // question_id → dist
};

function BarChart({ question, dist }: { question: BarometerSessionOut["questions"][0]; dist: Distribution }) {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const vals = Array.from({ length: question.scale_max - question.scale_min + 1 }, (_, i) => question.scale_min + i);
  const max = Math.max(...vals.map(v => dist[v] ?? 0), 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2 h-32">
        {vals.map(v => {
          const count = dist[v] ?? 0;
          const pct = max > 0 ? (count / max) * 100 : 0;
          return (
            <div key={v} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-[var(--accent)]">{count > 0 ? count : ""}</span>
              <div className="w-full rounded-t-lg transition-all duration-500"
                style={{ height: `${Math.max(pct, count > 0 ? 8 : 0)}%`, background: "var(--accent)", opacity: 0.85 }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        {vals.map((v, i) => (
          <div key={v} className="flex-1 text-center text-xs text-[var(--text-muted)]">
            {i === 0 && question.scale_min_label ? question.scale_min_label : v}
            {i === vals.length - 1 && question.scale_max_label && i !== 0 ? ` · ${question.scale_max_label}` : ""}
          </div>
        ))}
      </div>
      <div className="text-xs text-center text-[var(--text-muted)]">{total} Antwort{total !== 1 ? "en" : ""}</div>
    </div>
  );
}

export default function BarometerHostPage() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const joinUrl = useLanUrl(`/play/barometer/${code}`);

  const { data: session } = useQuery<BarometerSessionOut>({
    queryKey: ["barometer", code],
    queryFn: () => api.barometer.get(code),
    staleTime: 60_000,
  });

  const [live, setLive] = useState<LiveState>({
    status: "active", current_question_idx: -1, results_visible: false,
    total_questions: 0, participants: 0, distributions: {},
  });

  // WebSocket
  useEffect(() => {
    const ws = new WebSocket(wsUrl(`/api/barometer/${code}/ws?role=teacher`));
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "state") {
        setLive(prev => ({
          ...prev,
          status: msg.status,
          current_question_idx: msg.current_question_idx,
          results_visible: msg.results_visible,
          total_questions: msg.total_questions,
          participants: msg.participants ?? prev.participants,
          distributions: msg.distribution && msg.question
            ? { ...prev.distributions, [msg.question.id]: msg.distribution }
            : prev.distributions,
        }));
      } else if (msg.event === "participant_joined") {
        setLive(prev => ({ ...prev, participants: msg.count }));
      } else if (msg.event === "response_update") {
        setLive(prev => ({
          ...prev,
          distributions: { ...prev.distributions, [msg.question_id]: msg.distribution },
        }));
      } else if (msg.event === "question") {
        setLive(prev => ({
          ...prev,
          current_question_idx: msg.index,
          results_visible: false,
          total_questions: msg.total,
        }));
      } else if (msg.event === "results") {
        setLive(prev => ({
          ...prev,
          results_visible: true,
          distributions: { ...prev.distributions, [msg.question_id]: msg.distribution },
        }));
      } else if (msg.event === "closed") {
        setLive(prev => ({ ...prev, status: "closed" }));
      }
    };

    ws.onerror = () => toast("WebSocket-Fehler", "error");
    return () => ws.close();
  }, [code]);

  function send(msg: object) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  const currentQ = session?.questions[live.current_question_idx];
  const currentDist = currentQ ? (live.distributions[currentQ.id] ?? {}) : {};

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <Link href="/tools/barometer" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">← Barometer</Link>
          <h1 className="text-2xl font-black tracking-tight mt-1">📊 {session?.title ?? "…"}</h1>
          <div className="flex gap-3 mt-1 text-xs text-[var(--text-muted)]">
            <span>Code: <b className="text-[var(--text)]">{code}</b></span>
            <span>{live.participants} Teilnehmer</span>
            {live.status === "closed" && <span className="text-amber-400">Abgeschlossen</span>}
          </div>
        </div>
        {joinUrl && (
          <div className="flex flex-col items-center gap-1">
            <JoinQR url={joinUrl} />
            <span className="text-xs text-[var(--text-muted)]">/play/barometer/{code}</span>
          </div>
        )}
      </div>

      {/* Question navigator */}
      {session && (
        <div className="flex flex-col gap-3">
          {session.questions.map((q, i) => {
            const isActive = live.current_question_idx === i;
            const dist = live.distributions[q.id] ?? {};
            const hasResponses = Object.values(dist).some(v => v > 0);
            return (
              <div key={q.id}
                className={`border rounded-2xl p-4 flex flex-col gap-3 transition-colors ${isActive ? "border-[var(--accent)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--bg)]"}`}>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-[var(--text-muted)] mt-1 shrink-0">{i + 1}/{session.questions.length}</span>
                  <div className="flex-1 font-semibold text-sm">{q.text}</div>
                  <div className="flex gap-2 shrink-0">
                    {!isActive && live.status !== "closed" && (
                      <button onClick={() => send({ action: "show_question", index: i })}
                        className="btn-primary text-xs py-1 px-3">Zeigen</button>
                    )}
                    {isActive && !live.results_visible && live.status !== "closed" && (
                      <button onClick={() => send({ action: "show_results" })}
                        className="btn-secondary text-xs py-1 px-3">Ergebnis zeigen</button>
                    )}
                    {isActive && i < session.questions.length - 1 && live.status !== "closed" && (
                      <button onClick={() => send({ action: "show_question", index: i + 1 })}
                        className="btn-primary text-xs py-1 px-3">Weiter →</button>
                    )}
                  </div>
                </div>
                {(isActive || hasResponses) && (
                  <BarChart question={q} dist={dist} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Link href={`/tools/barometer?edit=${code}`}
          className="self-start text-sm border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)] rounded-xl px-4 py-1.5 transition-colors">
          ✏️ Bearbeiten
        </Link>
        {live.status === "closed" ? (
          <button onClick={() => send({ action: "restart" })}
            className="self-start text-sm border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-xl px-4 py-1.5 transition-colors">
            🔁 Neu starten
          </button>
        ) : (
          <button onClick={() => send({ action: "close" })}
            className="self-start text-sm border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-xl px-4 py-1.5 transition-colors">
            Umfrage beenden
          </button>
        )}
      </div>
    </div>
  );
}
