"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, GruppenauswertungPreview, GruppenauswertungEntry } from "@/lib/api";

const QUIZ_TYPES = [
  { key: "tue",         label: "Tägliche Übung",  desc: "Bayesianische Normalisierung · Ø×10", color: "text-green-300 border-green-700" },
  { key: "classic",     label: "Klassisch",        desc: "Ø Score · Direktes Ranking",          color: "text-blue-300 border-blue-700" },
  { key: "test",        label: "Test",             desc: "Ø Score · Direktes Ranking",          color: "text-orange-300 border-orange-700" },
  { key: "assignment",  label: "Aufgabe",          desc: "Ø Score · Direktes Ranking",          color: "text-purple-300 border-purple-700" },
  { key: "competition", label: "Wettbewerb",       desc: "Ø Score · Direktes Ranking",          color: "text-yellow-300 border-yellow-700" },
  { key: "custom",      label: "Benutzerdefiniert",desc: "Ø Score · Direktes Ranking",          color: "text-gray-300 border-gray-600" },
];

export default function GruppenauswertungPage() {
  const router = useRouter();

  const [quizType, setQuizType] = useState("tue");
  const [minSessions, setMinSessions] = useState(1);
  const [priorStrength, setPriorStrength] = useState(3);
  const [maxPoints, setMaxPoints] = useState(10);
  const [trostpreis, setTrostpreis] = useState(1);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const { data: capuths = [] } = useQuery({ queryKey: ["capuths"], queryFn: api.capuths.list });

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const q of capuths) if (q.quiz_type === quizType) for (const t of q.tags) set.add(t);
    return Array.from(set).sort();
  }, [capuths, quizType]);

  function toggleTag(tag: string) {
    setActiveTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
    setPreview(null);
    setCommitted(null);
  }

  const [preview, setPreview] = useState<GruppenauswertungPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState<(GruppenauswertungEntry & { points_awarded: number })[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    setLoading(true);
    setError(null);
    setPreview(null);
    setCommitted(null);
    try {
      const data = await api.capuths.gruppenauswertungPreview({
        quiz_type: quizType,
        min_sessions: minSessions,
        prior_strength: quizType === "tue" ? priorStrength : undefined,
        tags: activeTags.size > 0 ? Array.from(activeTags) : undefined,
      });
      setPreview(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!preview || !confirm(`Gruppenauswertung für „${QUIZ_TYPES.find(t => t.key === quizType)?.label}" wirklich durchführen und Punkte vergeben?`)) return;
    setCommitting(true);
    setError(null);
    try {
      const res = await api.capuths.gruppenauswertungCommit({
        quiz_type: quizType,
        max_points: maxPoints,
        trostpreis_points: trostpreis,
        min_sessions: minSessions,
        prior_strength: priorStrength,
        tags: activeTags.size > 0 ? Array.from(activeTags) : undefined,
      });
      setCommitted(res.awarded);
      setPreview(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Vergeben");
    } finally {
      setCommitting(false);
    }
  }

  const isTue = quizType === "tue";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-[var(--text-muted)] hover:text-white mb-4">← Zurück</button>
      <h1 className="text-2xl font-bold mb-1">Gruppenauswertung</h1>
      <p className="text-sm text-gray-500 mb-6">
        Vergibt Hauspunkte basierend auf dem Ø-Score aller Klassen über alle Capuths eines Typs.
        {isTue && " Tägliche Übungen werden bayesianisch normalisiert, um Cherry-Picking zu verhindern."}
      </p>

      {/* Type selector */}
      <div className="mb-5">
        <label className="label mb-2">Caputh-Typ</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {QUIZ_TYPES.map(t => (
            <button key={t.key} onClick={() => { setQuizType(t.key); setActiveTags(new Set()); setPreview(null); setCommitted(null); }}
              className={`py-3 px-4 rounded-xl border text-left transition-colors ${
                quizType === t.key ? `border-current bg-current/10 ${t.color}` : "border-[var(--border)] text-[var(--text-muted)] hover:border-gray-500"
              }`}>
              <span className="text-sm font-semibold block">{t.label}</span>
              <span className="text-xs opacity-70">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tag filter */}
      {availableTags.length > 0 && (
        <div className="mb-5">
          <label className="label mb-2">Tags filtern <span className="text-gray-600 font-normal">(optional — leer = alle)</span></label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => (
              <button key={tag} onClick={() => toggleTag(tag)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  activeTags.has(tag)
                    ? "border-indigo-500 bg-indigo-900/30 text-indigo-300"
                    : "border-[var(--border)] text-gray-500 hover:border-gray-500"
                }`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="label">Mindest-Sessions</label>
          <input type="number" min={1} className="input" value={minSessions}
            onChange={e => { setMinSessions(Number(e.target.value)); setPreview(null); }} />
          <p className="text-xs text-gray-500 mt-1">Klassen mit weniger Sessions werden ausgeschlossen</p>
        </div>
        {isTue && (
          <div>
            <label className="label">Prior-Stärke (C)</label>
            <input type="number" min={1} max={20} className="input" value={priorStrength}
              onChange={e => { setPriorStrength(Number(e.target.value)); setPreview(null); }} />
            <p className="text-xs text-gray-500 mt-1">Höher = Cherry-Picking schwieriger (Standard: 3)</p>
          </div>
        )}
        <div>
          <label className="label">Max. Hauspunkte (Rang 1)</label>
          <input type="number" min={2} className="input" value={maxPoints}
            onChange={e => setMaxPoints(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Trostpreis (letzter Rang)</label>
          <input type="number" min={0} className="input" value={trostpreis}
            onChange={e => setTrostpreis(Number(e.target.value))} />
        </div>
      </div>

      <button onClick={loadPreview} disabled={loading}
        className="btn-primary mb-6">
        {loading ? "Lade Vorschau…" : "Vorschau berechnen"}
      </button>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {/* Preview */}
      {preview && (
        <div className="space-y-5">
          {preview.entries.length === 0 ? (
            <p className="text-gray-400 text-sm">Keine qualifizierten Klassen für diesen Typ.</p>
          ) : (
            <>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                  Vorschau — {preview.entries.length} Klassen qualifiziert
                </h2>
                <div className="border border-[var(--border)] rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-800/60 text-gray-400 text-xs">
                        <th className="text-left px-3 py-2">Rang</th>
                        <th className="text-left px-3 py-2">Klasse</th>
                        <th className="px-3 py-2 text-center">Sessions</th>
                        <th className="px-3 py-2 text-center">Ø Raw</th>
                        {isTue && <th className="px-3 py-2 text-center">Ø Adj.</th>}
                        <th className="px-3 py-2 text-center font-bold text-white">Hauspunkte</th>
                        <th className="px-3 py-2 text-center">Ersteller</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {preview.entries.map((e, i) => {
                        const n = preview.entries.length;
                        const t = n === 1 ? 0 : (e.rank - 1) / (n - 1);
                        const pts = Math.round(maxPoints + t * (trostpreis - maxPoints));
                        const topTeacher = Object.entries(e.teacher_counts).sort((a, b) => b[1] - a[1])[0];
                        return (
                          <tr key={e.class_id} className={i === 0 ? "bg-yellow-900/10" : ""}>
                            <td className="px-3 py-2 text-gray-400 text-xs">
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : e.rank}
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {e.class_name}
                              {e.suspicious && (
                                <span className="ml-2 text-xs text-amber-400" title="Mehr als 60% der Sessions von einer Lehrkraft">⚠️</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-300">{e.sessions}</td>
                            <td className="px-3 py-2 text-center text-gray-400">{e.raw_avg?.toFixed(2)}</td>
                            {isTue && <td className="px-3 py-2 text-center text-indigo-300 font-semibold">{e.adjusted?.toFixed(2)}</td>}
                            <td className="px-3 py-2 text-center font-bold text-yellow-400">{pts}</td>
                            <td className="px-3 py-2 text-center text-xs text-gray-500">
                              {topTeacher ? `${topTeacher[0]} (${topTeacher[1]})` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {preview.excluded.filter(e => e.sessions > 0).length > 0 && (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                    Ausgeschlossen (unter Mindestsessions)
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {preview.excluded.filter(e => e.sessions > 0).map(e => (
                      <span key={e.class_id} className="text-xs px-2 py-1 rounded-lg border border-gray-700 text-gray-500">
                        {e.class_name} ({e.sessions} Sessions)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {isTue && (
                <div className="p-3 rounded-xl border border-indigo-900 bg-indigo-950/30 text-xs text-indigo-300 space-y-1">
                  <p className="font-semibold">Bayesianische Normalisierung aktiv (C={priorStrength})</p>
                  <p>„Adj." = (C × Gesamtmittel + n × Ø Raw) / (C + n) — Klassen mit wenigen Sessions werden Richtung Gesamtmittel gezogen.</p>
                  <p>⚠️ erscheint wenn &gt;60% der Sessions einer Klasse von derselben Lehrkraft stammen.</p>
                </div>
              )}

              <div className="pt-2 border-t border-[var(--border)]">
                <button onClick={commit} disabled={committing} className="btn-primary">
                  {committing ? "Vergebe Punkte…" : "✅ Punkte vergeben & abschließen"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Committed result */}
      {committed && (
        <div className="p-4 bg-green-900/20 border border-green-800 rounded-xl">
          <p className="font-bold text-green-300 mb-3">🏆 Gruppenauswertung abgeschlossen — Hauspunkte vergeben!</p>
          <div className="space-y-1">
            {committed.map((e, i) => (
              <div key={e.class_id} className="flex justify-between text-sm">
                <span className="text-gray-200">{i + 1}. {e.class_name}</span>
                <span className="text-yellow-400 font-bold">+{e.points_awarded} Pkte</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
