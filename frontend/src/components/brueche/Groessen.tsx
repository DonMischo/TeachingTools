"use client";
/**
 * Bruchteile von Größen: »3/4 von 200 g« als Streifen — erst durch den Nenner
 * teilen (ein Teil), dann mit dem Zähler malnehmen. Rückwärts: vom Teil aufs
 * Ganze. Darunter gewürfelte Sachaufgaben.
 */
import { useState } from "react";
import { bruchteilAufgabe, bruchteilWeg, bt, type Bruch } from "@/lib/brueche";
import { BruchSatz, Rechenzeile } from "./bild";

const de = (x: number) => x.toLocaleString("de-DE", { maximumFractionDigits: 3 });
const EINHEITEN = ["g", "kg", "€", "min", "m", "ℓ", "Kinder"];

/** Streifen mit n Feldern, jedes beschriftet mit seinem Anteil an der Größe */
function Streifen({ b, ganz, einheit, zeigeWerte }: { b: Bruch; ganz: number; einheit: string; zeigeWerte: boolean }) {
  const W = 600, H = 70, w = W / b.n;
  return (
    <svg viewBox={`-2 -24 ${W + 4} ${H + 52}`} className="w-full max-w-2xl" role="img" aria-label={`${bt(b)} von ${de(ganz)} ${einheit}`}>
      {Array.from({ length: b.n }, (_, i) => (
        <g key={i}>
          <rect x={i * w} y={0} width={w} height={H} fill={i < b.z ? "#f59e0b" : "var(--color-surface)"} stroke="var(--color-fg)" strokeWidth={2} />
          {zeigeWerte && <text x={i * w + w / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(18, w / 4)} fontWeight={700}
            fill={i < b.z ? "#1c1917" : "var(--color-muted)"}>{de(ganz / b.n)}</text>}
        </g>
      ))}
      <text x={W / 2} y={-8} textAnchor="middle" fontSize={16} fontWeight={800} fill="var(--color-fg)">das Ganze: {de(ganz)} {einheit}</text>
      <path d={`M 0 ${H + 8} v 8 H ${b.z * w} v -8`} fill="none" stroke="#b45309" strokeWidth={2.5} />
      <text x={(b.z * w) / 2} y={H + 26} textAnchor="middle" fontSize={15} fontWeight={800} fill="#b45309">{bt(b)} = {zeigeWerte ? `${de((ganz / b.n) * b.z)} ${einheit}` : "?"}</text>
    </svg>
  );
}

export default function Groessen() {
  const [z, setZ] = useState(3);
  const [n, setN] = useState(4);
  const [ganz, setGanz] = useState(200);
  const [einheit, setEinheit] = useState("g");
  const [schritt, setSchritt] = useState(0);
  const b = { z, n };
  const weg = bruchteilWeg(b, { wert: ganz, einheit, ding: "" });

  const [rueck, setRueck] = useState(false);
  const [auf, setAuf] = useState(() => bruchteilAufgabe(Math.random, false));
  const [antwort, setAntwort] = useState("");
  const [ergebnis, setErgebnis] = useState<null | boolean>(null);
  const [zeigeWeg, setZeigeWeg] = useState(false);
  const [stand, setStand] = useState({ r: 0, g: 0 });
  const neu = (r = rueck) => { setAuf(bruchteilAufgabe(Math.random, r)); setAntwort(""); setErgebnis(null); setZeigeWeg(false); };
  const pruefe = () => {
    const x = Number(antwort.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(x) || antwort.trim() === "") return;
    const ok = Math.abs(x - auf.loesung) < 0.005;
    if (ergebnis === null) setStand(s => ({ r: s.r + (ok ? 1 : 0), g: s.g + 1 }));
    setErgebnis(ok);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">⚖️ Bruchteil einer Größe — erst teilen, dann malnehmen</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-muted">Zähler<input type="number" className="input w-20" min={1} max={n} value={z} onChange={e => { setZ(Math.max(1, Math.min(n, Number(e.target.value) || 1))); setSchritt(0); }} /></label>
          <label className="flex flex-col text-xs text-muted">Nenner<input type="number" className="input w-20" min={2} max={12} value={n} onChange={e => { const v = Math.max(2, Math.min(12, Number(e.target.value) || 2)); setN(v); setZ(Math.min(z, v)); setSchritt(0); }} /></label>
          <span className="text-lg font-bold pb-2">von</span>
          <label className="flex flex-col text-xs text-muted">Größe<input type="number" className="input w-28" min={1} value={ganz} onChange={e => { setGanz(Math.max(1, Number(e.target.value) || 1)); setSchritt(0); }} /></label>
          <label className="flex flex-col text-xs text-muted">Einheit
            <select className="input w-28" value={einheit} onChange={e => setEinheit(e.target.value)}>{EINHEITEN.map(e => <option key={e}>{e}</option>)}</select>
          </label>
        </div>
        <Streifen b={b} ganz={ganz} einheit={einheit} zeigeWerte={schritt >= 1} />
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          {weg.schritte.slice(0, schritt).map(s => <li key={s}><Rechenzeile text={s} /></li>)}
        </ol>
        <div className="flex gap-2">
          {schritt < 2 ? <button className="btn-primary" onClick={() => setSchritt(schritt + 1)}>{schritt === 0 ? "1. Durch den Nenner teilen" : "2. Mit dem Zähler malnehmen"}</button>
            : <p className="text-lg font-black"><BruchSatz z={z} n={n} /> von {de(ganz)} {einheit} = {de(weg.teil)} {einheit}</p>}
          {schritt > 0 && <button className="btn-secondary" onClick={() => setSchritt(0)}>Von vorn</button>}
        </div>
        {einheit === "Kinder" && !Number.isInteger(ganz / n) && <p className="text-sm text-bad">Hm — {de(ganz)} Kinder lassen sich nicht in {n} gleich große Gruppen teilen.</p>}
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">✍️ Sachaufgaben</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <button className={`chip ${!rueck ? "chip-on" : ""}`} onClick={() => { setRueck(false); neu(false); }}>Teil gesucht</button>
          <button className={`chip ${rueck ? "chip-on" : ""}`} onClick={() => { setRueck(true); neu(true); }}>Ganzes gesucht (rückwärts)</button>
          {stand.g > 0 && <span className="text-sm font-bold ml-3">{stand.r} / {stand.g} richtig</span>}
        </div>
        <p className="text-lg"><Rechenzeile text={auf.frage} /></p>
        <div className="flex flex-wrap gap-2 items-center">
          <input className="input w-32" value={antwort} onChange={e => setAntwort(e.target.value)} onKeyDown={e => { if (e.key === "Enter") pruefe(); }} aria-label="Antwort" />
          <span className="font-bold">{auf.ganzes.einheit}</span>
          <button className="btn-primary" onClick={pruefe}>Prüfen</button>
          <button className="btn-secondary" onClick={() => setZeigeWeg(w => !w)}>Rechenweg</button>
          <button className="btn-secondary" onClick={() => neu()}>Neue Aufgabe</button>
        </div>
        {ergebnis !== null && <p className={`font-bold ${ergebnis ? "text-ok" : "text-bad"}`}>{ergebnis ? "✔ Richtig!" : "✘ Noch nicht."}</p>}
        {zeigeWeg && <ol className="list-decimal pl-5 text-sm">{auf.schritte.map(s => <li key={s}><Rechenzeile text={s} /></li>)}</ol>}
      </section>
    </div>
  );
}
