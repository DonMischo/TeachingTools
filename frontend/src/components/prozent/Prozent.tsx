"use client";
/**
 * Prozent- und Zinsrechnung — sechs Blätter:
 *   👀 Anschauen   Kreis, Prozentstreifen, Hunderterfeld, Dinge zählen
 *   🔢 Dreisatz    W, G oder p gesucht — Schritt für Schritt über 1
 *   💡 Denkwege    Merkprozente, Zerlegen, Faktor, Fallen
 *   🏦 Zinsen      Monats-/Tageszinsen und Zinseszins
 *   ✍️ Üben        Sachaufgaben in drei Stufen, Übungsblatt zum Drucken
 *   🎮 Spiele      Prozent-Blitz, Saftbar, Handy-Check, Mein Kiosk
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import Anschauen from "./Anschauen";
import Dreisatz from "./Dreisatz";
import Denkwege from "./Denkwege";
import Zinsen from "./Zinsen";
import Ueben from "./Ueben";
import Spiele from "./Spiele";
import { SimKopf } from "@/components/SimKopf";

const BLAETTER = [
  { id: "anschauen", icon: "👀", label: "Anschauen" },
  { id: "dreisatz", icon: "🔢", label: "Dreisatz" },
  { id: "denkwege", icon: "💡", label: "Denkwege & Tipps" },
  { id: "zinsen", icon: "🏦", label: "Zinsen" },
  { id: "ueben", icon: "✍️", label: "Üben" },
  { id: "spiel", icon: "🎮", label: "Spiele" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

const INHALT: Record<Blatt, () => ReactNode> = {
  anschauen: () => <Anschauen />,
  dreisatz: () => <Dreisatz />,
  denkwege: () => <Denkwege />,
  zinsen: () => <Zinsen />,
  ueben: () => <Ueben />,
  spiel: () => <Spiele />,
};

export default function Prozent({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  // Station mit festem Reiter: ohne Reiterleiste, wie es der TaskCrawler verspricht.
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "anschauen");
  return (
    <div className="page">
      <SimKopf titel="💯 Prozent- und Zinsrechnung" action={action}>
        Prozente sehen (Kreis, Streifen, Hunderterfeld), mit dem Dreisatz rechnen, im Kopf rechnen lernen,
        Zinsen und Zinseszins verstehen — dazu Übungsaufgaben und vier Spiele.
      </SimKopf>

      {!festerReiter && <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
        {BLAETTER.map(b => (
          <button key={b.id} onClick={() => setBlatt(b.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
            }`}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>}

      {INHALT[blatt]()}
    </div>
  );
}
