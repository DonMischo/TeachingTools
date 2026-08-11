"use client";
import { useRef, useState, useEffect } from "react";
import { WettkampfOut, ParticipantStats } from "@/lib/api";

const MEDAL = ["🥇", "🥈", "🥉"];
const TYPE_LABEL: Record<string, string> = {
  knockout: "K.O.-System",
  round_robin: "Jeder gegen Jeden",
  pairing: "Paarungsturnier",
};
const RANKING_LABEL: Record<string, string> = {
  overall: "Gesamtranking",
  per_group: "Pro Gruppe",
  both: "Gruppe + Gesamt",
};

interface AwardedEntry {
  participant: { name: string };
  stage: { name: string } | null;
  points: number;
}

interface ClassAwardedEntry {
  name: string;
  rank: number;
  stats: { w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number };
  points: number;
}

interface Props {
  w: WettkampfOut;
  awarded: AwardedEntry[];
  classAwarded?: ClassAwardedEntry[];
  onClose: () => void;
}

function StatCell({ val, color }: { val: number | string; color?: string }) {
  return <td className={`px-3 py-2 text-center text-sm tabular-nums ${color ?? "text-gray-300"}`}>{val}</td>;
}

export default function AuswertungView({ w, awarded, classAwarded, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  function exportPDF() {
    const style = document.createElement("style");
    style.id = "__auswertung_print";
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #__auswertung_root, #__auswertung_root * { visibility: visible !important; }
        #__auswertung_root { position: fixed !important; top: 0; left: 0; width: 100%; height: auto; overflow: visible; background: white !important; color: black !important; }
        #__auswertung_root .no-print { display: none !important; }
        #__auswertung_root .print-page { background: white; color: black; font-family: system-ui, sans-serif; padding: 32px; }
        #__auswertung_root table { border-collapse: collapse; width: 100%; }
        #__auswertung_root th, #__auswertung_root td { border: 1px solid #ccc; padding: 6px 10px; }
        #__auswertung_root th { background: #f0f0f0; }
        #__auswertung_root .section-title { font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #555; margin: 20px 0 8px; }
        #__auswertung_root .header { margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 12px; }
        #__auswertung_root .header h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; }
        #__auswertung_root .header .meta { font-size: 12px; color: #555; }
        #__auswertung_root .podium { display: flex; gap: 16px; margin-bottom: 24px; }
        #__auswertung_root .podium-card { flex: 1; border: 2px solid #ccc; border-radius: 8px; padding: 12px; text-align: center; }
        #__auswertung_root .points-badge { font-size: 18px; font-weight: 800; color: #b8860b; }
      }
    `;
    document.head.appendChild(style);
    const el = printRef.current!;
    el.id = "__auswertung_root";
    window.print();
    setTimeout(() => {
      style.remove();
      el.removeAttribute("id");
    }, 500);
  }

  // Sort awarded by points desc
  const sortedAwarded = [...awarded].sort((a, b) => b.points - a.points);
  const top3 = sortedAwarded.slice(0, 3);

  // Map participant name → has class (for Hauspunkte warning)
  const hasClassMap = Object.fromEntries(w.participants.map(p => [p.name, p.class_id != null]));
  const anyNoClass = awarded.some(r => !hasClassMap[r.participant.name]);

  // Stats table for RR/pairing
  const hasStats = w.type !== "knockout" && w.stats && Object.keys(w.stats).length > 0;
  const stats = (w.stats ?? {}) as Record<string, ParticipantStats>;
  const hasGroups = w.participants.some(p => p.group);
  const hasDraw = Object.values(stats).some(s => s.d > 0);

  const sortedParticipants = [...w.participants].sort((a, b) => {
    const sa = stats[a.id] ?? { pts: 0, gd: 0, gf: 0 };
    const sb = stats[b.id] ?? { pts: 0, gd: 0, gf: 0 };
    return sb.pts - sa.pts || sb.gd - sa.gd || sb.gf - sa.gf || a.name.localeCompare(b.name);
  });

  const hasMergedRanking = hasStats && classAwarded && classAwarded.length > 0;

  const [date, setDate] = useState("");
  useEffect(() => {
    setDate(new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }));
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-auto py-8 px-4">
      {/* Screen UI wrapper */}
      <div className="w-full max-w-3xl">
        {/* Toolbar — hidden on print */}
        <div className="no-print flex items-center justify-between mb-4">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white">← Zurück</button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            📄 Als PDF exportieren
          </button>
        </div>

        {/* Printable content */}
        <div ref={printRef} className="print-page bg-white text-gray-900 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="header bg-gray-900 text-white px-8 py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Wettkampf · Auswertung</p>
                <h1 className="text-3xl font-extrabold">{w.title}</h1>
                {w.description && <p className="text-gray-400 text-sm mt-1">{w.description}</p>}
              </div>
              <div className="text-right text-sm text-gray-400 shrink-0 ml-6">
                <div>{date}</div>
                <div className="mt-1">{TYPE_LABEL[w.type] ?? w.type}</div>
                <div>{RANKING_LABEL[w.ranking_mode] ?? w.ranking_mode}</div>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-8 bg-white text-gray-900">
            {/* Podium */}
            {top3.length >= 1 && (
              <section>
                <p className="section-title text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Podium</p>
                <div className="grid grid-cols-3 gap-4">
                  {top3.map((r, i) => (
                    <div key={i} className={`rounded-xl border-2 p-4 text-center ${
                      i === 0 ? "border-yellow-400 bg-yellow-50" :
                      i === 1 ? "border-gray-400 bg-gray-50" :
                      "border-amber-600 bg-amber-50"
                    }`}>
                      <div className="text-3xl mb-1">{MEDAL[i]}</div>
                      <div className="font-bold text-sm">{r.participant.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{r.stage?.name ?? "Teilnahme"}</div>
                      <div className={`points-badge mt-2 text-xl font-extrabold ${
                        i === 0 ? "text-yellow-600" : i === 1 ? "text-gray-500" : "text-amber-700"
                      }`}>{r.points} <span className="text-sm font-normal">Pkte</span></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Merged class ranking — shown before individual table */}
            {hasMergedRanking && (
              <section>
                <p className="section-title text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                  Klassenranking (♂ + ♀ zusammengefasst)
                </p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 text-xs">
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">Klasse</th>
                        <th className="px-3 py-2 text-center">Sp</th>
                        <th className="px-3 py-2 text-center">S</th>
                        {hasDraw && <th className="px-3 py-2 text-center">U</th>}
                        <th className="px-3 py-2 text-center">N</th>
                        <th className="px-3 py-2 text-center">+</th>
                        <th className="px-3 py-2 text-center">−</th>
                        <th className="px-3 py-2 text-center">Diff</th>
                        <th className="px-3 py-2 text-center font-bold">Pkt</th>
                        <th className="px-3 py-2 text-center">Hausp.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(classAwarded ?? []).map((cls, i) => {
                        const s = cls.stats;
                        const gd = s.gf - s.ga;
                        return (
                          <tr key={cls.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-3 py-2 text-gray-400 text-xs">{MEDAL[i] ?? i + 1}</td>
                            <td className="px-3 py-2 font-semibold text-gray-900">{cls.name}</td>
                            <StatCell val={s.w + s.d + s.l} color="text-gray-500" />
                            <StatCell val={s.w} color="text-green-700" />
                            {hasDraw && <StatCell val={s.d} color="text-yellow-700" />}
                            <StatCell val={s.l} color="text-red-700" />
                            <StatCell val={s.gf} />
                            <StatCell val={s.ga} color="text-gray-500" />
                            <StatCell val={(gd > 0 ? "+" : "") + gd} color={gd > 0 ? "text-green-700" : gd < 0 ? "text-red-700" : "text-gray-400"} />
                            <StatCell val={s.pts} color="font-bold text-gray-900" />
                            <td className="px-3 py-2 text-center text-sm tabular-nums font-bold text-indigo-700">{cls.points} Pkt</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Full individual standings table */}
            {hasStats && (
              <section>
                <p className="section-title text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                  Gesamttabelle
                </p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 text-xs">
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">Name</th>
                        {hasGroups && <th className="text-left px-3 py-2">Gruppe</th>}
                        <th className="px-3 py-2 text-center">Sp</th>
                        <th className="px-3 py-2 text-center">S</th>
                        {hasDraw && <th className="px-3 py-2 text-center">U</th>}
                        <th className="px-3 py-2 text-center">N</th>
                        <th className="px-3 py-2 text-center">+</th>
                        <th className="px-3 py-2 text-center">−</th>
                        <th className="px-3 py-2 text-center">Diff</th>
                        <th className="px-3 py-2 text-center font-bold">Pkt</th>
                        <th className="px-3 py-2 text-center">Hausp.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedParticipants.map((p, i) => {
                        const s = stats[p.id] ?? { w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
                        const award = awarded.find(a => a.participant.name === p.name);
                        return (
                          <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-3 py-2 text-gray-400 text-xs">{MEDAL[i] ?? i + 1}</td>
                            <td className="px-3 py-2 font-semibold text-gray-900">{p.name}</td>
                            {hasGroups && <td className="px-3 py-2 text-xs text-gray-500">{p.group ?? "—"}</td>}
                            <StatCell val={s.w + s.d + s.l} color="text-gray-500" />
                            <StatCell val={s.w} color="text-green-700" />
                            {hasDraw && <StatCell val={s.d} color="text-yellow-700" />}
                            <StatCell val={s.l} color="text-red-700" />
                            <StatCell val={s.gf} />
                            <StatCell val={s.ga} color="text-gray-500" />
                            <StatCell val={(s.gd > 0 ? "+" : "") + s.gd} color={s.gd > 0 ? "text-green-700" : s.gd < 0 ? "text-red-700" : "text-gray-400"} />
                            <StatCell val={s.pts} color="font-bold text-gray-900" />
                            <td className="px-3 py-2 text-center text-sm tabular-nums">
                              <span className={award ? "text-indigo-700 font-bold" : "text-gray-400"}>
                                {award ? `${award.points} Pkt` : "—"}
                              </span>
                              {award && !hasClassMap[p.name] && <span className="ml-1 text-orange-500 text-xs" title="Kein Klassenlink">⚠</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* For KO or when no stats: just the awarded list */}
            {!hasStats && sortedAwarded.length > 0 && (
              <section>
                <p className="section-title text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Ergebnisse</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 text-xs">
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">Teilnehmer</th>
                        <th className="px-3 py-2">Stufe</th>
                        <th className="px-3 py-2 text-right">Hauspunkte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedAwarded.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-2 text-gray-400 text-xs">{MEDAL[i] ?? i + 1}</td>
                          <td className="px-3 py-2 font-semibold">{r.participant.name}</td>
                          <td className="px-3 py-2 text-gray-500 text-center">{r.stage?.name ?? "Teilnahme"}</td>
                          <td className="px-3 py-2 text-right font-bold text-indigo-700">
                            {r.points} Pkt
                            {!hasClassMap[r.participant.name] && <span className="ml-1 text-orange-500 text-xs" title="Kein Klassenlink">⚠</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* No-class warning */}
            {anyNoClass && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-800">
                <span className="font-semibold">⚠ Hinweis:</span> Teams mit ⚠ sind nicht mit einer Klasse verknüpft — ihre Punkte wurden <strong>nicht</strong> im Hauspokal gebucht.
              </div>
            )}

            {/* Scoring info */}
            <section className="border-t border-gray-200 pt-4 flex flex-wrap gap-6 text-xs text-gray-500">
              <span>Wertungssystem: <strong className="text-gray-800">{w.scoring_system}</strong> ({w.win_points}-{w.draw_points}-{w.loss_points})</span>
              <span>Max. Hauspunkte: <strong className="text-gray-800">{w.max_points}</strong></span>
              <span>Trostpreis: <strong className="text-gray-800">{w.trostpreis_points}</strong></span>
              <span>Ranglistenmodus: <strong className="text-gray-800">{RANKING_LABEL[w.ranking_mode]}</strong></span>
              <span>Teilnehmer: <strong className="text-gray-800">{w.participants.length}</strong></span>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
