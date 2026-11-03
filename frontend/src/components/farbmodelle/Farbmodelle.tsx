"use client";
/**
 * Farbmodelle — wie Bildschirm, Drucker und Mensch Farben beschreiben:
 *   🌈 Farbmodelle  RGB, CMYK, HSV, HSL mit Bild und Reglern, dieselbe Farbe in allen Schreibweisen
 *   🔢 Hex ↔ Dez    #RRGGBB in drei Zahlen und zurück, mit Rechenweg; freier Umrechner
 *   🎮 Farbmischer  eine Zielfarbe mit Hex-Ziffern nachmischen
 * Die ersten beiden Blätter teilen sich eine Farbe.
 */
import { useState, type ReactNode } from "react";
import type { Rgb } from "@/lib/farbmodelle";
import Farbraeume from "./Farbraeume";
import HexDez from "./HexDez";
import Farbmischer from "./Farbmischer";

const BLAETTER = [
  { id: "modelle", icon: "🌈", label: "Farbmodelle" },
  { id: "hexdez", icon: "🔢", label: "Hex ↔ Dez" },
  { id: "spiel", icon: "🎮", label: "Farbmischer" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

export default function Farbmodelle({ action }: { action?: ReactNode }) {
  const [blatt, setBlatt] = useState<Blatt>("modelle");
  const [farbe, setFarbe] = useState<Rgb>([255, 128, 0]);
  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🎨 Farbmodelle</h1>
          <p className="text-muted text-sm mt-1">
            RGB, CMYK, HSV und HSL: dieselbe Farbe, vier Beschreibungen. Farbcodes zwischen Hex und Dezimal umrechnen — und im Spiel nachmischen.
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

      {blatt === "modelle" && <Farbraeume farbe={farbe} setFarbe={setFarbe} />}
      {blatt === "hexdez" && <HexDez farbe={farbe} setFarbe={setFarbe} />}
      {blatt === "spiel" && <div className="card p-4 sm:p-5"><Farbmischer /></div>}
    </div>
  );
}
