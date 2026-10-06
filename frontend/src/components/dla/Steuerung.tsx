"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Saat } from "@/lib/dla/kern";
import Dimensionsbild from "./Dimensionsbild";
import type { Einstellung, Stand } from "./useWachstum";

export const ANZAHLEN = {
  2: [5_000, 20_000, 50_000, 100_000, 250_000],
  3: [10_000, 50_000, 100_000, 250_000, 500_000],
};

const SAATEN: { id: Saat; label: string; text: string }[] = [
  { id: "punkt", label: "Punkt", text: "ein Keim in der Mitte" },
  { id: "linie", label: "Linie", text: "ein Draht, z. B. Raureif" },
  { id: "kreis", label: "Kreis", text: "ein Ring, von außen beschossen" },
];

const zahl = (n: number) => n.toLocaleString("de-DE");

export default function Steuerung({ dim, e, setE, neu, laeuft, setLaeuft, stand, extra }: {
  dim: 2 | 3;
  e: Einstellung;
  setE: (e: Einstellung) => void;
  neu: () => void;
  laeuft: boolean;
  setLaeuft: (b: boolean) => void;
  stand: Stand;
  extra?: ReactNode;
}) {
  // Der Regler wirkt erst beim Loslassen — sonst startet jede Zwischenstellung neu
  const [haftung, setHaftung] = useState(e.haftung);
  useEffect(() => setHaftung(e.haftung), [e.haftung]);
  const uebernehmen = () => { if (haftung !== e.haftung) setE({ ...e, haftung }); };
  const anteil = stand.anzahl / e.anzahl;

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-3 flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {!stand.fertig && (
            <button className="btn btn-primary" onClick={() => setLaeuft(!laeuft)}>{laeuft ? "⏸ Anhalten" : "▶ Weiter"}</button>
          )}
          <button className="btn btn-secondary" onClick={neu}>🎲 Neu wachsen</button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="label">Teilchen</span>
          <select className="input" value={e.anzahl} onChange={x => setE({ ...e, anzahl: +x.target.value })}>
            {ANZAHLEN[dim].map(n => <option key={n} value={n}>{zahl(n)}{dim === 3 && n >= 250_000 ? " (dauert)" : ""}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Haftwahrscheinlichkeit: {Math.round(haftung * 100)} %</span>
          <input type="range" min={0.02} max={1} step={0.01} value={haftung}
            onChange={x => setHaftung(+x.target.value)} onPointerUp={uebernehmen} onKeyUp={uebernehmen} onBlur={uebernehmen} />
          <span className="text-xs text-muted">100 % = klebt sofort (dünne Äste), wenig = prallt oft ab und dringt tiefer ein (dichter).</span>
        </label>
        <div className="flex flex-col gap-1">
          <span className="label">Keim</span>
          <div className="flex flex-wrap gap-1">
            {SAATEN.map(s => (
              <button key={s.id} title={s.text} onClick={() => setE({ ...e, saat: s.id })} className={`chip ${e.saat === s.id ? "chip-on" : ""}`}>{s.label}</button>
            ))}
          </div>
        </div>
        {extra}
      </div>

      <div className="card p-3 flex flex-col gap-1 text-sm">
        <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
          <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(anteil * 100)}%` }} />
        </div>
        <div className="flex justify-between tabular-nums">
          <span><b>{zahl(stand.anzahl)}</b> / {zahl(e.anzahl)} Teilchen</span>
          <span className="text-muted">Rechenzeit {stand.sekunden.toFixed(1).replace(".", ",")} s</span>
        </div>
        <span className="text-xs text-muted tabular-nums">Radius {zahl(Math.round(stand.rmax))} Teilchenabstände{stand.fertig ? " · fertig" : ""}</span>
      </div>

      <div className="card p-3">
        <h3 className="font-bold text-sm mb-2">📏 Fraktale Dimension</h3>
        <Dimensionsbild d={stand.dim} raum={dim === 3} />
      </div>
    </div>
  );
}
