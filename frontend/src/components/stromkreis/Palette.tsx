"use client";
/** Die Bauteilkiste: ein Klick wählt, ein Klick auf die Fläche setzt (oder aufziehen). */
import { useEffect, useRef } from "react";
import type { BauteilArt } from "@/lib/stromkreis/modell";
import { TEILE } from "@/lib/stromkreis/teile";
import { zeichneBauteil } from "@/lib/stromkreis/zeichnen";
import { zeichneRealistisch } from "@/lib/stromkreis/realistisch";
import { farbenAus, type Anzeige, type Werkzeug } from "./Zeichenflaeche";

const GRUPPEN: { name: string; teile: BauteilArt[] }[] = [
  { name: "Quellen", teile: ["batterie", "wechselquelle"] },
  { name: "Verbraucher", teile: ["lampe", "widerstand", "motor", "led", "diode"] },
  { name: "Schalten", teile: ["schalter", "umschalter", "sicherung"] },
  { name: "Kondensator & Spule", teile: ["kondensator", "spule", "trafo"] },
  { name: "Messen", teile: ["amperemeter", "voltmeter"] },
];

function SymbolBild({ art, stil }: { art: BauteilArt; stil: Anzeige["stil"] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = 64 * dpr; c.height = 40 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Was nach oben herausragt (Trafo, Umschalter; realistisch auch Kolben, Propeller, LED), rückt tiefer
    const echt = stil === "realistisch";
    const hoch = art === "trafo" || art === "umschalter" || (echt && (art === "lampe" || art === "motor" || art === "led"));
    const r = echt && (art === "motor" || art === "trafo") ? 7 : 9;
    const px = (p: { x: number; y: number }): [number, number] => [32 + (p.x - 2) * r, (hoch ? 31 : 20) + p.y * r];
    const t = { id: "x", art, a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, werte: {} };
    ctx.clearRect(0, 0, 64, 40);
    const male = stil === "realistisch" ? zeichneRealistisch : zeichneBauteil;
    male(ctx, t, px, r, { werte: { ...TEILE[art].werte, ...(art === "schalter" ? { geschlossen: 0 } : {}) }, anzeigeText: "0,00" }, farbenAus(c));
  }, [art, stil]);
  return <canvas ref={ref} style={{ width: 64, height: 40 }} aria-hidden />;
}

export default function Palette({ werkzeug, setWerkzeug, stil }: { werkzeug: Werkzeug; setWerkzeug: (w: Werkzeug) => void; stil: Anzeige["stil"] }) {
  const knopf = (an: boolean) =>
    `flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1 text-[11px] font-semibold leading-tight transition-colors ${
      an ? "border-line-active bg-surface-hover" : "border-line hover:bg-surface-hover"}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1.5">
        <button className={knopf(werkzeug === "auswahl")} onClick={() => setWerkzeug("auswahl")} title="Auswählen, verschieben, Schalter umlegen (Esc)">
          <span className="text-xl h-9 flex items-center">🖱️</span>Auswählen
        </button>
        <button className={knopf(werkzeug === "draht")} onClick={() => setWerkzeug("draht")} title="Leitung ziehen: von Punkt zu Punkt">
          <span className="text-xl h-9 flex items-center">〰️</span>Leitung
        </button>
      </div>
      {GRUPPEN.map(g => (
        <div key={g.name}>
          <div className="text-xs font-bold text-muted mb-1">{g.name}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {g.teile.map(art => (
              <button key={art} className={knopf(werkzeug === art)} onClick={() => setWerkzeug(werkzeug === art ? "auswahl" : art)} title={`${TEILE[art].name} setzen`}>
                <SymbolBild art={art} stil={stil} />
                {TEILE[art].name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
