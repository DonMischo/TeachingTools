"use client";
import { useEffect, useState } from "react";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PlayerIdentityForm } from "@/components/PlayerIdentityForm";
import { GuestExpired } from "@/components/GuestExpired";
import { useGuestSession } from "@/hooks/useGuestSession";

type SessionInfo = {
  status: "open" | "closed";
  title: string;
  question: string;
  rating_enabled: boolean;
};

const STARS = [1, 2, 3, 4, 5];

export default function ExitTicketPlayPage() {
  const { code } = useParams<{ code: string }>();
  const { auth } = useAuth();
  const guest = useGuestSession(code);
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const isGuest = mounted && !auth;               // fully unauthenticated visitor
  const studentId = auth?.student?.id ?? 0;
  const studentName = auth?.student
    ? auth.student.display_name
    : (guest.session?.name ?? "Anonym");

  async function handleGuestJoin(name: string) {
    try {
      await guest.join("exit-ticket", name);      // reconnect effect fires once token lands
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Beitritt fehlgeschlagen";
      setJoinError(/freigeschaltet/.test(msg) ? "Für dieses Exit Ticket sind Gäste nicht freigeschaltet. Bitte melde dich an." : msg);
    }
  }

  const params = new URLSearchParams({ role: "student" });
  if (studentId) params.set("student_id", String(studentId));
  params.set("student_name", studentName);
  if (guest.token) params.set("guest_token", guest.token);
  const live = useLiveSocket(
    // Gäste verbinden erst, wenn sie ein Token haben.
    code && mounted && !(isGuest && !guest.token) ? `/api/exit-ticket/${code}/ws?${params}` : null,
    (msg) => {
      if (msg.event === "state") {
        setSession({
          status: msg.status,
          title: msg.title,
          question: msg.question,
          rating_enabled: msg.rating_enabled,
        });
      } else if (msg.event === "submitted") {
        setSubmitted(true);
      } else if (msg.event === "closed") {
        setSession(prev => prev ? { ...prev, status: "closed" } : prev);
      }
    },
    {
      onRejected: (c) => {
        if (c === 4004) setError("Exit Ticket nicht gefunden.");
        else if (c === 4001) guest.markExpired();  // guest token missing/expired → hard block
      },
    },
  );

  function submit() {
    if (!session || session.status !== "open") return;
    if (session.rating_enabled && rating === null) return;
    live.send({
      action: "submit",
      rating: rating,
      comment: comment.trim() || null,
    });
  }

  if (!mounted) return null;

  // Guest's 60-min window elapsed → hard block, no rejoin.
  if (isGuest && guest.expired) return <GuestExpired gameIcon="📝" onRejoin={guest.rejoin} />;

  // Unauthenticated visitor picks a username before connecting.
  if (isGuest && !guest.token) {
    return (
      <PlayerIdentityForm
        gameCode={code}
        gameIcon="📝"
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)] text-sm bg-[var(--bg)]">
        Verbinde…
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[var(--bg)]">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold">Danke für dein Feedback!</h2>
        <p className="text-[var(--text-muted)] text-sm">Deine Antwort wurde übermittelt.</p>
      </div>
    );
  }

  if (session.status === "closed") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 bg-[var(--bg)]">
        <div className="text-4xl">🔒</div>
        <p className="text-[var(--text-muted)] text-sm">Dieses Exit Ticket wurde geschlossen.</p>
      </div>
    );
  }

  const activeStar = hovered ?? rating;
  const canSubmit = !session.rating_enabled || rating !== null;

  return (
    <div className="min-h-screen flex flex-col items-center gap-6 p-6 bg-[var(--bg)]">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-black">{session.title}</h1>
        <p className="text-[var(--text-muted)] text-xs mt-0.5">Exit Ticket</p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-5">
        <p className="text-sm font-semibold leading-snug">{session.question}</p>

        {session.rating_enabled && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-[var(--text-muted)]">Deine Bewertung</span>
            <div className="flex gap-2">
              {STARS.map(s => (
                <button
                  key={s}
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(null)}
                  className="text-3xl transition-transform hover:scale-110"
                  style={{ color: activeStar != null && s <= activeStar ? "#facc15" : "var(--border)" }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          className="input resize-none text-sm"
          rows={4}
          placeholder="Dein Kommentar (optional)…"
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={2000}
        />

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="btn-primary"
        >
          Abschicken
        </button>
      </div>
    </div>
  );
}
