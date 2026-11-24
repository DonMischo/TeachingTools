"use client";
/**
 * Brüche in sechs Blättern:
 *   🍕 Verstehen        Pizza, Torte, Blechkuchen, Schokolade, Band; vergleichen
 *   ✂️ Erweitern        Erweitern, Kürzen, gleichnamig machen — am Bild
 *   🧮 Rechnen          + − · : mit Rechenweg und Bild, Regeln, Üben
 *   ⚖️ Bruchteile       Bruchteile von Größen, vorwärts und rückwärts
 *   🔢 Dezimalzahlen    über Zehntel/Hundertstel/Tausendstel und die Stellenwerttafel
 *   ⭐ Wichtige Brüche  Tabelle und Bruch-Memory
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import Verstehen from "./Verstehen";
import Erweitern from "./Erweitern";
import Rechnen from "./Rechnen";
import Groessen from "./Groessen";
import Dezimal from "./Dezimal";
import Wichtige from "./Wichtige";

const BLAETTER = [
  { id: "verstehen", icon: "🍕", label: "Verstehen" },
  { id: "erweitern", icon: "✂️", label: "Erweitern & Kürzen" },
  { id: "rechnen", icon: "🧮", label: "Rechnen" },
  { id: "groessen", icon: "⚖️", label: "Bruchteile" },
  { id: "dezimal", icon: "🔢", label: "Dezimalzahlen" },
  { id: "wichtige", icon: "⭐", label: "Wichtige Brüche" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

const INHALT: Record<Blatt, () => ReactNode> = {
  verstehen: () => <Verstehen />,
  erweitern: () => <Erweitern />,
  rechnen: () => <Rechnen />,
  groessen: () => <Groessen />,
  dezimal: () => <Dezimal />,
  wichtige: () => <Wichtige />,
};

export default function Brueche({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "verstehen");
  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🍕 Brüche</h1>
          <p className="text-muted text-sm mt-1">
            Brüche sehen und verstehen, erweitern und kürzen, rechnen mit Rechenweg, Bruchteile von Größen
            und Umwandeln in Dezimalzahlen über die Stellenwerttafel.
          </p>
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
