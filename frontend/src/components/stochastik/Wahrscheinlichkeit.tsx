"use client";
/** Kl. 7/8: Ereignisse & Laplace, Baumdiagramm mit Pfadregeln, verknüpfte Ereignisse (Venn). */
import { useContext, useEffect, useMemo, useState } from "react";
import { baum, blaetter, pEreignis, type Experiment, type FarbName, FARBEN, FARB_LABEL } from "@/lib/stochastik/zufall";
import { bruch, bt, prozent, wert, zahl, type Bruch } from "@/lib/stochastik/zahlen";
import { Baum, Venn, Wuerfel, type Region, REGIONEN } from "./diagramme";
import { Chips, Kachel, Kasten, LektionsKopf, Navi } from "./ui";

// ── Ereignisse & Laplace ─────────────────────────────────────────────────

type Omega = { id: string; label: string; ergebnisse: string[]; vorlagen: { label: string; e: (x: string) => boolean }[]; zweistufig?: boolean };

const WUERFEL2 = Array.from({ length: 36 }, (_, i) => `${Math.floor(i / 6) + 1}${(i % 6) + 1}`);
const OMEGAS: Omega[] = [
  { id: "w", label: "🎲 ein Würfel", ergebnisse: ["1", "2", "3", "4", "5", "6"], vorlagen: [
    { label: "gerade Zahl", e: x => Number(x) % 2 === 0 }, { label: "größer als 4", e: x => Number(x) > 4 }, { label: "Primzahl", e: x => [2, 3, 5].includes(Number(x)) },
    { label: "kleiner als 7", e: () => true }, { label: "eine 7", e: () => false },
  ] },
  { id: "m", label: "🪙 zwei Münzen", zweistufig: true, ergebnisse: ["KK", "KZ", "ZK", "ZZ"], vorlagen: [
    { label: "zweimal gleich", e: x => x[0] === x[1] }, { label: "mindestens einmal Kopf", e: x => x.includes("K") }, { label: "genau einmal Zahl", e: x => x.split("Z").length === 2 },
  ] },
  { id: "ww", label: "🎲🎲 zwei Würfel", zweistufig: true, ergebnisse: WUERFEL2, vorlagen: [
    { label: "Pasch", e: x => x[0] === x[1] }, { label: "Augensumme 7", e: x => Number(x[0]) + Number(x[1]) === 7 },
    { label: "Augensumme ≥ 10", e: x => Number(x[0]) + Number(x[1]) >= 10 }, { label: "mindestens eine 6", e: x => x.includes("6") },
  ] },
];

export function Laplace() {
  const { niveau } = useContext(Navi);
  const mengen = niveau !== "H";
  const [oid, setOid] = useState("w");
  const om = OMEGAS.find(o => o.id === oid)!;
  const [e, setE] = useState<string[]>(["2", "4", "6"]);
  const [name, setName] = useState("gerade Zahl");
  useEffect(() => { const v = om.vorlagen[0]; setE(om.ergebnisse.filter(v.e)); setName(v.label); }, [oid]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = om.ergebnisse.length, k = e.length;
  const gegen = om.ergebnisse.filter(x => !e.includes(x));
  const art = k === 0 ? "unmögliches Ereignis" : k === n ? "sicheres Ereignis" : null;
  const kipp = (x: string) => { setE(a => (a.includes(x) ? a.filter(y => y !== x) : [...a, x].sort((p, q) => om.ergebnisse.indexOf(p) - om.ergebnisse.indexOf(q)))); setName("eigenes Ereignis"); };
  const menge = (xs: string[]) => (xs.length ? `{${xs.map(x => (om.id === "ww" ? `(${x[0]}|${x[1]})` : x)).join("; ")}}` : "{ } = ∅");
  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="laplace">
        Ein <b>Ergebnis</b> ist ein möglicher Ausgang, ein <b>Ereignis</b> eine Zusammenfassung von Ergebnissen. Sind alle Ergebnisse gleich wahrscheinlich
        (<b>Laplace-Experiment</b>), gilt: P(E) = Anzahl der günstigen Ergebnisse : Anzahl aller Ergebnisse.
      </LektionsKopf>
      <div className="card p-4 flex flex-col gap-3">
        <Chips wahl={oid} setze={setOid} optionen={OMEGAS.filter(o => mengen || o.id !== "ww").map(o => ({ id: o.id, label: o.label }))} />
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted">Ereignis E:</span>
          {om.vorlagen.map(v => <button key={v.label} className={`chip ${name === v.label ? "chip-on" : ""}`} onClick={() => { setE(om.ergebnisse.filter(v.e)); setName(v.label); }}>{v.label}</button>)}
          <span className="text-xs text-muted">– oder Ergebnisse anklicken</span>
        </div>
        <div className={`grid gap-1.5 ${om.id === "ww" ? "grid-cols-6 max-w-md" : "grid-cols-6 max-w-lg"}`} role="group" aria-label="Ergebnismenge">
          {om.ergebnisse.map(x => (
            <button key={x} onClick={() => kipp(x)} aria-pressed={e.includes(x)}
              className={`rounded-xl border-2 p-1.5 flex items-center justify-center gap-0.5 transition-all ${e.includes(x) ? "border-line-active bg-surface-hover scale-105" : "border-line opacity-70"}`}>
              {om.id === "w" ? <Wuerfel augen={Number(x)} groesse={40} /> : om.id === "ww" ? <><Wuerfel augen={Number(x[0])} groesse={22} /><Wuerfel augen={Number(x[1])} groesse={22} /></> : <b className="text-lg">{x}</b>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="card p-4 flex flex-col gap-2">
          <h3 className="font-black">E: {name}</h3>
          {mengen ? <>
            <p className="font-mono text-sm">Ω = {om.id === "ww" ? "{(1|1); (1|2); … (6|6)}" : menge(om.ergebnisse)} · |Ω| = {n}</p>
            <p className="font-mono text-sm">E = {menge(e)} · |E| = {k}</p>
            <p className="font-mono text-sm">Ē = {menge(gegen)}</p>
          </> : <>
            <p className="text-sm">Alle Ergebnisse: {n}. Günstig für E: {k} {k > 0 && k <= 12 && `(${e.join(", ")})`}</p>
            <p className="text-sm">Gegenereignis »nicht {name}«: {gegen.length <= 12 ? gegen.join(", ") || "keins" : `${gegen.length} Ergebnisse`}</p>
          </>}
          <div className="flex flex-wrap gap-2">
            <Kachel label="P(E)" wert={`${k}/${n}${bt(bruch(k, n)) !== `${k}/${n}` ? ` = ${bt(bruch(k, n))}` : ""}`} farbe="#f97316" hinweis={`≈ ${prozent(k / n)}`} />
            <Kachel label="P(Ē) = 1 − P(E)" wert={bt(bruch(n - k, n))} hinweis={`≈ ${prozent((n - k) / n)}`} />
          </div>
          {art && <p className="font-black text-ok">Das ist ein {art}: P = {k ? 1 : 0}.</p>}
        </div>
        <Kasten art="merk" titel="Begriffe">
          <p><b>sicheres Ereignis</b>: tritt immer ein, P = 1. <b>unmögliches Ereignis</b>: nie, P = 0.</p>
          <p><b>Gegenereignis Ē</b>: alle Ergebnisse, die nicht zu E gehören. P(E) + P(Ē) = 1.</p>
          <p>Laplace geht nur, wenn alle Ergebnisse <b>gleich wahrscheinlich</b> sind – bei einem gezinkten Würfel oder ungleichen Glücksradfeldern nicht.</p>
          {om.zweistufig && <p className="text-muted">Zweistufig: (2|5) und (5|2) sind verschiedene Ergebnisse – deshalb gibt es 36, nicht 21.</p>}
        </Kasten>
      </div>
    </div>
  );
}

// ── Baumdiagramm & Pfadregeln ────────────────────────────────────────────

type Vorlage = { label: string; gilt: (p: string[]) => boolean };

export function BaumBlatt() {
  const { niveau } = useContext(Navi);
  const [kugeln, setKugeln] = useState<Partial<Record<FarbName, number>>>({ rot: 3, blau: 2 });
  const [zl, setZl] = useState(false);
  const [stufen, setStufen] = useState(2);
  const [format, setFormat] = useState<"bruch" | "dezimal" | "prozent">("bruch");
  const [an, setAn] = useState<string[]>([]);
  const e: Experiment = { art: "urne", kugeln, zuruecklegen: zl };
  const ges = Object.values(kugeln).reduce((a, n) => a + (n ?? 0), 0);
  const ok = ges > 0 && (zl || ges >= stufen);
  const w = useMemo(() => (ok ? baum(e, stufen) : null), [JSON.stringify(kugeln), zl, stufen, ok]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setAn([]), [w]);
  const farben = (Object.keys(kugeln) as FarbName[]).filter(f => (kugeln[f] ?? 0) > 0);
  const vorlagen: Vorlage[] = [
    { label: "alle gleiche Farbe", gilt: p => p.every(x => x === p[0]) },
    { label: `mindestens eine ${FARB_LABEL[farben[0] ?? "rot"]}e`, gilt: p => p.includes(farben[0]) },
    { label: `genau eine ${FARB_LABEL[farben[0] ?? "rot"]}e`, gilt: p => p.filter(x => x === farben[0]).length === 1 },
    { label: "verschiedene Farben", gilt: p => new Set(p).size === p.length },
  ];
  const bl = w ? blaetter(w) : [];
  const gewaehlt = bl.filter(b => an.includes(b.pfad.join()));
  const f = (b: Bruch) => (format === "bruch" ? bt(b) : format === "prozent" ? prozent(wert(b)) : zahl(wert(b), 4));
  const summe = w ? pEreignis(w, p => an.includes(p.join())) : bruch(0);
  const kurz = (id: string) => id.slice(0, 1).toUpperCase();
  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="baum">
        An die Äste des Baumdiagramms schreibst du jetzt die Wahrscheinlichkeiten. <b>1. Pfadregel</b>: Die Wahrscheinlichkeit eines Pfades ist das Produkt entlang des Pfades.
        <b> 2. Pfadregel</b>: Gehören mehrere Pfade zum Ereignis, addierst du ihre Wahrscheinlichkeiten.
      </LektionsKopf>
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-4 items-center">
          {(["rot", "blau", "gruen"] as FarbName[]).map(c => (
            <label key={c} className="flex items-center gap-1.5 text-sm">
              <span className="w-4 h-4 rounded-full" style={{ background: FARBEN[c] }} />
              <input type="number" className="input w-16" min={0} max={9} value={kugeln[c] ?? 0} aria-label={`Kugeln ${FARB_LABEL[c]}`}
                onChange={ev => setKugeln(k => ({ ...k, [c]: Math.max(0, Math.min(9, Number(ev.target.value) || 0)) }))} />
            </label>
          ))}
          <Chips wahl={zl ? "mit" : "ohne"} setze={x => setZl(x === "mit")} optionen={[{ id: "mit", label: "mit Zurücklegen" }, { id: "ohne", label: "ohne Zurücklegen" }]} />
          <Chips wahl={String(stufen)} setze={x => setStufen(Number(x))} optionen={(niveau === "H" ? [1, 2] : [1, 2, 3]).map(n => ({ id: String(n), label: `${n} Stufe${n > 1 ? "n" : ""}` }))} />
          <Chips wahl={format} setze={setFormat} optionen={[{ id: "bruch", label: "Bruch" }, { id: "dezimal", label: "Dezimal" }, { id: "prozent", label: "Prozent" }]} />
        </div>
        {!ok && <p className="text-bad text-sm">{ges === 0 ? "Lege Kugeln in die Urne." : "Ohne Zurücklegen reichen die Kugeln nicht."}</p>}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted">Ereignis:</span>
          {vorlagen.map(v => <button key={v.label} className="chip" onClick={() => { setAn(bl.filter(b => v.gilt(b.pfad)).map(b => b.pfad.join())); }}>{v.label}</button>)}
          <button className="chip" onClick={() => setAn([])}>leeren</button>
          <span className="text-xs text-muted">– oder Pfade rechts anklicken</span>
        </div>
      </div>
      {w && (
        <div className="grid lg:grid-cols-[3fr_2fr] gap-4 items-start">
          <div className="card p-4">
            <Baum wurzel={w} mitP format={format} kurz={kurz} an={p => an.includes(p.join())}
              onPfad={p => setAn(a => (a.includes(p.join()) ? a.filter(x => x !== p.join()) : [...a, p.join()]))} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="card p-4 flex flex-col gap-1.5">
              <h3 className="font-black">Rechnung</h3>
              {gewaehlt.length === 0 && <p className="text-sm text-muted">Wähle ein Ereignis oder klicke Pfade an.</p>}
              {gewaehlt.map(b => {
                const faktoren: Bruch[] = [];
                let k = w;
                for (const x of b.pfad) { k = k.kinder.find(c => c.pfad[c.pfad.length - 1] === x && c.pfad.length === k.pfad.length + 1)!; faktoren.push(k.p); }
                return <p key={b.pfad.join()} className="font-mono text-sm">P({b.pfad.map(kurz).join("")}) = {faktoren.map(f).join(" · ")} = <b>{f(b.pPfad)}</b></p>;
              })}
              {gewaehlt.length > 1 && <p className="font-mono text-sm border-t border-line pt-1.5">P(E) = {gewaehlt.map(b => f(b.pPfad)).join(" + ")} = <b className="text-lg">{f(summe)}</b></p>}
              {gewaehlt.length > 0 && <p className="text-xs text-muted">≈ {prozent(wert(summe))}</p>}
            </div>
            <Kasten art={zl ? "tipp" : "achtung"} titel={zl ? "Mit Zurücklegen" : "Ohne Zurücklegen"}>
              <p>{zl ? "Die Urne ist bei jedem Zug gleich – die Äste jeder Stufe tragen dieselben Wahrscheinlichkeiten." : "Nach jedem Zug fehlt eine Kugel: Der Nenner wird kleiner, und der Zähler der gezogenen Farbe auch."}</p>
              <p className="text-muted">Probe: Alle Äste, die von einem Punkt ausgehen, ergeben zusammen 1. Alle Pfade zusammen auch.</p>
            </Kasten>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Verknüpfte Ereignisse ────────────────────────────────────────────────

const ZAHLEN = Array.from({ length: 12 }, (_, i) => i + 1);
const MENGEN = [
  { label: "gerade", m: (x: number) => x % 2 === 0 }, { label: "Primzahl", m: (x: number) => [2, 3, 5, 7, 11].includes(x) },
  { label: "größer als 6", m: (x: number) => x > 6 }, { label: "durch 3 teilbar", m: (x: number) => x % 3 === 0 },
  { label: "höchstens 4", m: (x: number) => x <= 4 },
];
const OPS: { id: string; sym: string; wort: string; r: Region[] }[] = [
  { id: "A", sym: "A", wort: "A tritt ein", r: ["nurA", "AB"] },
  { id: "B", sym: "B", wort: "B tritt ein", r: ["nurB", "AB"] },
  { id: "und", sym: "A ∩ B", wort: "A und B (beide zugleich)", r: ["AB"] },
  { id: "oder", sym: "A ∪ B", wort: "A oder B (mindestens eins)", r: ["nurA", "AB", "nurB"] },
  { id: "nA", sym: "Ā", wort: "nicht A", r: ["nurB", "aussen"] },
  { id: "AnB", sym: "A ∩ B̄", wort: "A, aber nicht B", r: ["nurA"] },
  { id: "kein", sym: "Ā ∩ B̄", wort: "weder A noch B", r: ["aussen"] },
  { id: "genau", sym: "(A ∩ B̄) ∪ (Ā ∩ B)", wort: "genau eins von beiden", r: ["nurA", "nurB"] },
];

export function VennBlatt() {
  const { niveau } = useContext(Navi);
  const mitSymbol = niveau !== "R";
  const [ia, setIa] = useState(0);
  const [ib, setIb] = useState(2);
  const [op, setOp] = useState("und");
  const [modus, setModus] = useState<"zeigen" | "raten">("zeigen");
  const [geraten, setGeraten] = useState<Region[]>([]);
  const [frage, setFrage] = useState(3);
  const [urteil, setUrteil] = useState<boolean | null>(null);
  const A = MENGEN[ia], B = MENGEN[ib];
  const region = (x: number): Region => (A.m(x) ? (B.m(x) ? "AB" : "nurA") : B.m(x) ? "nurB" : "aussen");
  const elemente = Object.fromEntries(REGIONEN.map(r => [r, ZAHLEN.filter(x => region(x) === r)])) as Record<Region, number[]>;
  const o = OPS.find(x => x.id === op)!;
  const treffer = ZAHLEN.filter(x => o.r.includes(region(x)));
  const ziel = OPS[frage];
  const pruefe = () => {
    const ok = geraten.length === ziel.r.length && ziel.r.every(r => geraten.includes(r));
    setUrteil(ok);
  };
  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="venn">
        Zwei Ereignisse lassen sich verknüpfen: <b>und</b> (Schnitt{mitSymbol ? " ∩" : ""}), <b>oder</b> (Vereinigung{mitSymbol ? " ∪" : ""}), <b>nicht</b> (Gegenereignis{mitSymbol ? ", Ā" : ""}).
        Im <b>Venn-Diagramm</b> ist jedes Ereignis ein Kreis in der Ergebnismenge Ω.
      </LektionsKopf>
      <div className="card p-4 flex flex-col gap-3">
        <p className="text-sm">Eine Kugel mit einer Zahl von 1 bis 12 wird gezogen.</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-wrap gap-1.5 items-center"><b style={{ color: "#3b82f6" }}>A:</b>{MENGEN.map((m, i) => <button key={m.label} disabled={i === ib} className={`chip ${ia === i ? "chip-on" : ""}`} onClick={() => setIa(i)}>{m.label}</button>)}</div>
          <div className="flex flex-wrap gap-1.5 items-center"><b style={{ color: "#22c55e" }}>B:</b>{MENGEN.map((m, i) => <button key={m.label} disabled={i === ia} className={`chip ${ib === i ? "chip-on" : ""}`} onClick={() => setIb(i)}>{m.label}</button>)}</div>
        </div>
        <Chips wahl={modus} setze={x => { setModus(x); setGeraten([]); setUrteil(null); }} optionen={[{ id: "zeigen", label: "👀 Zeigen" }, { id: "raten", label: "👆 Selbst markieren" }]} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="card p-4 flex flex-col gap-2 items-center">
          <Venn an={modus === "zeigen" ? o.r : geraten} a={`A: ${A.label}`} b={`B: ${B.label}`} elemente={elemente}
            onRegion={modus === "raten" ? r => { setUrteil(null); setGeraten(g => (g.includes(r) ? g.filter(x => x !== r) : [...g, r])); } : undefined} />
        </div>
        {modus === "zeigen" ? (
          <div className="card p-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">{OPS.map(x => <button key={x.id} className={`chip ${op === x.id ? "chip-on" : ""}`} onClick={() => setOp(x.id)}>{mitSymbol ? x.sym : x.wort}</button>)}</div>
            <p className="text-lg"><b>{mitSymbol ? o.sym : ""}</b> {mitSymbol && "–"} {o.wort}</p>
            <p className="font-mono text-sm">{mitSymbol ? `${o.sym} = ` : ""}{`{${treffer.join("; ")}}`}{!treffer.length && " = ∅"}</p>
            <Kachel label="Wahrscheinlichkeit" wert={`${treffer.length}/12${bt(bruch(treffer.length, 12)) !== `${treffer.length}/12` ? ` = ${bt(bruch(treffer.length, 12))}` : ""}`} hinweis={`≈ ${prozent(treffer.length / 12)}`} />
            {(op === "oder") && <p className="text-sm text-muted">Achtung beim Zählen: Was in A und in B liegt, nur einmal zählen! P(A ∪ B) = P(A) + P(B) − P(A ∩ B) = {ZAHLEN.filter(A.m).length}/12 + {ZAHLEN.filter(B.m).length}/12 − {elemente.AB.length}/12.</p>}
          </div>
        ) : (
          <div className="card p-4 flex flex-col gap-3">
            <p className="text-sm">Klicke im Diagramm alle Bereiche an, die zu diesem Ereignis gehören:</p>
            <p className="text-xl font-black">{mitSymbol ? ziel.sym : ziel.wort} {mitSymbol && <span className="text-sm text-muted font-normal">({ziel.wort})</span>}</p>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={pruefe}>✔ Prüfen</button>
              <button className="btn" onClick={() => { setFrage(f => (f + 1 + Math.floor(Math.random() * (OPS.length - 1))) % OPS.length); setGeraten([]); setUrteil(null); }}>🎲 Nächstes</button>
            </div>
            {urteil === true && <p className="text-ok font-black">✔ Richtig!</p>}
            {urteil === false && <p className="text-bad font-black">✘ Noch nicht. Tipp: {ziel.wort}.</p>}
          </div>
        )}
      </div>
      {niveau === "R" && <Kasten art="tipp" titel="Realschulniveau (Kl. 9)"><p>Beschreibe verknüpfte Ereignisse in Worten: »und«, »oder«, »nicht«, »weder … noch«. Die Symbole ∩ ∪ Ā sind Gymnasialstoff (Kl. 8).</p></Kasten>}
    </div>
  );
}
