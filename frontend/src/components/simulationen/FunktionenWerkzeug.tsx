"use client";
/**
 * Funktionen und Koordinatensystem — ein Werkzeug, zwei Reiter:
 *   Graphen          — Term, Wertetabelle und Graph (Funktionen.tsx)
 *   Koordinaten-Lauf — Punkte setzen im Jump'n'Run (koordinaten/KoordinatenLauf.tsx)
 *
 * TaskCrawler-Stationen benutzen weiter Funktionen.tsx direkt.
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import Funktionen from "./Funktionen";
import KoordinatenLauf from "@/components/koordinaten/KoordinatenLauf";

type Reiter = "graphen" | "lauf";
const REITER: { id: Reiter; label: string }[] = [
  { id: "graphen", label: "📈 Graphen" },
  { id: "lauf", label: "🏃 Koordinaten-Lauf" },
];

const chip = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

export default function FunktionenWerkzeug({ action, vorgabe, speicherSchluessel }: {
  action?: ReactNode; vorgabe?: Vorgabe; speicherSchluessel?: string;
}) {
  const fest = wahl(vorgabe, "reiter", REITER.map(r => r.id));
  const [reiter, setReiter] = useState<Reiter>(fest ?? "graphen");

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col gap-4 px-6 pt-6 max-w-seite mx-auto w-full">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-black tracking-tight">📈 Funktionen und Koordinatensystem</h1>
          <div className="flex items-center gap-2">{action}</div>
        </div>
        {!fest && (
          <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface" role="tablist">
            {REITER.map(r => (
              <button key={r.id} type="button" role="tab" aria-selected={reiter === r.id}
                onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.label}</button>
            ))}
          </div>
        )}
      </div>
      {reiter === "graphen"
        ? <Funktionen kopf={false} vorgabe={vorgabe} />
        : <div className="p-6 max-w-seite mx-auto w-full"><KoordinatenLauf speicherSchluessel={speicherSchluessel} /></div>}
    </div>
  );
}
