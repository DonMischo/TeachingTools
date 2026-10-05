"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, RankingMode } from "@/lib/api";

const SCORING_PRESETS = [
  { key: "soccer",  label: "⚽ Fußball",    desc: "Sieg 3 · Unentschieden 1 · Niederlage 0", w: 3, d: 1, l: 0 },
  { key: "classic", label: "🏅 Klassisch",   desc: "Sieg 2 · Unentschieden 1 · Niederlage 0", w: 2, d: 1, l: 0 },
  { key: "tennis",  label: "🎾 Tennis",      desc: "Sieg 1 · Keine Unentschieden · Niederlage 0", w: 1, d: 0, l: 0 },
  { key: "custom",  label: "⚙️ Benutzerdefiniert", desc: "Eigene Wertung festlegen", w: 1, d: 0, l: 0 },
] as const;

const RANKING_MODES: { key: RankingMode; label: string; desc: string }[] = [
  { key: "overall",                label: "🏆 Gesamt",                   desc: "Ein Ranking für alle. Sieger bekommt max. Punkte." },
  { key: "gender",                  label: "⚥ Gesamt ♂/♀",               desc: "Separate Ranglisten für M und F — je 50% der Punkte." },
  { key: "overall+gender",          label: "🏆 + ⚥ Gesamt + ♂/♀",        desc: "Gesamtranking (100%) + Geschlechtsranking (50% je)." },
  { key: "per_group",               label: "👥 Pro Gruppe",               desc: "Gruppenranking. Punkte proportional zur Gruppengröße." },
  { key: "per_group+gender",        label: "👥 + ⚥ Gruppe + ♂/♀",        desc: "Gruppenranking + Geschlecht innerhalb der Gruppe." },
  { key: "per_group_merged",        label: "🏫 Pro Klassenstufe",         desc: "'7a', '7b' → Stufe '7'. Punkte proportional zur Stufengröße." },
  { key: "per_group_merged+gender", label: "🏫 + ⚥ Stufe + ♂/♀",        desc: "Klassenstufen-Ranking + Geschlecht innerhalb der Stufe." },
  { key: "both",                    label: "🎯 Gruppe + Gesamt (Legacy)", desc: "Klassisches Modus: Gruppenranking + Gesamtranking." },
];

// Points formula preview
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

export default function NewWettkampfPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"knockout" | "round_robin" | "pairing">("knockout");
  const [maxPoints, setMaxPoints] = useState(100);
  const [trostpreis, setTrostpreis] = useState(5);
  const [rewardedPlaces, setRewardedPlaces] = useState(3);
  const [scoringKey, setScoringKey] = useState("soccer");
  const [customW, setCustomW] = useState(3);
  const [customD, setCustomD] = useState(1);
  const [customL, setCustomL] = useState(0);
  const [rankingMode, setRankingMode] = useState<RankingMode>("overall");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preset = SCORING_PRESETS.find(p => p.key === scoringKey) ?? SCORING_PRESETS[0];

  async function handleCreate() {
    if (!title.trim()) { setError("Titel erforderlich"); return; }
    if (trostpreis >= maxPoints) { setError("Trostpreis muss kleiner als Max-Punkte sein"); return; }
    setSaving(true);
    setError(null);
    try {
      const scoring = scoringKey === "custom"
        ? { scoring_system: "custom", win_points: customW, draw_points: customD, loss_points: customL }
        : { scoring_system: scoringKey };
      const w = await api.wettkampf.create({
        title: title.trim(), description: description || undefined,
        type, max_points: maxPoints, trostpreis_points: trostpreis,
        rewarded_places: rewardedPlaces,
        ranking_mode: rankingMode,
        ...scoring,
      });
      router.push(`/tools/wettkampf/${w.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto w-full">
      <button onClick={() => router.back()} className="text-sm text-muted hover:text-fg mb-4">← Zurück</button>
      <h1 className="text-2xl font-bold mb-6">Neuer Wettkampf</h1>

      <div className="space-y-5">
        <div>
          <label className="label">Titel</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Klassenturnier Mathe" />
        </div>

        <div>
          <label className="label">Beschreibung (optional)</label>
          <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Kurze Beschreibung…" />
        </div>

        <div>
          <label className="label">Wettkampftyp</label>
          <div className="flex flex-col gap-2 mt-1">
            {([
              ["knockout", "🏆 K.O.-System", "Direktes Ausscheidungsturnier. Wer verliert, scheidet aus."],
              ["round_robin", "🔄 Jeder gegen Jeden", "Jeder spielt gegen jeden anderen. Ranking nach Siegen."],
              ["pairing", "🤝 Paarungsturnier", "Freie Paarungen über mehrere Runden. Du bestimmst, wer gegen wen spielt."],
            ] as const).map(([t, label, desc]) => (
              <button key={t} onClick={() => setType(t)}
                className={`w-full py-3 px-4 rounded-xl border text-left transition-colors ${
                  type === t ? "border-accent bg-accent/10" : "border-line text-muted hover:border-muted"
                }`}>
                <span className={`text-sm font-semibold block ${type === t ? "text-accent" : ""}`}>{label}</span>
                <span className="text-xs text-muted">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Wertungssystem</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {SCORING_PRESETS.map(p => (
              <button key={p.key} onClick={() => setScoringKey(p.key)}
                className={`py-2 px-3 rounded-xl border text-left transition-colors ${
                  scoringKey === p.key ? "border-accent bg-accent/10" : "border-line text-muted hover:border-muted"
                }`}>
                <span className={`text-sm font-semibold block ${scoringKey === p.key ? "text-accent" : ""}`}>{p.label}</span>
                <span className="text-xs text-muted">{p.desc}</span>
              </button>
            ))}
          </div>
          {scoringKey === "custom" && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              {[["Sieg", customW, setCustomW], ["Unentschieden", customD, setCustomD], ["Niederlage", customL, setCustomL]].map(([label, val, setter]) => (
                <div key={String(label)}>
                  <label className="text-xs text-muted block mb-1">{String(label)}</label>
                  <input type="number" min={0} className="input text-center"
                    value={val as number}
                    onChange={e => (setter as (v: number) => void)(Number(e.target.value))} />
                </div>
              ))}
            </div>
          )}
          {scoringKey !== "custom" && (
            <p className="text-xs text-muted mt-2">
              Sieg <span className="text-fg font-bold">{preset.w}</span> · Unentschieden <span className="text-fg font-bold">{preset.d}</span> · Niederlage <span className="text-fg font-bold">{preset.l}</span>
            </p>
          )}
        </div>

        {/* Points & Ranking */}
        <div className="border border-line rounded-2xl p-4 space-y-4">
          <p className="text-sm font-bold">🏅 Punkte & Ranking</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label text-xs">Max. Hauspunkte</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {[50, 100, 200, 500].map(v => (
                  <button key={v} onClick={() => setMaxPoints(v)}
                    className={`chip px-2 rounded-lg ${maxPoints === v ? "chip-on" : ""}`}
                  >{v}</button>
                ))}
                <input type="number" min={2} className="input w-20 text-sm" value={maxPoints} onChange={e => setMaxPoints(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="label text-xs">Trostpunkte</label>
              <input type="number" min={0} className="input mt-1 text-sm" value={trostpreis} onChange={e => setTrostpreis(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="label text-xs">Belohnte Plätze</label>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 8, 10].map(v => (
                <button key={v} onClick={() => setRewardedPlaces(v)}
                  className={`chip w-9 h-9 text-sm font-semibold rounded-xl ${rewardedPlaces === v ? "chip-on" : ""}`}
                >{v}</button>
              ))}
            </div>
            {/* Formula preview */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {computePlacementPoints(rewardedPlaces, maxPoints, trostpreis).map((p, i) => (
                <div key={i} className={`text-center rounded-lg px-2 py-1 border text-xs ${i === 0 ? "border-yellow-500/40 bg-yellow-500/10" : i === 1 ? "border-gray-400/40" : i === 2 ? "border-amber-600/40" : "border-line"}`}>
                  <div>{["🥇","🥈","🥉"][i] ?? `#${i+1}`}</div>
                  <div className="font-bold">{p}</div>
                </div>
              ))}
              <div className="text-center rounded-lg px-2 py-1 border border-line text-xs opacity-50">
                <div>…</div>
                <div className="font-bold">{trostpreis}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="label text-xs">Ranglistenmodus</label>
            <div className="flex flex-col gap-1.5 mt-1">
              {RANKING_MODES.map(m => (
                <button key={m.key} onClick={() => setRankingMode(m.key)}
                  className={`w-full py-2 px-3 rounded-xl border text-left transition-colors ${rankingMode === m.key ? "border-accent bg-accent/10" : "border-line text-muted hover:border-muted"}`}>
                  <span className={`text-sm font-semibold block ${rankingMode === m.key ? "text-accent" : ""}`}>{m.label}</span>
                  <span className="text-xs text-muted">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button onClick={handleCreate} disabled={saving} className="btn-primary w-full">
          {saving ? "Erstelle…" : "Wettkampf erstellen →"}
        </button>
      </div>
    </div>
  );
}
