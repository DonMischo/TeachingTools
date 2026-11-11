"use client";
/**
 * Overheadprojektor: auf die Folie schreiben, Bild an der Wand scharf stellen,
 * Abdeckblatt, Lampe mit Lüfter und eine Fliege, die zum Monster wird.
 */
import { useEffect, useRef, useState } from "react";
import { fsk, rauschen } from "./ton";
import { useErprobt } from "@/lib/medien/erprobt";

const B = 300, H = 210;
const FARBEN = [{ n: "Schwarz", w: "#111111" }, { n: "Rot", w: "#d62828" }, { n: "Blau", w: "#1d4ed8" }, { n: "Grün", w: "#15803d" }];
const SCHARF_BEI = 62;
type Strich = { pts: [number, number][]; farbe: string; dicke: number; perm: boolean };

function zeichne(c: HTMLCanvasElement | null, striche: Strich[]) {
  const ctx = c?.getContext?.("2d");
  if (!c || !ctx) return;
  ctx.clearRect(0, 0, B, H);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const s of striche) {
    ctx.strokeStyle = s.farbe; ctx.lineWidth = s.dicke;
    ctx.beginPath();
    s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
    ctx.stroke();
  }
}

export function OverheadDemo() {
  const erprobt = useErprobt();
  const folie = useRef<HTMLCanvasElement>(null);
  const wand = useRef<HTMLCanvasElement>(null);
  const [striche, setStriche] = useState<Strich[]>([]);
  const aktiv = useRef<Strich | null>(null);
  const [farbe, setFarbe] = useState(FARBEN[0].w);
  const [dick, setDick] = useState(false);
  const [perm, setPerm] = useState(false);
  const [lampe, setLampe] = useState(false);
  const [fokus, setFokus] = useState(50);
  const [deck, setDeck] = useState(0);
  const [fliege, setFliege] = useState<number | null>(null);
  const [meldung, setMeldung] = useState("");
  const fertig = useRef(false);

  useEffect(() => { setFokus(() => { const d = 25 + Math.random() * 13; return SCHARF_BEI + (Math.random() < 0.5 ? -d : d); }); }, []);
  useEffect(() => { zeichne(folie.current, striche); zeichne(wand.current, striche); }, [striche]);

  const unscharf = Math.abs(fokus - SCHARF_BEI);
  const scharf = unscharf <= 4;
  const schaerfe = Math.max(0, Math.round(100 - unscharf * 2.5));

  useEffect(() => {
    if (!fertig.current && striche.length > 0 && lampe && scharf) { fertig.current = true; erprobt("overhead"); }
  }, [striche, lampe, scharf, erprobt]);

  // Lüfter
  useEffect(() => {
    if (!lampe) return;
    rauschen(1, 0, 0.02, { freq: 200 });
    const t = setInterval(() => rauschen(1, 0, 0.02, { freq: 200 }), 900);
    return () => clearInterval(t);
  }, [lampe]);

  // Fliege läuft über das Glas
  useEffect(() => {
    if (fliege === null) return;
    if (fliege >= 100) { setFliege(null); return; }
    const t = setTimeout(() => { setFliege(f => (f === null ? null : f + 4)); if (fliege % 20 === 0) fsk([280, 330], 0.25, 0, 60, 0.05, "sawtooth"); }, 120);
    return () => clearTimeout(t);
  }, [fliege]);
  useEffect(() => {
    const t = setTimeout(() => setFliege(f => (f === null ? 0 : f)), 20000 + Math.random() * 15000);
    return () => clearTimeout(t);
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / (r.width || B)) * B, ((e.clientY - r.top) / (r.height || H)) * H];
  };
  const runter = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* jsdom */ }
    aktiv.current = { pts: [pos(e)], farbe: farbe, dicke: dick ? 6 : 2, perm };
    setStriche(s => [...s, aktiv.current!]);
  };
  const bewegt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const a = aktiv.current;
    if (!a) return;
    a.pts.push(pos(e));
    setStriche(s => [...s]);
  };
  const hoch = () => { aktiv.current = null; };

  const wegwischen = () => {
    if (striche.some(s => s.perm)) setMeldung("Der Permanent-Marker lässt sich nicht wegwischen. Das war ein Spaß, der bleibt. Für immer.");
    else setMeldung("");
    setStriche(s => s.filter(x => x.perm));
  };

  const fliegeRufen = () => { if (fliege === null) { setFliege(0); fsk([280, 330], 0.4, 0, 60, 0.06, "sawtooth"); } };
  const unterkante = 100 - deck;

  return (
    <div className="card space-y-3 p-3">
      <p className="font-semibold">🔦 Overheadprojektor</p>
      <p className="text-sm text-muted">Schreib etwas auf die Folie, schalte die Lampe an und dreh den Fokus, bis die Wand scharf ist.</p>
      <div className="grid gap-3 md:grid-cols-[2fr_3fr]">
        <div className="space-y-2">
          <div className="relative rounded border border-line bg-surface p-2" style={{ background: "#9fd6e8" }}>
            <canvas ref={folie} width={B} height={H} aria-label="Folie" className="w-full touch-none rounded bg-white/60" onPointerDown={runter} onPointerMove={bewegt} onPointerUp={hoch} onPointerLeave={hoch} />
            {fliege !== null && <span className="pointer-events-none absolute top-1/2 text-lg" style={{ left: `${fliege}%` }}>🪰</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {FARBEN.map(f => <button key={f.w} aria-label={f.n} onClick={() => setFarbe(f.w)} className={`h-7 w-7 rounded-full border-2 ${farbe === f.w ? "border-ok" : "border-line"}`} style={{ background: f.w }} />)}
            <button className={dick ? "chip" : "chip chip-on"} onClick={() => setDick(false)}>fein</button>
            <button className={dick ? "chip chip-on" : "chip"} onClick={() => setDick(true)}>dick</button>
          </div>
          <div className="flex flex-wrap gap-1">
            <button className={perm ? "chip" : "chip chip-on"} onClick={() => setPerm(false)}>wasserlöslich</button>
            <button className={perm ? "chip chip-on" : "chip"} onClick={() => setPerm(true)}>permanent</button>
            <button className="btn-secondary" onClick={wegwischen}>wegwischen</button>
          </div>
          <label className="block text-sm">Fokus
            <input type="range" min={0} max={100} value={Math.round(fokus)} onChange={e => setFokus(Number(e.target.value))} className="w-full" aria-label="Fokus" />
          </label>
          <p className="text-xs text-muted">Schärfe: {schaerfe} % {scharf ? "✔ scharf" : ""}</p>
          <div className="h-1.5 rounded bg-surface-hover"><div className="h-full rounded bg-ok" style={{ width: `${schaerfe}%` }} /></div>
          <div className="flex flex-wrap gap-2">
            <button className={lampe ? "btn-primary" : "btn-secondary"} onClick={() => setLampe(l => !l)}>{lampe ? "💡 Lampe aus" : "💡 Lampe an"}</button>
            <button className="btn-secondary" onClick={fliegeRufen}>🪰 Fliege</button>
          </div>
          <label className="block text-sm">Abdeckblatt
            <input type="range" min={0} max={100} value={deck} onChange={e => setDeck(Number(e.target.value))} className="w-full" aria-label="Abdeckblatt" />
          </label>
        </div>

        <div className="relative overflow-hidden rounded border border-line" style={{ background: lampe ? "#f4f1e6" : "#1b1b1b", minHeight: 200 }}>
          <div style={{ transform: "perspective(500px) rotateX(6deg)", filter: `blur(${(unscharf / 6).toFixed(1)}px)`, opacity: lampe ? 1 : 0, transition: "opacity .3s" }}>
            <canvas ref={wand} width={B} height={H} aria-label="Wandprojektion" className="w-full" />
            <div className="absolute inset-x-0 bottom-0 bg-black" style={{ height: `${unterkante}%`, top: "auto", display: deck > 0 ? "block" : "none" }} />
          </div>
          {lampe && fliege !== null && (
            <div className="pointer-events-none absolute inset-0 flex items-center" style={{ filter: "blur(3px) grayscale(1) contrast(5)" }}>
              <span className="text-8xl" style={{ marginLeft: `${Math.min(fliege, 80)}%`, opacity: 0.7 }}>🪰</span>
            </div>
          )}
          {lampe && fliege !== null && <p className="absolute inset-x-0 bottom-1 text-center text-sm font-semibold text-bad">Godzilla-Fliege greift die Klasse an!</p>}
          {!lampe && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">Lampe aus. Die Wand ist dunkel.</p>}
        </div>
      </div>
      {meldung && <p className="text-sm text-muted">{meldung}</p>}
    </div>
  );
}
