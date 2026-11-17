"use client";
/**
 * Fünf Spiele: Kenngrößen-Blitz, Welches Diagramm passt?, Schätzen gegen
 * die Simulation, Baum-Puzzle, Vierfelder-Sprint. Bestwerte und Runden
 * gehen in den Erfolgsstand (lib/stochastik/erfolge.ts).
 */
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { blitzRunde, diagrammRunde, schaetzRunde, schaetzPunkte, baumRunde, astWert, pfadWert, tafelRunde, SPIELE, DIA_NAME,
  type BlitzRunde, type DiaRunde, type SchaetzRunde, type BaumRunde, type TafelRunde, type SpielId, type AstId, type DiaTyp } from "@/lib/stochastik/spiele";
import { simuliere } from "@/lib/stochastik/zufall";
import { voll, type FeldName } from "@/lib/stochastik/vierfelder";
import { leseAnteil, prozent, wert, zahl } from "@/lib/stochastik/zahlen";
import { leseZahl } from "@/lib/quadratisch";
import { lade } from "@/lib/stochastik/erfolge";
import { GeraetBild } from "./Geraete";
import { TafelAnsicht } from "./diagramme";
import { Navi, useMelden } from "./ui";

/** Uhr für ein Spiel auf Zeit. */
function useUhr(sekunden: number, laeuft: boolean, ende: () => void) {
  const [rest, setRest] = useState(sekunden);
  const strafeRef = useRef<(s: number) => void>(() => {});
  const endeRef = useRef(ende);
  endeRef.current = ende;
  useEffect(() => {
    if (!laeuft) return;
    setRest(sekunden);
    const t0 = Date.now();
    let abzug = 0;
    const id = setInterval(() => {
      const r = sekunden - Math.floor((Date.now() - t0) / 1000) - abzug;
      setRest(r);
      if (r <= 0) { clearInterval(id); endeRef.current(); }
    }, 200);
    strafeRef.current = (s: number) => { abzug += s; };
    return () => clearInterval(id);
  }, [laeuft, sekunden]);
  return { rest: Math.max(0, rest), strafe: (s: number) => strafeRef.current(s) };
}

function Rahmen({ titel, rest, punkte, best, children }: { titel: string; rest?: number; punkte: ReactNode; best: number; children: ReactNode }) {
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-black flex-1">{titel}</h3>
        {rest !== undefined && <span className={`rounded-full px-3 py-1 font-black tabular-nums ${rest <= 10 ? "bg-bad text-white" : "bg-surface-hover"}`}>⏱ {rest} s</span>}
        <span className="rounded-full bg-accent text-accent-fg px-3 py-1 font-black tabular-nums">{punkte}</span>
        <span className="text-xs text-muted">Bestwert {best}</span>
      </div>
      {children}
    </div>
  );
}

function useSpielstand(id: SpielId) {
  const melden = useMelden();
  const [best, setBest] = useState(0);
  useEffect(() => setBest(lade().best[id] ?? 0), [id]);
  const fertig = (wertung: number) => {
    setBest(b => Math.max(b, wertung));
    melden(s => ({ ...s, best: { ...s.best, [id]: Math.max(s.best[id] ?? 0, wertung) }, runden: { ...s.runden, [id]: (s.runden[id] ?? 0) + 1 } }));
  };
  return { best, fertig };
}

function Start({ text, los }: { text: ReactNode; los: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="max-w-lg text-sm">{text}</p>
      <button className="btn btn-primary text-lg px-6" onClick={los}>▶ Los geht&apos;s</button>
    </div>
  );
}

// ── Kenngrößen-Blitz ─────────────────────────────────────────────────────

function Blitz() {
  const { best, fertig } = useSpielstand("blitz");
  const [phase, setPhase] = useState<"start" | "laeuft" | "ende">("start");
  const [r, setR] = useState<BlitzRunde | null>(null);
  const [punkte, setPunkte] = useState(0);
  const [serie, setSerie] = useState(0);
  const [rueck, setRueck] = useState<{ ok: boolean; text: string } | null>(null);
  const stand = useRef(0);
  const uhr = useUhr(60, phase === "laeuft", () => { setPhase("ende"); fertig(stand.current); });
  const antwort = (i: number) => {
    if (!r) return;
    const ok = i === r.richtig;
    const plus = ok ? 10 + Math.min(serie, 10) : -5;
    stand.current = Math.max(0, stand.current + plus);
    setPunkte(stand.current); setSerie(s => (ok ? s + 1 : 0));
    if (!ok) uhr.strafe(3);
    setRueck({ ok, text: ok ? `+${plus}` : `✘ ${r.erklaerung}` });
    setR(blitzRunde(Math.random));
  };
  return (
    <Rahmen titel="⚡ Kenngrößen-Blitz" rest={phase === "laeuft" ? uhr.rest : undefined} punkte={`${punkte} Punkte`} best={best}>
      {phase === "start" && <Start text="60 Sekunden. Zu jeder kleinen Datenreihe wird eine Kenngröße gefragt – klick die richtige Zahl. Richtig: 10 Punkte plus Serienbonus. Falsch: −5 Punkte und −3 Sekunden." los={() => { stand.current = 0; setPunkte(0); setSerie(0); setRueck(null); setR(blitzRunde(Math.random)); setPhase("laeuft"); }} />}
      {phase === "laeuft" && r && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap gap-2 justify-center">{r.werte.map((w, i) => <span key={i} className="rounded-xl bg-surface-hover px-3 py-2 text-2xl font-black tabular-nums">{w}</span>)}</div>
          <p className="text-2xl font-black">{r.frage}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-xl">
            {r.optionen.map((o, i) => <button key={i} className="btn text-xl py-3 justify-center" onClick={() => antwort(i)}>{o}</button>)}
          </div>
          {rueck && <p className={`text-sm font-bold ${rueck.ok ? "text-ok" : "text-bad"}`}>{rueck.text}</p>}
          <p className="text-xs text-muted">Serie {serie}</p>
        </div>
      )}
      {phase === "ende" && <Start text={<><b className="text-2xl">{punkte} Punkte</b><br />{punkte >= best ? "Neuer Bestwert!" : `Bestwert: ${best}`}</>} los={() => setPhase("start")} />}
    </Rahmen>
  );
}

// ── Welches Diagramm passt? ──────────────────────────────────────────────

const DIA_ICON: Record<DiaTyp, string> = { saeulen: "📊", balken: "📶", kreis: "🥧", linie: "📈", piktogramm: "🙂", boxplot: "📦" };

function DiagrammSpiel() {
  const { niveau } = useContext(Navi);
  const { best, fertig } = useSpielstand("diagramm");
  const [phase, setPhase] = useState<"start" | "laeuft" | "ende">("start");
  const [r, setR] = useState<DiaRunde | null>(null);
  const [richtig, setRichtig] = useState(0);
  const [rueck, setRueck] = useState<string | null>(null);
  const stand = useRef(0);
  const neu = () => setR(diagrammRunde(Math.random, niveau === "H"));
  const uhr = useUhr(60, phase === "laeuft", () => { setPhase("ende"); fertig(stand.current); });
  const antwort = (i: number) => {
    if (!r) return;
    if (i === r.richtig) { stand.current++; setRichtig(stand.current); setRueck(`✔ ${DIA_NAME[r.optionen[i]]}: ${r.warum}`); }
    else { uhr.strafe(5); setRueck(`✘ Besser: ${DIA_NAME[r.optionen[r.richtig]]} – ${r.warum} (−5 s)`); }
    neu();
  };
  return (
    <Rahmen titel="🖼️ Welches Diagramm passt?" rest={phase === "laeuft" ? uhr.rest : undefined} punkte={`${richtig} richtig`} best={best}>
      {phase === "start" && <Start text="60 Sekunden: Zu jeder Situation das passende Diagramm wählen. Ein Fehler kostet 5 Sekunden." los={() => { stand.current = 0; setRichtig(0); setRueck(null); neu(); setPhase("laeuft"); }} />}
      {phase === "laeuft" && r && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-xl font-black text-center max-w-2xl">{r.t}</p>
          <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
            {r.optionen.map((o, i) => <button key={o} className="btn py-4 flex-col justify-center" onClick={() => antwort(i)}><span className="text-3xl">{DIA_ICON[o]}</span>{DIA_NAME[o]}</button>)}
          </div>
          {rueck && <p className={`text-sm font-bold ${rueck.startsWith("✔") ? "text-ok" : "text-bad"}`}>{rueck}</p>}
        </div>
      )}
      {phase === "ende" && <Start text={<><b className="text-2xl">{richtig} richtig</b><br />{richtig >= best ? "Neuer Bestwert!" : `Bestwert: ${best}`}</>} los={() => setPhase("start")} />}
    </Rahmen>
  );
}

// ── Schätzen gegen die Simulation ────────────────────────────────────────

const RUNDEN = 5;

function Schaetzen() {
  const { best, fertig } = useSpielstand("schaetzen");
  const [nr, setNr] = useState(0);
  const [r, setR] = useState<SchaetzRunde | null>(null);
  const [tipp, setTipp] = useState(50);
  const [sim, setSim] = useState<{ n: number; t: number } | null>(null);
  const [aufgedeckt, setAufgedeckt] = useState(false);
  const [summe, setSumme] = useState(0);
  const [letzte, setLetzte] = useState<string[]>([]);
  useEffect(() => { setR(schaetzRunde(Math.random)); }, []);
  useEffect(() => {
    if (!r || !sim || aufgedeckt || sim.n >= 1000) return;
    const id = setTimeout(() => {
      const neu = simuliere(r.experiment, r.stufen, 50, Math.random);
      setLetzte(neu[neu.length - 1]);
      setSim(s => s && ({ n: s.n + 50, t: s.t + neu.filter(r.treffer).length }));
    }, 40);
    return () => clearTimeout(id);
  }, [sim, r, aufgedeckt]);
  if (!r) return null;
  const p = wert(r.p);
  const fertigSim = sim && sim.n >= 1000;
  const aufdecken = () => {
    setAufgedeckt(true);
    const pkt = schaetzPunkte(tipp / 100, p);
    const s = summe + pkt;
    setSumme(s);
    if (nr + 1 >= RUNDEN) fertig(s);
  };
  const weiter = () => {
    if (nr + 1 >= RUNDEN) { setNr(0); setSumme(0); } else setNr(n => n + 1);
    setR(schaetzRunde(Math.random)); setSim(null); setAufgedeckt(false); setTipp(50); setLetzte([]);
  };
  return (
    <Rahmen titel="🎯 Schätzen gegen die Simulation" punkte={`${summe} / ${RUNDEN * 100}`} best={best}>
      <p className="text-sm text-muted">Runde {nr + 1} von {RUNDEN}. Schätze die Wahrscheinlichkeit, dann lass den Computer 1 000-mal spielen. Punkte gibt es für deine Schätzung (100 bei Volltreffer).</p>
      <div className="grid md:grid-cols-2 gap-4 items-center">
        <div className="flex flex-col items-center gap-2">
          <p className="text-xl font-black text-center">{r.text}</p>
          <div className="flex gap-2 min-h-20 items-center">{(letzte.length ? letzte : [undefined]).map((x, i) => <GeraetBild key={i} e={r.experiment} ergebnis={x} bisher={letzte.slice(0, i)} />)}</div>
        </div>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm">Deine Schätzung: <b className="text-2xl">{tipp} %</b></span>
            <input type="range" min={0} max={100} value={tipp} disabled={!!sim} onChange={e => setTipp(Number(e.target.value))} />
          </label>
          {!sim && <button className="btn btn-primary" onClick={() => setSim({ n: 0, t: 0 })}>🎲 Simulation starten</button>}
          {sim && (
            <div className="flex flex-col gap-1">
              <div className="h-3 rounded-full bg-surface-hover overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 bg-accent transition-all" style={{ width: `${(sim.n / 1000) * 100}%` }} />
              </div>
              <p className="text-sm">Simulation: {sim.n} Versuche, Treffer {sim.t} → <b>{sim.n ? prozent(sim.t / sim.n) : "–"}</b></p>
            </div>
          )}
          {fertigSim && !aufgedeckt && <button className="btn btn-primary" onClick={aufdecken}>🔓 Aufdecken</button>}
          {aufgedeckt && (
            <div className="rounded-xl bg-surface-hover p-3 text-sm flex flex-col gap-1">
              <p>Wahrscheinlichkeit: <b>{prozent(p)}</b> · du: {tipp} % · Simulation: {prozent(sim!.t / sim!.n)}</p>
              <p className="font-black">+{schaetzPunkte(tipp / 100, p)} Punkte {Math.abs(tipp / 100 - p) < Math.abs(sim!.t / sim!.n - p) ? "– besser als die Simulation! 🏆" : ""}</p>
              <button className="btn self-start" onClick={weiter}>{nr + 1 >= RUNDEN ? `Fertig: ${summe} Punkte – neue Runde` : "➡ Nächste"}</button>
            </div>
          )}
        </div>
      </div>
    </Rahmen>
  );
}

// ── Baum-Puzzle ──────────────────────────────────────────────────────────

const ASTPOS: Record<AstId, { x: number; y: number }> = {
  A: { x: 22, y: 32 }, nA: { x: 22, y: 68 }, "B|A": { x: 62, y: 15 }, "nB|A": { x: 62, y: 36 }, "B|nA": { x: 62, y: 64 }, "nB|nA": { x: 62, y: 85 },
};

function BaumSpiel() {
  const { best, fertig } = useSpielstand("baum");
  const [phase, setPhase] = useState<"start" | "laeuft" | "ende">("start");
  const [r, setR] = useState<BaumRunde | null>(null);
  const [ein, setEin] = useState<Record<string, string>>({});
  const [falsch, setFalsch] = useState<string[]>([]);
  const [geloest, setGeloest] = useState(0);
  const stand = useRef(0);
  const uhr = useUhr(120, phase === "laeuft", () => { setPhase("ende"); fertig(stand.current); });
  const neu = () => { setR(baumRunde(Math.random)); setEin({}); setFalsch([]); };
  const pfadName = r ? `${r.pfad[0] ? "A" : "Ā"} → ${r.pfad[1] ? "B" : "B̄"}` : "";
  const pruefen = () => {
    if (!r) return;
    const f: string[] = [];
    for (const l of r.luecken) { const x = leseAnteil(ein[l] ?? ""); if (x === null || Math.abs(x - astWert(r, l)) > 0.001) f.push(l); }
    const x = leseAnteil(ein.pfad ?? "");
    if (x === null || Math.abs(x - pfadWert(r)) > 0.001) f.push("pfad");
    setFalsch(f);
    if (!f.length) { stand.current++; setGeloest(stand.current); neu(); } else uhr.strafe(5);
  };
  return (
    <Rahmen titel="🌳 Baum-Puzzle" rest={phase === "laeuft" ? uhr.rest : undefined} punkte={`${geloest} gelöst`} best={best}>
      {phase === "start" && <Start text="2 Minuten: Ergänze die fehlenden Äste (alle Äste an einem Punkt ergeben 1) und berechne die Pfadwahrscheinlichkeit (Äste multiplizieren). Antwort als Dezimalzahl, Bruch oder Prozent. Ein Fehler kostet 5 Sekunden." los={() => { stand.current = 0; setGeloest(0); neu(); setPhase("laeuft"); }} />}
      {phase === "laeuft" && r && (
        <div className="flex flex-col gap-3 items-center">
          <div className="relative w-full max-w-xl" style={{ aspectRatio: "2 / 1" }}>
            <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              {[[4, 25, 40, 13.5], [4, 25, 40, 36.5], [44, 13.5, 80, 6.5], [44, 13.5, 80, 19], [44, 36.5, 80, 31], [44, 36.5, 80, 43.5]].map(([a, b, c, d], i) => (
                <line key={i} x1={a} y1={b} x2={c} y2={d} style={{ stroke: "var(--text-muted)" }} strokeWidth={0.5} />
              ))}
            </svg>
            {[["A", 42, 27], ["Ā", 42, 73], ["B", 82, 13], ["B̄", 82, 38], ["B", 82, 62], ["B̄", 82, 87]].map(([t, x, y], i) => (
              <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full w-8 h-8 flex items-center justify-center font-black text-white text-sm"
                style={{ left: `${x}%`, top: `${y}%`, background: String(t).startsWith("A") || String(t).startsWith("Ā") ? "#3b82f6" : "#22c55e" }}>{t}</span>
            ))}
            {(Object.keys(ASTPOS) as AstId[]).map(a => {
              const p = ASTPOS[a];
              const offen = r.luecken.includes(a);
              return (
                <span key={a} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                  {offen
                    ? <input className={`input w-16 text-center text-sm py-0.5 ${falsch.includes(a) ? "border-bad" : ""}`} value={ein[a] ?? ""} aria-label={`Ast ${a}`} placeholder="?"
                        onChange={e => setEin(x => ({ ...x, [a]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") pruefen(); }} />
                    : <span className="rounded-md bg-surface border border-line px-1.5 py-0.5 text-sm font-bold">{zahl(astWert(r, a), 2)}</span>}
                </span>
              );
            })}
          </div>
          <label className="flex items-center gap-2">
            <span>P({pfadName}) =</span>
            <input className={`input w-24 ${falsch.includes("pfad") ? "border-bad" : ""}`} value={ein.pfad ?? ""} aria-label="Pfadwahrscheinlichkeit"
              onChange={e => setEin(x => ({ ...x, pfad: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") pruefen(); }} />
          </label>
          <button className="btn btn-primary" onClick={pruefen}>✔ Prüfen</button>
          {falsch.length > 0 && <p className="text-bad text-sm font-bold">Rot markiert stimmt noch nicht.</p>}
        </div>
      )}
      {phase === "ende" && <Start text={<><b className="text-2xl">{geloest} Bäume</b><br />{geloest >= best ? "Neuer Bestwert!" : `Bestwert: ${best}`}</>} los={() => setPhase("start")} />}
    </Rahmen>
  );
}

// ── Vierfelder-Sprint ────────────────────────────────────────────────────

function TafelSpiel() {
  const { niveau } = useContext(Navi);
  const { best, fertig } = useSpielstand("vierfelder");
  const [phase, setPhase] = useState<"start" | "laeuft" | "ende">("start");
  const [r, setR] = useState<TafelRunde | null>(null);
  const [nr, setNr] = useState(0);
  const [ein, setEin] = useState<Record<string, string>>({});
  const [falsch, setFalsch] = useState<string[]>([]);
  const [geloest, setGeloest] = useState(0);
  const stand = useRef(0);
  const prozentRunde = niveau === "G" && nr % 2 === 1;
  const uhr = useUhr(120, phase === "laeuft", () => { setPhase("ende"); fertig(stand.current); });
  const neu = (n: number) => { setR(tafelRunde(Math.random, niveau === "G" && n % 2 === 1)); setEin({}); setFalsch([]); setNr(n); };
  const pruefen = () => {
    if (!r) return;
    const v = voll(r.tafel);
    const f = (Object.keys(v) as FeldName[]).filter(k => !r.bekannt.includes(k)).filter(k => { const x = leseZahl((ein[k] ?? "").replace("%", "")); return x === null || Math.abs(x - v[k]) > 0.01; });
    setFalsch(f);
    if (!f.length) { stand.current++; setGeloest(stand.current); neu(nr + 1); } else uhr.strafe(5);
  };
  return (
    <Rahmen titel="▦ Vierfelder-Sprint" rest={phase === "laeuft" ? uhr.rest : undefined} punkte={`${geloest} Tafeln`} best={best}>
      {phase === "start" && <Start text={`2 Minuten: Vier Felder sind bekannt, die anderen fünf rechnest du aus – jede Zeile und Spalte ergibt ihre Summe.${niveau === "G" ? " Jede zweite Tafel in Prozent." : ""} Ein Fehler kostet 5 Sekunden.`} los={() => { stand.current = 0; setGeloest(0); neu(0); setPhase("laeuft"); }} />}
      {phase === "laeuft" && r && (
        <div className="flex flex-col gap-3 items-center">
          {prozentRunde && <p className="text-sm text-muted">Angaben in Prozent – die Summe unten rechts ist 100.</p>}
          <TafelAnsicht tafel={r.tafel} a="A" b="B" nA="Ā" nB="B̄" zeigen={r.bekannt}
            eingabe={k => <input className={`input w-20 text-center ${falsch.includes(k) ? "border-bad" : ""}`} value={ein[k] ?? ""} aria-label={k}
              onChange={e => setEin(x => ({ ...x, [k]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") pruefen(); }} />} />
          <button className="btn btn-primary" onClick={pruefen}>✔ Prüfen</button>
        </div>
      )}
      {phase === "ende" && <Start text={<><b className="text-2xl">{geloest} Tafeln</b><br />{geloest >= best ? "Neuer Bestwert!" : `Bestwert: ${best}`}</>} los={() => setPhase("start")} />}
    </Rahmen>
  );
}

// ── Auswahl ──────────────────────────────────────────────────────────────

const KOMPONENTE: Record<SpielId, () => ReactNode> = {
  blitz: () => <Blitz />, diagramm: () => <DiagrammSpiel />, schaetzen: () => <Schaetzen />, baum: () => <BaumSpiel />, vierfelder: () => <TafelSpiel />,
};

export default function Spiele() {
  const [spiel, setSpiel] = useState<SpielId>("blitz");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {SPIELE.map(s => (
          <button key={s.id} onClick={() => setSpiel(s.id)}
            className={`card p-3 text-left flex flex-col gap-1 transition-all hover:border-line-active ${spiel === s.id ? "border-line-active ring-2 ring-accent" : ""}`}>
            <span className="text-3xl">{s.icon}</span>
            <b>{s.name}</b>
            <span className="text-xs text-muted">{s.text}</span>
            <span className="text-[11px] font-bold text-muted">{s.stufe}</span>
          </button>
        ))}
      </div>
      <div key={spiel}>{KOMPONENTE[spiel]()}</div>
    </div>
  );
}
