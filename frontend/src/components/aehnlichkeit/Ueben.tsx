"use client";
/** Übungen zu Streckfaktor, ähnlichen Dreiecken, Fläche und Maßstab — mit Rechenweg. */
import { useState } from "react";
import { aufgabe, AUFGABEN_ARTEN, type AufgabenArt } from "@/lib/aehnlichkeit";

export default function Ueben() {
  const [art, setArt] = useState<AufgabenArt>("faktor");
  const [a, setA] = useState(() => aufgabe("faktor"));
  const [eingabe, setEingabe] = useState("");
  const [ok, setOk] = useState<null | boolean>(null);
  const [weg, setWeg] = useState(false);
  const [stand, setStand] = useState({ r: 0, g: 0 });
  const neu = (x: AufgabenArt = art) => { setA(aufgabe(x)); setEingabe(""); setOk(null); setWeg(false); };
  const pruefe = () => {
    const t = eingabe.replace(/\s/g, "");
    // 25.000 = Tausenderpunkt, 2,5 und 2.5 = Komma
    const v = Number(/,/.test(t) ? t.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t);
    if (!eingabe.trim() || !Number.isFinite(v)) return;
    const r = Math.abs(v - a.loesung) <= Math.max(0.01, Math.abs(a.loesung) * 0.01);
    if (ok === null) setStand(s => ({ r: s.r + (r ? 1 : 0), g: s.g + 1 }));
    setOk(r);
  };
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5 items-center">
        {AUFGABEN_ARTEN.map(x => <button key={x.id} className={`chip ${art === x.id ? "chip-on" : ""}`} onClick={() => { setArt(x.id); neu(x.id); }}>{x.label}</button>)}
        {stand.g > 0 && <span className="text-sm font-bold ml-3">{stand.r} / {stand.g} richtig</span>}
      </div>
      <p className="text-lg">{a.frage}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-36" value={eingabe} onChange={e => setEingabe(e.target.value)} onKeyDown={e => { if (e.key === "Enter") pruefe(); }} aria-label="Antwort" />
        {a.einheit && <span className="font-bold">{a.einheit}</span>}
        <button className="btn-primary" onClick={pruefe}>Prüfen</button>
        <button className="btn-secondary" onClick={() => setWeg(w => !w)}>Rechenweg</button>
        <button className="btn-secondary" onClick={() => neu()}>Neue Aufgabe</button>
      </div>
      {ok !== null && <p className={`font-bold ${ok ? "text-ok" : "text-bad"}`}>{ok ? "✔ Richtig!" : "✘ Noch nicht."}</p>}
      {weg && <ol className="list-decimal pl-5 text-sm">{a.weg.map(s => <li key={s}>{s}</li>)}</ol>}
    </div>
  );
}
