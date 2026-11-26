"use client";
/**
 * Größen & Einheiten — zwei Blätter:
 *   🔁 Umrechnen               Einheitenleitern wie auf dem Merkblatt, Umrechner, Alltagsbeispiele
 *   📐 Länge · Fläche · Volumen  warum aus · 10 erst · 100 und dann · 1 000 wird
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import Umrechnen from "./Umrechnen";
import Dimensionen from "./Dimensionen";
import { SimKopf } from "@/components/SimKopf";

const BLAETTER = [
  { id: "umrechnen", icon: "🔁", label: "Umrechnen" },
  { id: "dimensionen", icon: "📐", label: "Länge · Fläche · Volumen" },
] as const;

export default function Groessen({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  // Station mit festem Reiter: ohne Reiterleiste, wie es der TaskCrawler verspricht.
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<(typeof BLAETTER)[number]["id"]>(festerReiter ?? "umrechnen");
  return (
    <div className="page">
      <SimKopf titel={<>🪜 Größen &amp; Einheiten</>} action={action}>
        Länge, Fläche, Volumen, Gewicht, Zeit und Geld umrechnen — mit Einheitenleiter, Alltagsbeispielen und der Frage,
        warum Fläche mit 100 und Volumen mit 1 000 rechnet.
      </SimKopf>

      {!festerReiter && <div className="inline-flex self-start rounded-xl border border-line p-1 bg-surface">
        {BLAETTER.map(b => (
          <button key={b.id} onClick={() => setBlatt(b.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
            }`}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>}

      {blatt === "umrechnen" ? <Umrechnen /> : <Dimensionen />}
    </div>
  );
}
