"use client";
/**
 * Werkzeug an einer TaskCrawler-Station: Die Aufgabe nennt eine Simulation und
 * eine Vorgabe (`task.sim = { tool, config }`), hier wird sie im Vollbild
 * geöffnet. Die Simulation ist nur Hilfsmittel — die Antwort tippt man danach
 * in die Aufgabe, geprüft wird sie wie jede andere auf dem Server.
 *
 * Jede Simulation lädt erst, wenn man sie öffnet (lazy), damit der TaskCrawler
 * nicht alle Werkzeuge mitschleppt. Was eine Simulation mit `vorgabe` macht
 * (z. B. genau eine Gleichung, nur ein Reiter), entscheidet sie selbst; wer
 * `vorgabe` noch nicht kennt, öffnet sich frei.
 */
import { Suspense, lazy, useEffect, useState, type ComponentType, type LazyExoticComponent } from "react";
import { createPortal } from "react-dom";
import type { ExitGameSim } from "@/lib/api";
import { MathText } from "@/components/MathText";

export type Vorgabe = Record<string, unknown>;
type SimKomponente = ComponentType<{ vorgabe?: Vorgabe }>;

const laden = (f: () => Promise<{ default: unknown }>): LazyExoticComponent<SimKomponente> =>
  lazy(f as () => Promise<{ default: SimKomponente }>);

/** Alle Werkzeuge, die eine Station öffnen kann (ohne GTA und Rock your Life). */
export const SIM_STATIONEN: Record<string, { name: string; icon: string; Komponente: LazyExoticComponent<SimKomponente> }> = {
  gleichungswaage: { name: "Gleichungswaage", icon: "⚖️", Komponente: laden(() => import("@/components/waage/Gleichungswaage")) },
  abacus: { name: "Abakus", icon: "🧮", Komponente: laden(() => import("@/components/simulationen/Abakus")) },
  bildformate: { name: "Bildformate", icon: "🖼️", Komponente: laden(() => import("@/components/simulationen/Bildformate")) },
  vierecke: { name: "Vierecke", icon: "📐", Komponente: laden(() => import("@/components/simulationen/Vierecke")) },
  binaerrechner: { name: "Binär-Rechner", icon: "◈", Komponente: laden(() => import("@/components/simulationen/Binaerrechner")) },
  funktionen: { name: "Funktionen", icon: "📈", Komponente: laden(() => import("@/components/simulationen/Funktionen")) },
  rechenregeln: { name: "Rechenregeln", icon: "🍎", Komponente: laden(() => import("@/components/simulationen/Rechenregeln")) },
  tippen: { name: "10-Finger-Trainer", icon: "⌨️", Komponente: laden(() => import("@/components/tippen/Tippen")) },
  maus: { name: "Maus-Führerschein", icon: "🐭", Komponente: laden(() => import("@/components/maus/MausFuehrerschein")) },
  ki: { name: "KI-Werkstatt", icon: "🤖", Komponente: laden(() => import("@/components/ki/KiWerkstatt")) },
  sonnensystem: { name: "Sonnensystem", icon: "🪐", Komponente: laden(() => import("@/components/sonnensystem/Sonnensystem")) },
  kueste: { name: "Küstendynamik", icon: "🌊", Komponente: laden(() => import("@/components/kueste/Kueste")) },
  erdaufbau: { name: "Aufbau der Erde", icon: "🌍", Komponente: laden(() => import("@/components/erde/ErdAufbau")) },
  wilson: { name: "Wilson-Zyklus", icon: "🌋", Komponente: laden(() => import("@/components/wilson/WilsonZyklus")) },
  regeln: { name: "Regel-Labor", icon: "🧬", Komponente: laden(() => import("@/components/regeln/RegelLabor")) },
  wfc: { name: "Wellenfunktionskollaps", icon: "🧩", Komponente: laden(() => import("@/components/wfc/Wellenkollaps")) },
};

export function SimKnopf({ sim, frage }: { sim: ExitGameSim; frage?: string }) {
  const [offen, setOffen] = useState(false);
  const eintrag = SIM_STATIONEN[sim.tool];

  useEffect(() => {
    if (!offen) return;
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") setOffen(false); };
    window.addEventListener("keydown", zu);
    return () => window.removeEventListener("keydown", zu);
  }, [offen]);

  if (!eintrag) {
    return <p className="text-xs text-red-400">Das Werkzeug »{sim.tool}« gibt es nicht.</p>;
  }
  const { Komponente } = eintrag;
  return (
    <>
      <button onClick={() => setOffen(true)}
        className="self-start text-sm px-3 py-1.5 rounded-lg border-2 border-(--accent) font-bold hover:bg-(--surface-hover)">
        {eintrag.icon} {eintrag.name} öffnen
      </button>
      {offen && createPortal(
        <div className="fixed inset-0 z-100 bg-(--bg) flex flex-col" role="dialog" aria-label={eintrag.name} data-sim-station={sim.tool}>
          <div className="flex items-center gap-3 border-b border-(--border) bg-(--surface) px-4 py-2">
            <span className="text-xl">{eintrag.icon}</span>
            <div className="flex-1 min-w-0 text-sm">
              {frage ? <MathText text={frage} className="font-medium" /> : <b>{eintrag.name}</b>}
            </div>
            <button onClick={() => setOffen(false)} className="btn-primary w-auto! text-sm py-1.5 px-4 shrink-0 whitespace-nowrap">✓ Zur Antwort</button>
          </div>
          <div className="flex-1 overflow-y-auto app-scroll">
            <Suspense fallback={<p className="p-6 text-sm text-(--text-muted)">Lade {eintrag.name} …</p>}>
              <Komponente vorgabe={sim.config} />
            </Suspense>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
