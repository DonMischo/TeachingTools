"use client";
/**
 * Übungen: gewürfelte Systeme (drei Stufen) und Sachaufgaben mit echten Preisen.
 * Jede Aufgabe lässt sich im Verfahren-Blatt Schritt für Schritt lösen.
 */
import { useState } from "react";
import { leseTerm, loeseSystem, qWert, sachaufgabe, wuerfleSystem } from "@/lib/lgs";
import { GleichungSatz } from "./teile";
import type { System } from "./Verfahren";

const zahl = (t: string) => { const v = leseTerm(t); return v && v.x.z === 0 && v.y.z === 0 ? qWert(v.k) : null; };
const de = (x: number) => x.toLocaleString("de-DE", { maximumFractionDigits: 2 });

export default function Ueben({ oeffnen }: { oeffnen: (s: System) => void }) {
  const [art, setArt] = useState<"rechnen" | "sach">("rechnen");
  const [stufe, setStufe] = useState<1 | 2 | 3>(1);
  const [auf, setAuf] = useState(() => wuerfleSystem(Math.random, 1));
  const [sach, setSach] = useState(() => sachaufgabe());
  const [ex, setEx] = useState(""), [ey, setEy] = useState("");
  const [rueck, setRueck] = useState<null | boolean>(null);
  const [ansatz, setAnsatz] = useState(false);
  const [stand, setStand] = useState({ r: 0, g: 0 });
  const neu = (a = art, s = stufe) => {
    if (a === "rechnen") setAuf(wuerfleSystem(Math.random, s)); else setSach(sachaufgabe());
    setEx(""); setEy(""); setRueck(null); setAnsatz(false);
  };
  const sys: System = art === "rechnen" ? { g1: auf.g1, g2: auf.g2 } : { g1: sach.g1, g2: sach.g2 };
  const pruefe = () => {
    const x = zahl(ex.replace(/€/g, "")), y = zahl(ey.replace(/€/g, ""));
    if (x === null || y === null) return;
    const l = loeseSystem(sys.g1, sys.g2);
    const ok = l.art === "eine" && Math.abs(qWert(l.x) - x) < 0.005 && Math.abs(qWert(l.y) - y) < 0.005;
    if (rueck === null) setStand(s => ({ r: s.r + (ok ? 1 : 0), g: s.g + 1 }));
    setRueck(ok);
  };
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button className={`chip ${art === "rechnen" ? "chip-on" : ""}`} onClick={() => { setArt("rechnen"); neu("rechnen"); }}>Systeme lösen</button>
        <button className={`chip ${art === "sach" ? "chip-on" : ""}`} onClick={() => { setArt("sach"); neu("sach"); }}>Sachaufgaben</button>
        {art === "rechnen" && <>
          <span className="text-sm ml-3">Stufe</span>
          {([1, 2, 3] as const).map(s => <button key={s} className={`chip ${stufe === s ? "chip-on" : ""}`} onClick={() => { setStufe(s); neu("rechnen", s); }}>{s}</button>)}
        </>}
        {stand.g > 0 && <span className="text-sm font-bold ml-3">{stand.r} / {stand.g} richtig</span>}
      </div>

      {art === "rechnen" ? (
        <div className="flex flex-col gap-1">
          <span>I: <GleichungSatz g={auf.g1} gross /></span>
          <span>II: <GleichungSatz g={auf.g2} gross /></span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <h3 className="font-black">{sach.kontext.titel}</h3>
          {sach.text.map(t => <p key={t}>{t}</p>)}
          <p className="font-bold">Gesucht: der Preis für {sach.kontext.x} (x) und für {sach.kontext.y} (y).</p>
          <button className="btn-secondary self-start" onClick={() => setAnsatz(a => !a)}>{ansatz ? "Ansatz verbergen" : "💡 Ansatz zeigen"}</button>
          {ansatz && (
            <div className="text-sm rounded-lg bg-page p-2">
              <p>x = Preis für {sach.kontext.x}, y = Preis für {sach.kontext.y} (in €)</p>
              <p>I: <GleichungSatz g={sach.g1} /> &nbsp; II: <GleichungSatz g={sach.g2} /></p>
            </div>
          )}
          <p className="text-xs text-muted">Preise: {sach.kontext.quelle}.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">x =<input className="input w-24" value={ex} onChange={e => setEx(e.target.value)} aria-label="x" /></label>
        <label className="flex items-center gap-1">y =<input className="input w-24" value={ey} onChange={e => setEy(e.target.value)} onKeyDown={e => { if (e.key === "Enter") pruefe(); }} aria-label="y" /></label>
        <button className="btn-primary" onClick={pruefe}>Prüfen</button>
        <button className="btn-secondary" onClick={() => oeffnen(sys)}>Schritt für Schritt lösen →</button>
        <button className="btn-secondary" onClick={() => neu()}>Neue Aufgabe</button>
      </div>
      {rueck !== null && <p className={`font-bold ${rueck ? "text-ok" : "text-bad"}`}>{rueck ? "✔ Richtig!" : "✘ Noch nicht — setz deine Werte zur Probe in beide Gleichungen ein."}</p>}
      {rueck && art === "sach" && <p className="text-sm">{sach.kontext.x}: {de(sach.x)} €, {sach.kontext.y}: {de(sach.y)} €.</p>}
      <p className="text-xs text-muted">Brüche als 3/2 oder Dezimalzahl mit Komma eingeben.</p>
    </div>
  );
}
