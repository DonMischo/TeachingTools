"use client";
/**
 * Algorithmen-Werkstatt — Einstieg in Algorithmen für Klasse 5/6.
 *
 * Reiter:
 *   Automat        — Handlungsschritte ordnen, ein wörtlich nehmender Roboter führt sie aus
 *   Flussdiagramm  — Diagramme bauen, prüfen und ablaufen lassen
 *   Code-Abenteuer — Levelspiel mit Kacheln oder Blockly, vier Themen
 *   Klassenübersicht (nur Lehrkraft in einer Sitzung)
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { wahl as vorWahl, type Vorgabe } from "@/lib/vorgabe";
import { LEER_STAND, ladeStand, mitErledigt, mitLevel, speichereStand, type AlgoStand } from "@/lib/algo/fortschritt";
import CodeAbenteuer from "./CodeAbenteuer";
import AutomatEinstieg from "./AutomatEinstieg";
import FlussReiter from "./FlussReiter";
import AlgoUebersicht from "./AlgoUebersicht";

type Reiter = "automat" | "fluss" | "abenteuer" | "uebersicht";

const REITER: { id: Reiter; icon: string; label: string }[] = [
  { id: "automat", icon: "🍬", label: "Automat" },
  { id: "fluss", icon: "🔀", label: "Flussdiagramm" },
  { id: "abenteuer", icon: "🎮", label: "Code-Abenteuer" },
  { id: "uebersicht", icon: "👩‍🏫", label: "Klassenübersicht" },
];

const chip = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

export default function Algorithmen({ action, vorgabe, speicherSchluessel = "hp_algo_stand", onStand, verwaltung = false }: {
  action?: ReactNode;
  /** Lehrkraft auf der Werkzeugseite: zeigt die Klassenübersicht */
  verwaltung?: boolean;
  vorgabe?: Vorgabe;
  /** localStorage-Schlüssel des Fortschritts (Gäste: je Name) */
  speicherSchluessel?: string;
  /** wird nach jeder Verbesserung gerufen — für die Meldung an den Server */
  onStand?: (s: AlgoStand) => void;
}) {
  const festerReiter = vorWahl(vorgabe, "reiter", REITER.map(r => r.id));
  const [reiter, setReiter] = useState<Reiter>(festerReiter ?? "automat");
  const [stand, setStand] = useState<AlgoStand>(LEER_STAND);
  const [flussStart, setFlussStart] = useState<string | null>(null);
  useEffect(() => { setStand(ladeStand(speicherSchluessel)); }, [speicherSchluessel]);

  const aendern = useCallback((f: (s: AlgoStand) => AlgoStand) => setStand(f), []);
  // Speichern und Melden außerhalb des Updaters (StrictMode ruft ihn doppelt).
  const [zuletzt, setZuletzt] = useState<AlgoStand | null>(null);
  useEffect(() => {
    if (stand === LEER_STAND || stand === zuletzt) return;
    setZuletzt(stand);
    speichereStand(speicherSchluessel, stand);
    onStand?.(stand);
  }, [stand, zuletzt, speicherSchluessel, onStand]);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🔀 Algorithmen-Werkstatt</h1>
          <p className="text-muted text-sm mt-1">
            Tu, was du tun musst — aber tu&apos;s richtig! Vom Automaten über das Flussdiagramm bis zum eigenen Programm.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {!festerReiter && (
        <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
          {REITER.filter(r => r.id !== "uebersicht" || verwaltung).map(r => (
            <button key={r.id} type="button" onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.icon} {r.label}</button>
          ))}
        </div>
      )}
      {reiter === "automat" && (
        <AutomatEinstieg erledigt={stand.automat} onGeloest={id => aendern(s => mitErledigt(s, "automat", id))}
          onFluss={id => { setFlussStart(id); setReiter("fluss"); }} />
      )}
      {reiter === "fluss" && <FlussReiter erledigt={stand.fluss} start={flussStart} onGeloest={id => aendern(s => mitErledigt(s, "fluss", id))} />}
      {reiter === "uebersicht" && verwaltung && <AlgoUebersicht />}
      {reiter === "abenteuer" && (
        <CodeAbenteuer stand={stand} onGeloest={(id, sterne, bloecke) => aendern(s => mitLevel(s, id, { sterne, bloecke }))} />
      )}
    </div>
  );
}
