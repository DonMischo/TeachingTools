"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { wsUrl } from "@/lib/utils";
import { useGuestSession } from "@/hooks/useGuestSession";
import { GuestExpired } from "@/components/GuestExpired";
import { PlayerIdentityForm } from "@/components/PlayerIdentityForm";

type Question = {
  id: number;
  text: string;
  scale_min: number;
  scale_max: number;
  scale_min_label: string | null;
  scale_max_label: string | null;
};

type Distribution = Record<number, number>;

type Phase =
  | { type: "lobby"; total_questions: number }
  | { type: "question"; question: Question; index: number; total: number; answered: number | null }
  | { type: "results"; question: Question; distribution: Distribution; count: number }
  | { type: "closed" };

export default function BarometerPlayPage() {
  const { code } = useParams<{ code: string }>();
  const { auth } = useAuth();
  const guest = useGuestSession(code);
  const wsRef = useRef<WebSocket | null>(null);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>({ type: "lobby", total_questions: 0 });
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [hovering, setHovering] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);
  const isGuest = mounted && !auth;

  async function handleGuestJoin(name: string) {
    try {
      await guest.join("barometer", name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Beitritt fehlgeschlagen";
      setJoinError(/freigeschaltet/.test(msg) ? "Für diese Umfrage sind Gäste nicht freigeschaltet. Bitte melde dich an." : msg);
    }
  }

  useEffect(() => {
    if (!mounted) return;
    if (isGuest && !guest.token) return;   // wait until the guest has a token
    const gt = guest.token;
    const ws = new WebSocket(wsUrl(`/api/barometer/${code}/ws?role=student${gt ? `&guest_token=${gt}` : ""}`));
    wsRef.current = ws;

    ws.onopen = () => setError(null);
    ws.onerror = () => setError("Verbindungsfehler – bitte Seite neu laden.");
    ws.onclose = (e) => {
      if (e.code === 4004) setError("Umfrage nicht gefunden.");
      else if (e.code === 4001) { if (isGuest) guest.markExpired(); else setError("Bitte einloggen, um teilzunehmen."); }
      else if (e.code === 4003) setError("Nur Schüler können an dieser Umfrage teilnehmen.");
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.event === "state") {
        if (msg.status === "closed") {
          setPhase({ type: "closed" });
        } else if (msg.current_question_idx >= 0 && msg.question) {
          if (msg.results_visible) {
            setPhase({ type: "results", question: msg.question, distribution: msg.distribution ?? {}, count: msg.count ?? 0 });
          } else {
            setPhase(prev => ({
              type: "question", question: msg.question,
              index: msg.current_question_idx, total: msg.total_questions,
              answered: prev.type === "question" && prev.question.id === msg.question.id ? prev.answered : null,
            }));
          }
        } else {
          setPhase({ type: "lobby", total_questions: msg.total_questions });
        }
      } else if (msg.event === "question") {
        setPhase({ type: "question", question: msg.question, index: msg.index, total: msg.total, answered: null });
      } else if (msg.event === "results") {
        setPhase(prev => ({
          type: "results",
          question: prev.type === "question" || prev.type === "results" ? prev.question : msg.question ?? { id: msg.question_id, text: "", scale_min: 1, scale_max: 6, scale_min_label: null, scale_max_label: null },
          distribution: msg.distribution,
          count: msg.count,
        }));
      } else if (msg.event === "response_ack") {
        setPhase(prev => prev.type === "question" ? { ...prev, answered: msg.value } : prev);
      } else if (msg.event === "closed") {
        setPhase({ type: "closed" });
      }
    };

    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, mounted, isGuest, guest.token]);

  function respond(questionId: number, value: number) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "respond", question_id: questionId, value }));
    }
    setPhase(prev => prev.type === "question" ? { ...prev, answered: value } : prev);
  }

  if (!mounted) return null;

  // Guest's 60-min window elapsed → hard block, no rejoin.
  if (isGuest && guest.expired) return <GuestExpired gameIcon="📊" />;

  // Unauthenticated visitor picks a username before connecting.
  if (isGuest && !guest.token) {
    return (
      <PlayerIdentityForm
        gameCode={code}
        gameIcon="📊"
        gameTitle="Umfrage"
        error={joinError}
        onJoin={(name) => handleGuestJoin(name)}
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)]">
        <div className="text-center text-[var(--text-muted)] text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg)]">
      <div className="w-full max-w-md flex flex-col gap-6">

        {phase.type === "lobby" && (
          <div className="text-center flex flex-col items-center gap-4">
            <div className="text-5xl animate-pulse">📊</div>
            <h1 className="text-xl font-bold">Umfrage beigetreten</h1>
            <p className="text-[var(--text-muted)] text-sm">
              Warte auf die erste Frage…
              {phase.total_questions > 0 && <> ({phase.total_questions} Frage{phase.total_questions !== 1 ? "n" : ""})</>}
            </p>
            <div className="flex gap-1 mt-2">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-[var(--accent)]"
                  style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {phase.type === "question" && (() => {
          const q = phase.question;
          const vals = Array.from({ length: q.scale_max - q.scale_min + 1 }, (_, i) => q.scale_min + i);
          return (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <div className="text-xs text-[var(--text-muted)] mb-2">
                  Frage {phase.index + 1} von {phase.total}
                </div>
                <h2 className="text-xl font-bold leading-snug">{q.text}</h2>
              </div>

              <div className="flex flex-col gap-2">
                {q.scale_min_label && (
                  <div className="flex justify-between text-xs text-[var(--text-muted)]">
                    <span>{q.scale_min_label}</span>
                    <span>{q.scale_max_label}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  {vals.map(v => {
                    const selected = phase.answered === v;
                    const isHover = hovering === v;
                    return (
                      <button
                        key={v}
                        onClick={() => respond(q.id, v)}
                        onMouseEnter={() => setHovering(v)}
                        onMouseLeave={() => setHovering(null)}
                        className={`flex-1 aspect-square rounded-2xl text-lg font-bold transition-all duration-150 border-2 ${
                          selected
                            ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-[var(--accent)] scale-105 shadow-lg"
                            : isHover
                            ? "border-[var(--accent)] text-[var(--accent)] scale-105"
                            : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>

              {phase.answered !== null && (
                <div className="text-center text-sm text-[var(--text-muted)] animate-in fade-in duration-300">
                  Antwort gespeichert ✓ — warte auf Ergebnis…
                </div>
              )}
            </div>
          );
        })()}

        {phase.type === "results" && (() => {
          const q = phase.question;
          const vals = Array.from({ length: q.scale_max - q.scale_min + 1 }, (_, i) => q.scale_min + i);
          const max = Math.max(...vals.map(v => phase.distribution[v] ?? 0), 1);
          return (
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <h2 className="text-lg font-bold leading-snug">{q.text}</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">{phase.count} Antwort{phase.count !== 1 ? "en" : ""}</p>
              </div>
              <div className="flex items-end gap-2 h-40">
                {vals.map(v => {
                  const count = phase.distribution[v] ?? 0;
                  const pct = (count / max) * 100;
                  return (
                    <div key={v} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-bold text-[var(--accent)]">{count > 0 ? count : ""}</span>
                      <div className="w-full rounded-t-xl transition-all duration-700"
                        style={{ height: `${Math.max(pct, count > 0 ? 6 : 0)}%`, background: "var(--accent)", opacity: 0.85 }} />
                      <span className="text-xs text-[var(--text-muted)]">
                        {v === q.scale_min && q.scale_min_label ? q.scale_min_label : v}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {phase.type === "closed" && (
          <div className="text-center flex flex-col items-center gap-4">
            <div className="text-5xl">✅</div>
            <h1 className="text-xl font-bold">Umfrage beendet</h1>
            <p className="text-[var(--text-muted)] text-sm">Danke für deine Teilnahme!</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
