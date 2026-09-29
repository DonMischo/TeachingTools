"use client";
/**
 * Gleichungswaage — drei Modi auf derselben Waage:
 *   🔢 Zahlen     lineare Gleichungen mit einem x, Klammern als Kisten
 *   🔤 Variablen  beliebige Formeln nach einer Größe umstellen
 *   ⚗️ Chemie     Reaktionsgleichungen ausgleichen, Atom für Atom
 *
 * Der Rahmen (Ständer, Balken, Schalen, Neigung) steckt in components/waage.
 */
import { useEffect, useState, type ReactNode } from "react";
import { WaageStyles } from "./Balance";
import ZahlenModus from "./ZahlenModus";
import VariablenModus from "./VariablenModus";
import ChemieModus from "./ChemieModus";

const MODES = [
  { id: "zahlen", icon: "🔢", label: "Zahlen", sub: "Gleichungen mit x — dazu die Klammerregel." },
  { id: "variablen", icon: "🔤", label: "Variablen", sub: "Formeln nach einer Größe umstellen — jede Größe hat ihre Farbe." },
  { id: "chemie", icon: "⚗️", label: "Chemie", sub: "Reaktionsgleichungen ausgleichen — jedes Atom liegt einzeln in der Schale." },
] as const;

type ModeId = (typeof MODES)[number]["id"];

export default function Gleichungswaage({ action }: { action?: ReactNode }) {
  const [mode, setMode] = useState<ModeId>("zahlen");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3600);
    return () => clearTimeout(t);
  }, [msg]);

  const active = MODES.find(m => m.id === mode)!;

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <WaageStyles />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
        <h1 className="text-2xl font-black tracking-tight">⚖️ Gleichungswaage</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1 max-w-2xl">
          Beide Seiten liegen in den Schalen. Was du auf der einen Seite tust, musst du auch auf
          der anderen tun — sonst kippt die Waage. {active.sub}
        </p>
        </div>
        {action}
      </div>

      <div className="inline-flex self-start rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
        {MODES.map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setMsg(null); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              mode === m.id
                ? "bg-[var(--accent)] text-[var(--accent-text,#111)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {msg && (
        <div className="gw-banner rounded-xl border border-[var(--red)] bg-[var(--red)]/10 px-4 py-2 text-sm text-[var(--red)] font-medium">
          {msg}
        </div>
      )}

      {mode === "zahlen" && <ZahlenModus onMessage={setMsg} />}
      {mode === "variablen" && <VariablenModus onMessage={setMsg} />}
      {mode === "chemie" && <ChemieModus onMessage={setMsg} />}
    </div>
  );
}
