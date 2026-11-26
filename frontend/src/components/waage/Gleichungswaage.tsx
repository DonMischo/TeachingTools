"use client";
/**
 * Gleichungswaage — vier Modi auf derselben Waage:
 *   🍎 Rechnen    Grundschule: Dinge zusammenlegen, wegnehmen, vergleichen (<, =, >)
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
import RechnenModus from "./RechnenModus";
import { text, wahl, zahlen, type Vorgabe } from "@/lib/vorgabe";
import { SimKopf } from "@/components/SimKopf";

const MODES = [
  { id: "rechnen", icon: "🍎", label: "Rechnen", sub: "Dinge zusammenlegen, wegnehmen und vergleichen — in der Mitte steht <, = oder >." },
  { id: "zahlen", icon: "🔢", label: "Zahlen", sub: "Gleichungen mit x — dazu die Klammerregel." },
  { id: "variablen", icon: "🔤", label: "Variablen", sub: "Formeln nach einer Größe umstellen — jede Größe hat ihre Farbe." },
  { id: "chemie", icon: "⚗️", label: "Chemie", sub: "Reaktionsgleichungen ausgleichen — jedes Atom liegt einzeln in der Schale." },
] as const;

type ModeId = (typeof MODES)[number]["id"];

/**
 * `vorgabe` (TaskCrawler-Station) legt Modus und Aufgabe fest:
 *   { gleichung: "3x + 4 = 19" }                           → Zahlen
 *   { formel: "E = m·g·h", nach: "h", werte: { m: 2 } }    → Variablen
 *   { reaktion: "H2 + O2 -> H2O" }                          → Chemie
 * Dann gibt es keinen Moduswechsel und keine anderen Aufgaben.
 */
/**
 * `start` kommt aus dem Link (`?reaktion=…`, etwa aus dem Periodensystem):
 * es wählt Modus und Aufgabe für den Anfang, sperrt aber nichts — anders als
 * `vorgabe`.
 */
export type Start =
  | { modus: "zahlen"; gleichung: string }
  | { modus: "variablen"; formel: string; nach?: string }
  | { modus: "chemie"; reaktion: string };

export default function Gleichungswaage({ action, vorgabe, start }: { action?: ReactNode; vorgabe?: Vorgabe; start?: Start }) {
  const gleichung = text(vorgabe, "gleichung"), formel = text(vorgabe, "formel"), reaktion = text(vorgabe, "reaktion");
  const fest: ModeId | null = vorgabe
    ? wahl(vorgabe, "modus", ["zahlen", "variablen", "chemie"] as const)
      ?? (reaktion ? "chemie" : formel ? "variablen" : "zahlen")
    : null;
  const [mode, setMode] = useState<ModeId>(fest ?? start?.modus ?? "zahlen");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3600);
    return () => clearTimeout(t);
  }, [msg]);

  const active = MODES.find(m => m.id === mode)!;

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <WaageStyles />

      <SimKopf titel="⚖️ Gleichungswaage" action={action}>
        Beide Seiten liegen in den Schalen. Was du auf der einen Seite tust, musst du auch auf
        der anderen tun — sonst kippt die Waage. {active.sub}
      </SimKopf>

      {!fest && <div className="inline-flex self-start rounded-xl border border-line p-1 bg-surface">
        {MODES.map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setMsg(null); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              mode === m.id
                ? "bg-accent text-accent-fg"
                : "text-muted hover:text-fg"
            }`}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>}

      {msg && (
        <div className="gw-banner rounded-xl border border-bad bg-bad/10 px-4 py-2 text-sm text-bad font-medium">
          {msg}
        </div>
      )}

      {mode === "rechnen" && <RechnenModus />}
      {mode === "zahlen" && <ZahlenModus onMessage={setMsg} fest={fest ? gleichung : undefined}
        anfang={start?.modus === "zahlen" ? start.gleichung : undefined} />}
      {mode === "variablen" && <VariablenModus onMessage={setMsg}
        fest={fest && formel ? { formel, nach: text(vorgabe, "nach"), werte: zahlen(vorgabe, "werte") } : undefined}
        ausLink={start?.modus === "variablen" ? { formel: start.formel, nach: start.nach, werte: {} } : undefined} />}
      {mode === "chemie" && <ChemieModus onMessage={setMsg} fest={fest ? reaktion : undefined}
        anfang={start?.modus === "chemie" ? start.reaktion : undefined} />}
    </div>
  );
}
