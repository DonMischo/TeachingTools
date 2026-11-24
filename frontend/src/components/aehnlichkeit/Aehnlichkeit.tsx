"use client";
/**
 * Ähnlichkeit und Maßstab in fünf Blättern:
 *   🔍 Streckung     zentrische Streckung mit ziehbarem Zentrum und Faktor k
 *   📐 Ähnlich       was ähnlich heißt, Ähnlichkeitssätze, Dreieck selbst bauen
 *   🗺️ Maßstab       umrechnen, je Maßstab ein Beispielbild zum Nachmessen
 *   ✍️ Üben          Streckfaktor, fehlende Seite, Fläche, Karte, Plan, Maßstab
 *   🎯 Zoom-Treffer  Spiel: Zentrum und k finden
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import Streckung from "./Streckung";
import Aehnlich from "./Aehnlich";
import Massstab from "./Massstab";
import Ueben from "./Ueben";
import ZoomTreffer from "./ZoomTreffer";

const BLAETTER = [
  { id: "streckung", icon: "🔍", label: "Zentrische Streckung" },
  { id: "aehnlich", icon: "📐", label: "Ähnliche Figuren" },
  { id: "massstab", icon: "🗺️", label: "Maßstab" },
  { id: "ueben", icon: "✍️", label: "Üben" },
  { id: "spiel", icon: "🎯", label: "Zoom-Treffer" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

const INHALT: Record<Blatt, () => ReactNode> = {
  streckung: () => <Streckung />,
  aehnlich: () => <Aehnlich />,
  massstab: () => <Massstab />,
  ueben: () => <Ueben />,
  spiel: () => <div className="card p-4"><ZoomTreffer /></div>,
};

export default function Aehnlichkeit({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "streckung");
  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🔍 Ähnlichkeit und Maßstab</h1>
          <p className="text-muted text-sm mt-1">Zentrische Streckung zum Ziehen, ähnliche Dreiecke, Maßstab auf Karten und Plänen — mit Übungen und dem Spiel Zoom-Treffer.</p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {!festerReiter && <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
        {BLAETTER.map(b => (
          <button key={b.id} onClick={() => setBlatt(b.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>}
      {INHALT[blatt]()}
    </div>
  );
}
