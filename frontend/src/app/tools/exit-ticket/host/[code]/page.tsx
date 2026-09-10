"use client";
import { useState } from "react";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import Link from "next/link";
import { useParams } from "next/navigation";
import { JoinQR } from "@/components/JoinQR";
import { GuestAccessToggle } from "@/components/GuestAccessToggle";
import { useLanUrl } from "@/hooks/useLanUrl";

type Response = {
  id: number;
  student_name: string;
  rating: number | null;
  comment: string | null;
  submitted_at: string;
};

type State = {
  status: "open" | "closed";
  title: string;
  question: string;
  rating_enabled: boolean;
  responses: Response[];
  participant_count: number;
};

const STARS = [1, 2, 3, 4, 5];

export default function ExitTicketHostPage() {
  const { code } = useParams<{ code: string }>();
  const [state, setState] = useState<State | null>(null);

  const playUrl = useLanUrl(`/play/exit-ticket/${code}`);

  const live = useLiveSocket(
    code ? `/api/exit-ticket/${code}/ws?role=teacher` : null,
    (msg) => {
      if (msg.event === "state") {
        setState({
          status: msg.status,
          title: msg.title,
          question: msg.question,
          rating_enabled: msg.rating_enabled,
          responses: msg.responses,
          participant_count: msg.participant_count,
        });
      } else if (msg.event === "new_response") {
        setState(prev => prev ? {
          ...prev,
          responses: [...prev.responses, msg.response],
        } : prev);
      } else if (msg.event === "participant_joined") {
        setState(prev => prev ? { ...prev, participant_count: msg.count } : prev);
      } else if (msg.event === "closed") {
        setState(prev => prev ? { ...prev, status: "closed" } : prev);
      }
    },
  );

  function close() {
    live.send({ action: "close" });
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)] text-sm">
        Verbinde…
      </div>
    );
  }

  const avgRating = state.responses.filter(r => r.rating != null).length > 0
    ? state.responses.reduce((s, r) => s + (r.rating ?? 0), 0) / state.responses.filter(r => r.rating != null).length
    : null;

  const dist = STARS.map(s => ({
    star: s,
    count: state.responses.filter(r => r.rating === s).length,
  }));
  const maxCount = Math.max(...dist.map(d => d.count), 1);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-start gap-4 justify-between flex-wrap">
        <div>
          <Link href="/tools/exit-ticket" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">← Exit-Ticket</Link>
          <h1 className="text-2xl font-black tracking-tight mt-1">🎫 {state.title}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">{state.question}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {state.status === "open" && (
            <button onClick={close} className="btn-secondary text-sm py-1.5 px-4">
              Schließen
            </button>
          )}
          {state.status === "closed" && (
            <span className="text-xs px-3 py-1.5 rounded-xl bg-[var(--border)] text-[var(--text-muted)]">
              Geschlossen
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* QR Code */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col items-center gap-2">
          <JoinQR url={playUrl} size={200} className="rounded-xl" />
          <div className="text-xs text-[var(--text-muted)] text-center font-mono break-all">{code}</div>
          <div className="text-xs text-[var(--text-muted)]">{state.participant_count} verbunden · {state.responses.length} Antworten</div>
          <GuestAccessToggle tool="exit-ticket" code={code} />
        </div>

        {/* Rating distribution */}
        {state.rating_enabled && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3 col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Bewertungen</span>
              {avgRating != null && (
                <span className="text-sm text-[var(--accent)] font-bold">
                  Ø {avgRating.toFixed(1)} ★
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {dist.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-right text-[var(--text-muted)]">{star}★</span>
                  <div className="flex-1 h-5 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-[var(--text-muted)] text-xs">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Responses */}
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-sm">Antworten ({state.responses.length})</h2>
        {state.responses.length === 0 ? (
          <div className="flex items-center justify-center h-20 border border-dashed border-[var(--border)] rounded-xl text-[var(--text-muted)] text-sm">
            Noch keine Antworten
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[...state.responses].reverse().map(r => (
              <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text-muted)]">{r.student_name}</span>
                  {r.rating != null && (
                    <span className="text-sm text-[var(--accent)]">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  )}
                </div>
                {r.comment && (
                  <p className="text-sm leading-snug">{r.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
