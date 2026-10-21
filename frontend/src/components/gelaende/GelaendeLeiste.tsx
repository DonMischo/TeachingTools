"use client";
/**
 * Geländewahl für Stadtentwicklung und Erosion: Landschaft, Zufall,
 * Fluss an/aus, Relief — optional ein Knopf »Erosion«.
 */
import { LANDSCHAFTEN, wuerfle, type GelaendeWahl, type Landschaft } from "@/lib/gelaende/gelaende";

export default function GelaendeLeiste({ wahl, setWahl, erosion, erosionLaeuft, gesperrt }: {
  wahl: GelaendeWahl;
  setWahl: (w: GelaendeWahl) => void;
  /** Knopf »🌧️ Erosion« zeigen */
  erosion?: () => void;
  /** Fortschritt 0..1 der laufenden Erosion */
  erosionLaeuft?: number | null;
  gesperrt?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select className="input w-auto py-1.5" value={wahl.art} disabled={gesperrt}
        onChange={e => setWahl({ ...wahl, art: e.target.value as Landschaft })} aria-label="Landschaft">
        {LANDSCHAFTEN.map(l => <option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}
      </select>
      <button className="btn-secondary py-1.5" disabled={gesperrt} onClick={() => setWahl(wuerfle())} title="Neue Landschaft auswürfeln">🎲 Zufall</button>
      <button className="btn-secondary py-1.5" disabled={gesperrt} onClick={() => setWahl({ ...wahl, seed: Math.floor(Math.random() * 1e9) })} title="Gleiche Landschaftsart, neue Form">🔁 Neu formen</button>
      <label className="flex items-center gap-1.5 text-muted">
        <input type="checkbox" checked={wahl.fluss} disabled={gesperrt} onChange={e => setWahl({ ...wahl, fluss: e.target.checked })} /> Fluss
      </label>
      <label className="flex items-center gap-1.5 text-muted" title="Wie hügelig?">
        Relief
        <input type="range" min={0.2} max={2} step={0.1} value={wahl.relief} disabled={gesperrt}
          onChange={e => setWahl({ ...wahl, relief: Number(e.target.value) })} className="w-24" />
      </label>
      {erosion && (
        <button className="btn-secondary py-1.5" disabled={gesperrt || erosionLaeuft != null} onClick={erosion} title="Regen und Flüsse formen das Gelände über Jahrtausende">
          {erosionLaeuft != null ? `🌧️ ${Math.round(erosionLaeuft * 100)} %` : "🌧️ Erosion"}
        </button>
      )}
      <span className="text-xs text-muted">Seed {wahl.seed}</span>
    </div>
  );
}
