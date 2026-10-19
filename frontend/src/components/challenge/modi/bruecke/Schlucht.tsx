"use client";
/** Seitenansicht: eine Brücke aus Segmenten (bis zu drei Schluchten hintereinander), die Kamera folgt der aktiven Brücke, ein Karren fährt zur Testfahrt vom Ufer bis zum letzten geprüften Segment. */
import { memo, useEffect, useRef, useState } from "react";
import { wenigerBewegung } from "@/lib/challenge/bewegung";
import { BODEN_Y, bruch, bruckeX, durchhang, HOEHE, kameraX, karren, SEG, segmentOrt, segmentX, SICHT, UFER, ueberfahrt, weltBreite, type Ausgang, type Material } from "@/lib/challenge/brueckeSpiel";

/** teile = Material je gelegtem Fakt (Reihenfolge des Legens). */
export type Luecke = { id: string; teile: Material[]; fertig: boolean };
/** ueber: die Brücke ist danach fertig, der Karren fährt bis aufs andere Ufer. */
export type Fahrt = { idx: number; art: Ausgang; teile: Material[]; ueber?: boolean };
const HOLZ = ["#c28a4a", "#a8733a"];

/** Ein Bauteil zwischen (xa, ya) und (xb, yb) im Aussehen seines Materials. */
function Bauteil({ m, xa, ya, xb, yb, i, tf }: { m: Material; xa: number; ya: number; xb: number; yb: number; i: number; tf?: string }) {
  if (m === "stein") {
    return <path d={`M${xa} ${ya - 0.9} L${xb} ${yb - 0.9} L${xb} ${yb + 1.6} L${xa} ${ya + 1.6} Z`} fill={i % 2 ? "#a3a3a3" : "#8f8f8f"} stroke="#5f5f5f" strokeWidth={0.2} transform={tf} />;
  }
  if (m === "stahl") {
    const xm = (xa + xb) / 2, ym = (ya + yb) / 2;
    return (
      <g transform={tf}>
        <line x1={xa} y1={ya} x2={xb} y2={yb} stroke="#6c7a89" strokeWidth={1.6} />
        <path d={`M${xa} ${ya + 0.8} L${xm} ${ym + 2.2} L${xb} ${yb + 0.8}`} fill="none" stroke="#4b5866" strokeWidth={0.35} />
        <circle cx={xm} cy={ym} r={0.25} fill="#c9d3dd" />
      </g>
    );
  }
  if (m === "seil" || m === "stahlseil") {
    const farbe = m === "seil" ? "#c9a66b" : "#a9bccf";
    const xm = (xa + xb) / 2;
    return (
      <g transform={tf}>
        <line x1={xa} y1={ya} x2={xb} y2={yb} stroke={farbe} strokeWidth={m === "seil" ? 1 : 0.8} strokeDasharray={m === "seil" ? "0.7 0.25" : undefined} />
        <line x1={xm} y1={(ya + yb) / 2} x2={xm} y2={BODEN_Y - 3.4} stroke={farbe} strokeWidth={0.22} />
      </g>
    );
  }
  return <line x1={xa} y1={ya} x2={xb} y2={yb} stroke={HOLZ[i % 2]} strokeWidth={2} transform={tf} />;
}

function Deck({ x0, teile, art, p, fest, pb = 0.5 }: { x0: number; teile: Material[]; art?: Ausgang; p?: number; fest?: boolean; pb?: number }) {
  const liste: Material[] = teile.length ? teile : ["holz"];
  const n = liste.length;
  const sag = art && p !== undefined ? durchhang(art, p) : 0;
  const y = (u: number) => BODEN_Y + sag * Math.sin(Math.PI * u);
  const seile = liste.some((m) => m === "seil" || m === "stahlseil");
  return (
    <g>
      {seile && <line x1={x0} y1={BODEN_Y - 3.4} x2={x0 + SEG} y2={BODEN_Y - 3.4} stroke="#8d99a6" strokeWidth={0.3} />}
      {liste.map((m, i) => {
        const u0 = i / n, u1 = (i + 1) / n;
        const q = art === "bricht" && p !== undefined && p > pb ? ((p - pb) / (1 - pb)) * 0.5 : 0;
        const mx = x0 + ((u0 + u1) / 2) * SEG, my = y((u0 + u1) / 2);
        const tf = q ? `translate(0 ${q * q * 140 * (1 + i * 0.25)}) rotate(${(i % 2 ? 1 : -1) * q * 120} ${mx} ${my})` : undefined;
        return <Bauteil key={i} m={m} xa={x0 + u0 * SEG} ya={y(u0)} xb={x0 + u1 * SEG} yb={y(u1)} i={i} tf={tf} />;
      })}
      {fest && <g stroke="#6d4c41" strokeWidth={0.3}><line x1={x0} y1={BODEN_Y - 3} x2={x0 + SEG} y2={BODEN_Y - 3} /><line x1={x0 + SEG / 2} y1={BODEN_Y - 3} x2={x0 + SEG / 2} y2={BODEN_Y - 1} /></g>}
    </g>
  );
}

/** Ufer, Inseln und alle ruhenden Segmente; ändert sich während der Fahrt nicht (nur das fahrende Segment fehlt). */
const Statisch = memo(function Statisch({ luecken, teile, laeuftIdx }: { luecken: Luecke[]; teile: number[]; laeuftIdx: number }) {
  return (
    <>
      <rect x={0} y={BODEN_Y + 8} width={weltBreite(teile)} height={HOEHE} fill="#2b3a55" />
      {teile.flatMap((t, b) => {
        const x0 = bruckeX(b, teile), x1 = x0 + t * SEG;
        return [x0 - UFER, x1].map((x) => (
          <g key={`${b}-${x}`}>
            <rect x={x} y={BODEN_Y} width={UFER} height={HOEHE - BODEN_Y} fill="#7b5a3a" />
            <rect x={x} y={BODEN_Y} width={UFER} height={2} fill="#4f9d3d" />
          </g>
        ));
      })}
      {luecken.map((l, i) => {
        const x0 = segmentX(i, teile);
        const laeuft = laeuftIdx === i;
        return (
          <g key={l.id}>
            {!laeuft && l.fertig && <Deck x0={x0} teile={l.teile.length ? l.teile : ["holz", "holz", "holz"]} fest />}
            {!laeuft && !l.fertig && l.teile.length > 0 && <Deck x0={x0} teile={l.teile} />}
            {!l.fertig && !laeuft && l.teile.length === 0 && <line x1={x0} y1={BODEN_Y} x2={x0 + SEG} y2={BODEN_Y} stroke="#fff" strokeWidth={0.4} strokeDasharray="1 1" />}
          </g>
        );
      })}
    </>
  );
});

export default function Schlucht({ luecken, teile, aktiv, fahrt, onEnde }: { luecken: Luecke[]; teile: number[]; aktiv: number; fahrt: Fahrt | null; onEnde(): void }) {
  const W = weltBreite(teile);
  const [p, setP] = useState(0);
  const ende = useRef(onEnde);
  ende.current = onEnde;

  useEffect(() => {
    if (!fahrt) { setP(0); return; }
    // Bei reduzierter Bewegung keine Fahrt: gleich am Ziel, die Textmeldung genügt
    if (wenigerBewegung()) { setP(1); const t = setTimeout(() => ende.current(), 0); return () => clearTimeout(t); }
    const dauer = 3200;
    let id = 0, alt = performance.now(), ver = 0;
    const f = (t: number) => {
      if (!document.hidden) ver += t - alt;
      alt = t;
      const q = Math.min(1, ver / dauer);
      setP(q);
      if (q >= 1) { ende.current(); return; }
      id = requestAnimationFrame(f);
    };
    id = requestAnimationFrame(f);
    return () => cancelAnimationFrame(id);
  }, [fahrt]);

  const cur = fahrt ? fahrt.idx : aktiv;
  const ort = segmentOrt(cur, teile);
  const cam = kameraX(ort.bruecke, teile);
  const x0 = bruckeX(ort.bruecke, teile);
  const len = fahrt?.ueber ? ueberfahrt(ort.bruecke, teile) : (ort.segment + 1) * SEG;
  const k = fahrt ? karren(fahrt.art, p, len) : { x: -6, fall: 0, schirm: false };
  const kx = x0 + k.x;
  const u = Math.min(1, Math.max(0, (k.x - ort.segment * SEG) / SEG)); // auf dem fahrenden Segment (dahinter: Ufer, kein Durchhang)
  const ky = BODEN_Y - 2.6 + k.fall + (fahrt && !k.fall ? durchhang(fahrt.art, p) * Math.sin(Math.PI * u) : 0);

  return (
    <div className="relative w-full max-w-[720px] mx-auto overflow-hidden rounded-lg" style={{ aspectRatio: `${SICHT}/${HOEHE}`, background: "#bfe3f5" }} role="img" aria-label="Brücke über die Schlucht">
      <svg viewBox={`0 0 ${W} ${HOEHE}`} style={{ width: `${(W / SICHT) * 100}%`, position: "absolute", left: 0, top: 0, transform: `translateX(-${(cam / W) * 100}%)`, transition: wenigerBewegung() ? "none" : "transform 0.9s ease-in-out" }}>
        <Statisch luecken={luecken} teile={teile} laeuftIdx={fahrt ? fahrt.idx : -1} />
        {fahrt && <Deck x0={segmentX(fahrt.idx, teile)} teile={fahrt.teile} art={fahrt.art} p={p} pb={bruch(len)} />}
        <g transform={`translate(${kx} ${ky})`}>
          {k.schirm && <g><path d="M-3.5 -1 Q0 -7.5 3.5 -1 Z" fill="#e74c3c" /><line x1={-3.4} y1={-1} x2={-1} y2={1} stroke="#444" strokeWidth={0.2} /><line x1={3.4} y1={-1} x2={1} y2={1} stroke="#444" strokeWidth={0.2} /></g>}
          <rect x={-2.2} y={0} width={4.4} height={1.8} fill="#6d4c41" rx={0.3} />
          <circle cx={-1.3} cy={2} r={0.7} fill="#222" /><circle cx={1.3} cy={2} r={0.7} fill="#222" />
          <circle cx={0} cy={-0.7} r={0.8} fill="#f1c27d" />
        </g>
      </svg>
    </div>
  );
}
