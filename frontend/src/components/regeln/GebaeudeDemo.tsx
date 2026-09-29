"use client";
/**
 * Reiter »Gebäude« des Regel-Labors: Aus der Wachstumsregel WBB=WAW wächst
 * ein Haus mit Stockwerken. Daneben der Grundriss, wie ihn die Regel liefert.
 * Besucht man alle Zimmer eines Stockwerks, geht die Treppe auf — so wie im
 * Exitgame, wo in den Zimmern Rätsel warten.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { bauePlan, REGELN, type Plan } from "@/lib/gebaeude/plan";
import Gebaeude, { type Ort } from "@/components/gebaeude/Gebaeude";
import type { RaumZustand } from "@/components/gebaeude/szene";

export default function GebaeudeDemo() {
  const [stockwerke, setStockwerke] = useState(3);
  const [zimmer, setZimmer] = useState(4);
  const [seed, setSeed] = useState(1);
  const plan = useMemo(() => bauePlan(Array(stockwerke).fill(zimmer), seed), [stockwerke, zimmer, seed]);
  const [stock, setStock] = useState(0);
  const [besucht, setBesucht] = useState<boolean[][]>([]);
  const [meldung, setMeldung] = useState("Klicke auf ein Feld oder nutze die Pfeiltasten.");
  const [auftrag, setAuftrag] = useState<{ ort: Ort; nr: number } | null>(null);

  useEffect(() => {
    setStock(0);
    setBesucht(plan.stockwerke.map(st => st.raeume.map(() => false)));
    setMeldung("Klicke auf ein Feld oder nutze die Pfeiltasten.");
  }, [plan]);

  const zustaende: RaumZustand[][] = plan.stockwerke.map((st, i) => st.raeume.map((_, k) => (besucht[i]?.[k] ? "geloest" : "offen")));
  const zielOffen = plan.stockwerke.map((_, i) => (besucht[i] ?? []).every(Boolean));

  const ankunft = (ort: Ort) => {
    if (ort.art === "raum") {
      setBesucht(b => b.map((z, i) => (i === stock ? z.map((v, k) => v || k === ort.raum) : z)));
      setMeldung(`Zimmer ${ort.raum + 1}: Im Exitgame wartet hier eine Aufgabe. Wer sie löst, bekommt einen Codeschnipsel.`);
    } else if (!zielOffen[stock]) {
      setMeldung("🔒 Die Tür ist zu. Erst alle Zimmer dieses Stockwerks besuchen.");
    } else if (stock < plan.stockwerke.length - 1) {
      setStock(s => s + 1);
      setMeldung(`Stockwerk ${stock + 2} — die Treppe endet genau dort, wo unten das Treppenhaus war.`);
    } else {
      setMeldung("🎉 Ausgang erreicht!");
    }
  };

  const auswahl = "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <label className="flex items-center gap-1">Stockwerke
          <select value={stockwerke} onChange={e => setStockwerke(+e.target.value)} className={auswahl}>
            {[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">Zimmer je Stockwerk
          <select value={zimmer} onChange={e => setZimmer(+e.target.value)} className={auswahl}>
            {[2, 3, 4, 5, 6, 8].map(n => <option key={n}>{n}</option>)}
          </select>
        </label>
        <button className={auswahl + " font-bold"} onClick={() => setSeed(s => s + 1)}>🎲 anderes Haus ({seed})</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <div className="flex flex-col gap-2">
          <div className="h-[60vh] min-h-[360px] rounded-xl border border-[var(--border)] overflow-hidden bg-gradient-to-b from-sky-900/30 to-transparent">
            <Gebaeude plan={plan} stock={stock} zustaende={zustaende} zielOffen={zielOffen} aktiv auftrag={auftrag} onAnkunft={ankunft} />
          </div>
          <p className="text-sm text-center" data-meldung>{meldung}</p>
        </div>
        <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed">
          <h3 className="font-black text-lg">Stockwerk {stock + 1} von {plan.stockwerke.length}</h3>
          <Grundriss plan={plan} stock={stock} besucht={besucht[stock] ?? []} />
          <p>
            Gewachsen mit einer einzigen Regel: <code className="font-mono">{REGELN}</code>. Von einer Kreuzung (weiß) wächst der Flur
            zwei Felder weit ins Schwarze; das Stück dazwischen wird grau, damit nur Kreuzungen weiterwachsen. Es entsteht ein Baum —
            und jede Sackgasse wird ein Zimmer mit genau einer Tür. Die weiteste Sackgasse ist das Treppenhaus.
          </p>
          <div className="flex flex-wrap gap-1">
            {plan.stockwerke[stock].raeume.map((_, k) => (
              <button key={k} onClick={() => setAuftrag(a => ({ ort: { art: "raum", raum: k }, nr: (a?.nr ?? 0) + 1 }))}
                className={`px-2 py-1 rounded-lg border text-xs font-bold ${besucht[stock]?.[k] ? "border-green-500 text-green-600" : "border-[var(--border)]"}`}>
                {besucht[stock]?.[k] ? "✔" : "🚪"} Zimmer {k + 1}
              </button>
            ))}
            <button onClick={() => setAuftrag(a => ({ ort: { art: "ziel" }, nr: (a?.nr ?? 0) + 1 }))}
              className="px-2 py-1 rounded-lg border border-[var(--border)] text-xs font-bold">
              {zielOffen[stock] ? "⬆" : "🔒"} {stock < plan.stockwerke.length - 1 ? "Treppe" : "Ausgang"}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Tipp: Die Knöpfe schicken die Figur auf dem kürzesten Weg dorthin (Breitensuche).</p>
        </section>
      </div>
    </div>
  );
}

/** Der Grundriss als Raster, so wie ihn die Regel ausgibt. */
function Grundriss({ plan, stock, besucht }: { plan: Plan; stock: number; besucht: boolean[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = Math.floor(280 / plan.R);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const st = plan.stockwerke[stock];
    for (let y = 0; y < plan.R; y++) for (let x = 0; x < plan.R; x++) {
      const offen = st.boden[y * plan.R + x];
      ctx.fillStyle = !offen ? "#111827" : x % 2 && y % 2 ? "#f5efe6" : "#9ca3af";
      ctx.fillRect(x * px, y * px, px, px);
    }
    st.raeume.forEach((r, k) => { ctx.fillStyle = besucht[k] ? "#22c55e" : "#f59e0b"; ctx.fillRect(r.x * px, r.y * px, px, px); });
    ctx.fillStyle = "#e11d48";
    ctx.fillRect(st.ziel[0] * px, st.ziel[1] * px, px, px);
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(st.start[0] * px, st.start[1] * px, px, px);
  });
  return (
    <div className="flex flex-col gap-1">
      <canvas ref={ref} width={plan.R * px} height={plan.R * px} className="rounded-lg self-center [image-rendering:pixelated]" />
      <p className="text-xs text-[var(--text-muted)] text-center">blau Start · orange Zimmer · grün besucht · rot Treppe</p>
    </div>
  );
}
