"use client";
/** Seitenansicht der Schlucht: mehrere Lücken hintereinander, die Kamera fährt zur aktiven Lücke, ein Karren fährt zur Testfahrt. */
import { useEffect, useRef, useState } from "react";
import { BODEN_Y, durchhang, HOEHE, kameraX, karren, LUECKE, lueckeX, SICHT, UFER, weltBreite, type Ausgang } from "@/lib/challenge/brueckeSpiel";

export type Luecke = { id: string; bretter: number; fertig: boolean };
export type Fahrt = { idx: number; art: Ausgang; bretter: number };
const reduziert = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
const HOLZ = ["#c28a4a", "#a8733a"];

function Deck({ x0, bretter, art, p }: { x0: number; bretter: number; art?: Ausgang; p?: number }) {
  const n = Math.max(1, bretter);
  const sag = art && p !== undefined ? durchhang(art, p) : 0;
  const y = (u: number) => BODEN_Y + sag * Math.sin(Math.PI * u);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const u0 = i / n, u1 = (i + 1) / n;
        const q = art === "bricht" && p !== undefined && p > 0.5 ? p - 0.5 : 0;
        const mx = x0 + ((u0 + u1) / 2) * LUECKE, my = y((u0 + u1) / 2);
        const tf = q ? `translate(0 ${q * q * 140 * (1 + i * 0.25)}) rotate(${(i % 2 ? 1 : -1) * q * 120} ${mx} ${my})` : undefined;
        return <line key={i} x1={x0 + u0 * LUECKE} y1={y(u0)} x2={x0 + u1 * LUECKE} y2={y(u1)} stroke={HOLZ[i % 2]} strokeWidth={2} transform={tf} />;
      })}
    </g>
  );
}

export default function Schlucht({ luecken, aktiv, fahrt, onEnde }: { luecken: Luecke[]; aktiv: number; fahrt: Fahrt | null; onEnde(): void }) {
  const n = luecken.length;
  const W = weltBreite(n);
  const [p, setP] = useState(0);
  const ende = useRef(onEnde);
  ende.current = onEnde;

  useEffect(() => {
    if (!fahrt) { setP(0); return; }
    const dauer = reduziert() ? 400 : 3200;
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

  const cam = kameraX(fahrt ? fahrt.idx : aktiv, n);
  const k = fahrt ? karren(fahrt.art, p) : { x: -6, fall: 0, schirm: false };
  const kx = lueckeX(fahrt ? fahrt.idx : aktiv) + k.x;
  const u = Math.min(1, Math.max(0, k.x / LUECKE));
  const ky = BODEN_Y - 2.6 + k.fall + (fahrt && !k.fall ? durchhang(fahrt.art, p) * Math.sin(Math.PI * u) : 0);

  return (
    <div className="relative w-full max-w-[720px] mx-auto overflow-hidden rounded-lg" style={{ aspectRatio: `${SICHT}/${HOEHE}`, background: "#bfe3f5" }} role="img" aria-label="Schlucht mit Lücken">
      <svg viewBox={`0 0 ${W} ${HOEHE}`} style={{ width: `${(W / SICHT) * 100}%`, position: "absolute", left: 0, top: 0, transform: `translateX(-${(cam / W) * 100}%)`, transition: reduziert() ? "none" : "transform 0.9s ease-in-out" }}>
        <rect x={0} y={BODEN_Y + 8} width={W} height={HOEHE} fill="#2b3a55" />
        {Array.from({ length: n + 1 }, (_, i) => {
          const x = i === 0 ? 0 : lueckeX(i - 1) + LUECKE;
          return (
            <g key={i}>
              <rect x={x} y={BODEN_Y} width={UFER} height={HOEHE - BODEN_Y} fill="#7b5a3a" />
              <rect x={x} y={BODEN_Y} width={UFER} height={2} fill="#4f9d3d" />
            </g>
          );
        })}
        {luecken.map((l, i) => {
          const x0 = lueckeX(i);
          const laeuft = fahrt?.idx === i;
          return (
            <g key={l.id}>
              <circle cx={x0} cy={BODEN_Y} r={0.8} fill="#ddd" /><circle cx={x0 + LUECKE} cy={BODEN_Y} r={0.8} fill="#ddd" />
              {laeuft ? <Deck x0={x0} bretter={fahrt.bretter} art={fahrt.art} p={p} />
                : (l.fertig || l.bretter > 0) && <Deck x0={x0} bretter={l.bretter} />}
              {!l.fertig && !laeuft && l.bretter === 0 && <line x1={x0} y1={BODEN_Y} x2={x0 + LUECKE} y2={BODEN_Y} stroke="#fff" strokeWidth={0.4} strokeDasharray="1.5 1.5" />}
            </g>
          );
        })}
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
