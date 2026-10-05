"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, WettkampfMatch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import BracketView from "./BracketView";
import RoundRobinView from "./RoundRobinView";
import PairingView from "./PairingView";
import AuswertungView from "./AuswertungView";
import PunktePanel from "./PunktePanel";

// ── ResultModal ───────────────────────────────────────────────────────────────

function ResultModal({
  match,
  allowDraw,
  onSave,
  onClose,
}: {
  match: WettkampfMatch;
  allowDraw: boolean;
  onSave: (winnerId: number | null, isDraw: boolean, s1: string, s2: string) => void;
  onClose: () => void;
}) {
  const [winnerId, setWinnerId] = useState<number | null>(match.winner_id);
  const [isDraw, setIsDraw] = useState(match.is_draw);
  const [s1, setS1] = useState(match.score_p1 ?? "");
  const [s2, setS2] = useState(match.score_p2 ?? "");

  const canSave = isDraw || winnerId !== null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-lg">Ergebnis eintragen</h2>

        <div className="text-sm text-gray-400 text-center font-medium">
          {match.p1?.name} <span className="text-gray-600">vs</span> {match.p2?.name}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-gray-500 mb-1 text-center">{match.p1?.name}</p>
            <input className="input text-center" placeholder="0" value={s1} onChange={e => setS1(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 text-center">{match.p2?.name}</p>
            <input className="input text-center" placeholder="0" value={s2} onChange={e => setS2(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-400">Ergebnis:</p>
          {[match.p1, match.p2].map(p => p && (
            <button key={p.id}
              onClick={() => { setWinnerId(p.id); setIsDraw(false); }}
              className={`py-2 rounded-xl border text-sm font-semibold transition-colors ${
                !isDraw && winnerId === p.id
                  ? "border-green-500 bg-green-900/30 text-green-300"
                  : "border-gray-600 text-gray-300 hover:border-gray-400"
              }`}>
              🏆 {p.name} gewinnt
            </button>
          ))}
          {allowDraw && (
            <button
              onClick={() => { setIsDraw(true); setWinnerId(null); }}
              className={`py-2 rounded-xl border text-sm font-semibold transition-colors ${
                isDraw ? "border-yellow-500 bg-yellow-900/30 text-yellow-300" : "border-gray-600 text-gray-300 hover:border-gray-400"
              }`}>
              🤝 Unentschieden
            </button>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm">Abbrechen</button>
          <button
            disabled={!canSave}
            onClick={() => canSave && onSave(isDraw ? null : winnerId, isDraw, s1, s2)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 font-semibold text-sm disabled:opacity-40"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WettkampfDetailPage() {
  const { id } = useParams<{ id: string }>();
  const wid = Number(id);
  const router = useRouter();
  const { auth } = useAuth();
  const qc = useQueryClient();

  const { data: w, isLoading } = useQuery({
    queryKey: ["wettkampf", wid],
    queryFn: () => api.wettkampf.get(wid),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: api.classes.list,
  });

  const [newName, setNewName] = useState("");
  // selection keys: `${classId}:mixed`, `${classId}:male`, `${classId}:female`, `"teacher"`
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addingP, setAddingP] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<WettkampfMatch | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishResult, setFinishResult] = useState<{ participant: { name: string }; stage: { name: string } | null; points: number }[] | null>(null);
  const [classResult, setClassResult] = useState<{ name: string; rank: number; stats: { w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number }; points: number }[] | null>(null);
  const [showAuswertung, setShowAuswertung] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Group management
  const [, setEditingGroupFor] = useState<number | null>(null);
  const [groupDraft, setGroupDraft] = useState("");
  const [newGroupInput, setNewGroupInput] = useState<number | null>(null); // pid with custom input shown
  // Auto-pairing
  const [autopairingGroup, setAutopairingGroup] = useState<string | null | undefined>(undefined); // undefined = not running
  // Auto-groups
  const [autoGroupOpen, setAutoGroupOpen] = useState(false);
  const [customGroupSel, setCustomGroupSel] = useState<Set<number>>(new Set());
  const [customGroupName, setCustomGroupName] = useState("");
  // Manual points for pairing finish
  const [manualPointsMode, setManualPointsMode] = useState(false);
  const [manualPts, setManualPts] = useState<Record<number, string>>({});

  if (isLoading) return <p className="p-6 text-muted">Wird geladen…</p>;
  if (!w) return <p className="p-6 text-red-500">Wettkampf nicht gefunden.</p>;

  const canEdit = !!auth;
  const isDraft = w.status === "draft";
  const isActive = w.status === "active";
  const isFinished = w.status === "finished";

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function addParticipants() {
    setAddingP(true);
    try {
      const existingNames = new Set(w?.participants.map(p => p.name));
      const SUFFIX = { mixed: "", male: " ♂", female: " ♀" };
      for (const key of selected) {
        if (key === "teacher") {
          if (!existingNames.has("Lehrerteam"))
            await api.wettkampf.addParticipant(wid, { name: "Lehrerteam", class_id: null });
        } else {
          const [cidStr, variant] = key.split(":") as [string, "mixed" | "male" | "female"];
          const cls = classes.find(c => c.id === Number(cidStr));
          if (!cls) continue;
          const name = cls.display_name + SUFFIX[variant];
          const gender = variant === "male" ? "m" : variant === "female" ? "f" : null;
          if (!existingNames.has(name))
            await api.wettkampf.addParticipant(wid, { name, class_id: cls.id, gender });
        }
      }
      if (newName.trim()) {
        const names = newName.split(";").map(n => n.trim()).filter(Boolean);
        for (const n of names) {
          if (!existingNames.has(n))
            await api.wettkampf.addParticipant(wid, { name: n, class_id: null });
        }
        setNewName("");
      }
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["wettkampf", wid] });
    } finally {
      setAddingP(false);
    }
  }

  async function removeParticipant(pid: number) {
    await api.wettkampf.removeParticipant(wid, pid);
    qc.invalidateQueries({ queryKey: ["wettkampf", wid] });
  }

  async function generate() {
    setGenerating(true); setError(null);
    try {
      await api.wettkampf.generate(wid);
      qc.invalidateQueries({ queryKey: ["wettkampf", wid] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setGenerating(false);
    }
  }

  async function saveGroup(pid: number, group: string) {
    await api.wettkampf.updateParticipant(wid, pid, { group: group.trim() || null });
    qc.invalidateQueries({ queryKey: ["wettkampf", wid] });
    setEditingGroupFor(null);
    setGroupDraft("");
    setNewGroupInput(null);
  }

  function extractGrade(name: string, className: string | null): string | null {
    const src = className ?? name;
    const m = src.match(/(\d+)/);
    return m ? m[1] : null;
  }

  async function applyAutoGroups(mode: "grade" | "grade_gender") {
    if (!w) return;
    const updates: { pid: number; group: string }[] = [];
    for (const p of w.participants) {
      const grade = extractGrade(p.name, p.class_name);
      if (!grade) continue;
      let group = `Stufe ${grade}`;
      if (mode === "grade_gender") {
        const gender = p.name.includes("♂") ? " ♂" : p.name.includes("♀") ? " ♀" : "";
        group += gender;
      }
      updates.push({ pid: p.id, group });
    }
    for (const { pid, group } of updates) {
      await api.wettkampf.updateParticipant(wid, pid, { group });
    }
    qc.invalidateQueries({ queryKey: ["wettkampf", wid] });
  }

  async function applyCustomGroup() {
    if (!customGroupName.trim() || customGroupSel.size === 0) return;
    for (const pid of customGroupSel) {
      await api.wettkampf.updateParticipant(wid, pid, { group: customGroupName.trim() });
    }
    setCustomGroupSel(new Set());
    setCustomGroupName("");
    qc.invalidateQueries({ queryKey: ["wettkampf", wid] });
  }

  function suggestGroupName(pids: Set<number>): string {
    if (!w) return "";
    const selected = w.participants.filter(p => pids.has(p.id));
    const grades = Array.from(new Set(selected.map(p => extractGrade(p.name, p.class_name)).filter(Boolean)));
    const hasM = selected.some(p => p.name.includes("♂"));
    const hasF = selected.some(p => p.name.includes("♀"));
    if (grades.length === 1) return `Stufe ${grades[0]}${hasM && !hasF ? " ♂" : hasF && !hasM ? " ♀" : ""}`;
    return grades.length > 0 ? `Stufe ${grades.join("/")}` : "";
  }

  async function autoPair(group: string | null) {
    setAutopairingGroup(group);
    setError(null);
    try {
      await api.wettkampf.autoPair(wid, group);
      qc.invalidateQueries({ queryKey: ["wettkampf", wid] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Auto-Pairing");
    } finally {
      setAutopairingGroup(undefined);
    }
  }

  async function addMatch(round: number, p1Id: number, p2Id: number) {
    await api.wettkampf.addMatch(wid, { round_number: round, p1_id: p1Id, p2_id: p2Id });
    qc.invalidateQueries({ queryKey: ["wettkampf", wid] });
  }

  async function deleteMatch(mid: number) {
    await api.wettkampf.deleteMatch(wid, mid);
    qc.invalidateQueries({ queryKey: ["wettkampf", wid] });
  }

  async function saveResult(winnerId: number | null, isDraw: boolean, s1: string, s2: string) {
    if (!selectedMatch) return;
    const isOverwrite = selectedMatch.winner_id !== null || selectedMatch.is_draw;
    if (isOverwrite && !confirm("Ergebnis bereits eingetragen. Wirklich überschreiben?")) return;
    await api.wettkampf.setResult(wid, selectedMatch.id, {
      winner_id: winnerId ?? undefined,
      is_draw: isDraw,
      score_p1: s1 || undefined,
      score_p2: s2 || undefined,
    });
    setSelectedMatch(null);
    qc.invalidateQueries({ queryKey: ["wettkampf", wid] });
  }

  async function finish(useManual = false) {
    if (!confirm("Wettkampf abschließen und Punkte vergeben?")) return;
    setFinishing(true); setError(null);
    try {
      let res;
      if (useManual && w) {
        const entries = w.participants.map(p => ({
          participant_id: p.id,
          points: Number(manualPts[p.id] ?? w.trostpreis_points),
        }));
        res = await api.wettkampf.finishWithPoints(wid, entries);
      } else {
        res = await api.wettkampf.finish(wid);
      }
      setFinishResult(res.awarded);
      if (res.class_awarded) setClassResult(res.class_awarded);
      setManualPointsMode(false);
      qc.invalidateQueries({ queryKey: ["wettkampf", wid] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setFinishing(false);
    }
  }

  const openMatches = (w.matches ?? []).filter(m => !m.winner_id && !m.is_draw && m.p1 && m.p2);
  const totalMatches = (w.matches ?? []).filter(m => m.p1 && m.p2).length;
  const doneMatches = totalMatches - openMatches.length;

  return (
    <div className="p-6 max-w-seite mx-auto w-full">
      {showAuswertung && finishResult && (
        <AuswertungView
          w={w}
          awarded={finishResult}
          classAwarded={classResult ?? undefined}
          onClose={() => setShowAuswertung(false)}
        />
      )}
      {selectedMatch && (
        <ResultModal
          match={selectedMatch}
          allowDraw={w.draw_points > 0}
          onSave={saveResult}
          onClose={() => setSelectedMatch(null)}
        />
      )}

      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-white mt-1">←</button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{w.title}</h1>
          {w.description && <p className="text-muted text-sm mt-1">{w.description}</p>}
          <div className="flex gap-3 mt-2 text-sm text-gray-500 flex-wrap">
            <span>{w.type === "knockout" ? "K.O.-System" : w.type === "round_robin" ? "Jeder gegen Jeden" : "Paarungsturnier"}</span>
            <span>·</span>
            <span>Max {w.max_points} Pkte · Trostpreis {w.trostpreis_points} Pkte</span>
            <span>·</span>
            <span className={isActive ? "text-green-400" : isFinished ? "text-blue-400" : "text-gray-400"}>
              {isDraft ? "Entwurf" : isActive ? "Läuft" : "Abgeschlossen"}
            </span>
          </div>
        </div>
        {isFinished && (
          <button
            onClick={async () => {
              if (!finishResult) {
                try {
                  const res = await api.wettkampf.results(wid);
                  setFinishResult(res.awarded);
                  if (res.class_awarded) setClassResult(res.class_awarded);
                } catch {
                  // fallback: use stats-based ranking
                  const statsMap = (w.stats ?? {}) as Record<string, { pts: number; gd: number; gf: number }>;
                  const sorted = [...w.participants].sort((a, b) => {
                    const sa = statsMap[a.id] ?? { pts: 0, gd: 0, gf: 0 };
                    const sb = statsMap[b.id] ?? { pts: 0, gd: 0, gf: 0 };
                    return sb.pts - sa.pts || sb.gd - sa.gd || sb.gf - sa.gf;
                  });
                  const n = sorted.length;
                  setFinishResult(sorted.map((p, i) => ({
                    participant: { name: p.name },
                    stage: null as { name: string } | null,
                    points: Math.round(w.trostpreis_points + (n > 1 ? (n - 1 - i) / (n - 1) : 1) * (w.max_points - w.trostpreis_points)),
                  })));
                }
              }
              setShowAuswertung(true);
            }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            📄 Auswertung
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {/* Finish result banner */}
      {finishResult && (
        <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-green-300">🏆 Wettkampf abgeschlossen – Punkte vergeben!</p>
            <button
              onClick={() => setShowAuswertung(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              📄 Auswertung
            </button>
          </div>
          <div className="space-y-1">
            {[...finishResult].sort((a, b) => b.points - a.points).map((r, i) => {
              const hasClass = w.participants.find(p => p.name === r.participant.name)?.class_id != null;
              return (
                <div key={i} className="flex justify-between text-sm gap-2">
                  <span className="text-gray-200 flex-1">{r.participant.name}</span>
                  <span className="text-gray-400">{r.stage?.name ?? "Teilnahme"}</span>
                  <span className="text-yellow-400 font-bold">{r.points} Pkte</span>
                  {!hasClass && <span className="text-orange-400 text-xs" title="Kein Klassenlink – keine Hauspunkte gebucht">⚠ kein Klasse</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Draft: setup */}
      {isDraft && canEdit && (
        <div className="space-y-6">
          {/* Participants */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Teilnehmer ({w.participants.length})</h2>
            {/* Added participants */}
            {w.participants.length > 0 && (() => {
              const existingGroups = Array.from(new Set(w.participants.map(p => p.group).filter((g): g is string => !!g))).sort();
              return (
                <div className="mb-4 border border-line rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-800/40 text-gray-500 text-xs">
                        <th className="text-left px-3 py-2">Name</th>
                        <th className="px-3 py-2 text-center">⚥</th>
                        <th className="text-left px-3 py-2">Gruppe</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {w.participants.map(p => (
                        <tr key={p.id}>
                          <td className="px-3 py-2 font-medium">
                            {p.name}
                            {p.class_name && <span className="ml-2 text-xs text-gray-500">{p.class_name}</span>}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="flex gap-0.5 justify-center">
                              {(["m", "f"] as const).map(g => (
                                <button
                                  key={g}
                                  onClick={() => api.wettkampf.updateParticipant(wid, p.id, { gender: p.gender === g ? null : g }).then(() => qc.invalidateQueries({ queryKey: ["wettkampf", wid] }))}
                                  className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                                    p.gender === g
                                      ? g === "m" ? "border-blue-500 bg-blue-900/30 text-blue-300" : "border-pink-500 bg-pink-900/30 text-pink-300"
                                      : "border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400"
                                  }`}
                                >
                                  {g === "m" ? "♂" : "♀"}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {newGroupInput === p.id ? (
                              <div className="flex gap-1 items-center">
                                <input
                                  className="input text-xs py-0.5 px-2 w-28"
                                  value={groupDraft}
                                  onChange={e => setGroupDraft(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") saveGroup(p.id, groupDraft); if (e.key === "Escape") { setNewGroupInput(null); setEditingGroupFor(null); } }}
                                  autoFocus
                                  placeholder="Gruppenname…"
                                />
                                <button onClick={() => saveGroup(p.id, groupDraft)} className="text-xs px-2 py-0.5 bg-accent text-white rounded-sm">✓</button>
                                <button onClick={() => { setNewGroupInput(null); setEditingGroupFor(null); }} className="text-xs text-gray-500">✕</button>
                              </div>
                            ) : (
                              <select
                                className="input text-xs py-0.5 px-2 w-32"
                                value={p.group ?? ""}
                                onChange={e => {
                                  const v = e.target.value;
                                  if (v === "__new__") {
                                    setGroupDraft("");
                                    setNewGroupInput(p.id);
                                    setEditingGroupFor(p.id);
                                  } else {
                                    saveGroup(p.id, v);
                                  }
                                }}
                              >
                                <option value="">— keine Gruppe —</option>
                                {existingGroups.map(g => <option key={g} value={g}>{g}</option>)}
                                <option value="__new__">+ Neue Gruppe…</option>
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <button onClick={() => removeParticipant(p.id)} className="text-gray-600 hover:text-red-400 text-xs">🗑</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            {/* Auto-Gruppen */}
            {w.participants.length >= 2 && (
              <div className="mb-4 border border-line rounded-xl overflow-hidden">
                <button
                  onClick={() => setAutoGroupOpen(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/40 text-sm text-gray-300 hover:bg-gray-800/60 transition-colors"
                >
                  <span className="font-medium">🗂 Gruppen auto-zuweisen</span>
                  <span className="text-gray-500 text-xs">{autoGroupOpen ? "▲" : "▼"}</span>
                </button>
                {autoGroupOpen && (
                  <div className="p-3 space-y-3">
                    {/* Strategy buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => applyAutoGroups("grade")}
                        className="text-xs px-3 py-1.5 rounded-lg border border-line text-gray-300 hover:border-indigo-600 hover:text-indigo-300 transition-colors"
                      >
                        Nach Klassenstufe
                      </button>
                      <button
                        onClick={() => applyAutoGroups("grade_gender")}
                        className="text-xs px-3 py-1.5 rounded-lg border border-line text-gray-300 hover:border-indigo-600 hover:text-indigo-300 transition-colors"
                      >
                        Nach Klassenstufe + Geschlecht
                      </button>
                    </div>

                    {/* Custom selection */}
                    <div className="border-t border-line pt-3">
                      {(() => {
                        const ungrouped = w.participants.filter(p => !p.group);
                        return (
                          <>
                            <p className="text-xs text-gray-500 mb-2">
                              Eigene Auswahl{ungrouped.length < w.participants.length ? ` (${w.participants.length - ungrouped.length} bereits in Gruppen ausgeblendet)` : ""}:
                            </p>
                            <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
                              {ungrouped.length === 0 ? (
                                <p className="text-xs text-gray-600 italic">Alle Teilnehmer haben bereits eine Gruppe.</p>
                              ) : ungrouped.map(p => (
                                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={customGroupSel.has(p.id)}
                                    onChange={e => {
                                      setCustomGroupSel(prev => {
                                        const next = new Set(prev);
                                        e.target.checked ? next.add(p.id) : next.delete(p.id);
                                        const suggested = suggestGroupName(next);
                                        if (suggested) setCustomGroupName(suggested);
                                        return next;
                                      });
                                    }}
                                    className="rounded-sm"
                                  />
                                  <span className="text-sm text-gray-300">{p.name}</span>
                                </label>
                              ))}
                            </div>
                          </>
                        );
                      })()}

                      <div className="flex gap-2 items-center">
                        <input
                          className="input text-xs py-1 px-2 flex-1"
                          placeholder="Gruppenname…"
                          value={customGroupName}
                          onChange={e => setCustomGroupName(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && applyCustomGroup()}
                        />
                        <button
                          onClick={applyCustomGroup}
                          disabled={!customGroupName.trim() || customGroupSel.size === 0}
                          className="btn-primary text-xs px-3 py-1.5"
                        >
                          Zuweisen
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Class rows with mixed / ♂ / ♀ toggles */}
            {classes.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Klassen hinzufügen:</p>
                  {/* Select-all buttons */}
                  <div className="flex gap-1">
                    {(["mixed", "male", "female"] as const).map(v => {
                      const SUFFIX = { mixed: "", male: " ♂", female: " ♀" };
                      const LABEL = { mixed: "Alle Gesamt", male: "Alle ♂", female: "Alle ♀" };
                      const existingNames = new Set(w.participants.map(p => p.name));
                      const available = classes.filter(c => !existingNames.has(c.display_name + SUFFIX[v]));
                      const allKeys = available.map(c => `${c.id}:${v}`);
                      const allOn = allKeys.length > 0 && allKeys.every(k => selected.has(k));
                      if (available.length === 0) return null;
                      return (
                        <button
                          key={v}
                          onClick={() => setSelected(prev => {
                            const next = new Set(prev);
                            if (allOn) allKeys.forEach(k => next.delete(k));
                            else allKeys.forEach(k => next.add(k));
                            return next;
                          })}
                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                            allOn
                              ? "border-accent bg-accent/15 text-accent"
                              : "border-line text-gray-500 hover:border-gray-400 hover:text-gray-300"
                          }`}
                        >
                          {LABEL[v]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {classes.map(c => {
                  const existingNames = new Set(w.participants.map(p => p.name));
                  const SUFFIX = { mixed: "", male: " ♂", female: " ♀" };
                  const LABEL = { mixed: "Gesamt", male: "♂", female: "♀" };
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="text-sm text-gray-300 w-28 shrink-0 truncate">{c.display_name}</span>
                      {(["mixed", "male", "female"] as const).map(v => {
                        const key = `${c.id}:${v}`;
                        const name = c.display_name + SUFFIX[v];
                        const done = existingNames.has(name);
                        const on = selected.has(key);
                        return (
                          <button
                            key={v}
                            disabled={done}
                            onClick={() => !done && toggle(key)}
                            className={`text-xs px-2 py-1 rounded-md border transition-colors select-none ${
                              done
                                ? "border-gray-700 text-gray-600 cursor-not-allowed"
                                : on
                                ? "border-accent bg-accent/15 text-accent"
                                : "border-line text-gray-400 hover:border-gray-500"
                            }`}
                          >
                            {done ? "✓ " : ""}{LABEL[v]}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Lehrerteam */}
            <div className="mb-4">
              {(() => {
                const done = w.participants.some(p => p.name === "Lehrerteam");
                const on = selected.has("teacher");
                return (
                  <button
                    disabled={done}
                    onClick={() => !done && toggle("teacher")}
                    className={`text-xs px-3 py-1.5 rounded-md border transition-colors select-none ${
                      done
                        ? "border-gray-700 text-gray-600 cursor-not-allowed"
                        : on
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-line text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    {done ? "✓ " : ""}👩‍🏫 Lehrerteam
                  </button>
                );
              })()}
            </div>
            {/* Custom teams */}
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-gray-500">Eigene Teams</span>
              <span
                className="text-xs text-gray-600 cursor-help border border-gray-700 rounded-full w-4 h-4 flex items-center justify-center leading-none hover:border-gray-400 hover:text-gray-400 transition-colors"
                title="Mehrere Teams auf einmal: Namen mit Semikolon trennen, z.B. »5a; 5b; 5c«"
              >?</span>
            </div>
            <input
              className="input w-full mb-2"
              placeholder="z.B. 5a; 5b; 5c"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addParticipants()}
            />
            <button
              onClick={addParticipants}
              disabled={addingP || (selected.size === 0 && !newName.trim())}
              className="btn-primary text-sm px-3 py-1.5"
            >
              {addingP ? "Füge hinzu…" : "Hinzufügen"}
            </button>
          </section>

          {/* Punkte & Ranking Panel */}
          <PunktePanel w={w} canEdit={canEdit} />

          {/* Auto-pairing per group (pairing type only) */}
          {w.type === "pairing" && (() => {
            const groups = Array.from(new Set(w.participants.map(p => p.group).filter((g): g is string => !!g))).sort();
            const ungrouped = w.participants.filter(p => !p.group);
            // Only show groups/ungrouped with 2+ members
            const pairableGroups = groups.filter(g => w.participants.filter(p => p.group === g).length >= 2);
            const hasUngrouped = ungrouped.length >= 2;
            if (!pairableGroups.length && !hasUngrouped) return null;
            return (
              <section>
                <h2 className="text-lg font-semibold mb-1">Auto-Paarung</h2>
                <p className="text-xs text-gray-500 mb-3">Erzeugt Jeder-gegen-Jeden-Begegnungen innerhalb einer Gruppe.</p>
                <div className="flex flex-wrap gap-2">
                  {pairableGroups.map(g => {
                    const count = w.participants.filter(p => p.group === g).length;
                    const running = autopairingGroup === g;
                    return (
                      <button
                        key={g}
                        onClick={() => autoPair(g)}
                        disabled={autopairingGroup !== undefined}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-700 bg-indigo-900/20 text-indigo-300 text-sm hover:bg-indigo-800/30 disabled:opacity-50 transition-colors"
                      >
                        {running ? "⏳" : "⚡"} {g} <span className="text-xs text-indigo-500">({count} Teams)</span>
                      </button>
                    );
                  })}
                  {hasUngrouped && (
                    <button
                      onClick={() => autoPair(null)}
                      disabled={autopairingGroup !== undefined}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-600 text-gray-400 text-sm hover:border-gray-500 disabled:opacity-50 transition-colors"
                    >
                      {autopairingGroup === null ? "⏳" : "⚡"} Ohne Gruppe <span className="text-xs text-gray-600">({ungrouped.length} Teams)</span>
                    </button>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Preview / Generate */}
          <section className="pt-2 border-t border-line">
            {!showPreview ? (
              <>
                {(() => {
                  const needsConfig = w.stages.length === 0 && w.rewarded_places == null && w.type !== "pairing";
                  return (
                    <>
                      <button
                        onClick={() => setShowPreview(true)}
                        disabled={w.participants.length < 2 || needsConfig}
                        className="btn-primary w-full"
                      >
                        Vorschau & starten →
                      </button>
                      {w.participants.length < 2 && (
                        <p className="text-xs text-gray-500 mt-1">Mindestens 2 Teilnehmer benötigt.</p>
                      )}
                      {needsConfig && (
                        <p className="text-xs text-gray-500 mt-1">Bitte erst „Belohnte Plätze" festlegen und Punkte speichern.</p>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              /* ── Preview panel ── */
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Vorschau</h2>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    ← Zurück zu Gruppen
                  </button>
                </div>

                {/* Summary chips */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300">
                    {w.participants.length} Teilnehmer
                  </span>
                  <span className="px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300">
                    {w.type === "knockout" ? "K.O.-System" : w.type === "round_robin" ? "Jeder gegen Jeden" : "Paarungsturnier"}
                  </span>
                  {w.stages.length > 0 && (
                    <span className="px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300">
                      {w.stages.length} Stufen · Max {w.max_points} Pkte
                    </span>
                  )}
                  <span className="px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300">
                    {w.scoring_system} ({w.win_points}-{w.draw_points}-{w.loss_points})
                  </span>
                </div>

                {/* Groups */}
                {(() => {
                  const groups = Array.from(new Set(w.participants.map(p => p.group ?? ""))).sort();
                  const hasGroups = w.participants.some(p => p.group);
                  if (!hasGroups) {
                    return (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Teilnehmer</p>
                        <div className="flex flex-wrap gap-2">
                          {w.participants.map(p => (
                            <span key={p.id} className="text-sm px-2 py-1 bg-gray-800 rounded-lg border border-gray-700 text-gray-300">{p.name}</span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Gruppen</p>
                      {groups.map(g => {
                        const members = w.participants.filter(p => (p.group ?? "") === g);
                        return (
                          <div key={g} className="rounded-xl border border-line overflow-hidden">
                            <div className="px-3 py-2 bg-gray-800/60 flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-200">{g || "Ohne Gruppe"}</span>
                              <span className="text-xs text-gray-500">{members.length} Teams</span>
                            </div>
                            <div className="px-3 py-2 flex flex-wrap gap-2">
                              {members.map(p => (
                                <span key={p.id} className="text-xs px-2 py-0.5 bg-gray-900 rounded-md border border-gray-700 text-gray-300">{p.name}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Draft matches (pairing) */}
                {w.type === "pairing" && w.matches && w.matches.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                      Geplante Begegnungen ({w.matches.length})
                    </p>
                    {(() => {
                      const rounds = Array.from(new Set(w.matches.map(m => m.round_number))).sort((a,b) => a-b);
                      const byRound: Record<number, typeof w.matches> = {};
                      for (const m of w.matches) (byRound[m.round_number] ??= []).push(m);
                      return rounds.map(r => (
                        <div key={r} className="mb-2">
                          <p className="text-xs text-gray-600 mb-1">Runde {r + 1}</p>
                          <div className="space-y-1">
                            {byRound[r].map(m => (
                              <div key={m.id} className="flex items-center gap-2 text-sm text-gray-400 px-2">
                                <span className="flex-1 text-right text-gray-300">{m.p1?.name ?? "—"}</span>
                                <span className="text-gray-600 text-xs">vs</span>
                                <span className="flex-1 text-gray-300">{m.p2?.name ?? "—"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* Stages */}
                {w.stages.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Punktestufen</p>
                    <div className="flex flex-wrap gap-2">
                      {[...w.stages].sort((a,b) => b.points - a.points).map(s => (
                        <span key={s.id} className="text-xs px-2 py-1 rounded-lg border border-yellow-800 bg-yellow-900/20 text-yellow-300">
                          {s.name}: {s.points} Pkte
                        </span>
                      ))}
                      <span className="text-xs px-2 py-1 rounded-lg border border-gray-700 text-gray-500">
                        Trostpreis: {w.trostpreis_points} Pkte
                      </span>
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-red-400">{error}</p>}

                {/* Confirm */}
                <div className="flex gap-3 pt-2 border-t border-line">
                  <button
                    onClick={generate}
                    disabled={generating}
                    className="btn-primary w-full"
                  >
                    {generating ? "Starte…" : "✓ Turnier starten"}
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-2 border border-line rounded-xl text-sm text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors"
                  >
                    ← Zurück
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Active / Finished: bracket or round robin */}
      {(isActive || isFinished) && (
        <div className="space-y-6">
          {/* Progress */}
          {isActive && totalMatches > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(doneMatches / totalMatches) * 100}%` }}
                />
              </div>
              <span className="text-sm text-gray-400 shrink-0">{doneMatches} / {totalMatches} gespielt</span>
            </div>
          )}

          {w.type === "knockout" ? (
            <BracketView
              matches={w.matches ?? []}
              onSelectMatch={isActive ? setSelectedMatch : undefined}
              canEdit={canEdit && isActive}
            />
          ) : w.type === "round_robin" ? (
            <RoundRobinView
              participants={w.participants}
              matches={w.matches ?? []}
              stats={w.stats ?? {}}
              onSelectMatch={isActive ? setSelectedMatch : undefined}
              canEdit={canEdit && isActive}
            />
          ) : (
            <PairingView
              participants={w.participants}
              matches={w.matches ?? []}
              stats={w.stats ?? {}}
              onSelectMatch={isActive ? setSelectedMatch : undefined}
              onAddMatch={isActive && canEdit ? addMatch : undefined}
              onDeleteMatch={isActive && canEdit ? deleteMatch : undefined}
              onAutoPair={isActive && canEdit ? autoPair : undefined}
              canEdit={canEdit && isActive}
            />
          )}

          {/* Stages summary */}
          {w.stages.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Punktestufen</h3>
              <div className="flex flex-wrap gap-2">
                {w.stages.map(s => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm border border-gray-700">
                    <span className="text-gray-300">{s.name}</span>
                    <span className="text-yellow-400 font-bold">{s.points}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm border border-gray-700">
                  <span className="text-gray-500">Trostpreis</span>
                  <span className="text-gray-400 font-bold">{w.trostpreis_points}</span>
                </div>
              </div>
            </div>
          )}

          {/* Finish button */}
          {isActive && canEdit && (
            <div className="pt-4 border-t border-line space-y-3">
              {w.type === "pairing" ? (
                manualPointsMode ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-300">Punkte manuell vergeben:</p>
                    <div className="space-y-2">
                      {w.participants.map(p => (
                        <div key={p.id} className="flex items-center gap-3">
                          <span className="flex-1 text-sm">{p.name}</span>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            className="input w-24 text-sm text-center"
                            placeholder={String(w.trostpreis_points)}
                            value={manualPts[p.id] ?? ""}
                            onChange={e => setManualPts(prev => ({ ...prev, [p.id]: e.target.value }))}
                          />
                          <span className="text-xs text-gray-500 w-8">Pkte</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => finish(true)} disabled={finishing} className="btn-primary w-full">
                        {finishing ? "Verarbeite…" : "Punkte vergeben & abschließen 🏆"}
                      </button>
                      <button onClick={() => setManualPointsMode(false)} className="text-sm text-gray-400 hover:text-white">
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 flex-wrap">
                    <button onClick={() => finish(false)} disabled={finishing} className="btn-primary w-full">
                      {finishing ? "Verarbeite…" : "Abschließen (Punkte nach Siegen) 🏆"}
                    </button>
                    {w.stages.length > 0 || true ? (
                      <button
                        onClick={() => { setManualPointsMode(true); setManualPts({}); }}
                        className="px-4 py-2 border border-line rounded-lg text-sm text-gray-300 hover:border-gray-500 transition-colors"
                      >
                        Punkte selbst eintragen…
                      </button>
                    ) : null}
                  </div>
                )
              ) : openMatches.length === 0 ? (
                <button onClick={() => finish(false)} disabled={finishing} className="btn-primary w-full">
                  {finishing ? "Verarbeite…" : "Wettkampf abschließen & Punkte vergeben 🏆"}
                </button>
              ) : (
                <p className="text-sm text-gray-500">
                  Noch {openMatches.length} Begegnung{openMatches.length !== 1 ? "en" : ""} ausstehend.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
