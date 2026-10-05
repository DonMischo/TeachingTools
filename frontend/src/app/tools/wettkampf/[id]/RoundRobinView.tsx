"use client";
import { WettkampfMatch, WettkampfParticipant, ParticipantStats } from "@/lib/api";

interface Props {
  participants: WettkampfParticipant[];
  matches: WettkampfMatch[];
  stats: Record<string, ParticipantStats>;
  onSelectMatch?: (m: WettkampfMatch) => void;
  canEdit: boolean;
}

export default function RoundRobinView({ participants, matches, stats, onSelectMatch, canEdit }: Props) {
  if (matches.length === 0 && participants.length === 0) return null;

  const hasGroups = participants.some(p => p.group);

  const sorted = [...participants].sort((a, b) => {
    if (hasGroups) {
      const ga = a.group ?? ""; const gb = b.group ?? "";
      if (ga !== gb) return ga.localeCompare(gb);
    }
    const sa = stats[a.id] ?? { pts: 0, gd: 0, gf: 0 };
    const sb = stats[b.id] ?? { pts: 0, gd: 0, gf: 0 };
    return sb.pts - sa.pts || sb.gd - sa.gd || sb.gf - sa.gf || a.name.localeCompare(b.name);
  });

  const rounds = Array.from(new Set(matches.map(m => m.round_number))).sort((a, b) => a - b);
  const byRound: Record<number, WettkampfMatch[]> = {};
  for (const m of matches) (byRound[m.round_number] ??= []).push(m);

  const hasDraw = matches.some(m => m.is_draw) || Object.values(stats).some(s => s.d > 0);

  return (
    <div className="space-y-6">
      {/* Standings */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Tabelle</h3>
        <div className="border border-line rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/60 text-gray-400 text-xs">
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Name</th>
                {hasGroups && <th className="text-left px-3 py-2">Gruppe</th>}
                <th className="px-3 py-2 text-center" title="Spiele">Sp</th>
                <th className="px-3 py-2 text-center text-green-400" title="Siege">S</th>
                {hasDraw && <th className="px-3 py-2 text-center text-yellow-400" title="Unentschieden">U</th>}
                <th className="px-3 py-2 text-center text-red-400" title="Niederlagen">N</th>
                <th className="px-3 py-2 text-center" title="Tore/Punkte für">+</th>
                <th className="px-3 py-2 text-center" title="Tore/Punkte gegen">−</th>
                <th className="px-3 py-2 text-center" title="Differenz">Diff</th>
                <th className="px-3 py-2 text-center font-bold text-white" title="Punkte">Pkt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((p, i) => {
                const s = stats[p.id] ?? { w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
                return (
                  <tr key={p.id} className={i === 0 && s.pts > 0 ? "bg-yellow-900/10" : ""}>
                    <td className="px-3 py-2 text-gray-400 text-xs">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    {hasGroups && <td className="px-3 py-2 text-xs text-gray-500">{p.group ?? "—"}</td>}
                    <td className="px-3 py-2 text-center text-gray-500">{s.w + s.d + s.l}</td>
                    <td className="px-3 py-2 text-center text-green-400 font-semibold">{s.w}</td>
                    {hasDraw && <td className="px-3 py-2 text-center text-yellow-400">{s.d}</td>}
                    <td className="px-3 py-2 text-center text-red-400">{s.l}</td>
                    <td className="px-3 py-2 text-center text-gray-300">{s.gf}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{s.ga}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${s.gd > 0 ? "text-green-400" : s.gd < 0 ? "text-red-400" : "text-gray-500"}`}>
                      {s.gd > 0 ? "+" : ""}{s.gd}
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-white">{s.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rounds */}
      <div className="space-y-4">
        {rounds.map(r => (
          <div key={r}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Runde {r + 1}</h3>
            <div className="space-y-2">
              {(byRound[r] ?? []).map(m => {
                const isDone = m.winner_id !== null || m.is_draw;
                const canClick = canEdit && m.p1 && m.p2;
                return (
                  <div key={m.id} onClick={canClick ? () => onSelectMatch?.(m) : undefined}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      isDone && canClick ? "border-gray-600 cursor-pointer hover:border-yellow-600 opacity-80"
                      : isDone ? "border-gray-700 opacity-75"
                      : canClick ? "border-indigo-600 cursor-pointer hover:border-indigo-400"
                      : "border-line"
                    }`}>
                    <span className={`flex-1 text-sm font-medium text-right ${m.winner_id === m.p1?.id ? "text-green-300" : "text-gray-300"}`}>
                      {m.p1?.name ?? "—"}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0 w-16 text-center">
                      {m.is_draw
                        ? `${m.score_p1 ?? "—"} : ${m.score_p2 ?? "—"} 🤝`
                        : m.score_p1 && m.score_p2 ? `${m.score_p1} : ${m.score_p2}` : "vs"}
                    </span>
                    <span className={`flex-1 text-sm font-medium ${m.winner_id === m.p2?.id ? "text-green-300" : "text-gray-300"}`}>
                      {m.p2?.name ?? "—"}
                    </span>
                    {isDone ? <span className="text-xs text-green-500 shrink-0" title="Klicken zum Ändern">✓</span>
                    : canEdit && m.p1 && m.p2 ? <span className="text-xs text-indigo-400 shrink-0">Eintragen →</span>
                    : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
