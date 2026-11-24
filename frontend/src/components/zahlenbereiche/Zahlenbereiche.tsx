"use client";
/**
 * Zahlenbereiche ℕ → ℤ → ℚ → ℝ in vier Blättern:
 *   🪆 Mengenbild   ineinander liegende Felder, eigene Zahlen einsortieren
 *   📏 Zahlenstrahl Punkte, dichte Brüche, Lücken bei √2, Lupe
 *   📋 Steckbriefe  Beschreibung, Eigenschaften, Beispiele, Abgeschlossenheit
 *   🎮 Spiele       Zahlen-Detektiv (alle Bereiche antippen), Zahlenregen
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { Chips } from "@/components/prozent/ui";
import Mengenbild from "./Mengenbild";
import Zahlenstrahl from "./Zahlenstrahl";
import Steckbriefe from "./Steckbriefe";
import Sortierer from "./Sortierer";
import Zahlenregen from "./Zahlenregen";

const BLAETTER = [
  { id: "menge", icon: "🪆", label: "Mengenbild" },
  { id: "strahl", icon: "📏", label: "Zahlenstrahl" },
  { id: "steckbriefe", icon: "📋", label: "Steckbriefe" },
  { id: "spiele", icon: "🎮", label: "Spiele" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

const SPIELE = [
  { id: "detektiv", label: "🕵️ Zahlen-Detektiv" },
  { id: "regen", label: "🌧️ Zahlenregen" },
] as const;

function Spiele() {
  const [spiel, setSpiel] = useState<(typeof SPIELE)[number]["id"]>("detektiv");
  return (
    <div className="flex flex-col gap-3">
      <Chips wahl={spiel} setze={setSpiel} optionen={SPIELE} />
      <div className="card p-4 sm:p-5">{spiel === "detektiv" ? <Sortierer /> : <Zahlenregen />}</div>
    </div>
  );
}

const INHALT: Record<Blatt, () => ReactNode> = {
  menge: () => <Mengenbild />,
  strahl: () => <Zahlenstrahl />,
  steckbriefe: () => <Steckbriefe />,
  spiele: () => <Spiele />,
};

export default function Zahlenbereiche({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "menge");
  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🪆 Zahlenbereiche</h1>
          <p className="text-muted text-sm mt-1">
            Von den natürlichen bis zu den reellen Zahlen: ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ als Mengenbild und auf dem Zahlenstrahl,
            Steckbriefe mit Eigenschaften und Beispielen — und zwei Spiele.
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
