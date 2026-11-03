"use client";
/**
 * Geometrie — Grundbegriffe für Klasse 5–7, acht Blätter:
 *   📐 Winkel          messen und zeichnen mit Winkelmesser/Geodreieck, Winkelarten, Bezeichnungen
 *   ∥  Lage            Punkt, Strecke, Strahl, Gerade; parallel, senkrecht, Abstand
 *   🛤️ Winkel an Geraden Neben-, Scheitel-, Stufen-, Wechselwinkel, farbig gekoppelt
 *   🦋 Symmetrie       Achsen- und Punktspiegelung auf Kästchenpapier, Achsen finden, Drehen
 *   🪞 Koordinaten     Spiegeln an x-/y-Achse, Parallelen und Ursprung mit Bildkoordinaten
 *   ✍️ Übungen / 🏡 Anwendungen  gewürfelt mit Skizze, beide mit Word-Export
 *   🎱 Winkel-Billard  Spiel: über die Bande ins Loch
 */
import { useState, type ReactNode } from "react";
import Aufgabenblatt from "@/components/geometrie/Aufgabenblatt";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { ANWENDUNG_ARTEN, UEBUNG_ARTEN, erzeugeAnwendung, erzeugeUebung } from "@/lib/geometrie-aufgaben";
import Winkel from "./Winkel";
import Lage from "./Lage";
import Winkelsaetze from "./Winkelsaetze";
import Symmetrie from "./Symmetrie";
import Koordinaten from "./Koordinaten";
import WinkelBillard from "./WinkelBillard";

const BLAETTER = [
  { id: "winkel", icon: "📐", label: "Winkel" },
  { id: "lage", icon: "∥", label: "Lagebeziehungen" },
  { id: "saetze", icon: "🛤️", label: "Winkel an Geraden" },
  { id: "symmetrie", icon: "🦋", label: "Symmetrie" },
  { id: "koordinaten", icon: "🪞", label: "Spiegeln im Koordinatensystem" },
  { id: "uebungen", icon: "✍️", label: "Übungen" },
  { id: "anwendungen", icon: "🏡", label: "Anwendungen" },
  { id: "spiel", icon: "🎱", label: "Winkel-Billard" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

const INHALT: Record<Blatt, () => ReactNode> = {
  winkel: () => <Winkel />,
  lage: () => <Lage />,
  saetze: () => <Winkelsaetze />,
  symmetrie: () => <Symmetrie />,
  koordinaten: () => <Koordinaten />,
  uebungen: () => <Aufgabenblatt arten={UEBUNG_ARTEN} erzeuge={a => erzeugeUebung(a)} titel="Geometrie – Übungen" datei="Geometrie-Uebungen.docx" />,
  anwendungen: () => <Aufgabenblatt arten={ANWENDUNG_ARTEN} erzeuge={a => erzeugeAnwendung(a)} titel="Geometrie – Anwendungsaufgaben" datei="Geometrie-Anwendungen.docx" />,
  spiel: () => <WinkelBillard />,
};

/** `vorgabe` (TaskCrawler-Station): { reiter: "symmetrie" } öffnet nur dieses Blatt. */
export default function Geometrie({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const fest = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(fest ?? "winkel");
  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📏 Geometrie</h1>
          <p className="text-muted text-sm mt-1">
            Grundbegriffe für Klasse 5–7: Winkel messen und zeichnen, Lage von Geraden, Winkel an Parallelen, Symmetrie auf
            Kästchenpapier und im Koordinatensystem — mit gewürfelten Übungen und Sachaufgaben (Word-Export) und dem Spiel Winkel-Billard.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      {!fest && <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
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
