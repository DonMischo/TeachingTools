"use client";
/**
 * PC-Werkstatt:
 *   🔧 Bauen          Gaming-PC, 386er und Raspberry Pi Teil für Teil zusammensetzen und einschalten
 *   🔍 Erkennen       Teile aller vier Geräte (auch Smartphone) nachlesen und im Quiz finden
 *   📊 Damals & heute Kennzahlen der Geräte im Vergleich
 * Jede Ansicht gibt es realistisch und als Schaltplan.
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { GERAETE } from "@/lib/pcbau/geraete";
import { BlickWahl, type Blick } from "./Ansichten";
import Bauen from "./Bauen";
import Erkennen from "./Erkennen";
import Vergleich from "./Vergleich";
import { PcbDefs } from "./zeichnungen";
import { SimKopf } from "@/components/SimKopf";

const BLAETTER = [
  { id: "bauen", icon: "🔧", label: "Bauen" },
  { id: "erkennen", icon: "🔍", label: "Erkennen" },
  { id: "vergleich", icon: "📊", label: "Damals & heute" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

export default function PcWerkstatt({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  // Station mit festem Reiter: ohne Reiterleiste, wie es der TaskCrawler verspricht.
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "bauen");
  const [geraetId, setGeraetId] = useState("pc");
  const [blick, setBlick] = useState<Blick>("real");
  const g = GERAETE.find(x => x.id === geraetId)!;
  const nurErkennen = blatt === "bauen" && !g.bauen;

  return (
    <div className="page">
      <PcbDefs />
      <SimKopf titel="🪛 PC-Werkstatt" action={action}>
        Schraub einen Gaming-PC, einen 386er von 1990 und einen Raspberry Pi zusammen — mit Kabeln, Netzteil und allem.
        Schalte ein und finde heraus, was fehlt. Im Smartphone erkennst du die Teile.
      </SimKopf>

      <div className="flex flex-wrap items-center gap-3">
        {!festerReiter && <div className="inline-flex flex-wrap rounded-xl border border-line p-1 bg-surface">
          {BLAETTER.map(b => (
            <button key={b.id} onClick={() => setBlatt(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
              {b.icon} {b.label}
            </button>
          ))}
        </div>}
        {blatt !== "vergleich" && <BlickWahl blick={blick} setBlick={setBlick} />}
      </div>

      {blatt !== "vergleich" && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))]">
          {GERAETE.map(x => (
            <button key={x.id} onClick={() => setGeraetId(x.id)} aria-pressed={x.id === geraetId}
              className={`card flex items-center gap-3 p-3 text-left transition ${x.id === geraetId ? "ring-2 ring-accent border-accent" : "hover:bg-surface-hover"}`}>
              <span className="text-3xl">{x.icon}</span>
              <span className="min-w-0">
                <span className="block font-black leading-tight">{x.name}</span>
                <span className="block text-xs text-muted">{x.untertitel}{!x.bauen && " · nur Erkennen"}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {blatt === "vergleich" ? <Vergleich />
        : nurErkennen ? (
          <div className="grid gap-3">
            <div className="card p-3 text-sm">📱 Ein Smartphone schraubt man nicht selbst zusammen — fast alles ist verklebt oder gelötet. Hier lernst du seine Teile kennen.</div>
            <Erkennen key={g.id} g={g} blick={blick} />
          </div>
        )
          : blatt === "bauen" ? <Bauen key={g.id} g={g} blick={blick} />
            : <Erkennen key={g.id} g={g} blick={blick} />}
    </div>
  );
}
