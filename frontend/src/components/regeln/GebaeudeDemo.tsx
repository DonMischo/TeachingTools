"use client";
/**
 * Reiter »Gebäude« des Regel-Labors: Aus der Wachstumsregel WBB=WAW wächst
 * ein Haus mit Stockwerken. Daneben der Grundriss, wie ihn die Regel liefert.
 * Besucht man alle Zimmer eines Stockwerks, geht die Treppe auf — so wie im
 * TaskCrawler, wo in den Zimmern Rätsel warten.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { bauePlan, REGELN, type Plan } from "@/lib/gebaeude/plan";
import Gebaeude, { type GebaeudeArt, type Ort } from "@/components/gebaeude/Gebaeude";
import HausModell from "@/components/gebaeude/HausModell";
import { STILE, type RaumZustand, type Stil } from "@/components/gebaeude/szene";
import AvatarWahl from "@/components/gebaeude/AvatarWahl";
import { STANDARD_AVATAR, ladeAvatar, type Avatar } from "@/components/gebaeude/avatar";
import { OBJEKTE, OBJEKT_NAME } from "@/lib/gebaeude/objekte";
import { DURCHGANG, NAGE_REGELN, PLATZ, WAND, baueFreiPlan, freiRegeln, type FreiEbene } from "@/lib/gebaeude/frei";
import FreiWelt from "@/components/gebaeude/frei/FreiWelt";
import { istOrganisch, weltVon } from "@/components/gebaeude/frei/welt";

export default function GebaeudeDemo() {
  const [stockwerke, setStockwerke] = useState(3);
  const [zimmer, setZimmer] = useState(4);
  const [avatar, setAvatar] = useState<Avatar>(STANDARD_AVATAR);
  useEffect(() => { setAvatar(ladeAvatar()); }, []);
  const [seed, setSeed] = useState(1);
  const [art, setArt] = useState<GebaeudeArt | "frei">("haus");
  const [stil, setStil] = useState<Stil>("klassisch");
  // frei: gemalte 3D-Welt auf einer weiten Karte; der Stil bestimmt die Welt (Wald, Höhle, Gebäude)
  const frei = art === "frei";
  const welt = weltVon(stil);
  const organisch = istOrganisch(stil);
  const verlies = art === "verlies" || frei;
  /** 3D-Welt: jede dritte Station ist ein Erz mit einem Info-Splitter, die anderen sind Monster */
  const istErz = (k: number) => frei && k % 3 === 1;
  const tueren = art === "ebene" || frei;
  const plan = useMemo(() => bauePlan(Array(stockwerke).fill(zimmer), seed, frei ? "haus" : art), [stockwerke, zimmer, seed, art, frei]);
  const freiPlan = useMemo(
    () => (frei ? baueFreiPlan(Array(stockwerke).fill(zimmer), seed, Array(stockwerke).fill(organisch)) : null),
    [frei, stockwerke, zimmer, seed, organisch]);
  /** die Abschnitte der gewählten Art: beide haben `raeume` */
  const karten: { raeume: unknown[] }[] = freiPlan ? freiPlan.ebenen : plan.stockwerke;
  const [stock, setStock] = useState(0);
  const [besucht, setBesucht] = useState<boolean[][]>([]);
  const [meldung, setMeldung] = useState("Klicke auf ein Feld, nutze die Pfeiltasten oder tippe eine Zimmernummer (1–9, 0 = Treppe bzw. Tür).");
  const [auftrag, setAuftrag] = useState<{ ort: Ort; nr: number } | null>(null);
  const [ansicht, setAnsicht] = useState<"laufen" | "haus">("laufen");

  useEffect(() => {
    setStock(0);
    setBesucht(karten.map(st => st.raeume.map(() => false)));
    setMeldung(freiPlan
      ? "Laufe mit W/S, drehe dich mit A/D oder ziehe mit der Maus. Ein Klick auf den Boden oder eine Zahl (1–9, 0 = Tor) läuft hin."
      : "Klicke auf ein Feld, nutze die Pfeiltasten oder tippe eine Zimmernummer (1–9, 0 = Treppe bzw. Tür).");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, freiPlan]);

  const zustaende: RaumZustand[][] = karten.map((st, i) => st.raeume.map((_, k) =>
    (istErz(k) ? (besucht[i]?.[k] ? "gelesen" : "info") : besucht[i]?.[k] ? "geloest" : "offen")));
  const zielOffen = karten.map((_, i) => (besucht[i] ?? []).every(Boolean));
  // Reihum alle Objekte zeigen — im Verlies wartet in jedem Zimmer ein Monster, an jeder Treppe ein Boss.
  const objekte = karten.map((st, i) => st.raeume.map((_, k) => (verlies ? "monster" : OBJEKTE[(i * 5 + k) % OBJEKTE.length])));
  const waechter = karten.map(() => verlies);
  const wort = art === "verlies" ? "Ebene" : tueren ? "Abschnitt" : "Stockwerk";

  const ankunft = (ort: Ort) => {
    if (ort.art === "raum") {
      setBesucht(b => b.map((z, i) => (i === stock ? z.map((v, k) => v || k === ort.raum) : z)));
      setMeldung(istErz(ort.raum)
        ? `Station ${ort.raum + 1}: Im Erz steckte ein Info-Splitter — im TaskCrawler ist das eine Erklärung zum Lesen.`
        : verlies
        ? `Zimmer ${ort.raum + 1}: Im TaskCrawler ist das Monster eine Aufgabe — gelöst, liegt es besiegt am Boden.`
        : `Zimmer ${ort.raum + 1} (${OBJEKT_NAME[objekte[stock][ort.raum]]}): Im TaskCrawler wartet hier eine Aufgabe. Wer sie löst, bekommt einen Codeschnipsel.`);
    } else if (ort.art === "zurueck") {
      setStock(s => s - 1);
      setMeldung(`Zurück auf ${wort} ${stock} — du stehst an der Treppe, über die du gekommen bist.`);
    } else if (!zielOffen[stock]) {
      setMeldung(verlies ? "👹 Der Boss lässt dich nicht vorbei. Erst alle Monster dieser Ebene besiegen."
        : `🔒 Die Tür ist zu. Erst alle Zimmer dieses ${tueren ? "Abschnitts" : "Stockwerks"} besuchen.`);
    } else if (stock < karten.length - 1) {
      setStock(s => s + 1);
      setMeldung(verlies ? `Ebene ${stock + 2} — tiefer im Verlies. Hinauf geht es über die Treppe, an der du stehst.`
        : tueren ? `Abschnitt ${stock + 2} — hinter der Tür geht es weiter; zurück kommst du durch dieselbe Tür.`
        : `Stockwerk ${stock + 2} — die Treppe endet genau dort, wo unten das Treppenhaus war.`);
    } else {
      setMeldung(verlies ? "🎉 Der Endboss ist besiegt — Ausgang erreicht!" : "🎉 Ausgang erreicht!");
    }
  };

  const auswahl = "rounded-lg border border-line bg-surface px-2 py-1";
  return (
    <div className="flex flex-col gap-3">
      <div className="card flex flex-wrap items-center gap-3 text-sm p-3">
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
        <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Art">
          {([["haus", "🏢 Haus (nach oben)"], ["verlies", "🗝️ Verlies (nach unten)"], ["ebene", "🗺️ Ebene (Türen)"], ["frei", "🌲 3D-Welt (frei laufen)"]] as const).map(([v, t]) => (
            <button key={v} onClick={() => { setArt(v); setStil(v === "verlies" ? "verlies" : v === "frei" ? "wald" : "klassisch"); setStock(0); }} aria-pressed={art === v}
              className={`px-2 py-1 rounded-md text-xs font-bold ${art === v ? "bg-accent text-accent-fg" : "text-muted"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Ansicht">
          {([["laufen", "🚶 durchlaufen"], ["haus", "🏛️ ganzes Haus"]] as const).map(([a, t]) => (
            <button key={a} onClick={() => setAnsicht(a)} aria-pressed={ansicht === a}
              className={`px-2 py-1 rounded-md text-xs font-bold ${ansicht === a ? "bg-accent text-accent-fg" : "text-muted"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <div className="flex flex-col gap-2">
          <div className="relative h-[75vh] min-h-[480px] rounded-xl border border-line overflow-hidden bg-linear-to-b from-sky-900/30 to-transparent">
            {freiPlan
              ? <FreiWelt key={seed} plan={freiPlan} stock={Math.min(stock, freiPlan.ebenen.length - 1)} zustaende={zustaende} zielOffen={zielOffen} objekte={objekte}
                  stile={freiPlan.ebenen.map(() => stil)} waechter={waechter} seed={seed} avatar={avatar} aktiv auftrag={auftrag} onAnkunft={ankunft} />
              : art !== "frei" && (ansicht === "laufen"
                ? <Gebaeude plan={plan} stock={stock} zustaende={zustaende} zielOffen={zielOffen} objekte={objekte} stil={stil}
                    art={art} waechter={waechter} avatar={avatar} aktiv auftrag={auftrag} onAnkunft={ankunft} />
                : <HausModell plan={plan} stil={stil} zustaende={zustaende} objekte={objekte} art={art} waechter={waechter} />)}
            {(ansicht === "laufen" || frei) && <div className="absolute top-2 left-2"><AvatarWahl avatar={avatar} onWahl={setAvatar} /></div>}
          </div>
          <p className="text-sm text-center" data-meldung>{meldung}</p>
        </div>
        <section className="card flex flex-col gap-3 p-4 text-sm leading-relaxed">
          <h3 className="font-black text-lg">{wort} {stock + 1} von {karten.length}</h3>
          {freiPlan
            ? <FreiGrundriss e={freiPlan.ebenen[Math.min(stock, freiPlan.ebenen.length - 1)]} besucht={besucht[stock] ?? []} />
            : <Grundriss plan={plan} stock={stock} besucht={besucht[stock] ?? []} />}
          {freiPlan ? (
            <>
              <p>
                Dieselbe Regelmaschine, aber weit und luftig: Erst wächst ein Punktgitter, darauf werden die Plätze gestempelt, ein
                Backtracker gräbt Wege, einige Wände fallen (Rundwege), jeder Platz bekommt einen Durchgang, Sackgassen verschwinden.
                Dann wird alles gestreckt: Wege und Plätze dreimal so breit wie die Wände.
              </p>
              <pre className="text-[10px] leading-snug font-mono bg-surface-hover rounded-lg p-2 overflow-x-auto">{freiRegeln(zimmer + 2, zimmer + 2)}</pre>
              {organisch && (
                <>
                  <p>Wald und Höhle: Ein Zellautomat nagt die Ränder an, einzelne {welt === "wald" ? "Bäume" : "Felssäulen"} wachsen mitten im Weg.</p>
                  <pre className="text-[10px] leading-snug font-mono bg-surface-hover rounded-lg p-2 overflow-x-auto">{NAGE_REGELN}</pre>
                </>
              )}
            </>
          ) : verlies ? (
            <p>
              Jede Ebene ist eine Verlies-Karte wie das Beispiel »Verlies«: Säle verteilen, dazwischen ein Labyrinth graben
              (Backtracker), jedem Saal eine Tür geben, Sackgassen verschwinden lassen. Die Treppe liegt im Saal, der am weitesten weg
              ist — und die Ebene darunter beginnt in einem Saal genau darunter.
            </p>
          ) : (
            <p>
              Gewachsen mit einer einzigen Regel: <code className="font-mono">{REGELN}</code>. Von einer Kreuzung (weiß) wächst der Flur
              zwei Felder weit ins Schwarze; das Stück dazwischen wird grau, damit nur Kreuzungen weiterwachsen. Es entsteht ein Baum —
              und jede Sackgasse wird ein Zimmer mit genau einer Tür. Die weiteste Sackgasse ist {art === "ebene" ? "rechts die Tür zum nächsten Abschnitt" : "das Treppenhaus"}.
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {(karten[stock]?.raeume ?? []).map((_, k) => (
              <button key={k} onClick={() => setAuftrag(a => ({ ort: { art: "raum", raum: k }, nr: (a?.nr ?? 0) + 1 }))}
                className={`px-2 py-1 rounded-lg border text-xs font-bold ${besucht[stock]?.[k] ? "border-green-500 text-green-600" : "border-line"}`}>
                {besucht[stock]?.[k] ? "✔" : verlies ? "👾" : "🚪"} Zimmer {k + 1}
              </button>
            ))}
            <button onClick={() => setAuftrag(a => ({ ort: { art: "ziel" }, nr: (a?.nr ?? 0) + 1 }))}
              className="px-2 py-1 rounded-lg border border-line text-xs font-bold">
              {zielOffen[stock] ? (tueren ? "➡" : verlies ? "⬇" : "⬆") : "🔒"} {stock < karten.length - 1 ? (frei ? "Tor" : verlies ? "Treppe hinab" : tueren ? "Tür" : "Treppe") : "Ausgang"}
            </button>
            {stock > 0 && (
              <button onClick={() => setAuftrag(a => ({ ort: { art: "zurueck" }, nr: (a?.nr ?? 0) + 1 }))}
                className="px-2 py-1 rounded-lg border border-line text-xs font-bold">
                {frei ? "⬅ zurück durchs Tor" : verlies ? "⬆ zurück hinauf" : tueren ? "⬅ zurück durch die Tür" : "⬇ zurück hinunter"}
              </button>
            )}
          </div>
          <p className="text-xs text-muted">Tipp: Die Knöpfe schicken die Figur auf dem kürzesten Weg dorthin (Breitensuche).</p>
        </section>
      </div>
    </div>
  );
}

/** Die weite Karte der 3D-Welt: Wand dunkel, Wege hell, Plätze grünlich. */
function FreiGrundriss({ e, besucht }: { e: FreiEbene; besucht: boolean[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = Math.max(2, Math.floor(280 / e.b));
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      const a = e.art[y * e.b + x];
      ctx.fillStyle = a === WAND ? "#111827" : a === PLATZ ? "#d9e4c8" : a === DURCHGANG ? "#eab308" : "#9ca3af";
      ctx.fillRect(x * px, y * px, px, px);
    }
    const punkt = (x: number, y: number, f: string) => { ctx.fillStyle = f; ctx.fillRect((x - 1) * px, (y - 1) * px, px * 3, px * 3); };
    e.raeume.forEach((r, k) => punkt(r.x, r.y, besucht[k] ? "#22c55e" : "#f59e0b"));
    punkt(e.ziel[0], e.ziel[1], "#e11d48");
    punkt(e.start[0], e.start[1], "#2563eb");
  });
  return (
    <div className="flex flex-col gap-1">
      <canvas ref={ref} width={e.b * px} height={e.h * px} className="rounded-lg self-center [image-rendering:pixelated]" />
      <p className="text-xs text-muted text-center">blau Start · orange Station · grün besucht · rot Tor · gelb Durchgang</p>
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
      <p className="text-xs text-muted text-center">blau Start · orange Zimmer · grün besucht · rot Treppe</p>
    </div>
  );
}
