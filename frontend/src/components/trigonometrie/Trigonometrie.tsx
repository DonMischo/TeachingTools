"use client";
/**
 * Trigonometrie — sechs Blätter:
 *   ⭕ Einheitskreis   sin, cos, tan, cot, sec, csc am Kreis und als Graph
 *   〰️ Sinusfunktion   a · sin(b(x − c)) + d, dazu »Welle treffen«
 *   📐 Rechtwinklig    Gegenkathete, Ankathete, Hypotenuse
 *   🔺 Dreiecke        Aufgaben nach Fall mit Tipps, eigener Rechner
 *   🧭 Anwendungen     Sachaufgaben mit Bild
 *   🚨 Küstenwache     Spiel: anpeilen, rechnen, retten
 */
import { useState, type ReactNode } from "react";
import Einheitskreis from "./Einheitskreis";
import Sinusfunktion from "./Sinusfunktion";
import Rechtwinklig from "./Rechtwinklig";
import Dreiecke from "./Dreiecke";
import Anwendungen from "./Anwendungen";
import Kuestenwache from "./Kuestenwache";

const BLAETTER = [
  { id: "kreis", icon: "⭕", label: "Einheitskreis" },
  { id: "welle", icon: "〰️", label: "Sinusfunktion" },
  { id: "recht", icon: "📐", label: "Rechtwinklig" },
  { id: "dreieck", icon: "🔺", label: "Dreiecke" },
  { id: "anwendung", icon: "🧭", label: "Anwendungen" },
  { id: "spiel", icon: "🚨", label: "Küstenwache" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

const INHALT: Record<Blatt, () => ReactNode> = {
  kreis: () => <Einheitskreis />,
  welle: () => <Sinusfunktion />,
  recht: () => <Rechtwinklig />,
  dreieck: () => <Dreiecke />,
  anwendung: () => <Anwendungen />,
  spiel: () => <Kuestenwache />,
};

export default function Trigonometrie({ action }: { action?: ReactNode }) {
  const [blatt, setBlatt] = useState<Blatt>("kreis");
  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🔺 Trigonometrie</h1>
          <p className="text-muted text-sm mt-1">
            sin, cos und tan am Einheitskreis und als Funktion, im rechtwinkligen und im allgemeinen Dreieck — mit Aufgaben,
            Tipps, Fällen mit zwei Lösungen, Sachaufgaben zum Triangulieren und Wegeplanen und dem Spiel Küstenwache.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
        {BLAETTER.map(b => (
          <button key={b.id} onClick={() => setBlatt(b.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
            }`}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>

      {INHALT[blatt]()}
    </div>
  );
}
