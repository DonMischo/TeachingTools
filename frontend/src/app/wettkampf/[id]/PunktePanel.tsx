"use client";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, WettkampfOut, RankingMode } from "@/lib/api";

const RANKING_MODES: { key: RankingMode; label: string; desc: string; needsGender?: boolean; needsGroup?: boolean }[] = [
  { key: "overall",                label: "🏆 Gesamt",                   desc: "Ein Ranking für alle. Sieger bekommt max. Punkte." },
  { key: "gender",                  label: "⚥ Gesamt ♂/♀",               desc: "Separate Ranglisten für Männer und Frauen — jede Gruppe vergibt 50% der Punkte.", needsGender: true },
  { key: "overall+gender",          label: "🏆 + ⚥ Gesamt + ♂/♀",        desc: "Gesamtranking (100%) UND Geschlechtsranking (je 50%).", needsGender: true },
  { key: "per_group",               label: "👥 Pro Gruppe",               desc: "Jede Gruppe hat ihr eigenes Ranking. Punkte proportional zur Gruppengröße.", needsGroup: true },
  { key: "per_group+gender",        label: "👥 + ⚥ Gruppe + ♂/♀",        desc: "Pro Gruppe + Geschlechtsranking innerhalb der Gruppe.", needsGroup: true, needsGender: true },
  { key: "per_group_merged",        label: "🏫 Pro Klassenstufe",         desc: "Gruppen wie '7a', '7b' werden zu '7' zusammengeführt. Punkte proportional zur Stufengröße.", needsGroup: true },
  { key: "per_group_merged+gender", label: "🏫 + ⚥ Stufe + ♂/♀",        desc: "Pro Klassenstufe + Geschlechtsranking.", needsGroup: true, needsGender: true },
  { key: "both",                    label: "🎯 Gruppe + Gesamt (Legacy)", desc: "Klassisches Modus: Gruppenranking + Gesamtranking (Summe).", needsGroup: true },
];

// Formula preview
function computePlacementPoints(n: number, max: number, trost: number): number[] {
  const result: number[] = [];
  for (let i = 1; i <= n; i++) {
    let p: number;
    if (i === 1) p = max;
    else if (i === 2) p = Math.max(trost + 1, Math.round(max * 0.6));
    else p = Math.max(trost + 1, Math.round(max * 0.2 * Math.pow(0.5, i - 3)));
    result.push(p);
  }
  return result;
}

function PlacementPreview({ n, max, trost }: { n: number; max: number; trost: number }) {
  const pts = computePlacementPoints(n, max, trost);
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {pts.map((p, i) => (
        <div key={i} className={`flex flex-col items-center rounded-xl px-3 py-2 border ${
          i === 0 ? "border-yellow-500/40 bg-yellow-500/10" :
          i === 1 ? "border-gray-400/40 bg-gray-400/10" :
          i === 2 ? "border-amber-600/40 bg-amber-600/10" :
          "border-[var(--border)] bg-[var(--bg)]"
        }`}>
          <span className="text-base">{medals[i] ?? `#${i + 1}`}</span>
          <span className="text-xs font-bold mt-0.5">{p} Pkt</span>
        </div>
      ))}
      <div className="flex flex-col items-center rounded-xl px-3 py-2 border border-[var(--border)] bg-[var(--bg)] opacity-60">
        <span className="text-base">…</span>
        <span className="text-xs font-bold mt-0.5">{trost} Pkt</span>
        <span className="text-[10px] text-[var(--text-muted)]">Rest</span>
      </div>
    </div>
  );
}

interface Props {
  w: WettkampfOut;
  canEdit: boolean;
}

export default function PunktePanel({ w, canEdit }: Props) {
  const qc = useQueryClient();
  const [maxPts, setMaxPts] = useState(w.max_points);
  const [trost, setTrost] = useState(w.trostpreis_points);
  const [places, setPlaces] = useState<number>(w.rewarded_places ?? 3);
  const [rankMode, setRankMode] = useState<RankingMode>(w.ranking_mode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Sync if parent changes
  useEffect(() => {
    setMaxPts(w.max_points);
    setTrost(w.trostpreis_points);
    setPlaces(w.rewarded_places ?? 3);
    setRankMode(w.ranking_mode);
  }, [w.id]);

  async function save() {
    if (trost >= maxPts) { setError("Trostpreis muss kleiner als Max-Punkte sein"); return; }
    setSaving(true);
    setError(null);
    try {
      await api.wettkampf.update(w.id, {
        max_points: maxPts,
        trostpreis_points: trost,
        rewarded_places: places,
        ranking_mode: rankMode,
      });
      qc.invalidateQueries({ queryKey: ["wettkampf", w.id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  const selectedMode = RANKING_MODES.find(m => m.key === rankMode);
  const hasGenderData = w.participants.some(p => p.gender);
  const hasGroupData = w.participants.some(p => p.group);

  return (
    <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <span className="font-bold text-sm">🏅 Punkte & Ranking</span>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Points row */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-32">
            <label className="label text-xs">Max. Hauspunkte</label>
            <div className="flex items-center gap-1 mt-1">
              {[50, 100, 200, 500].map(v => (
                <button key={v} onClick={() => canEdit && setMaxPts(v)}
                  className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
                    maxPts === v
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-gray-500"
                  }`}
                >
                  {v}
                </button>
              ))}
              <input
                type="number"
                className="input w-20 text-sm"
                value={maxPts}
                min={2}
                onChange={e => canEdit && setMaxPts(Number(e.target.value))}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="min-w-28">
            <label className="label text-xs">Trostpunkte</label>
            <input
              type="number"
              className="input w-24 mt-1 text-sm"
              value={trost}
              min={0}
              onChange={e => canEdit && setTrost(Number(e.target.value))}
              disabled={!canEdit}
            />
          </div>
        </div>

        {/* Belohnte Plätze */}
        <div>
          <label className="label text-xs">Belohnte Plätze</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {[1, 2, 3, 4, 5, 6, 8, 10].map(v => (
              <button key={v} onClick={() => canEdit && setPlaces(v)}
                className={`w-9 h-9 text-sm font-semibold rounded-xl border transition-colors ${
                  places === v
                    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-gray-500"
                }`}
              >
                {v}
              </button>
            ))}
            <input
              type="number"
              className="input w-16 text-sm"
              value={places}
              min={1}
              max={30}
              onChange={e => canEdit && setPlaces(Math.max(1, Number(e.target.value)))}
              disabled={!canEdit}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5">
            Alle übrigen Teilnehmer erhalten {trost} Trostpunkte.
          </p>

          {/* Formula preview */}
          <PlacementPreview n={places} max={maxPts} trost={trost} />
        </div>

        {/* Ranking mode */}
        <div>
          <label className="label text-xs">Ranglistenmodus</label>
          <div className="flex flex-col gap-1.5 mt-1">
            {RANKING_MODES.map(m => {
              const warn = (m.needsGender && !hasGenderData) || (m.needsGroup && !hasGroupData);
              return (
                <button key={m.key} onClick={() => canEdit && setRankMode(m.key)}
                  disabled={!canEdit}
                  className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${
                    rankMode === m.key
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-sm font-semibold ${rankMode === m.key ? "text-[var(--accent)]" : ""}`}>
                      {m.label}
                    </span>
                    {warn && (
                      <span className="text-[10px] text-amber-400 border border-amber-400/40 rounded px-1 py-0.5 shrink-0 mt-0.5">
                        {m.needsGender && !hasGenderData ? "kein Geschlecht" : "keine Gruppen"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Normalization info for multi-context modes */}
        {selectedMode && (selectedMode.needsGender || selectedMode.needsGroup) && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl px-3 py-2.5 text-xs text-blue-300">
            <strong>Gewichtung:</strong>{" "}
            {rankMode.includes("overall") && "Gesamt-Rangliste = 100% · "}
            {rankMode.includes("gender") && "Geschlecht-Rangliste = je 50% · "}
            {(rankMode.includes("per_group") || rankMode.includes("per_group_merged")) &&
              "Gruppen = proportional zur Gruppengröße (z.B. 5 von 20 = 25%) · "}
            Summe aller Listen ergibt die Gesamtpunkte.
          </div>
        )}

        {/* Actions */}
        {canEdit && (
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-[var(--accent)] text-white rounded-xl disabled:opacity-40 hover:opacity-90"
            >
              {saving ? "Speichere…" : "Punkte-Einstellungen speichern"}
            </button>
            {saved && <span className="text-green-400 text-sm">✓ Gespeichert</span>}
            {error && <span className="text-red-400 text-sm">{error}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
