"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  DndContext, useDraggable, useDroppable, DragEndEvent,
} from "@dnd-kit/core";
import { PlayerIdentityForm } from "@/components/PlayerIdentityForm";
import { useSavedPlayer } from "@/hooks/useSavedPlayer";
import { api, LueckentextBoard, LueckentextBoardGap } from "@/lib/api";

type Phase = "join" | "waiting" | "active" | "finished";

type AttemptState = {
  match: "exact" | "near" | "wrong" | null;
  revealed: boolean;
  hint: string | null;
  solved: boolean;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function LueckentextPlayPage() {
  const { code } = useParams<{ code: string }>();
  const { saved, save, loaded: savedLoaded } = useSavedPlayer("lueckentext", code);

  const [phase, setPhase] = useState<Phase>("join");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [board, setBoard] = useState<LueckentextBoard | null>(null);
  const [attempts, setAttempts] = useState<Record<string, AttemptState>>({});
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordBankOrder, setWordBankOrder] = useState<string[]>([]);
  const [gapValues, setGapValues] = useState<Record<string, string>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-rejoin if we have a saved session for this code.
  useEffect(() => {
    if (!savedLoaded) return;
    if (saved?.participantId != null) {
      setParticipantId(saved.participantId);
      setPhase("waiting");
    }
  }, [savedLoaded, saved]);

  // Poll session state while waiting/active until it moves past "waiting",
  // then keep polling for the board while active until we get it.
  useEffect(() => {
    if (phase !== "waiting" && phase !== "active") return;
    let cancelled = false;
    async function poll() {
      try {
        const s = await api.lueckentexte.sessionState(code);
        if (cancelled) return;
        if (s.status === "finished") {
          setPhase("finished");
        } else if (s.status === "active" && s.board) {
          setBoard((prev) => prev ?? s.board);
          setPhase("active");
        }
      } catch { /* ignore transient errors */ }
    }
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, code]);

  useEffect(() => {
    if (board) setWordBankOrder(shuffle(board.word_bank));
  }, [board]);

  async function handleJoin(name: string, avatar: string) {
    setSubmitting(true);
    setJoinError(null);
    try {
      const p = await api.lueckentexte.joinSession(code, name, avatar);
      save({ name, avatar, participantId: p.id });
      setParticipantId(p.id);
      setPhase("waiting");
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitGap(gapId: string, text: string) {
    if (participantId == null) return;
    try {
      const res = await api.lueckentexte.submitAttempt(code, gapId, participantId, text);
      setAttempts((prev) => {
        const next = {
          ...prev,
          [gapId]: { match: res.match as AttemptState["match"], revealed: res.revealed, hint: res.hint, solved: res.solved },
        };
        if (board && board.gaps.every((g) => next[g.id]?.solved)) {
          setPhase("finished");
        }
        return next;
      });
    } catch { /* ignore, let the student retry */ }
  }

  function handleDragEnd(e: DragEndEvent) {
    const word = e.active?.data?.current?.word as string | undefined;
    const gapId = e.over?.id as string | undefined;
    if (word && gapId) submitGap(gapId, word);
  }

  // ── Join screen ──────────────────────────────────────────────────────────
  if (phase === "join") {
    return (
      <PlayerIdentityForm
        gameCode={code}
        gameIcon="📝"
        error={joinError}
        submitting={submitting}
        onJoin={handleJoin}
      />
    );
  }

  // ── Waiting screen ───────────────────────────────────────────────────────
  if (phase === "waiting" || (phase === "active" && !board)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[var(--bg)]">
        <div className="text-5xl">📝</div>
        <p className="text-[var(--text-muted)] text-sm animate-pulse">Warte auf Start…</p>
      </div>
    );
  }

  // ── Finished screen ──────────────────────────────────────────────────────
  if (phase === "finished") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[var(--bg)] text-center">
        <div className="text-5xl">🎉</div>
        <p className="font-black text-xl">Fertig!</p>
        {participantId != null && (
          <a
            href={`/api/lueckentexte/sessions/${code}/participants/${participantId}/export.pdf`}
            className="btn-primary"
          >
            Meine PDF herunterladen
          </a>
        )}
      </div>
    );
  }

  // ── Active — render board ────────────────────────────────────────────────
  if (!board) return null;

  const gapsById = new Map(board.gaps.map((g) => [g.id, g]));
  const parts = board.text.split(/(\{\{[^{}]+\}\})/g);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
        <p className="whitespace-pre-wrap leading-relaxed text-lg">
          {parts.map((part, i) => {
            const m = part.match(/^\{\{([^{}]+)\}\}$/);
            if (!m) return <span key={i}>{part}</span>;
            const gap = gapsById.get(m[1]);
            if (!gap) return <span key={i}>{part}</span>;
            return (
              <Gap
                key={i}
                gap={gap}
                value={gapValues[gap.id] ?? ""}
                onChange={(v) => setGapValues((prev) => ({ ...prev, [gap.id]: v }))}
                attempt={attempts[gap.id]}
                selectedWord={selectedWord}
                onSelectSlot={() => {
                  if (gap.type === "word_bank" && selectedWord) {
                    submitGap(gap.id, selectedWord);
                    setSelectedWord(null);
                  }
                }}
                onSubmit={(text) => submitGap(gap.id, text)}
              />
            );
          })}
        </p>

        {board.gaps.some((g) => g.type === "word_bank") && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold mb-2">Wortbank</h2>
            <div className="flex flex-wrap gap-2">
              {wordBankOrder.map((word, i) => (
                <WordChip
                  key={`${word}-${i}`}
                  word={word}
                  selected={selectedWord === word}
                  onClick={() => setSelectedWord((prev) => (prev === word ? null : word))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}

function WordChip({ word, selected, onClick }: { word: string; selected: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `word-${word}`,
    data: { word },
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={style}
      className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 cursor-grab active:cursor-grabbing transition-colors ${
        selected ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)]"
      }`}
    >
      {word}
    </button>
  );
}

function Gap({
  gap, value, onChange, attempt, selectedWord, onSelectSlot, onSubmit,
}: {
  gap: LueckentextBoardGap;
  value: string;
  onChange: (v: string) => void;
  attempt: AttemptState | undefined;
  selectedWord: string | null;
  onSelectSlot: () => void;
  onSubmit: (text: string) => void;
}) {
  const matchClass =
    attempt?.match === "exact" ? "border-green-500 bg-green-500/10 text-green-600"
    : attempt?.match === "near" ? "border-amber-500 bg-amber-500/10 text-amber-600 border-dashed"
    : attempt?.match === "wrong" ? "border-red-500 bg-red-500/10 text-red-600"
    : "border-[var(--border)]";

  const { setNodeRef, isOver } = useDroppable({ id: gap.id });

  if (gap.type === "word_bank") {
    return (
      <span className="inline-flex flex-col items-center align-middle mx-1">
        <span
          ref={setNodeRef}
          onClick={onSelectSlot}
          className={`inline-block min-w-[4rem] px-2 py-0.5 rounded-lg border-2 text-center cursor-pointer ${matchClass} ${isOver ? "bg-[var(--accent)]/20" : ""}`}
        >
          {value || " "}
        </span>
        {attempt?.match === "near" && <span className="text-xs text-amber-600">fast richtig!</span>}
        {attempt?.revealed && attempt.hint && <span className="text-xs text-[var(--text-muted)]">{attempt.hint}</span>}
      </span>
    );
  }

  if (gap.type === "multiple_choice") {
    return (
      <span className="inline-flex flex-col items-center align-middle mx-1 gap-1">
        <span className="inline-flex gap-1 flex-wrap justify-center">
          {(gap.choices ?? []).map((choice) => (
            <button
              key={choice}
              onClick={() => onSubmit(choice)}
              className={`px-2 py-0.5 rounded-lg border-2 text-sm ${matchClass}`}
            >
              {choice}
            </button>
          ))}
        </span>
        {attempt?.match === "near" && <span className="text-xs text-amber-600">fast richtig!</span>}
        {attempt?.revealed && attempt.hint && <span className="text-xs text-[var(--text-muted)]">{attempt.hint}</span>}
      </span>
    );
  }

  // free_type
  return (
    <span className="inline-flex flex-col items-center align-middle mx-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(value); }}
        onBlur={() => { if (value) onSubmit(value); }}
        className={`inline-block w-28 px-2 py-0.5 rounded-lg border-2 text-center bg-transparent ${matchClass}`}
      />
      {attempt?.match === "near" && <span className="text-xs text-amber-600">fast richtig!</span>}
      {attempt?.revealed && attempt.hint && <span className="text-xs text-[var(--text-muted)]">{attempt.hint}</span>}
    </span>
  );
}
