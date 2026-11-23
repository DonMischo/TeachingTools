"use client";
/**
 * Die drei Rechenverfahren, jeweils langsam Schritt für Schritt:
 *   Additionsverfahren   Zeilen malnehmen, die zweite schwebt auf die erste, eine Variable fällt weg
 *   Gleichsetzungsverfahren  beide nach y freistellen, die rechten Seiten gleichsetzen
 *   Einsetzungsverfahren  Term per Ziehen (oder Antippen) für die Variable einsetzen
 * Umgeformt wird immer mit dem Umformer (beide Seiten, Protokoll).
 */
import { useEffect, useState, type DragEvent } from "react";
import {
  additionsFaktoren, addiere, ausNormal, einsetzen, einsetzText, erfuellt, gleichungText, leseGleichung, malNormal, normal, qDeutsch,
  stelleFrei, T, wuerfleSystem, type Gleichung, type Q, type Term, type Var,
} from "@/lib/lgs";
import { GleichungSatz, KachelZeile, Umformer, VFARBE } from "./teile";

export type System = { g1: Gleichung; g2: Gleichung };
const andere = (v: Var): Var => (v === "x" ? "y" : "x");
const wertVon = (g: Gleichung) => g.r.k;

/** Gemeinsamer Kopf: System wählen oder würfeln */
export function SystemWahl({ sys, setze }: { sys: System; setze: (s: System) => void }) {
  const [t1, setT1] = useState(gleichungText(sys.g1));
  const [t2, setT2] = useState(gleichungText(sys.g2));
  useEffect(() => { setT1(gleichungText(sys.g1)); setT2(gleichungText(sys.g2)); }, [sys]);
  const uebernehmen = () => { const a = leseGleichung(t1), b = leseGleichung(t2); if (a && b) setze({ g1: a, g2: b }); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-black">I</span><input className="input w-44 font-mono" value={t1} onChange={e => setT1(e.target.value)} aria-label="Gleichung I" />
      <span className="font-black">II</span><input className="input w-44 font-mono" value={t2} onChange={e => setT2(e.target.value)} aria-label="Gleichung II" />
      <button className="btn-secondary" onClick={uebernehmen}>Übernehmen</button>
      <button className="btn-secondary" onClick={() => { const w = wuerfleSystem(Math.random, 2); setze({ g1: w.g1, g2: w.g2 }); }}>🎲 Neues System</button>
    </div>
  );
}

function Ergebnis({ sys, x, y }: { sys: System; x: Q; y: Q }) {
  const ok = erfuellt(sys.g1, x, y) && erfuellt(sys.g2, x, y);
  return (
    <div className="rounded-xl bg-page p-3 flex flex-col gap-1">
      <p className="text-xl font-black text-ok">L = {"{"}({qDeutsch(x)} | {qDeutsch(y)}){"}"}</p>
      <p className="text-sm">Probe: in I und II einsetzen — {ok ? "beide Gleichungen stimmen ✔" : "stimmt nicht ✘"}</p>
    </div>
  );
}

/** Rückwärts einsetzen: bekannten Wert in I einsetzen, die andere Variable freistellen. */
function Rueckwaerts({ sys, v, wert, onFertig }: { sys: System; v: Var; wert: Q; onFertig: (x: Q, y: Q) => void }) {
  const g = einsetzen(sys.g1, v, T(0, 0, wert));
  const w = andere(v);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold">{v} = {qDeutsch(wert)} in I einsetzen: <GleichungSatz text={einsetzText(sys.g1, v, T(0, 0, wert))} /></p>
      <Umformer start={g} ziel={w} titel={`Nach ${w} auflösen`}
        onFertig={e => (v === "x" ? onFertig(wert, wertVon(e)) : onFertig(wertVon(e), wert))} />
    </div>
  );
}

// ── Additionsverfahren ───────────────────────────────────────────────

export function Addition({ sys }: { sys: System }) {
  const [v, setV] = useState<Var>("x");
  const [f, setF] = useState<[string, string]>(["", ""]);
  const [phase, setPhase] = useState(0);
  const [wert1, setWert1] = useState<Q | null>(null);
  const [loesung, setLoesung] = useState<{ x: Q; y: Q } | null>(null);
  useEffect(() => { setPhase(0); setF(["", ""]); setWert1(null); setLoesung(null); }, [sys, v]);
  useEffect(() => { if (phase === 2) { const t = setTimeout(() => setPhase(3), 900); return () => clearTimeout(t); } }, [phase]);

  const f1 = Number(f[0].replace("−", "-")), f2 = Number(f[1].replace("−", "-"));
  const gueltig = Number.isInteger(f1) && Number.isInteger(f2) && f1 !== 0 && f2 !== 0;
  const n1 = normal(sys.g1), n2 = normal(sys.g2);
  const summe = gueltig ? addiere(sys.g1, f1, sys.g2, f2) : null;
  const faellt = summe && summe[v === "x" ? "a" : "b"].z === 0;
  const rest = andere(v);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Welche Variable soll wegfallen?</span>
        {(["x", "y"] as Var[]).map(k => <button key={k} className={`chip text-base ${v === k ? "chip-on" : ""}`} style={{ color: VFARBE[k] }} onClick={() => setV(k)}>{k}</button>)}
      </div>
      <div className="relative flex flex-col gap-2 py-1">
        {phase === 0 ? <>
          <KachelZeile n={n1} name="I" />
          <KachelZeile n={n2} name="II" />
        </> : <>
          <KachelZeile n={malNormal(n1, f1)} name={`${f1}·I`} />
          <KachelZeile n={malNormal(n2, f2)} name={`${f2}·II`} stil={phase >= 2 ? { transform: "translateY(-3.25rem)", opacity: phase >= 3 ? 0 : 0.85 } : undefined} />
          {phase >= 3 && summe && <div className="border-t-4 border-fg pt-2"><KachelZeile n={summe} name="Summe" /></div>}
        </>}
      </div>

      {phase === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">I mal</span><input className="input w-16" value={f[0]} onChange={e => setF([e.target.value, f[1]])} aria-label="Faktor I" />
          <span className="text-sm">II mal</span><input className="input w-16" value={f[1]} onChange={e => setF([f[0], e.target.value])} aria-label="Faktor II" />
          <button className="btn-secondary" onClick={() => { const k = additionsFaktoren(sys.g1, sys.g2, v); if (k) setF([String(k[0]), String(k[1])]); }}>💡 Tipp</button>
          <button className="btn-primary" disabled={!gueltig} onClick={() => setPhase(1)}>Multiplizieren</button>
          <span className="text-xs text-muted w-full">Ziel: Die {v}-Kacheln sollen gleich groß, aber mit verschiedenem Vorzeichen sein — dann heben sie sich beim Addieren auf.</span>
        </div>
      )}
      {phase === 1 && (
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => setPhase(2)}>⬆ Addieren</button>
          <button className="btn-secondary" onClick={() => setPhase(0)}>↶ Faktoren ändern</button>
        </div>
      )}
      {phase >= 3 && summe && !faellt && (
        <div className="flex gap-2 items-center">
          <p className="text-sm text-bad font-bold">{v} fällt nicht weg — die {v}-Kacheln waren nicht entgegengesetzt gleich.</p>
          <button className="btn-secondary" onClick={() => setPhase(0)}>↶ Andere Faktoren</button>
        </div>
      )}
      {phase >= 3 && summe && faellt && (
        summe[rest === "x" ? "a" : "b"].z === 0
          ? <p className="font-bold">Beide Variablen fallen weg: {summe.c.z === 0 ? "0 = 0 ist immer wahr — unendlich viele Lösungen." : "0 = " + qDeutsch(summe.c) + " ist falsch — keine Lösung."}</p>
          : <>
              <p className="text-sm font-bold text-ok">✔ {v} ist weg — übrig bleibt eine Gleichung mit nur {rest}.</p>
              <Umformer start={ausNormal(summe)} ziel={rest} titel={`Nach ${rest} auflösen`} onFertig={e => setWert1(wertVon(e))} />
              {wert1 && <Rueckwaerts sys={sys} v={rest} wert={wert1} onFertig={(x, y) => setLoesung({ x, y })} />}
              {loesung && <Ergebnis sys={sys} x={loesung.x} y={loesung.y} />}
            </>
      )}
    </div>
  );
}

// ── Gleichsetzungsverfahren ──────────────────────────────────────────

export function Gleichsetzung({ sys }: { sys: System }) {
  const [v, setV] = useState<Var>("y");
  const [frei, setFrei] = useState<[Gleichung | null, Gleichung | null]>([null, null]);
  const [gesetzt, setGesetzt] = useState(false);
  const [wert1, setWert1] = useState<Q | null>(null);
  const [loesung, setLoesung] = useState<{ x: Q; y: Q } | null>(null);
  useEffect(() => { setFrei([null, null]); setGesetzt(false); setWert1(null); setLoesung(null); }, [sys, v]);
  const rest = andere(v);
  const beide = frei[0] && frei[1];
  const gleich: Gleichung | null = beide ? { l: frei[0]!.r, r: frei[1]!.r } : null;
  const moeglich = stelleFrei(sys.g1, v) && stelleFrei(sys.g2, v);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Beide Gleichungen freistellen nach</span>
        {(["y", "x"] as Var[]).map(k => <button key={k} className={`chip text-base ${v === k ? "chip-on" : ""}`} style={{ color: VFARBE[k] }} onClick={() => setV(k)}>{k}</button>)}
      </div>
      {!moeglich ? <p className="text-sm text-bad">In einer Gleichung kommt {v} nicht vor — nimm die andere Variable.</p> : <>
        <div className="grid gap-3 md:grid-cols-2">
          <Umformer key={`a${v}${gleichungText(sys.g1)}`} start={sys.g1} ziel={v} titel="I freistellen" onFertig={g => setFrei(f => [g, f[1]])} />
          <Umformer key={`b${v}${gleichungText(sys.g2)}`} start={sys.g2} ziel={v} titel="II freistellen" onFertig={g => setFrei(f => [f[0], g])} />
        </div>
        {beide && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3 text-xl font-mono font-bold">
              <span className="transition-transform duration-700" style={{ transform: gesetzt ? "translateX(1rem)" : undefined }}><GleichungSatz text={gleichungText(frei[0]!)} /></span>
              <span className="text-muted">und</span>
              <span className="transition-transform duration-700" style={{ transform: gesetzt ? "translateX(-1rem)" : undefined }}><GleichungSatz text={gleichungText(frei[1]!)} /></span>
            </div>
            <p className="text-sm">Beide rechten Seiten sind gleich {v} — also sind sie auch einander gleich.</p>
            {!gesetzt ? <button className="btn-primary self-start" onClick={() => setGesetzt(true)}>= Gleichsetzen</button>
              : <>
                  <p className="font-bold">Gleichgesetzt: <GleichungSatz g={gleich!} /></p>
                  <Umformer start={gleich!} ziel={rest} titel={`Nach ${rest} auflösen`} onFertig={e => setWert1(wertVon(e))} />
                  {wert1 && <Rueckwaerts sys={sys} v={rest} wert={wert1} onFertig={(x, y) => setLoesung({ x, y })} />}
                  {loesung && <Ergebnis sys={sys} x={loesung.x} y={loesung.y} />}
                </>}
          </div>
        )}
      </>}
    </div>
  );
}

// ── Einsetzungsverfahren ─────────────────────────────────────────────

export function Einsetzung({ sys }: { sys: System }) {
  const [v, setV] = useState<Var>("y");
  const [frei, setFrei] = useState<Gleichung | null>(null);
  const [gegriffen, setGegriffen] = useState(false);
  const [eingesetzt, setEingesetzt] = useState(false);
  const [ausmult, setAusmult] = useState(false);
  const [wert1, setWert1] = useState<Q | null>(null);
  const [loesung, setLoesung] = useState<{ x: Q; y: Q } | null>(null);
  const [ueber, setUeber] = useState(false);
  useEffect(() => { setFrei(null); setGegriffen(false); setEingesetzt(false); setAusmult(false); setWert1(null); setLoesung(null); }, [sys, v]);
  const rest = andere(v);
  const term: Term | null = frei ? frei.r : null;
  const nachher = term ? einsetzen(sys.g2, v, term) : null;
  const ablegen = (e?: DragEvent) => { e?.preventDefault(); setUeber(false); if (term) { setEingesetzt(true); setGegriffen(false); } };

  /** II mit der Variablen v als Ablagefeld */
  const zweite = () => {
    const teile = gleichungText(sys.g2).split(new RegExp(`(\\d*/?\\d*${v})`));
    return teile.map((t, i) => t.endsWith(v) ? (
      <span key={i} onDragOver={e => { e.preventDefault(); setUeber(true); }} onDragLeave={() => setUeber(false)} onDrop={ablegen}
        onClick={() => gegriffen && ablegen()} role="button" aria-label={`Ablagefeld ${v}`}
        className={`inline-block rounded-lg px-1 border-2 border-dashed transition-colors ${ueber || gegriffen ? "bg-accent/20 border-accent animate-pulse" : "border-transparent"}`}
        style={{ color: VFARBE[v] }}>{t}</span>
    ) : <span key={i}>{t}</span>);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>I nach dieser Variablen freistellen:</span>
        {(["y", "x"] as Var[]).map(k => <button key={k} className={`chip text-base ${v === k ? "chip-on" : ""}`} style={{ color: VFARBE[k] }} onClick={() => setV(k)}>{k}</button>)}
      </div>
      {!stelleFrei(sys.g1, v) ? <p className="text-sm text-bad">In I kommt {v} nicht vor — nimm die andere Variable.</p> : <>
        <Umformer key={`${v}${gleichungText(sys.g1)}`} start={sys.g1} ziel={v} titel="1. I freistellen" onFertig={setFrei} />
        {frei && term && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">2. Den Term für {v} in II einsetzen — ziehen (oder antippen und dann auf {v} tippen):</p>
            <div className="flex flex-wrap items-center gap-4">
              {!eingesetzt && (
                <span draggable onDragStart={e => { e.dataTransfer.setData("text/plain", "term"); setGegriffen(true); }} onDragEnd={() => setGegriffen(false)}
                  onClick={() => setGegriffen(g => !g)} role="button" aria-label="Term zum Einsetzen" aria-pressed={gegriffen}
                  className={`cursor-grab rounded-xl border-2 px-3 py-2 font-mono font-black text-lg shadow ${gegriffen ? "ring-4 ring-accent" : ""}`}
                  style={{ borderColor: VFARBE[v], background: VFARBE[v] + "1f" }}>
                  ({<GleichungSatz text={gleichungText({ l: T(0, 0, 0), r: term }).replace(/^0 = /, "")} />})
                </span>
              )}
              <span className="text-xl font-mono font-bold">II: {eingesetzt ? <GleichungSatz text={einsetzText(sys.g2, v, term)} /> : zweite()}</span>
            </div>
            {eingesetzt && !ausmult && <button className="btn-primary self-start" onClick={() => setAusmult(true)}>Klammer auflösen und zusammenfassen</button>}
            {ausmult && nachher && (
              <>
                <p className="font-bold">Zusammengefasst: <GleichungSatz g={nachher} /></p>
                <Umformer start={nachher} ziel={rest} titel={`3. Nach ${rest} auflösen`} onFertig={e => setWert1(wertVon(e))} />
                {wert1 && (() => {
                  const w = einsetzen(frei, rest, T(0, 0, wert1)).r.k;
                  const x = rest === "x" ? wert1 : w, y = rest === "x" ? w : wert1;
                  return (
                    <>
                      <p className="text-sm font-bold">4. {rest} = {qDeutsch(wert1)} in <GleichungSatz g={frei} /> einsetzen: {v} = {qDeutsch(w)}</p>
                      {!loesung ? <button className="btn-primary self-start" onClick={() => setLoesung({ x, y })}>Lösung zeigen</button> : <Ergebnis sys={sys} x={loesung.x} y={loesung.y} />}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </>}
    </div>
  );
}
