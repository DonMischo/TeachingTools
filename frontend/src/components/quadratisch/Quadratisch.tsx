"use client";
/**
 * Quadratische Funktionen — eine Unterrichtseinheit in Blättern, Schritt für
 * Schritt aufgebaut (Schreibweise wie im Tafelwerk: y = a(x + d)² + e, S(−d | e)):
 *   🔵 Normalparabel     y = x², Wertetabelle, Treppe 1-3-5
 *   ↕️ Verschieben       + e, dann (x + d)², dann beides
 *   🔀 Faktor a          strecken, stauchen, spiegeln
 *   📍 Scheitelpunktform alle drei Regler, Steckbrief, »Parabel treffen«
 *   🌈 Klammern & Binome vier Bögen, binomische Formeln, Flächenbild
 *   🧩 Umformen          ausmultiplizieren und quadratische Ergänzung
 *   🎯 Nullstellen       p-q-Formel
 *   ✖️ Schnittpunkte     gleichsetzen, p-q, y einsetzen
 *   ✍️ Üben              Themen wählbar, drei Stufen
 *   📝 Prüfungsaufgaben  Sachaufgaben mit Teilaufgaben, Word-Export
 *   🏀 Korbwurf          Spiel
 *   🚒 Feuerwehr         Spiel: Löschstrahl mit Druck, Hitze-Mindestabstand
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import Normalparabel from "./Normalparabel";
import Verschieben from "./Verschieben";
import Strecken from "./Strecken";
import Scheitelform from "./Scheitelform";
import Binome from "./Binome";
import { Nullstellen, Schnittpunkte, Umformen } from "./Rechnen";
import Ueben from "./Ueben";
import PruefungsBlatt from "./Pruefung";
import Korbwurf from "./Korbwurf";
import Feuerwehr from "./Feuerwehr";
import { SimKopf } from "@/components/SimKopf";

const BLAETTER = [
  { id: "normal", icon: "🔵", label: "Normalparabel" },
  { id: "verschieben", icon: "↕️", label: "Verschieben" },
  { id: "strecken", icon: "🔀", label: "Faktor a" },
  { id: "scheitel", icon: "📍", label: "Scheitelpunktform" },
  { id: "binome", icon: "🌈", label: "Klammern & Binome" },
  { id: "umformen", icon: "🧩", label: "Umformen" },
  { id: "nullstellen", icon: "🎯", label: "Nullstellen" },
  { id: "schnitt", icon: "✖️", label: "Schnittpunkte" },
  { id: "ueben", icon: "✍️", label: "Üben" },
  { id: "pruefung", icon: "📝", label: "Prüfungsaufgaben" },
  { id: "spiel", icon: "🏀", label: "Korbwurf" },
  { id: "feuerwehr", icon: "🚒", label: "Feuerwehr" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

const INHALT: Record<Blatt, () => ReactNode> = {
  normal: () => <Normalparabel />,
  verschieben: () => <Verschieben />,
  strecken: () => <Strecken />,
  scheitel: () => <Scheitelform />,
  binome: () => <Binome />,
  umformen: () => <Umformen />,
  nullstellen: () => <Nullstellen />,
  schnitt: () => <Schnittpunkte />,
  ueben: () => <Ueben />,
  pruefung: () => <PruefungsBlatt />,
  spiel: () => <Korbwurf />,
  feuerwehr: () => <Feuerwehr />,
};

export default function Quadratisch({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "normal");
  const i = BLAETTER.findIndex(b => b.id === blatt);
  return (
    <div className="page">
      <SimKopf titel="⛲ Quadratische Funktionen" action={action}>
        Von der Normalparabel bis zur p-q-Formel, Schritt für Schritt: verschieben, strecken, Scheitelpunktform
        y = a(x + d)² + e mit S(−d | e) wie im Tafelwerk, Klammern quadrieren, Umformen, Nullstellen und Schnittpunkte —
        mit Übungen nach Thema, Prüfungsaufgaben zum Exportieren und dem Spiel Korbwurf.
      </SimKopf>

      {!festerReiter && <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
        {BLAETTER.map((b, n) => (
          <button key={b.id} onClick={() => setBlatt(b.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
            {n < 8 && <span className="opacity-60 mr-1">{n + 1}</span>}{b.icon} {b.label}
          </button>
        ))}
      </div>}

      {INHALT[blatt]()}

      {!festerReiter && i < 7 && (
        <div className="flex justify-end">
          <button className="btn" onClick={() => setBlatt(BLAETTER[i + 1].id)}>Weiter: {BLAETTER[i + 1].icon} {BLAETTER[i + 1].label} →</button>
        </div>
      )}
    </div>
  );
}
