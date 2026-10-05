"use client";
import { useState } from "react";
import { WettkampfMatch, WettkampfParticipant, ParticipantStats } from "@/lib/api";

interface Props {
  participants: WettkampfParticipant[];
  matches: WettkampfMatch[];
  stats: Record<string, ParticipantStats>;
  onSelectMatch?: (m: WettkampfMatch) => void;
  onAddMatch?: (round: number, p1Id: number, p2Id: number) => void;
  onDeleteMatch?: (mid: number) => void;
  onAutoPair?: (group: string | null) => Promise<void>;
  canEdit: boolean;
}

type AddState = { groupKey: string; p1: string; p2: string };

function MatchRow({ m, canEdit, onSelectMatch, onDeleteMatch }: {
  m: WettkampfMatch;
  canEdit: boolean;
  onSelectMatch?: (m: WettkampfMatch) => void;
  onDeleteMatch?: (mid: number) => void;
}) {
  const isDone = m.winner_id !== null || m.is_draw;
  const canClick = canEdit && m.p1 && m.p2;
  return (
    <div
      onClick={canClick ? () => onSelectMatch?.(m) : undefined}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        isDone && canClick ? "border-gray-600 cursor-pointer hover:border-yellow-600 opacity-80"
        : isDone ? "border-gray-700/60 opacity-80"
        : canClick ? "border-indigo-600 cursor-pointer hover:border-indigo-400 shadow-xs shadow-indigo-900/30"
        : "border-line"
      }`}
    >
      <span className={`flex-1 text-sm font-medium text-right ${m.winner_id === m.p1?.id ? "text-green-300" : "text-gray-300"}`}>
        {m.p1?.name ?? "—"}
      </span>
      <span className="text-xs text-gray-500 shrink-0 w-16 text-center">
        {m.is_draw
          ? `${m.score_p1 ?? "—"} : ${m.score_p2 ?? "—"} 🤝`
          : m.score_p1 != null && m.score_p2 != null ? `${m.score_p1} : ${m.score_p2}` : "vs"}
      </span>
      <span className={`flex-1 text-sm font-medium ${m.winner_id === m.p2?.id ? "text-green-300" : "text-gray-300"}`}>
        {m.p2?.name ?? "—"}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {isDone
          ? <span className="text-green-500 text-xs">✓</span>
          : canEdit && m.p1 && m.p2
          ? <span className="text-indigo-400 text-xs">→</span>
          : null}
        {canEdit && (
          <button
            onClick={e => { e.stopPropagation(); if (confirm("Paarung löschen?")) onDeleteMatch?.(m.id); }}
            className="text-gray-600 hover:text-red-400 text-xs ml-1 transition-colors"
            title="Paarung löschen"
          >🗑</button>
        )}
      </div>
    </div>
  );
}

export default function PairingView({ participants, matches, stats, onSelectMatch, onAddMatch, onDeleteMatch, onAutoPair, canEdit }: Props) {
  const [addState, setAddState] = useState<AddState | null>(null);
  const [autopairingGroup, setAutopairingGroup] = useState<string | null | undefined>(undefined);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(g: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }

  function collapseAll(gs: string[]) { setCollapsed(new Set(gs)); }
  function expandAll() { setCollapsed(new Set()); }

  const groups = Array.from(new Set(participants.map(p => p.group).filter((g): g is string => !!g))).sort();
  const hasGroups = groups.length > 0;
  const hasDraw = matches.some(m => m.is_draw) || Object.values(stats).some(s => s.d > 0);

  const maxRoundGlobal = matches.length > 0 ? Math.max(...matches.map(m => m.round_number)) : -1;

  function openAdd(groupKey: string) {
    setAddState({ groupKey, p1: "", p2: "" });
  }

  function confirmAdd(groupParticipants: WettkampfParticipant[]) {
    if (!addState || !addState.p1 || !addState.p2 || addState.p1 === addState.p2) return;
    // Find a suitable round: next after last match between these group members
    const groupIds = new Set(groupParticipants.map(p => p.id));
    const groupMatches = matches.filter(m =>
      m.p1 != null && m.p2 != null && groupIds.has(m.p1.id) && groupIds.has(m.p2.id));
    const round = groupMatches.length > 0 ? Math.max(...groupMatches.map(m => m.round_number)) + 1 : maxRoundGlobal + 1;
    onAddMatch?.(round, Number(addState.p1), Number(addState.p2));
    setAddState(prev => prev ? { ...prev, p1: "", p2: "" } : null);
  }

  function AddForm({ groupKey, groupParticipants }: { groupKey: string; groupParticipants: WettkampfParticipant[] }) {
    if (!addState || addState.groupKey !== groupKey) return null;
    return (
      <div className="flex items-center gap-2 mt-2 p-3 rounded-xl border border-dashed border-indigo-700 bg-indigo-950/20">
        <select className="input flex-1 text-sm" value={addState.p1}
          onChange={e => setAddState(s => s ? { ...s, p1: e.target.value } : s)} autoFocus>
          <option value="">— Teilnehmer 1 —</option>
          {groupParticipants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-gray-500 text-sm shrink-0 font-bold">vs</span>
        <select className="input flex-1 text-sm" value={addState.p2}
          onChange={e => setAddState(s => s ? { ...s, p2: e.target.value } : s)}>
          <option value="">— Teilnehmer 2 —</option>
          {groupParticipants.filter(p => String(p.id) !== addState.p1).map(p =>
            <option key={p.id} value={p.id}>{p.name}</option>
          )}
        </select>
        <button onClick={() => confirmAdd(groupParticipants)}
          disabled={!addState.p1 || !addState.p2 || addState.p1 === addState.p2}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40 transition-colors">
          +
        </button>
        <button onClick={() => setAddState(null)} className="text-gray-500 hover:text-white text-lg shrink-0 leading-none">×</button>
      </div>
    );
  }

  // ── Group view ───────────────────────────────────────────────────────────────
  if (hasGroups) {
    // Bucket matches by group (both p1 and p2 in same group), rest → cross-group
    const pById = Object.fromEntries(participants.map(p => [p.id, p]));
    const matchesByGroup: Record<string, WettkampfMatch[]> = {};
    const crossGroupMatches: WettkampfMatch[] = [];

    for (const m of matches) {
      const g1 = m.p1 != null ? (pById[m.p1.id]?.group ?? null) : null;
      const g2 = m.p2 != null ? (pById[m.p2.id]?.group ?? null) : null;
      if (g1 && g1 === g2) {
        (matchesByGroup[g1] ??= []).push(m);
      } else {
        crossGroupMatches.push(m);
      }
    }

    const allCollapsed = groups.every(g => collapsed.has(g));
    return (
      <div className="space-y-6">
        {/* Collapse / expand all */}
        <div className="flex justify-end">
          <button
            onClick={() => allCollapsed ? expandAll() : collapseAll(groups)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {allCollapsed ? "▶ Alle aufklappen" : "▼ Alle zuklappen"}
          </button>
        </div>

        {/* Per-group sections */}
        {groups.map(g => {
          const gParticipants = participants.filter(p => p.group === g);
          const gMatches = matchesByGroup[g] ?? [];
          const done = gMatches.filter(m => m.winner_id || m.is_draw).length;
          const isCollapsed = collapsed.has(g);
          return (
            <div key={g} className="border border-line rounded-2xl overflow-hidden">
              {/* Group header */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-gray-800/60 border-b border-line cursor-pointer select-none"
                onClick={() => toggleCollapse(g)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-3">{isCollapsed ? "▶" : "▼"}</span>
                  <span className="font-bold text-gray-100">{g}</span>
                  <span className="text-xs text-gray-500">{gParticipants.length} Teams</span>
                  {gMatches.length > 0 && (
                    <span className="text-xs text-gray-600">{done}/{gMatches.length} gespielt</span>
                  )}
                </div>
                {!isCollapsed && canEdit && addState?.groupKey !== g && (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {onAutoPair && gMatches.length === 0 && (
                      <button
                        onClick={async () => { setAutopairingGroup(g); await onAutoPair(g); setAutopairingGroup(undefined); }}
                        disabled={autopairingGroup !== undefined}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-40"
                        title="Jeder gegen Jeden automatisch erstellen"
                      >
                        {autopairingGroup === g ? "⏳" : "⚡"} Auto
                      </button>
                    )}
                    <button onClick={() => openAdd(g)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                      + Paarung
                    </button>
                  </div>
                )}
              </div>

              {!isCollapsed && <div className="p-4 space-y-4">
                {/* Matches */}
                {gMatches.length > 0 ? (
                  <div className="space-y-2">
                    {gMatches.map(m => (
                      <MatchRow key={m.id} m={m} canEdit={canEdit} onSelectMatch={onSelectMatch} onDeleteMatch={onDeleteMatch} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 italic">Noch keine Paarungen.</p>
                )}
                <AddForm groupKey={g} groupParticipants={gParticipants} />

                {/* Mini standings */}
                {gParticipants.length >= 2 && gMatches.some(m => m.winner_id || m.is_draw) && (
                  <div className="border-t border-line pt-3">
                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">Zwischenstand</p>
                    <div className="space-y-1">
                      {[...gParticipants].sort((a, b) => {
                        const sa = stats[a.id] ?? { pts: 0, gd: 0, gf: 0 };
                        const sb = stats[b.id] ?? { pts: 0, gd: 0, gf: 0 };
                        return sb.pts - sa.pts || sb.gd - sa.gd || sb.gf - sa.gf || a.name.localeCompare(b.name);
                      }).map((p, i) => {
                        const s = stats[p.id] ?? { w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
                        return (
                          <div key={p.id} className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600 text-xs w-4">{i + 1}</span>
                            <span className="flex-1 text-gray-300 font-medium">{p.name}</span>
                            <span className="text-gray-500 text-xs">{s.w}S {hasDraw ? `${s.d}U ` : ""}{s.l}N</span>
                            {(s.gf > 0 || s.ga > 0) && <span className="text-gray-600 text-xs">{s.gf}:{s.ga}</span>}
                            <span className="text-white font-bold text-xs w-8 text-right">{s.pts} Pkt</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>}
            </div>
          );
        })}

        {/* Cross-group matches */}
        {crossGroupMatches.length > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Gruppenübergreifend</h3>
            <div className="space-y-2">
              {crossGroupMatches.map(m => (
                <MatchRow key={m.id} m={m} canEdit={canEdit} onSelectMatch={onSelectMatch} onDeleteMatch={onDeleteMatch} />
              ))}
            </div>
          </div>
        )}

        {/* Add cross-group match */}
        {canEdit && (
          <div>
            {addState?.groupKey === "__cross__" ? (
              <AddForm groupKey="__cross__" groupParticipants={participants} />
            ) : (
              <button onClick={() => openAdd("__cross__")}
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-600 rounded-xl text-sm text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors">
                + Gruppenübergreifende Paarung
              </button>
            )}
          </div>
        )}

        {/* Full standings */}
        <GesamtstandTable participants={participants} groups={groups} stats={stats} hasDraw={hasDraw} />
      </div>
    );
  }

  // ── No groups: round-based view ───────────────────────────────────────────
  const rounds = Array.from(new Set(matches.map(m => m.round_number))).sort((a, b) => a - b);
  const byRound: Record<number, WettkampfMatch[]> = {};
  for (const m of matches) (byRound[m.round_number] ??= []).push(m);
  const maxRound = rounds.length > 0 ? Math.max(...rounds) : -1;
  const nextRoundNo = maxRound + 1;

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        {rounds.map(r => (
          <div key={r}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">Runde {r + 1}</h3>
              {canEdit && addState?.groupKey !== String(r) && (
                <button onClick={() => openAdd(String(r))} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  + Paarung
                </button>
              )}
            </div>
            <div className="space-y-2">
              {(byRound[r] ?? []).map(m => (
                <MatchRow key={m.id} m={m} canEdit={canEdit} onSelectMatch={onSelectMatch} onDeleteMatch={onDeleteMatch} />
              ))}
            </div>
            {addState?.groupKey === String(r) && (
              <div className="flex items-center gap-2 mt-2 p-3 rounded-xl border border-dashed border-indigo-700 bg-indigo-950/20">
                <select className="input flex-1 text-sm" value={addState.p1}
                  onChange={e => setAddState(s => s ? { ...s, p1: e.target.value } : s)} autoFocus>
                  <option value="">— Teilnehmer 1 —</option>
                  {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <span className="text-gray-500 text-sm shrink-0 font-bold">vs</span>
                <select className="input flex-1 text-sm" value={addState.p2}
                  onChange={e => setAddState(s => s ? { ...s, p2: e.target.value } : s)}>
                  <option value="">— Teilnehmer 2 —</option>
                  {participants.filter(p => String(p.id) !== addState.p1).map(p =>
                    <option key={p.id} value={p.id}>{p.name}</option>
                  )}
                </select>
                <button onClick={() => {
                  if (!addState.p1 || !addState.p2) return;
                  onAddMatch?.(r, Number(addState.p1), Number(addState.p2));
                  setAddState(prev => prev ? { ...prev, p1: "", p2: "" } : null);
                }} disabled={!addState.p1 || !addState.p2}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40 transition-colors">+</button>
                <button onClick={() => setAddState(null)} className="text-gray-500 hover:text-white text-lg shrink-0 leading-none">×</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        addState?.groupKey === `r${nextRoundNo}` ? (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Runde {nextRoundNo + 1}</h3>
            <div className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-indigo-700 bg-indigo-950/20">
              <select className="input flex-1 text-sm" value={addState.p1}
                onChange={e => setAddState(s => s ? { ...s, p1: e.target.value } : s)} autoFocus>
                <option value="">— Teilnehmer 1 —</option>
                {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span className="text-gray-500 text-sm shrink-0 font-bold">vs</span>
              <select className="input flex-1 text-sm" value={addState.p2}
                onChange={e => setAddState(s => s ? { ...s, p2: e.target.value } : s)}>
                <option value="">— Teilnehmer 2 —</option>
                {participants.filter(p => String(p.id) !== addState.p1).map(p =>
                  <option key={p.id} value={p.id}>{p.name}</option>
                )}
              </select>
              <button onClick={() => {
                if (!addState.p1 || !addState.p2) return;
                onAddMatch?.(nextRoundNo, Number(addState.p1), Number(addState.p2));
                setAddState(prev => prev ? { ...prev, p1: "", p2: "" } : null);
              }} disabled={!addState.p1 || !addState.p2}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40 transition-colors">+</button>
              <button onClick={() => setAddState(null)} className="text-gray-500 hover:text-white text-lg shrink-0 leading-none">×</button>
            </div>
          </div>
        ) : (
          <button onClick={() => openAdd(`r${nextRoundNo}`)}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-600 rounded-xl text-sm text-gray-400 hover:border-indigo-600 hover:text-indigo-400 transition-colors">
            + Runde {nextRoundNo + 1} hinzufügen
          </button>
        )
      )}

      {participants.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Zwischenstand</h3>
          <StandingsTable participants={participants} showGroup={false} stats={stats} hasDraw={hasDraw} />
        </div>
      )}
    </div>
  );
}

function sortByPts(list: WettkampfParticipant[], stats: Record<string, ParticipantStats>) {
  return [...list].sort((a, b) => {
    const sa = stats[a.id] ?? { pts: 0, gd: 0, gf: 0 };
    const sb = stats[b.id] ?? { pts: 0, gd: 0, gf: 0 };
    return sb.pts - sa.pts || sb.gd - sa.gd || sb.gf - sa.gf || a.name.localeCompare(b.name);
  });
}

function StandingsTable({ participants, showGroup, stats, hasDraw }: {
  participants: WettkampfParticipant[];
  showGroup: boolean;
  stats: Record<string, ParticipantStats>;
  hasDraw: boolean;
}) {
  const sorted = sortByPts(participants, stats);
  return (
    <div className="border border-line rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800/60 text-gray-400 text-xs">
            <th className="text-left px-3 py-2">#</th>
            <th className="text-left px-3 py-2">Name</th>
            {showGroup && <th className="text-left px-3 py-2">Gruppe</th>}
            <th className="px-3 py-2 text-center">Sp</th>
            <th className="px-3 py-2 text-center text-green-400">S</th>
            {hasDraw && <th className="px-3 py-2 text-center text-yellow-400">U</th>}
            <th className="px-3 py-2 text-center text-red-400">N</th>
            <th className="px-3 py-2 text-center">+</th>
            <th className="px-3 py-2 text-center">−</th>
            <th className="px-3 py-2 text-center">Diff</th>
            <th className="px-3 py-2 text-center font-bold text-white">Pkt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.map((p, i) => {
            const s = stats[p.id] ?? { w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
            return (
              <tr key={p.id} className={i === 0 && s.pts > 0 ? "bg-yellow-900/10" : ""}>
                <td className="px-3 py-2 text-gray-400 text-xs">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                {showGroup && <td className="px-3 py-2 text-xs text-gray-500">{p.group ?? "—"}</td>}
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
  );
}

const GENDER_RE = /\s*(♂|♀|männlich|weiblich|\bm\b|\bw\b|\bf\b)$/i;
function baseName(name: string) { return name.replace(GENDER_RE, "").trim(); }

type MergedRow = { participant: WettkampfParticipant; mergedStats: ParticipantStats; parts: WettkampfParticipant[] };

function sumStats(rows: { stats: ParticipantStats }[]): ParticipantStats {
  return rows.reduce((acc, r) => {
    const s = r.stats;
    return { w: acc.w+s.w, d: acc.d+s.d, l: acc.l+s.l, gf: acc.gf+s.gf, ga: acc.ga+s.ga, gd: acc.gd+s.gd, pts: acc.pts+s.pts };
  }, { w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
}

function buildMergedView(participants: WettkampfParticipant[], stats: Record<string, ParticipantStats>): MergedRow[] {
  const groups = new Map<string, WettkampfParticipant[]>();
  for (const p of participants) {
    const key = baseName(p.name);
    (groups.get(key) ?? (groups.set(key, []), groups.get(key)!)).push(p);
  }
  const rows: MergedRow[] = [];
  for (const [key, parts] of groups) {
    const mergedStats = sumStats(parts.map(p => ({ stats: stats[p.id] ?? { w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 } })));
    rows.push({ participant: { ...parts[0], name: key }, mergedStats, parts });
  }
  return rows;
}


function GesamtstandTable({ participants, groups, stats, hasDraw }: {
  participants: WettkampfParticipant[];
  groups: string[];
  stats: Record<string, ParticipantStats>;
  hasDraw: boolean;
}) {
  const [merged, setMerged] = useState(false);
  const [filter, setFilter] = useState<string>("__all__");

  // Merged group names = groups with ♂/♀ stripped and deduplicated
  const mergedGroupNames = Array.from(new Set(groups.map(g => baseName(g)))).sort();
  const canMerge = mergedGroupNames.length < groups.length; // true when any groups share a base name

  function toggleMerged() {
    setMerged(m => !m);
    setFilter("__all__");
  }

  // In merged mode: filter by merged group name (baseName of participant.group)
  // In normal mode: filter by exact group name
  const filteredParticipants = filter === "__all__"
    ? participants
    : merged
      ? participants.filter(p => baseName(p.group ?? "") === filter)
      : participants.filter(p => p.group === filter);

  const mergedRows = buildMergedView(filteredParticipants, stats);
  const mergedStatsMap: Record<string, ParticipantStats> = {};
  for (const row of mergedRows) mergedStatsMap[row.participant.id] = row.mergedStats;

  const dropdownOptions = merged ? mergedGroupNames : groups;
  const showGroupCol = filter === "__all__" && !merged && groups.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">Gesamtstand</h3>
        <div className="flex items-center gap-2">
          {dropdownOptions.length > 1 && (
            <select value={filter} onChange={e => setFilter(e.target.value)} className="input text-xs py-1 px-2">
              <option value="__all__">Alle</option>
              {dropdownOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          )}
          {canMerge && (
            <button
              onClick={toggleMerged}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${merged ? "border-indigo-500 bg-indigo-900/30 text-indigo-300" : "border-line text-gray-500 hover:border-indigo-500 hover:text-indigo-300"}`}
            >
              {merged ? "⊕ Zusammengefasst" : "⊕ Zusammenfassen"}
            </button>
          )}
        </div>
      </div>
      <StandingsTable
        participants={merged ? mergedRows.map(r => r.participant) : filteredParticipants}
        showGroup={showGroupCol}
        stats={merged ? mergedStatsMap : stats}
        hasDraw={hasDraw}
      />
    </div>
  );
}
