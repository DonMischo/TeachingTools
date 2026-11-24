"use client";
/**
 * Rechnen mit Brüchen: zwei Brüche, eine Grundrechenart, der Rechenweg Schritt
 * für Schritt mit Bild (Streifen beim Addieren/Subtrahieren, Flächenmodell beim
 * Multiplizieren, »wie oft passt es hinein« beim Dividieren). Darunter die Regeln
 * und ein Übungsfeld mit gewürfelten Aufgaben.
 */
import { useMemo, useState } from "react";
import { bt, erweitere, gleich, kgv, kreuzWeg, kuerze, leseBruch, OPS, rechne, rechenAufgabe, REGELN, wert, type Bruch, type Op } from "@/lib/brueche";
import { BruchBild, BruchSatz, Rechenzeile } from "./bild";

const OP_NAME: Record<Op, string> = { "+": "plus", "−": "minus", "·": "mal", ":": "geteilt durch" };

function Flaechenmodell({ a, b }: { a: Bruch; b: Bruch }) {
  const W = 240, H = 240, w = W / a.n, h = H / b.n;
  const zellen = [];
  for (let i = 0; i < a.n; i++) for (let j = 0; j < b.n; j++) {
    const inA = i < a.z, inB = j < b.z;
    zellen.push(<rect key={`${i}-${j}`} x={i * w} y={j * h} width={w} height={h}
      fill={inA && inB ? "#7c3aed" : inA ? "#c4b5fd" : inB ? "#fde68a" : "transparent"} stroke="var(--color-line)" />);
  }
  return (
    <svg viewBox={`-30 -24 ${W + 40} ${H + 34}`} className="w-60 max-w-full" role="img" aria-label="Flächenmodell">
      {zellen}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke="var(--color-fg)" strokeWidth={3} />
      <text x={(a.z * w) / 2} y={-8} textAnchor="middle" fontSize={14} fontWeight={800} fill="#7c3aed">{bt(a)}</text>
      <text x={-8} y={(b.z * h) / 2} textAnchor="end" fontSize={14} fontWeight={800} fill="#b45309" dominantBaseline="middle">{bt(b)}</text>
    </svg>
  );
}

function Bild({ a, op, b }: { a: Bruch; op: Op; b: Bruch }) {
  if (a.z < 0 || b.z < 0 || a.z > 3 * a.n || b.z > 3 * b.n) return null;
  if (op === "+" || op === "−") {
    const hn = kgv(a.n, b.n);
    const ea = erweitere(a, hn / a.n), eb = erweitere(b, hn / b.n);
    const e = op === "+" ? ea.z + eb.z : ea.z - eb.z;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2"><span className="w-16 text-sm font-bold">{bt(a)}</span><BruchBild form="band" n={a.n} z={a.z} k={hn / a.n} breite="9rem" /></div>
        <div className="flex items-center gap-2"><span className="w-16 text-sm font-bold">{op} {bt(b)}</span><BruchBild form="band" n={b.n} z={b.z} k={hn / b.n} breite="9rem" /></div>
        {e >= 0 && <div className="flex items-center gap-2"><span className="w-16 text-sm font-bold">= {bt({ z: e, n: hn })}</span><BruchBild form="band" n={hn} z={e} breite="9rem" /></div>}
      </div>
    );
  }
  if (op === "·") {
    if (a.z > a.n || b.z > b.n) return <p className="text-sm text-muted">Das Flächenmodell zeigt echte Brüche (kleiner als 1).</p>;
    return (
      <div className="flex flex-wrap items-center gap-4">
        <Flaechenmodell a={a} b={b} />
        <p className="text-sm max-w-xs">{bt(a)} der Breite, {bt(b)} der Höhe: Das dunkle Feld besteht aus {a.z} · {b.z} = {a.z * b.z} von {a.n} · {b.n} = {a.n * b.n} Kästchen. »{bt(a)} · {bt(b)}« heißt »{bt(a)} von {bt(b)}«.</p>
      </div>
    );
  }
  const q = wert(a) / wert(b);
  if (b.z === 0 || q > 8) return null;
  const hn = kgv(a.n, b.n);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Wie oft passt {bt(b)} in {bt(a)}? In {hn}-teln: {erweitere(a, hn / a.n).z} Stücke, je {erweitere(b, hn / b.n).z} pro Portion → {q.toLocaleString("de-DE", { maximumFractionDigits: 3 })}-mal.</p>
      <BruchBild form="band" n={hn} z={erweitere(a, hn / a.n).z} breite="12rem" />
    </div>
  );
}

export const DORFUCHS = "https://www.youtube.com/watch?v=VOMXhfWBXg0";

/**
 * Kreuzmethode (vedische Mathematik) für + und −: zwei Kreuzpfeile
 * (links oben · rechts unten, links unten · rechts oben), unten einfach mal.
 */
function Kreuzmethode({ a, op, b }: { a: Bruch; op: "+" | "−"; b: Bruch }) {
  const w = kreuzWeg(a, op, b);
  const [zeige, setZeige] = useState(0);
  const BLAU = "#2563eb", ROT = "#dc2626", GRUEN = "#16a34a";
  const z = (t: number | string, x: number, y: number, farbe = "var(--color-fg)") => <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={30} fontWeight={900} fill={farbe}>{t}</text>;
  return (
    <section className="rounded-xl border border-line p-3 flex flex-col gap-2">
      <h4 className="font-black">✖️ Kreuzmethode (vedische Mathematik)</h4>
      <div className="flex flex-wrap items-start gap-4">
        <svg viewBox="0 0 300 170" className="w-72 max-w-full" role="img" aria-label="Kreuzmethode">
          <defs>{[["b", BLAU], ["r", ROT], ["g", GRUEN]].map(([id, f]) => (
            <marker key={id} id={`kr-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={f} /></marker>
          ))}</defs>
          {z(Math.abs(a.z), 60, 45)}{z(a.n, 60, 125)}<line x1={35} y1={85} x2={85} y2={85} stroke="var(--color-fg)" strokeWidth={3} />
          {z(op, 150, 85)}
          {z(Math.abs(b.z), 240, 45)}{z(b.n, 240, 125)}<line x1={215} y1={85} x2={265} y2={85} stroke="var(--color-fg)" strokeWidth={3} />
          {zeige >= 1 && <line x1={82} y1={52} x2={218} y2={118} stroke={BLAU} strokeWidth={3} markerEnd="url(#kr-b)" />}
          {zeige >= 2 && <line x1={82} y1={118} x2={218} y2={52} stroke={ROT} strokeWidth={3} markerEnd="url(#kr-r)" />}
          {zeige >= 4 && <path d="M 60 150 Q 150 185 240 150" fill="none" stroke={GRUEN} strokeWidth={3} markerEnd="url(#kr-g)" />}
        </svg>
        <ol className="list-decimal pl-5 text-sm flex flex-col gap-1">
          {w.schritte.slice(0, zeige).map((t, i) => <li key={t} style={{ color: i === 0 ? BLAU : i === 1 ? ROT : i === 3 ? GRUEN : undefined }}><Rechenzeile text={t} /></li>)}
        </ol>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {zeige < w.schritte.length ? <button className="btn-primary" onClick={() => setZeige(zeige + 1)}>Nächster Schritt →</button>
          : <span className="font-black">Ergebnis: <BruchSatz z={w.ergebnis.z} n={w.ergebnis.n} /></span>}
        {zeige > 0 && <button className="btn-secondary" onClick={() => setZeige(0)}>Von vorn</button>}
        <a className="btn-secondary" href={DORFUCHS} target="_blank" rel="noopener noreferrer">🎵 Lied dazu: DorFuchs – Brüche addieren mit vedischer Mathematik</a>
      </div>
      <p className="text-xs text-muted">Geht immer, ohne Hauptnenner zu suchen. Weil »unten mal unten« meist nicht der kleinste gemeinsame Nenner ist, muss man am Ende oft noch kürzen.</p>
    </section>
  );
}

function Rechner() {
  const [ta, setTa] = useState("3/4");
  const [tb, setTb] = useState("1/6");
  const [op, setOp] = useState<Op>("+");
  const [zeige, setZeige] = useState(1);
  const a = leseBruch(ta), b = leseBruch(tb);
  const weg = useMemo(() => { try { return a && b ? rechne(a, op, b) : null; } catch { return null; } }, [a?.z, a?.n, b?.z, b?.n, op]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">🧮 Rechner mit Rechenweg</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-24 text-center text-lg font-bold" value={ta} onChange={e => { setTa(e.target.value); setZeige(1); }} aria-label="Erster Bruch" />
        <div className="flex gap-1">
          {OPS.map(o => <button key={o} className={`chip text-lg ${op === o ? "chip-on" : ""}`} onClick={() => { setOp(o); setZeige(1); }} aria-label={OP_NAME[o]}>{o}</button>)}
        </div>
        <input className="input w-24 text-center text-lg font-bold" value={tb} onChange={e => { setTb(e.target.value); setZeige(1); }} aria-label="Zweiter Bruch" />
        <span className="text-xs text-muted">z. B. 3/4, 2, 1 1/2</span>
      </div>
      {!weg ? <p className="text-sm text-bad">Bitte zwei Brüche eingeben (bei »:« darf der zweite nicht 0 sein).</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ol className="flex flex-col gap-2 list-decimal pl-5">
            {weg.schritte.slice(0, zeige).map(s => <li key={s}><Rechenzeile text={s} /></li>)}
            <li className="list-none -ml-5 flex gap-2">
              {zeige < weg.schritte.length
                ? <><button className="btn-primary" onClick={() => setZeige(zeige + 1)}>Nächster Schritt →</button>
                    <button className="btn-secondary" onClick={() => setZeige(weg.schritte.length)}>Alle</button></>
                : <span className="text-xl font-black">Ergebnis: <BruchSatz z={weg.ergebnis.z} n={weg.ergebnis.n} /></span>}
            </li>
          </ol>
          {a && b && <Bild a={a} op={op} b={b} />}
        </div>
      )}
      {weg && a && b && (op === "+" || op === "−") && <Kreuzmethode key={`${bt(a)}${op}${bt(b)}`} a={a} op={op} b={b} />}
    </section>
  );
}

function Ueben() {
  const [op, setOp] = useState<Op>("+");
  const [stufe, setStufe] = useState<1 | 2 | 3>(1);
  const [auf, setAuf] = useState(() => rechenAufgabe(Math.random, "+", 1));
  const [antwort, setAntwort] = useState("");
  const [rueck, setRueck] = useState<null | { ok: boolean; text: string }>(null);
  const [weg, setWeg] = useState(false);
  const [stand, setStand] = useState({ r: 0, g: 0 });
  const loesung = rechne(auf.a, op, auf.b);
  const neu = (o = op, s = stufe) => { setAuf(rechenAufgabe(Math.random, o, s)); setAntwort(""); setRueck(null); setWeg(false); };
  const pruefe = () => {
    const x = leseBruch(antwort);
    if (!x) { setRueck({ ok: false, text: "Als Bruch eingeben, z. B. 5/12 oder 1 1/2." }); return; }
    const ok = gleich(x, loesung.ergebnis);
    const gekuerzt = ok && kuerze(x).n === x.n;
    if (!rueck) setStand(s => ({ r: s.r + (ok ? 1 : 0), g: s.g + 1 }));
    setRueck({ ok, text: ok ? (gekuerzt ? "Richtig!" : `Richtig — aber noch kürzen: ${bt(kuerze(x))}.`) : "Noch nicht. Schau dir den Rechenweg an." });
  };
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">✍️ Üben</h3>
      <div className="flex flex-wrap gap-2 items-center">
        {OPS.map(o => <button key={o} className={`chip text-base ${op === o ? "chip-on" : ""}`} onClick={() => { setOp(o); neu(o); }}>{o}</button>)}
        <span className="text-sm ml-3">Stufe</span>
        {([1, 2, 3] as const).map(s => <button key={s} className={`chip ${stufe === s ? "chip-on" : ""}`} onClick={() => { setStufe(s); neu(op, s); }}>{s}</button>)}
        {stand.g > 0 && <span className="text-sm font-bold ml-3">{stand.r} / {stand.g} richtig</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-2xl">
        <BruchSatz z={auf.a.z} n={auf.a.n} /> <span className="font-black">{op}</span> <BruchSatz z={auf.b.z} n={auf.b.n} /> <span>=</span>
        <input className="input w-28 text-lg" value={antwort} onChange={e => setAntwort(e.target.value)} onKeyDown={e => { if (e.key === "Enter") pruefe(); }} aria-label="Deine Antwort" />
        <button className="btn-primary" onClick={pruefe}>Prüfen</button>
        <button className="btn-secondary" onClick={() => setWeg(w => !w)}>Rechenweg</button>
        <button className="btn-secondary" onClick={() => neu()}>Neue Aufgabe</button>
      </div>
      {rueck && <p className={`font-bold ${rueck.ok ? "text-ok" : "text-bad"}`}>{rueck.ok ? "✔ " : "✘ "}{rueck.text}</p>}
      {weg && <ol className="list-decimal pl-5 text-sm">{loesung.schritte.map(s => <li key={s}><Rechenzeile text={s} /></li>)}</ol>}
    </section>
  );
}

export default function Rechnen() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {REGELN.map(r => (
          <div key={r.op} className="card p-3 flex flex-col gap-1">
            <h3 className="font-black"><span className="text-accent text-xl">{r.op}</span> {r.titel}</h3>
            <p className="text-sm">{r.regel}</p>
            <p className="text-sm"><Rechenzeile text={r.beispiel} /></p>
          </div>
        ))}
      </div>
      <Rechner />
      <Ueben />
    </div>
  );
}
