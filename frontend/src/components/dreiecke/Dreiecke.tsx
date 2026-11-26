"use client";
/**
 * Dreiecke (Klasse 5–8) — sieben Blätter:
 *   △ Dreiecksarten      Ecken ziehen oder per Regler, Einordnung live, Fachbegriffe
 *   📐 Winkelsätze       Innenwinkelsumme (Abreißen), Außenwinkel, Basiswinkel, Thales
 *   ✳️ Besondere Linien  Höhen, Seitenhalbierende, Mittelsenkrechte, Winkelhalbierende
 *   🧱 Umfang und Fläche A = g · h : 2 durch Ergänzen; Kongruenzsätze
 *   ✍️ Übungen / 🏡 Anwendungen  gewürfelt, mit Skizze und Word-Export
 *   ⚡ Dreiecks-Blitz    Spiel: Dreiecke in Sekunden einordnen
 * Sinus, Kosinus und die Sätze dazu stehen in der Sim »trigonometrie«.
 *
 * `vorgabe` (TaskCrawler-Station): { reiter?: "arten" | "saetze" | "linien" | "flaeche",
 * winkel?: { alpha, beta } } — öffnet das Blatt mit diesem Startdreieck.
 */
import { useState, type ReactNode } from "react";
import { wahl, zahlen, type Vorgabe } from "@/lib/vorgabe";
import { ausWinkeln, type Dreieck } from "@/lib/dreiecke";
import { ANWENDUNG_ARTEN, UEBUNG_ARTEN, erzeugeAnwendung, erzeugeUebung } from "@/lib/dreiecke-aufgaben";
import Aufgabenblatt from "@/components/geometrie/Aufgabenblatt";
import Arten, { START } from "./Arten";
import Winkelsaetze from "./Winkelsaetze";
import Linien from "./Linien";
import Flaeche from "./Flaeche";
import DreiecksBlitz from "./DreiecksBlitz";
import { SimKopf } from "@/components/SimKopf";

const BLAETTER = [
  { id: "arten", icon: "△", label: "Dreiecksarten" },
  { id: "saetze", icon: "📐", label: "Winkelsätze" },
  { id: "linien", icon: "✳️", label: "Besondere Linien" },
  { id: "flaeche", icon: "🧱", label: "Umfang und Fläche" },
  { id: "uebungen", icon: "✍️", label: "Übungen" },
  { id: "anwendungen", icon: "🏡", label: "Anwendungen" },
  { id: "spiel", icon: "⚡", label: "Dreiecks-Blitz" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

/** Startdreieck aus der Vorgabe, so verschoben, dass es aufs Blatt passt. */
function startDreieck(vorgabe?: Vorgabe): Dreieck {
  const w = zahlen(vorgabe, "winkel");
  if (!w || !(w.alpha > 0 && w.beta > 0 && w.alpha + w.beta < 175)) return START;
  const d = ausWinkeln(8, w.alpha, w.beta, { x: 2, y: 8 });
  const dy = Math.max(0, 0.6 - d[2].y), dx = Math.min(0, d[2].x - 0.5);
  return d.map(p => ({ x: p.x - dx, y: p.y + dy })) as Dreieck;
}

export default function Dreiecke({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const [blatt, setBlatt] = useState<Blatt>(wahl(vorgabe, "reiter", ["arten", "saetze", "linien", "flaeche"] as const) ?? "arten");
  // Ein Dreieck für die ersten drei Blätter: was man in »Arten« zieht, liegt auch bei den Sätzen und Linien.
  const [d, setD] = useState<Dreieck>(() => startDreieck(vorgabe));

  const inhalt: Record<Blatt, () => ReactNode> = {
    arten: () => <Arten d={d} setD={setD} />,
    saetze: () => <Winkelsaetze d={d} setD={setD} />,
    linien: () => <Linien d={d} setD={setD} />,
    flaeche: () => <Flaeche />,
    uebungen: () => <Aufgabenblatt arten={UEBUNG_ARTEN} erzeuge={a => erzeugeUebung(a)} titel="Dreiecke – Übungen" datei="Dreiecke-Uebungen.docx" />,
    anwendungen: () => <Aufgabenblatt arten={ANWENDUNG_ARTEN} erzeuge={a => erzeugeAnwendung(a)} titel="Dreiecke – Anwendungsaufgaben" datei="Dreiecke-Anwendungen.docx" />,
    spiel: () => <DreiecksBlitz />,
  };

  return (
    <div className="page">
      <SimKopf titel="△ Dreiecke" action={action}>
        Dreiecksarten zum Ziehen, Winkelsumme, Außenwinkel, Basiswinkel und Thales, die besonderen Linien mit Umkreis und Inkreis,
        Umfang und Fläche mit Herleitung, Kongruenzsätze — dazu gewürfelte Übungen und Sachaufgaben mit Word-Export und der Dreiecks-Blitz.
      </SimKopf>

      <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
        {BLAETTER.map(b => (
          <button key={b.id} onClick={() => setBlatt(b.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>

      {/* key: Übungen und Anwendungen sind dasselbe Bauteil — ohne Schlüssel bliebe die Artenauswahl stehen. */}
      <div key={blatt} className="contents">{inhalt[blatt]()}</div>
    </div>
  );
}
