"use client";
/** Kurze Spielanleitung über einem Spiel: Ziel, Ablauf, Punkte — einklappbar. */
import { useState } from "react";

export default function SoGehts({ ziel, schritte, punkte }: { ziel: string; schritte: string[]; punkte: string }) {
  const [offen, setOffen] = useState(true);
  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-sm">
      <button className="flex w-full items-center justify-between font-black" onClick={() => setOffen(o => !o)} aria-expanded={offen}>
        <span>ℹ️ So geht's</span><span className="text-muted text-xs">{offen ? "zuklappen ▲" : "aufklappen ▼"}</span>
      </button>
      {offen && (
        <div className="mt-2 flex flex-col gap-1.5">
          <p><b>Ziel:</b> {ziel}</p>
          <ol className="list-decimal pl-5 flex flex-col gap-0.5">{schritte.map(s => <li key={s}>{s}</li>)}</ol>
          <p className="text-xs text-muted">🏅 {punkte}</p>
        </div>
      )}
    </div>
  );
}
