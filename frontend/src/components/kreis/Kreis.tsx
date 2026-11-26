"use client";
/**
 * Kreis — Klasse 6 bis 9: Kreis-Labor (r, d, u, A mit Rechenweg und der
 * Herleitung von π), Geraden am Kreis (Sekante, Tangente, Passante),
 * Kreisteile (Sektor, Bogen, Segment, Ring, Halb- und Viertelkreis),
 * gewürfelte Übungen und Sachaufgaben (beide mit Word-Export) und das Spiel
 * Rad-Rollen.
 *
 * `vorgabe` (TaskCrawler-Station): { reiter?: "labor" | "geraden" | "teile" | "uebungen" | "anwendungen" | "spiel",
 * r?: Radius im Kreis-Labor } — öffnet dieses Blatt; die anderen bleiben erreichbar.
 */
import { useState, type ReactNode } from "react";
import { wahl, zahl, type Vorgabe } from "@/lib/vorgabe";
import Aufgabenblatt from "@/components/geometrie/Aufgabenblatt";
import { ANWENDUNG_ARTEN, UEBUNG_ARTEN, erzeugeAnwendung, erzeugeUebung } from "@/lib/kreis-aufgaben";
import KreisLabor from "./KreisLabor";
import Geraden from "./Geraden";
import Kreisteile from "./Kreisteile";
import RadRollen from "./RadRollen";
import { SimKopf } from "@/components/SimKopf";

const BLAETTER = [
  { id: "labor", icon: "⭕", label: "Kreis-Labor" },
  { id: "geraden", icon: "📏", label: "Geraden am Kreis" },
  { id: "teile", icon: "🍰", label: "Kreisteile" },
  { id: "uebungen", icon: "✍️", label: "Übungen" },
  { id: "anwendungen", icon: "🍕", label: "Anwendungen" },
  { id: "spiel", icon: "🛞", label: "Rad-Rollen" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

const INHALT: Record<Blatt, (v?: Vorgabe) => ReactNode> = {
  labor: v => <KreisLabor startR={zahl(v, "r")} />,
  geraden: () => <Geraden />,
  teile: () => <Kreisteile />,
  uebungen: () => <Aufgabenblatt arten={UEBUNG_ARTEN} erzeuge={a => erzeugeUebung(a)} titel="Kreis – Übungen" datei="Kreis-Uebungen.docx" />,
  anwendungen: () => <Aufgabenblatt arten={ANWENDUNG_ARTEN} erzeuge={a => erzeugeAnwendung(a)} titel="Kreis – Anwendungsaufgaben" datei="Kreis-Anwendungen.docx" />,
  spiel: () => <RadRollen />,
};

export default function Kreis({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  // Station mit festem Reiter: ohne Reiterleiste, wie es der TaskCrawler verspricht.
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "labor");
  return (
    <div className="page">
      <SimKopf titel="⭕ Kreis" action={action}>
        Radius, Durchmesser, Umfang und Fläche zum Ziehen, woher π kommt, Sekante, Tangente und Passante, Kreisteile vom
        Tortenstück bis zum Ring — dazu Übungen und Sachaufgaben mit Word-Export und das Spiel Rad-Rollen.
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

      {INHALT[blatt](vorgabe)}
    </div>
  );
}
