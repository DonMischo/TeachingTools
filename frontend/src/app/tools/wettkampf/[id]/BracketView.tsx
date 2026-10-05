"use client";
import { WettkampfMatch, WettkampfParticipant } from "@/lib/api";

interface Props {
  matches: WettkampfMatch[];
  onSelectMatch?: (m: WettkampfMatch) => void;
  canEdit: boolean;
}

function ParticipantSlot({ p, isWinner }: { p: WettkampfParticipant | null; isWinner: boolean }) {
  if (!p) {
    return (
      <div className="h-8 flex items-center px-3 rounded-sm bg-gray-800/50 text-gray-600 text-sm italic">
        Freilos / offen
      </div>
    );
  }
  return (
    <div
      className={`h-8 flex items-center justify-between px-3 rounded text-sm font-medium transition-colors ${
        isWinner
          ? "bg-green-800/60 border border-green-600 text-green-200"
          : "bg-gray-800 text-gray-300"
      }`}
    >
      <span className="truncate">{p.name}</span>
      {isWinner && <span className="text-green-400 ml-2 text-xs shrink-0">✓</span>}
    </div>
  );
}

function MatchCard({
  match,
  onClick,
  canEdit,
}: {
  match: WettkampfMatch;
  onClick?: () => void;
  canEdit: boolean;
}) {
  const isDone = match.winner_id !== null;
  const canClick = canEdit && match.p1 && match.p2 && !isDone;

  return (
    <div
      onClick={canClick ? onClick : undefined}
      className={`w-48 rounded-xl border overflow-hidden ${
        isDone
          ? "border-gray-700 opacity-80"
          : canClick
          ? "border-indigo-600 cursor-pointer hover:border-indigo-400 shadow-lg shadow-indigo-900/20"
          : "border-gray-700"
      }`}
    >
      <div className="bg-gray-800/80 px-2 py-0.5 text-xs text-gray-500 border-b border-gray-700 flex justify-between">
        <span>Begegnung</span>
        {match.score_p1 && match.score_p2 && (
          <span className="text-gray-400">{match.score_p1}:{match.score_p2}</span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-2">
        <ParticipantSlot p={match.p1} isWinner={match.winner_id === match.p1?.id} />
        <div className="text-center text-xs text-gray-600">vs</div>
        <ParticipantSlot p={match.p2} isWinner={match.winner_id === match.p2?.id} />
      </div>
      {canClick && (
        <div className="bg-indigo-900/20 px-2 py-1 text-xs text-indigo-400 text-center">
          Ergebnis eintragen
        </div>
      )}
    </div>
  );
}

export default function BracketView({ matches, onSelectMatch, canEdit }: Props) {
  if (matches.length === 0) return null;

  const rounds = Array.from(new Set(matches.map(m => m.round_number))).sort((a, b) => a - b);
  const byRound: Record<number, WettkampfMatch[]> = {};
  for (const m of matches) {
    (byRound[m.round_number] ??= []).push(m);
    byRound[m.round_number].sort((a, b) => a.match_number - b.match_number);
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max items-start pt-4">
        {rounds.map((r) => {
          const rMatches = byRound[r] ?? [];
          const roundName = rMatches[0]?.stage_name ?? `Runde ${r + 1}`;
          return (
            <div key={r} className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 text-center mb-2">
                {roundName}
              </p>
              <div
                className="flex flex-col"
                style={{ gap: `${Math.max(8, 32 * Math.pow(2, r))}px` }}
              >
                {rMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    onClick={() => onSelectMatch?.(m)}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
