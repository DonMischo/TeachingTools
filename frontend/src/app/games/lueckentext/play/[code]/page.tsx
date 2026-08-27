"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  DndContext, useDraggable, useDroppable, DragEndEvent,
} from "@dnd-kit/core";
import { PlayerIdentityForm } from "@/components/PlayerIdentityForm";
import { GuestExpired } from "@/components/GuestExpired";
import { useSavedPlayer } from "@/hooks/useSavedPlayer";
import { useHubIdentity } from "@/hooks/useHubIdentity";
import { useGuestSession } from "@/hooks/useGuestSession";
import { useAuth } from "@/contexts/AuthContext";
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
  const { auth } = useAuth();
  const guest = useGuestSession(code);
  const { saved, save, loaded: savedLoaded } = useSavedPlayer("lueckentext", code);

  const [phase, setPhase] = useState<Phase>("join");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [board, setBoard] = useState<LueckentextBoard | null>(null);
  const [attempts, setAttempts] = useState<Record<string, AttemptState>>({});
  // The same word can sit in the bank more than once, so a tile is identified
  // by its position — selecting (or dragging) one must not move its twin.
  const [selected, setSelected] = useState<number | null>(null);
  const [wordBankOrder, setWordBankOrder] = useState<string[]>([]);
  const selectedWord = selected == null ? null : wordBankOrder[selected] ?? null;
  const [gapValues, setGapValues] = useState<Record<string, string>>({});
  // Gap whose word list is open on phones (see WordPicker).
  const [pickerGap, setPickerGap] = useState<string | null>(null);
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
      // Unauthenticated visitors first obtain a 60-min guest token (backend
      // enforces the "Gäste erlauben" opt-in and 403s if it's off).
      let gt = guest.token;
      if (!auth && !gt) gt = (await guest.join("lueckentext", name)).token;
      const p = await api.lueckentexte.joinSession(code, name, avatar, gt);
      save({ name, avatar, participantId: p.id });
      setParticipantId(p.id);
      setPhase("waiting");
    } catch (e) {
      const msg = (e as Error).message;
      setJoinError(/freigeschaltet/.test(msg) ? "Für diese Sitzung sind Gäste nicht freigeschaltet. Bitte melde dich an." : msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Aus dem Playhub durchgereicht: Name und Avatar stehen schon fest.
  useHubIdentity(code, savedLoaded && phase === "join", (id) => {
    void handleJoin(id.name, id.avatar);
  });


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

  /** Put a word into a gap and send it off — the slot has to show what was
   *  placed there, otherwise a dropped tile just vanishes. */
  function placeWord(gapId: string, word: string) {
    setGapValues((prev) => ({ ...prev, [gapId]: word }));
    submitGap(gapId, word);
  }

  function handleDragEnd(e: DragEndEvent) {
    const word = e.active?.data?.current?.word as string | undefined;
    const gapId = e.over?.id as string | undefined;
    if (word && gapId) placeWord(gapId, word);
  }

  // Guest's 60-min window elapsed → hard block, no rejoin.
  if (!auth && guest.expired) return <GuestExpired gameIcon="📝" />;

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
  const hasWordBank = board.gaps.some((g) => g.type === "word_bank");
  const usedUpWords = board.gaps
    .filter((g) => g.type === "word_bank" && attempts[g.id]?.solved)
    .map((g) => gapValues[g.id])
    .filter(Boolean);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      {/* Wide screens put the word bank beside the text (sticky, so it stays in
          reach while scrolling); narrow ones stack it underneath as before. */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6 p-6 max-w-5xl mx-auto w-full">
        <p className="flex-1 min-w-0 whitespace-pre-wrap leading-relaxed text-lg">
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
                  if (gap.type !== "word_bank") return;
                  if (selectedWord) {
                    placeWord(gap.id, selectedWord);
                    setSelected(null);
                  } else {
                    // Opens the picker on phones. On wide screens the sheet is
                    // display:none and the sidebar does the job, so this stays
                    // the no-op it always was there.
                    setPickerGap(gap.id);
                  }
                }}
                onSubmit={(text) => placeWord(gap.id, text)}
              />
            );
          })}
        </p>

        {hasWordBank && (
          <>
            <p className="lg:hidden text-sm text-[var(--text-muted)]">
              Tippe auf eine Lücke, um ein Wort aus der Wortbank zu wählen.
            </p>
            <aside className="hidden lg:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:w-60 lg:shrink-0 lg:sticky lg:top-6">
              <h2 className="text-sm font-semibold mb-2">Wortbank</h2>
              <div className="flex flex-wrap gap-2">
                {wordBankOrder.map((word, i) => (
                  <WordChip
                    key={i}
                    index={i}
                    word={word}
                    selected={selected === i}
                    onClick={() => setSelected((prev) => (prev === i ? null : i))}
                  />
                ))}
              </div>
            </aside>
          </>
        )}
      </div>

      {pickerGap && (
        <WordPicker
          words={remainingWords(wordBankOrder, usedUpWords)}
          onPick={(word) => { placeWord(pickerGap, word); setPickerGap(null); }}
          onClose={() => setPickerGap(null)}
        />
      )}
    </DndContext>
  );
}

/** Words still up for grabs: the bank minus one tile per gap a word already
 *  solved. A wrong guess keeps its tile in the list — a word parked in the
 *  wrong gap must not disappear from the gap it actually belongs to. */
function remainingWords(order: string[], usedUp: string[]): string[] {
  const pool = [...usedUp];
  return order.filter((word) => {
    const hit = pool.indexOf(word);
    if (hit < 0) return true;
    pool.splice(hit, 1);
    return false;
  });
}

/** Phone-sized word bank: no room for a standing list beside the text, so the
 *  words come to the gap you tapped — as a sheet that scrolls when the bank is
 *  long. Hidden on wide screens, where the sidebar is always in view. */
function WordPicker({ words, onPick, onClose }: { words: string[]; onPick: (word: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/50 lg:hidden" onClick={onClose}>
      <div
        className="w-full max-h-[60vh] flex flex-col gap-3 rounded-t-2xl border-t border-[var(--border)] p-4"
        style={{ background: "var(--bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold">Wortbank</h2>
          <button onClick={onClose} className="text-xs text-[var(--text-muted)]">Schließen</button>
        </div>
        {words.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Alle Wörter sind vergeben.</p>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto">
            {words.map((word, i) => (
              <button
                key={i}
                onClick={() => onPick(word)}
                className="w-full rounded-xl border-2 border-[var(--border)] px-3 py-2.5 text-left active:border-[var(--accent)]"
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WordChip({ index, word, selected, onClick }: { index: number; word: string; selected: boolean; onClick: () => void }) {
  // Keyed by position, not by the word: two tiles sharing a draggable id would
  // both follow the pointer.
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `word-${index}`,
    data: { word },
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50, position: "relative" as const }
    : undefined;
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
        {/* A real button, not a clickable span: on phones this is how a word
            gets picked at all, so it needs a name and the keyboard. */}
        <button
          type="button"
          ref={setNodeRef}
          onClick={onSelectSlot}
          aria-label={value ? `Lücke, gefüllt mit ${value}` : "Leere Lücke"}
          className={`inline-block min-w-[4rem] px-2 py-0.5 rounded-lg border-2 text-center cursor-pointer ${matchClass} ${isOver ? "bg-[var(--accent)]/20" : ""}`}
        >
          {value || " "}
        </button>
        {attempt?.match === "near" && <span className="text-xs text-amber-600">fast richtig!</span>}
        {attempt?.revealed && attempt.hint && <span className="text-xs text-[var(--text-muted)]">{attempt.hint}</span>}
      </span>
    );
  }

  if (gap.type === "multiple_choice") {
    return (
      <span className="inline-flex flex-col items-center align-middle mx-1 gap-1">
        <span className="inline-flex gap-1 flex-wrap justify-center">
          {/* Only the option the student actually picked carries the verdict —
              colouring every button green would read as "all of them fit". */}
          {(gap.choices ?? []).map((choice) => (
            <button
              key={choice}
              onClick={() => onSubmit(choice)}
              className={`px-2 py-0.5 rounded-lg border-2 text-sm ${choice === value ? matchClass : "border-[var(--border)]"}`}
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
        // Grows with what's typed instead of clipping long answers at a fixed
        // width — the minimum keeps an empty gap visible as a gap.
        style={{ width: `${Math.min(Math.max(value.length + 2, 8), 28)}ch` }}
        className={`inline-block max-w-full px-2 py-0.5 rounded-lg border-2 text-center bg-transparent ${matchClass}`}
      />
      {attempt?.match === "near" && <span className="text-xs text-amber-600">fast richtig!</span>}
      {attempt?.revealed && attempt.hint && <span className="text-xs text-[var(--text-muted)]">{attempt.hint}</span>}
    </span>
  );
}
