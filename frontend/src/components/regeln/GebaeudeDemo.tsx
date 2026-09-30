"use client";
/**
 * Reiter »Gebäude« des Regel-Labors: Aus der Wachstumsregel WBB=WAW wächst
 * ein Haus mit Stockwerken. Daneben der Grundriss, wie ihn die Regel liefert.
 * Besucht man alle Zimmer eines Stockwerks, geht die Treppe auf — so wie im
 * Exitgame, wo in den Zimmern Rätsel warten.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { bauePlan, REGELN, type Plan } from "@/lib/gebaeude/plan";
import Gebaeude, { type GebaeudeArt, type Ort } from "@/components/gebaeude/Gebaeude";
import HausModell from "@/components/gebaeude/HausModell";
import { STILE, type RaumZustand, type Stil } from "@/components/gebaeude/szene";
import { OBJEKTE, OBJEKT_NAME } from "@/lib/gebaeude/objekte";

export default function GebaeudeDemo() {
  const [stockwerke, setStockwerke] = useState(3);
  const [zimmer, setZimmer] = useState(4);
  const [seed, setSeed] = useState(1);
  const [art, setArt] = useState<GebaeudeArt>("haus");
  const verlies = art === "verlies";
  const plan = useMemo(() => bauePlan(Array(stockwerke).fill(zimmer), seed, art === "ebene"), [stockwerke, zimmer, seed, art]);
  const [stock, setStock] = useState(0);
  const [besucht, setBesucht] = useState<boolean[][]>([]);
  const [meldung, setMeldung] = useState("Klicke auf ein Feld, nutze die Pfeiltasten oder tippe eine Zimmernummer (1–9, 0 = Treppe bzw. Tür).");
  const [auftrag, setAuftrag] = useState<{ ort: Ort; nr: number } | null>(null);
  const [ansicht, setAnsicht] = useState<"laufen" | "haus">("laufen");
  const [stil, setStil] = useState<Stil>("klassisch");

  useEffect(() => {
    setStock(0);
    setBesucht(plan.stockwerke.map(st => st.raeume.map(() => false)));
    setMeldung("Klicke auf ein Feld, nutze die Pfeiltasten oder tippe eine Zimmernummer (1–9, 0 = Treppe bzw. Tür).");
  }, [plan]);

  const zustaende: RaumZustand[][] = plan.stockwerke.map((st, i) => st.raeume.map((_, k) => (besucht[i]?.[k] ? "geloest" : "offen")));
  const zielOffen = plan.stockwerke.map((_, i) => (besucht[i] ?? []).every(Boolean));
  // Reihum alle Objekte zeigen — im Verlies wartet in jedem Zimmer ein Monster, an jeder Treppe ein Boss.
  const objekte = plan.stockwerke.map((st, i) => st.raeume.map((_, k) => (verlies ? "monster" : OBJEKTE[(i * 5 + k) % OBJEKTE.length])));
  const waechter = plan.stockwerke.map(() => verlies);
  const wort = art === "verlies" ? "Ebene" : art === "ebene" ? "Abschnitt" : "Stockwerk";

  const ankunft = (ort: Ort) => {
    if (ort.art === "raum") {
      setBesucht(b => b.map((z, i) => (i === stock ? z.map((v, k) => v || k === ort.raum) : z)));
      setMeldung(verlies
        ? `Zimmer ${ort.raum + 1}: Im Exitgame ist das Monster eine Aufgabe — gelöst, liegt es besiegt am Boden.`
        : `Zimmer ${ort.raum + 1} (${OBJEKT_NAME[objekte[stock][ort.raum]]}): Im Exitgame wartet hier eine Aufgabe. Wer sie löst, bekommt einen Codeschnipsel.`);
    } else if (ort.art === "zurueck") {
      setStock(s => s - 1);
      setMeldung(`Zurück auf ${wort} ${stock} — du stehst an der Treppe, über die du gekommen bist.`);
    } else if (!zielOffen[stock]) {
      setMeldung(verlies ? "👹 Der Boss lässt dich nicht vorbei. Erst alle Monster dieser Ebene besiegen."
        : `🔒 Die Tür ist zu. Erst alle Zimmer dieses ${art === "ebene" ? "Abschnitts" : "Stockwerks"} besuchen.`);
    } else if (stock < plan.stockwerke.length - 1) {
      setStock(s => s + 1);
      setMeldung(verlies ? `Ebene ${stock + 2} — tiefer im Verlies. Hinauf geht es über die Treppe, an der du stehst.`
        : art === "ebene" ? `Abschnitt ${stock + 2} — hinter der Tür geht es weiter; zurück kommst du durch dieselbe Tür.`
        : `Stockwerk ${stock + 2} — die Treppe endet genau dort, wo unten das Treppenhaus war.`);
    } else {
      setMeldung(verlies ? "🎉 Der Endboss ist besiegt — Ausgang erreicht!" : "🎉 Ausgang erreicht!");
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
        <label className="flex items-center gap-1">Stil
          <select value={stil} onChange={e => setStil(e.target.value as Stil)} className={auswahl}>
            {(Object.keys(STILE) as Stil[]).map(s => <option key={s} value={s}>{STILE[s].name}</option>)}
          </select>
        </label>
        <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5" role="group" aria-label="Art">
          {([["haus", "🏢 Haus (nach oben)"], ["verlies", "🗝️ Verlies (nach unten)"], ["ebene", "🗺️ Ebene (Türen)"]] as const).map(([v, t]) => (
            <button key={v} onClick={() => { setArt(v); setStil(v === "verlies" ? "verlies" : "klassisch"); setStock(0); }} aria-pressed={art === v}
              className={`px-2 py-1 rounded-md text-xs font-bold ${art === v ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)]"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5" role="group" aria-label="Ansicht">
          {([["laufen", "🚶 durchlaufen"], ["haus", "🏛️ ganzes Haus"]] as const).map(([a, t]) => (
            <button key={a} onClick={() => setAnsicht(a)} aria-pressed={ansicht === a}
              className={`px-2 py-1 rounded-md text-xs font-bold ${ansicht === a ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)]"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <div className="flex flex-col gap-2">
          <div className="h-[60vh] min-h-[360px] rounded-xl border border-[var(--border)] overflow-hidden bg-gradient-to-b from-sky-900/30 to-transparent">
            {ansicht === "laufen"
              ? <Gebaeude plan={plan} stock={stock} zustaende={zustaende} zielOffen={zielOffen} objekte={objekte} stil={stil}
                  art={art} waechter={waechter} aktiv auftrag={auftrag} onAnkunft={ankunft} />
              : <HausModell plan={plan} stil={stil} zustaende={zustaende} objekte={objekte} art={art} waechter={waechter} />}
          </div>
          <p className="text-sm text-center" data-meldung>{meldung}</p>
        </div>
        <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed">
          <h3 className="font-black text-lg">{wort} {stock + 1} von {plan.stockwerke.length}</h3>
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
                {besucht[stock]?.[k] ? "✔" : verlies ? "👾" : "🚪"} Zimmer {k + 1}
              </button>
            ))}
            <button onClick={() => setAuftrag(a => ({ ort: { art: "ziel" }, nr: (a?.nr ?? 0) + 1 }))}
              className="px-2 py-1 rounded-lg border border-[var(--border)] text-xs font-bold">
              {zielOffen[stock] ? (verlies ? "⬇" : art === "ebene" ? "➡" : "⬆") : "🔒"} {stock < plan.stockwerke.length - 1 ? (verlies ? "Treppe hinab" : art === "ebene" ? "Tür" : "Treppe") : "Ausgang"}
            </button>
            {stock > 0 && (
              <button onClick={() => setAuftrag(a => ({ ort: { art: "zurueck" }, nr: (a?.nr ?? 0) + 1 }))}
                className="px-2 py-1 rounded-lg border border-[var(--border)] text-xs font-bold">
                {verlies ? "⬆ zurück hinauf" : art === "ebene" ? "⬅ zurück durch die Tür" : "⬇ zurück hinunter"}
              </button>
            )}
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
